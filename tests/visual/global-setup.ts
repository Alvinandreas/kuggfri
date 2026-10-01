/**
 * Körs en gång före det visuella testet, efter att produktionsbygget startat (webServer):
 * 1. Kontrollerar att lokala Supabase svarar.
 * 2. Skapar teststudenten och testexaminatorn med fast progress (data.ts).
 * 3. Loggar in de tre rollerna en gång och sparar sessionerna i tests/visual/.state/, så att
 *    testerna inte loggar in hundratals gånger (Supabase begränsar inloggningar per IP).
 */
import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { ADMIN, AUTH_FILE, EXAMINER, FIXTURE_FILE, STATE_DIR, STUDENT, SUPABASE_URL, seedVisualData } from "./data";

export default async function globalSetup(config: FullConfig) {
  let healthy = false;
  try {
    healthy = (await fetch(`${SUPABASE_URL}/auth/v1/health`, { signal: AbortSignal.timeout(5000) })).ok;
  } catch {
    healthy = false;
  }
  if (!healthy) throw new Error(`Supabase svarar inte på ${SUPABASE_URL}. Starta den lokala stacken ("npm run db:start") först.`);

  mkdirSync(STATE_DIR, { recursive: true });
  const fixture = await seedVisualData();
  writeFileSync(FIXTURE_FILE, JSON.stringify(fixture, null, 2));

  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("baseURL saknas i playwright.visual.config.ts.");
  const browser = await chromium.launch();
  try {
    for (const [role, user] of [
      ["student", STUDENT],
      ["admin", ADMIN],
      ["examiner", EXAMINER],
    ] as const) {
      const context = await browser.newContext({ baseURL, locale: "sv-SE", timezoneId: "Europe/Stockholm" });
      const page = await context.newPage();
      await page.goto("/logga-in?next=%2Fhem");
      await page.getByLabel("E-postadress").fill(user.email);
      await page.locator('input[name="password"]').fill(user.password);
      await page.getByTestId("login-submit").click();
      await page.waitForURL((url) => !url.pathname.startsWith("/logga-in"), { timeout: 30_000 });
      await context.storageState({ path: AUTH_FILE[role] });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
