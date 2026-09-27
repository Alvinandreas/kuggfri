import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

/** Standardnycklarna som lokala Supabase CLI använder. Skriv över med env om de skiljer sig (se `supabase status`). */
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const ADMIN_USER = { email: "admin@kuggfri.test", password: "admin-losenord-123" };

export const DECK_SLUG = "materialteknik";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@kuggfri.test`;
}

/** Inga allvarliga eller kritiska tillgänglighetsfel på sidan. */
export async function expectNoSeriousA11yViolations(page: Page) {
  // Block tonar in (anim-fade-up, förskjutet per block). Mitt i intoningen är texten halvt
  // genomskinlig och axe mäter för låg kontrast; spola fram så att det färdiga läget mäts.
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html) })), null, 2)).toEqual([]);
}

/** Startar en session från deckets sida med valt läge och urval. */
export async function startSession(page: Page, mode: "fsrs" | "free" | "random", selection = "all") {
  await page.goto(`/d/${DECK_SLUG}/plugga?mode=${mode}&urval=${encodeURIComponent(selection)}`);
  await expect(page.getByTestId("flashcard")).toBeVisible();
}

/** Vänder aktuellt kort och skattar det. */
export async function rateCurrentCard(page: Page, rating: 1 | 2 | 3 | 4 | 5) {
  const card = page.getByTestId("flashcard");
  const before = await card.getAttribute("data-card-id");
  await page.getByTestId("flip").click();
  await expect(card).toHaveAttribute("data-flipped", "true");
  await page.getByTestId(`rate-${rating}`).click();
  // Vänta tills nästa kort visas (eller sammanfattningen).
  await expect
    .poll(async () => {
      if (await page.getByTestId("session-summary").isVisible()) return "summary";
      return page.getByTestId("flashcard").getAttribute("data-card-id");
    })
    .not.toBe(before);
}

export async function studyCards(page: Page, mode: "fsrs" | "free" | "random", count: number, rating: 1 | 2 | 3 | 4 | 5 = 4) {
  await startSession(page, mode);
  for (let i = 0; i < count; i++) {
    await rateCurrentCard(page, rating);
  }
}

export async function readLocalProgress(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("kuggfri:progress:v1");
    return raw ? (JSON.parse(raw).cards as Record<string, unknown>) : {};
  });
}

export const STUDENT_PASSWORD = "testlosenord-123";

export async function register(page: Page, email: string, password: string, next = "/hem", name = "E2E Testare") {
  await page.goto(`/registrera?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Namn").fill(name);
  await page.getByLabel("E-postadress").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByTestId("register-submit").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/registrera"), { timeout: 20_000 });
}

/** Ny student med eget konto; konto krävs för att plugga. Returnerar e-postadressen. */
export async function registerStudent(page: Page, prefix = "student", next = "/hem"): Promise<string> {
  const email = uniqueEmail(prefix);
  await register(page, email, STUDENT_PASSWORD, next);
  return email;
}

/** Loggar ut via profilmenyn (sidomenyn på desktop, toppfältet på mobil) och landar på startsidan. */
export async function logout(page: Page) {
  if (!/\/(hem|kurser|konto|d\/|admin|om|integritet)/.test(page.url())) await page.goto("/hem");
  await page.getByTestId("profile-menu").filter({ visible: true }).first().click();
  await page.getByRole("menuitem", { name: "Logga ut" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });
  await expect(page.getByTestId("register-submit")).toBeVisible();
}

type StoredProgress = { card_id: string; due: string; self_rating: number | null; reps: number };

/** Kontots progress direkt ur databasen (service role, bara i testerna). */
export async function accountProgress(email: string): Promise<Record<string, StoredProgress>> {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const id = users?.users.find((u) => u.email === email)?.id;
  if (!id) throw new Error(`Hittade inte ${email}`);
  const { data, error } = await admin.from("card_progress").select("card_id, due, self_rating, reps").eq("user_id", id);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.card_id, r as StoredProgress]));
}

export async function login(page: Page, email: string, password: string, next = "/hem") {
  await page.goto(`/logga-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-postadress").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/logga-in"), { timeout: 20_000 });
}

export async function seenCountText(page: Page): Promise<string | null> {
  await page.goto(`/d/${DECK_SLUG}`);
  const seen = page.getByTestId("seen-count");
  if (await seen.isVisible({ timeout: 5000 }).catch(() => false)) return seen.textContent();
  return null;
}

/** Senaste mejlet till adressen i Mailpit (lokala Supabase-stacken), som klartext. */
export async function latestMailText(email: string, timeoutMs = 20_000): Promise<string> {
  const base = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = (await (await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${base}/api/v1/message/${id}`)).json()) as { Text?: string; HTML?: string };
      return msg.HTML || msg.Text || "";
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Inget mejl till ${email} inom ${timeoutMs} ms`);
}
