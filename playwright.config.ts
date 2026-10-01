import { defineConfig, devices } from "@playwright/test";

// Egen port och eget produktionsbygge (som det visuella testet): stabilare än dev-servern, som
// kompilerar varje sida vid första anropet och gav timeouts och avbrutna navigeringar i långa
// körningar, och närmare det studenterna kör. Krockar inte med dev-servrar på 3000/3005.
const PORT = 3020;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  // Generösa väntetider: testerna delar en lokal databas och gör många skrivningar.
  expect: { timeout: 15_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  // Tar bort kurserna testerna skapat (e2e-…, "E2E …"), även efter fallerade tester.
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "sv-SE",
  },
  projects: [
    {
      name: "mobile",
      // Rena admintester utan något mobilspecifikt (taggade @desktop) körs bara i desktop.
      grepInvert: /@desktop/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: baseURL,
    env: { NEXT_DIST_DIR: ".next-e2e", NEXT_TELEMETRY_DISABLED: "1" },
    // E2E_REUSE_SERVER=1 återanvänder en redan startad server på porten (snabbare omkörningar).
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
