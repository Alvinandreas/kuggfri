import { defineConfig, devices } from "@playwright/test";

/**
 * Visuellt regressionstest (tests/visual/README.md): referensbilder av hela tjänsten, tagna mot
 * ett eget produktionsbygge på port 3010 (NEXT_DIST_DIR=.next-visual), så att körningen varken
 * stör dev-servern på 3005 eller kopian på 3001. Fyra projekt: desktop och mobil, ljust och mörkt.
 *
 *   npm run test:visual          jämför mot referensbilderna i tests/visual/__screenshots__/
 *   npm run test:visual:update   tar nya referensbilder (bara när en ändring är avsiktlig)
 *
 * VISUAL_REUSE_SERVER=1 återanvänder en server som redan kör på 3010 i stället för att bygga om.
 */

const PORT = 3010;
const baseURL = `http://localhost:${PORT}`;

const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const mobile = { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: "tests/visual",
  testMatch: "*.spec.ts",
  outputDir: "test-results/visual",
  // Referensbilderna per projekt och testfil, med namnen testerna ger dem.
  snapshotPathTemplate: "tests/visual/__screenshots__/{projectName}/{testFileName}/{arg}{ext}",
  fullyParallel: true,
  workers: process.env.VISUAL_WORKERS ? Number(process.env.VISUAL_WORKERS) : 2,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/visual", open: "never" }]],
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      // Toleransen (tests/visual/README.md, "Tolerans"): inga pixlar får skilja (maxDiffPixels 0),
      // men varje pixel får avvika lite i färg (threshold 0,05 i pixelmatchs YIQ-skala, där 0 är
      // exakt och 1 allt). Uppmätt brus mellan körningar: upp till ~200 pixlar med färgskillnad
      // under 0,05 (kantutjämning, oskärpa bakom dialoger); med 0,05 blir alla körningar gröna.
      // En andel (maxDiffPixelRatio 0,001) hade på en 1440 × 3200-bild släppt igenom 4 600 pixlar,
      // alltså en ändrad siffra eller ett ändrat ord. Båda går att skriva över för felsökning.
      maxDiffPixels: process.env.VISUAL_MAX_DIFF_PIXELS ? Number(process.env.VISUAL_MAX_DIFF_PIXELS) : 0,
      threshold: process.env.VISUAL_THRESHOLD ? Number(process.env.VISUAL_THRESHOLD) : 0.05,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  globalSetup: "./tests/visual/global-setup.ts",
  globalTeardown: "./tests/visual/global-teardown.ts",
  use: {
    baseURL,
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
    trace: "retain-on-failure",
    // Inga tjänstearbetare: allt ska hämtas från servern vid varje körning.
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop-ljus", use: { ...desktop, colorScheme: "light" } },
    { name: "desktop-mork", use: { ...desktop, colorScheme: "dark" } },
    { name: "mobil-ljus", use: { ...mobile, colorScheme: "light" } },
    { name: "mobil-mork", use: { ...mobile, colorScheme: "dark" } },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: baseURL,
    env: { NEXT_DIST_DIR: ".next-visual", NEXT_TELEMETRY_DISABLED: "1" },
    reuseExistingServer: process.env.VISUAL_REUSE_SERVER === "1",
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
