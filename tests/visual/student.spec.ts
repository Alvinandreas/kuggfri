/**
 * Student (visual-student@kuggfri.test, fast progress ur data.ts): hemsidan med radarn och dess
 * dialoger, Min statistik, kurssidan med varje läge i Ditt pass, ett pass från framsida till
 * sammanfattning, kontot och tentalägets låsta vy.
 */
import type { Page } from "@playwright/test";
import { AUTH_FILE, DECK_SLUG } from "./data";
import { blockProgressWrites, expect, isMobile, open, openMobileMenu, shot, test } from "./fixtures";

test.use({ storageState: AUTH_FILE.student });

const COURSE = `/d/${DECK_SLUG}`;

/** Hemsidan och statistiken visar inget förrän progressen laddats från kontot. */
async function openWithProgress(page: Page, url: string, ready: string) {
  await open(page, url);
  await expect(page.getByTestId(ready)).toBeVisible();
}

test.describe("student", () => {
  test("hem", async ({ page }) => {
    await openWithProgress(page, "/hem", "home-radar");
    await shot(page, "hem");
  });

  test("hem: områdesdialogen från radarn", async ({ page, fx }) => {
    await openWithProgress(page, "/hem", "home-radar");
    await page.getByTestId("home-radar").getByRole("button", { name: `Öppna ${fx.firstCategory.title}` }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, "hem-omradesdialog", { fullPage: false });
  });

  test("hem: kluriga kort och duggan", async ({ page }) => {
    await openWithProgress(page, "/hem", "home-radar");
    await page.getByTestId("home-tricky").click();
    await expect(page.getByTestId("tricky-dialog")).toBeVisible();
    await shot(page, "hem-kluriga-dialog", { fullPage: false });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("tricky-dialog")).toBeHidden();
    await page.getByTestId("home-dugga").click();
    await expect(page.getByTestId("dugga-dialog")).toBeVisible();
    await shot(page, "hem-dugga-dialog", { fullPage: false });
  });

  test("min statistik", async ({ page }) => {
    await openWithProgress(page, "/statistik", "mystats-tiles");
    await shot(page, "statistik");
  });

  test("kurser", async ({ page }) => {
    await open(page, "/kurser");
    await shot(page, "kurser");
  });

  test("kurssidan", async ({ page }) => {
    await openWithProgress(page, COURSE, "mode-picker");
    await shot(page, "kurssida");
  });

  // Varje läge i Ditt pass, med lägets inställningar. Schemalagd repetition är förvald.
  const MODES: readonly [file: string, title: string][] = [
    ["schemalagd", "Schemalagd repetition"],
    ["kluriga", "Kluriga kort"],
    ["fri", "Fri repetition"],
    ["slumpad", "Slumpad genomkörning"],
    ["dugga", "Dugga"],
    ["stjarnmarkta", "Stjärnmärkta"],
  ];
  for (const [file, title] of MODES) {
    test(`kurssidan: läget ${title}`, async ({ page }) => {
      await openWithProgress(page, COURSE, "mode-picker");
      await page.getByRole("radio", { name: title }).check();
      const panel = page.getByRole("region", { name: "Ditt pass" });
      await expect(panel.getByText(title, { exact: true })).toBeVisible();
      await expect(panel.getByTestId("session-settings")).toBeVisible();
      await shot(page, `kurssida-lage-${file}`, { element: panel });
    });
  }

  test("kurssidan: stjärnmärkta korten", async ({ page }) => {
    await openWithProgress(page, COURSE, "mode-picker");
    await page.getByRole("radio", { name: "Stjärnmärkta" }).check();
    await page.getByTestId("show-starred").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, "kurssida-stjarnmarkta-dialog", { fullPage: false });
  });

  test("pass: självskattning från framsida till sammanfattning", async ({ page, fx }) => {
    await blockProgressWrites(page);
    await open(page, `${COURSE}/plugga?mode=free&urval=kategori:${fx.selfRatingArea.id}&ordning=kurs`);
    const card = page.getByTestId("flashcard");
    await expect(card).toBeVisible();
    await shot(page, "pass-framsida");

    await page.getByTestId("flip").click();
    await expect(card).toHaveAttribute("data-flipped", "true");
    await shot(page, "pass-baksida");

    // Skatta alla kort i området (skrivningarna stoppas) för att nå sammanfattningen.
    // Skattningen räknas bara när kortet vänts klart; klickas den för tidigt försöker vi igen,
    // men aldrig på nästa kort (då blev fördelningen i sammanfattningen en annan).
    const current = async () => ((await page.getByTestId("session-summary").isVisible()) ? "summary" : await card.getAttribute("data-card-id"));
    for (let i = 0; i < fx.selfRatingArea.cards; i++) {
      const before = await current();
      if (before === "summary") break;
      await expect(async () => {
        if ((await current()) !== before) return;
        if ((await card.getAttribute("data-flipped")) !== "true") {
          await page.getByTestId("flip").click();
          await expect(card).toHaveAttribute("data-flipped", "true", { timeout: 3_000 });
        }
        await page.getByTestId(`rate-${(i % 4) + 2}`).click();
        await expect.poll(current, { timeout: 3_000 }).not.toBe(before);
      }).toPass({ timeout: 30_000 });
    }
    await expect(page.getByTestId("session-summary")).toBeVisible();
    await shot(page, "pass-sammanfattning");
  });

  test("pass: begreppskort", async ({ page, fx }) => {
    await blockProgressWrites(page);
    await open(page, `${COURSE}/plugga?mode=free&urval=kategori:${fx.conceptArea.id}&ordning=kurs`);
    const card = page.getByTestId("flashcard");
    await expect(card).toBeVisible();
    await shot(page, "pass-begrepp-framsida");
    await page.getByTestId("flip").click();
    await expect(card).toHaveAttribute("data-flipped", "true");
    await shot(page, "pass-begrepp-baksida");
  });

  test("konto", async ({ page }) => {
    await open(page, "/konto");
    await shot(page, "konto");
  });

  test("tentaläget (låst)", async ({ page }) => {
    await open(page, `${COURSE}/tenta`);
    await expect(page.getByTestId("exam-mode-locked")).toBeVisible();
    await shot(page, "tentalage-last");
  });

  test("mobilmenyn", async ({ page }) => {
    test.skip(!isMobile(page), "Sidomenyn syns redan i varje desktopbild.");
    await openWithProgress(page, "/hem", "home-radar");
    await openMobileMenu(page);
    await shot(page, "mobilmeny", { fullPage: false });
  });
});
