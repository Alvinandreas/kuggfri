/**
 * Körs en gång före E2E-testerna (efter att webbservern startat).
 * - Kontrollerar att lokala Supabase svarar (annars tydligt fel).
 * - Skapar admin-testanvändaren om den saknas och sätter is_admin = true
 *   via service role-nyckeln (bara här, aldrig i appen).
 * - Loggar in admin en gång via formuläret och sparar sessionen i ADMIN_STATE, som
 *   admintesterna återanvänder med loginAsAdmin() i stället för att logga in var för sig.
 */
import { chromium, type FullConfig } from "@playwright/test";
import { ADMIN_STATE, ADMIN_USER, login, serviceClient, SUPABASE_URL } from "./helpers";

export default async function globalSetup(config: FullConfig) {
  // Mot produktion (E2E_BASE_URL satt) skapas inga testkonton: kör bara public.spec.ts.
  if (process.env.E2E_SKIP_SETUP === "1") return;
  let healthy = false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { signal: AbortSignal.timeout(5000) });
    healthy = res.ok;
  } catch {
    healthy = false;
  }
  if (!healthy) {
    throw new Error(
      `Supabase svarar inte på ${SUPABASE_URL}. Kör "supabase start" (kräver Docker) och "npm run db:reset" innan E2E-testerna.`,
    );
  }

  const admin = serviceClient();

  // Skapa admin-användaren (ignorera om den redan finns).
  const { data: created, error } = await admin.auth.admin.createUser({
    email: ADMIN_USER.email,
    password: ADMIN_USER.password,
    email_confirm: true,
    // Skript och tester skapar konton förbi deltagarlistornas spärr (se migrationen deltagarlistor).
    app_metadata: { kuggfri_skapad_av: "skript" },
  });
  let userId = created?.user?.id ?? null;
  if (error && !/already|exists|registered/i.test(error.message)) {
    throw new Error(`Kunde inte skapa admin-testanvändare: ${error.message}`);
  }
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email === ADMIN_USER.email)?.id ?? null;
  }
  if (!userId) throw new Error("Hittade inte admin-testanvändaren.");

  const { error: updateError } = await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
  if (updateError) throw new Error(`Kunde inte sätta is_admin: ${updateError.message}`);

  // Adminens session, en gång för hela körningen.
  const use = config.projects[0]?.use ?? {};
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: use.baseURL, locale: use.locale });
    const page = await context.newPage();
    // Första kompileringen av sidorna i dev-läge kan ta en stund.
    page.setDefaultTimeout(60_000);
    await login(page, ADMIN_USER.email, ADMIN_USER.password, "/admin", 60_000);
    await context.storageState({ path: ADMIN_STATE });
  } finally {
    await browser.close();
  }
}
