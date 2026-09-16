// Skärmdumpar av demoflödet som reserv om nätet strular i morgon.
// Gäst/mobil mot produktion (kuggfri.com), admin/desktop mot testkopian på :3001 (lokalt adminkonto).
const { chromium, devices } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const OUT = path.resolve(process.argv[2] || "docs/demo-skarmdumpar");
fs.mkdirSync(OUT, { recursive: true });
const PROD = "https://kuggfri.com";
const LOCAL = "http://localhost:3001";
let n = 0;
const shot = async (page, name, opts = {}) => {
  n++;
  if (!opts.fullPage) await page.evaluate(() => window.scrollTo(0, 0));
  const file = path.join(OUT, `${String(n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, ...opts });
  console.log("skrev", path.basename(file));
};

(async () => {
  const browser = await chromium.launch();

  // --- Gäst i mobilen ---
  const mctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "sv-SE" });
  const m = await mctx.newPage();
  await m.goto(`${PROD}/`, { waitUntil: "networkidle" });
  await shot(m, "mobil-start");
  await m.goto(`${PROD}/d/materialteknik`, { waitUntil: "networkidle" });
  await shot(m, "mobil-deck-oversikt", { fullPage: true });

  // Plugga några kort så att progress finns, sedan dumpar av kortet.
  await m.goto(`${PROD}/d/materialteknik/plugga?mode=fsrs&urval=all`, { waitUntil: "networkidle" });
  await m.getByTestId("flashcard").waitFor();
  await shot(m, "mobil-kort-framsida");
  await m.getByTestId("flip").click();
  await m.waitForTimeout(700);
  await shot(m, "mobil-kort-baksida");
  await m.getByTestId("rate-4").click();
  await m.waitForTimeout(350);
  await shot(m, "mobil-kort-stampel");
  await m.waitForTimeout(1200);
  for (const r of [2, 5, 3, 4, 1, 4, 5, 3, 4, 4]) {
    await m.getByTestId("flip").click();
    await m.waitForTimeout(250);
    await m.getByTestId(`rate-${r}`).click();
    await m.waitForTimeout(1300);
  }
  // Felrapport-dialogen
  await m.getByTestId("report-open").click();
  await m.getByTestId("report-message").fill("Enheten på Fe₃C-halten ser fel ut, borde det vara viktprocent?");
  await shot(m, "mobil-rapportera-fel");
  await m.keyboard.press("Escape");

  await m.goto(`${PROD}/d/materialteknik`, { waitUntil: "networkidle" });
  await m.waitForTimeout(800);
  await shot(m, "mobil-deck-med-progress", { fullPage: true });
  await m.goto(`${PROD}/d/materialteknik/plugga?mode=tricky&urval=all`, { waitUntil: "networkidle" });
  await m.getByTestId("flashcard").waitFor();
  await shot(m, "mobil-kluriga-kort");
  await m.goto(`${PROD}/om`, { waitUntil: "networkidle" });
  await shot(m, "mobil-om", { fullPage: true });
  await mctx.close();

  // --- Admin på laptop (lokal testkopia, lokalt adminkonto) ---
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: "sv-SE" });
  const d = await dctx.newPage();
  await d.goto(`${LOCAL}/logga-in?next=%2Fadmin`, { waitUntil: "networkidle" });
  await d.getByLabel("E-postadress").fill("admin@kuggfri.test");
  await d.locator('input[name="password"]').fill("admin-losenord-123");
  await d.getByTestId("login-submit").click();
  await d.waitForURL(/\/admin$/);
  await d.waitForTimeout(500);
  await shot(d, "admin-decklista");
  await d.getByTestId("admin-deck-list").getByRole("link", { name: "Materialteknik", exact: true }).click();
  await d.waitForURL(/\/admin\/deck\//);
  await d.waitForTimeout(500);
  const deckUrl = d.url();
  await shot(d, "admin-deck");
  await d.getByTestId("admin-card-front").first().click();
  await d.waitForURL(/\/kort\//);
  await d.waitForTimeout(800);
  await shot(d, "admin-kortredigerare", { fullPage: true });
  await d.goto(`${deckUrl}/import`, { waitUntil: "networkidle" });
  await shot(d, "admin-import");
  await d.goto(`${deckUrl}/statistik`, { waitUntil: "networkidle" });
  await shot(d, "admin-statistik", { fullPage: true });
  await d.goto(`${deckUrl}/rapporter`, { waitUntil: "networkidle" });
  await shot(d, "admin-felrapporter", { fullPage: true });
  await d.goto(`${LOCAL}/konto`, { waitUntil: "networkidle" });
  await shot(d, "konto", { fullPage: true });
  await dctx.close();

  // Desktop-gäst: deckets tvåkolumnslayout
  const gctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: "sv-SE" });
  const g = await gctx.newPage();
  await g.goto(`${PROD}/d/materialteknik`, { waitUntil: "networkidle" });
  await shot(g, "desktop-deck", { fullPage: true });
  await gctx.close();

  await browser.close();
  console.log(`${n} skärmdumpar i ${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
