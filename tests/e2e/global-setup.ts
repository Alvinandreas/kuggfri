/**
 * Körs en gång före E2E-testerna.
 * - Kontrollerar att lokala Supabase svarar (annars tydligt fel).
 * - Skapar admin-testanvändaren om den saknas och sätter is_admin = true
 *   via service role-nyckeln (bara här, aldrig i appen).
 */
import { createClient } from "@supabase/supabase-js";
import { ADMIN_USER, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./helpers";

export default async function globalSetup() {
  // Mot produktion (E2E_BASE_URL satt) skapas inga testkonton: kör bara gästtesterna.
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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Skapa admin-användaren (ignorera om den redan finns).
  const { data: created, error } = await admin.auth.admin.createUser({
    email: ADMIN_USER.email,
    password: ADMIN_USER.password,
    email_confirm: true,
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
}
