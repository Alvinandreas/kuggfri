import { expect, test } from "@playwright/test";
import {
  DECK_SLUG,
  accountProgress,
  expectNoSeriousA11yViolations,
  rateCurrentCard,
  registerStudent,
  seenCountText,
  startSession,
  studyCards,
} from "./helpers";

// Konto krävs för att plugga (Kuggfri 2.0): varje test får en ny student, så att
// progressen alltid börjar från noll och testerna inte påverkar varandra.
let email = "";
test.beforeEach(async ({ page }) => {
  email = await registerStudent(page, "plugg");
});

/** Väntar tills antalet kort med progress i databasen är n (skrivningarna går asynkront). */
async function expectStoredCount(n: number) {
  await expect.poll(async () => Object.keys(await accountProgress(email)).length, { timeout: 15_000 }).toBe(n);
}

test.describe("plugga", () => {
  test("1. pluggar tio kort, laddar om sidan, progressen finns kvar", async ({ page }) => {
    await page.goto(`/d/${DECK_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Materialteknik");
    await expectNoSeriousA11yViolations(page);

    await page.getByTestId("start-session").click();
    await expect(page.getByTestId("flashcard")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    for (let i = 0; i < 10; i++) {
      await rateCurrentCard(page, i % 2 === 0 ? 4 : 5);
    }
    await expectStoredCount(10);

    await page.reload();
    const seen = await seenCountText(page);
    expect(seen).toContain("10 av");
  });

  test("4. fri repetition ändrar inte nästa schemalagda datum", async ({ page }) => {
    // Schemalägg ett par kort först.
    await studyCards(page, "fsrs", 2, 5);
    await expectStoredCount(2);
    const before = await accountProgress(email);

    // Fri repetition med låga skattningar över flera kort, inklusive de schemalagda.
    await startSession(page, "free", "all");
    for (let i = 0; i < 5; i++) {
      await rateCurrentCard(page, 1);
    }
    await expect(page.getByTestId("session-summary").or(page.getByTestId("flashcard"))).toBeVisible();

    expect(await accountProgress(email)).toEqual(before);
  });

  test("slumpad genomkörning ändrar inte heller progressen", async ({ page }) => {
    await studyCards(page, "fsrs", 1, 3);
    await expectStoredCount(1);
    const before = await accountProgress(email);

    await startSession(page, "random");
    await rateCurrentCard(page, 2);
    await rateCurrentCard(page, 4);
    expect(await accountProgress(email)).toEqual(before);
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

test.describe("hemsidan", () => {
  test("ny student ser sitt första pass och kommer rakt in i det", async ({ page }) => {
    await page.goto("/hem");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E");
    await expect(page.getByTestId("home-lead")).toContainText("första pass");
    await expect(page.getByTestId("home-today")).toContainText("20 kort");
    await expect(page.getByTestId("home-knowledge")).toHaveText(/^0\s*%$/);
    await expectNoSeriousA11yViolations(page);

    // Fortsätt plugga leder till kurssidan, där dagens pass är förvalt.
    await page.getByTestId("home-start").click();
    await page.waitForURL(new RegExp(`/d/${DECK_SLUG}$`));
    await page.getByTestId("start-session").click();
    await expect(page.getByTestId("flashcard")).toBeVisible();
    await expect(page.getByTestId("remaining")).toHaveText("20 kort kvar");
  });

  test("ett område i radardiagrammet öppnas i en dialog och startar ett pass på bara det området", async ({ page }) => {
    await page.goto("/hem");
    await page.getByRole("button", { name: "Öppna Materialvalsprocessen" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Materialvalsprocessen" })).toBeVisible();
    await expect(dialog.getByTestId("focus-study")).toContainText("6 kort i dag");
    await expectNoSeriousA11yViolations(page);
    await dialog.getByTestId("focus-study").click();
    await expect(page.getByTestId("flashcard")).toBeVisible();
    await expect(page.getByTestId("remaining")).toHaveText("6 kort kvar");
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
    await expect(page.getByTestId("rate-4")).toHaveAttribute("aria-label", /om \d+ dagar|i morgon/);
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
    await expectStoredCount(20);
    await page.goto(`/d/${DECK_SLUG}`);
    await expect(page.getByTestId("start-info")).toHaveText("Klar för i dag");
    await expect(page.getByTestId("start-more")).toContainText("Ta 20 nya kort till");
    expect(await seenCountText(page)).toContain("20 av");
    await page.goto(`/d/${DECK_SLUG}`);

    // Hemsidan säger samma sak.
    await page.goto("/hem");
    await expect(page.getByTestId("home-today")).toContainText("Klart för i dag");
    await expect(page.getByTestId("home-lead")).toContainText("klar för i dag");

    await page.goto(`/d/${DECK_SLUG}`);
    await page.getByTestId("start-more").click();
    await expect(page.getByTestId("remaining")).toHaveText("20 kort kvar");
  });
});

test.describe("dugga", () => {
  test("slumpade kort ur en kategori, ingen tillbaka, resultat i procent, progressen orörd", async ({ page }) => {
    await page.goto(`/d/${DECK_SLUG}`);
    await page.getByLabel("Dugga").check();
    await expect(page.getByTestId("dugga-settings")).toBeVisible();
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
    expect(await accountProgress(email)).toEqual({});
    await expectNoSeriousA11yViolations(page);
  });
});
