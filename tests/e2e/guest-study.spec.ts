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
    // Välj fri repetition och en kategori via kryssrutan i kategorilistan.
    await page.getByLabel("Fri repetition").check();
    await page.getByTestId("category-row").filter({ hasText: "Materialvalsprocessen" }).getByRole("checkbox").check();
    await expect(page.getByTestId("selection-summary")).toContainText("Materialvalsprocessen");
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

test.describe("dosering", () => {
  test("första passet slutar efter dagsmålet med 'Klar för i dag' och erbjuder fler nya kort", async ({ page }) => {
    await page.goto(`/d/${DECK_SLUG}`);
    // Förstabesöksrutan och sessionsplanen: 20 nya kort, tidsuppskattning.
    await expect(page.getByTestId("first-visit")).toBeVisible();
    await expect(page.getByTestId("start-info")).toContainText("20 nya kort");
    await expect(page.getByTestId("start-info")).toContainText("cirka 5 min");

    await page.getByTestId("start-session").click();
    await expect(page.getByTestId("flashcard")).toBeVisible();
    await expect(page.getByTestId("remaining")).toHaveText("20 kort kvar");

    // Vänt kort visar intervall per skattning i schemalagt läge.
    await page.getByTestId("flip").click();
    await expect(page.getByTestId("rate-4")).toContainText(/om \d+ dagar|i morgon/);
    // Tillbaka till framsidan så att hjälpfunktionen kan vända själv.
    await page.getByTestId("flip").click();
    await expect(page.getByTestId("flashcard")).toHaveAttribute("data-flipped", "false");

    for (let i = 0; i < 20; i++) {
      if (await page.getByTestId("session-summary").isVisible()) break;
      await rateCurrentCard(page, i % 2 === 0 ? 4 : 5);
    }
    const summary = page.getByTestId("session-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAttribute("data-done", "true");
    await expect(summary.getByRole("heading", { level: 1 })).toHaveText("Klar för i dag");
    await expect(page.getByTestId("today-tiles")).toContainText("Dagar i rad");
    await expect(page.getByTestId("continue-new")).toContainText("Ta 20 nya kort till");
    await expectNoSeriousA11yViolations(page);

    // Deck-sidan: dagsmålet är nått, men fler nya kort kan tas frivilligt.
    await page.goto(`/d/${DECK_SLUG}`);
    await expect(page.getByTestId("start-info")).toHaveText("Klar för i dag");
    await expect(page.getByTestId("start-more")).toContainText("Ta 20 nya kort till");
    await expect(page.getByTestId("knowledge-now")).toContainText("baserat på 20 repeterade kort");
    await page.getByTestId("start-more").click();
    await expect(page.getByTestId("remaining")).toHaveText("20 kort kvar");
  });
});

test.describe("provtenta", () => {
  test("slumpade kort ur en kategori, ingen tillbaka, resultat i procent, progressen orörd", async ({ page }) => {
    await page.goto(`/d/${DECK_SLUG}`);
    await page.getByLabel("Provtenta").check();
    await page.getByTestId("category-row").filter({ hasText: "Materialvalsprocessen" }).getByRole("checkbox").check({ force: true });
    await expect(page.getByTestId("start-info")).toContainText("6 kort");
    await page.getByTestId("start-session").click();
    await expect(page.getByTestId("flashcard")).toBeVisible();
    await expect(page.getByTestId("remaining")).toHaveText("Fråga 1 av 6");
    await expect(page.getByTestId("prev")).toBeDisabled();
    for (let i = 0; i < 6; i++) {
      if (await page.getByTestId("session-summary").isVisible()) break;
      await rateCurrentCard(page, i < 4 ? 5 : 2);
    }
    await expect(page.getByTestId("session-summary")).toBeVisible();
    await expect(page.getByTestId("exam-result")).toContainText("4 av 6");
    await expect(page.getByTestId("exam-result")).toContainText("67 %");
    expect(await readLocalProgress(page)).toEqual({});
    await expectNoSeriousA11yViolations(page);
  });
});
