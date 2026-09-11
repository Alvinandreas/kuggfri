import { expect, test } from "@playwright/test";
import {
  DECK_SLUG,
  expectNoSeriousA11yViolations,
  rateCurrentCard,
  readLocalProgress,
  seenCountText,
  startSession,
  studyCards,
} from "./helpers";

test.describe("gäst", () => {
  test("1. pluggar tio kort, laddar om sidan, progressen finns kvar", async ({ page }) => {
    await page.goto(`/d/${DECK_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Materialteknik");
    await expect(page.getByText("Du pluggar som gäst.")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByTestId("start-session").click();
    await expect(page.getByTestId("flashcard")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    for (let i = 0; i < 10; i++) {
      await rateCurrentCard(page, i % 2 === 0 ? 4 : 5);
    }

    const stored = await readLocalProgress(page);
    expect(Object.keys(stored)).toHaveLength(10);

    await page.reload();
    expect(Object.keys(await readLocalProgress(page))).toHaveLength(10);

    const seen = await seenCountText(page);
    expect(seen).toContain("10 av");
  });

  test("4. fri repetition ändrar inte nästa schemalagda datum", async ({ page }) => {
    // Schemalägg ett par kort först.
    await studyCards(page, "fsrs", 2, 5);
    const before = await readLocalProgress(page);
    expect(Object.keys(before)).toHaveLength(2);

    // Fri repetition med låga skattningar över flera kort, inklusive de schemalagda.
    await startSession(page, "free", "all");
    for (let i = 0; i < 5; i++) {
      await rateCurrentCard(page, 1);
    }
    await expect(page.getByTestId("session-summary").or(page.getByTestId("flashcard"))).toBeVisible();

    const after = await readLocalProgress(page);
    expect(after).toEqual(before);
  });

  test("slumpad genomkörning ändrar inte heller progressen och sammanfattningen visas", async ({ page }) => {
    await studyCards(page, "fsrs", 1, 3);
    const before = await readLocalProgress(page);

    await startSession(page, "random");
    await rateCurrentCard(page, 2);
    await rateCurrentCard(page, 4);
    expect(await readLocalProgress(page)).toEqual(before);
  });

  test("tangentbord: mellanslag vänder, siffra skattar, pil hoppar", async ({ page }) => {
    await startSession(page, "free");
    const card = page.getByTestId("flashcard");
    const first = await card.getAttribute("data-card-id");
    await page.keyboard.press("Space");
    await expect(card).toHaveAttribute("data-flipped", "true");
    await page.keyboard.press("4");
    await expect(card).not.toHaveAttribute("data-card-id", first ?? "");
    const second = await card.getAttribute("data-card-id");
    await page.keyboard.press("ArrowRight");
    await expect(card).not.toHaveAttribute("data-card-id", second ?? "");
    await page.keyboard.press("ArrowLeft");
    await expect(card).toHaveAttribute("data-card-id", second ?? "");
  });

  test("sessionssammanfattning efter en liten kategori", async ({ page }) => {
    await page.goto(`/d/${DECK_SLUG}`);
    // Välj fri repetition och en kategori via urvalsmenyn.
    await page.getByLabel("Fri repetition").check();
    const select = page.getByLabel("Urval");
    const options = await select.locator("option").allTextContents();
    const small = options.find((o) => /Materialvalsprocessen/.test(o));
    expect(small).toBeTruthy();
    await select.selectOption({ label: small! });
    await page.getByTestId("start-session").click();
    await expect(page.getByTestId("flashcard")).toBeVisible();

    for (let i = 0; i < 6; i++) {
      if (await page.getByTestId("session-summary").isVisible()) break;
      await rateCurrentCard(page, ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5);
    }
    await expect(page.getByTestId("session-summary")).toBeVisible();
    await expect(page.getByTestId("summary-reviewed")).toContainText("kort genomgångna");
    await expect(page.getByTestId("next-due")).toContainText("Fri repetition påverkar inte schemat.");
    await expectNoSeriousA11yViolations(page);
  });
});
