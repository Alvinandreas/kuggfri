import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

/** Standardnycklarna som lokala Supabase CLI använder. Skriv över med env om de skiljer sig (se `supabase status`). */
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const ADMIN_USER = { email: "admin@plugget.test", password: "admin-losenord-123" };

export const DECK_SLUG = "materialteknik";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@plugget.test`;
}

/** Inga allvarliga eller kritiska tillgänglighetsfel på sidan. */
export async function expectNoSeriousA11yViolations(page: Page) {
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
    const raw = localStorage.getItem("plugget:progress:v1");
    return raw ? (JSON.parse(raw).cards as Record<string, unknown>) : {};
  });
}

export async function register(page: Page, email: string, password: string, next = "/") {
  await page.goto(`/registrera?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-postadress").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByTestId("register-submit").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/registrera"), { timeout: 20_000 });
}

export async function login(page: Page, email: string, password: string, next = "/") {
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
