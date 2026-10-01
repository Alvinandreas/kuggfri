import { expect, test } from "@playwright/test";
import {
  DECK_SLUG,
  accountProgress,
  serviceClient,
  currentCard,
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

/**
 * Ett litet område (färre kort än dagsdosen 20), så att ett pass på området går att göra klart.
 * Sedan 1 okt ligger alla kursens kort i rotation; det minsta området har 16 kort, varav några
 * rättas automatiskt.
 */
const SMALL_AREA = "Hållbarhet och återvinning";
const SMALL_AREA_CARDS = 16;

/**
 * Sätter studentens progress på alla områdets kort till skattning 4 med nästa repetition i morgon:
 * området är klart för i dag. (Ett automaträttat kort som testet besvarade fel hade annars kommit
 * tillbaka i dag, så testet gör det deterministiskt.)
 */
async function completeAreaInDb(area: string) {
  const admin = serviceClient();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const userId = users?.users.find((u) => u.email === email)?.id;
  if (!userId) throw new Error(`Hittade inte ${email}`);
  const { data: category } = await admin.from("categories").select("id").eq("title", area).single();
  const { data: cards } = await admin.from("cards").select("id").eq("category_id", category!.id).eq("is_active", true).is("review_status", null);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 36 * 3600_000);
  const rows = (cards ?? []).map((c) => ({
    user_id: userId,
    card_id: c.id,
    due: tomorrow.toISOString(),
    stability: 5,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 1,
    reps: 1,
    lapses: 0,
    state: 2,
    last_review: now.toISOString(),
    self_rating: 4,
  }));
  const { error } = await admin.from("card_progress").upsert(rows, { onConflict: "user_id,card_id" });
  if (error) throw error;
}

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
    await expect(currentCard(page)).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    for (let i = 0; i < 10; i++) {
      await rateCurrentCard(page, i % 2 === 0 ? 4 : 5);
    }
    await expectStoredCount(10);

    await page.reload();
    const seen = await seenCountText(page);
    expect(seen).toContain("10 av");
  });

  test("4. fri repetition räknas in i schemat (30 sep 2026)", async ({ page }) => {
    // Schemalägg ett par kort först.
    await studyCards(page, "fsrs", 2, 5);
    await expectStoredCount(2);
    const before = await accountProgress(email);

    // Fri repetition tar svagast först: fem aldrig sedda kort, före de två som fick 5. Bara
    // vändkort: ett automaträttat kort i det första passet kan ha rättats till 1 och kommit först.
    await startSession(page, "free", "all", "typer=vand");
    for (let i = 0; i < 5; i++) {
      await rateCurrentCard(page, 1);
    }
    // De fem korten är nu introducerade i schemat, precis som i schemalagd repetition.
    await expectStoredCount(7);
    const after = await accountProgress(email);
    for (const [id, p] of Object.entries(before)) expect(after[id]).toEqual(p);
    const fresh = Object.values(after).filter((p) => !(p.card_id in before));
    expect(fresh).toHaveLength(5);
    for (const p of fresh) {
      expect(p.reps).toBe(1);
      expect(p.self_rating).toBe(1);
    }
  });

  test("slumpad genomkörning räknas också in i schemat", async ({ page }) => {
    await studyCards(page, "fsrs", 1, 3);
    await expectStoredCount(1);
    const repsOf = async () => Object.values(await accountProgress(email)).reduce((sum, p) => sum + p.reps, 0);
    const before = await repsOf();

    await startSession(page, "random");
    await rateCurrentCard(page, 2);
    await rateCurrentCard(page, 4);
    // Varje skattning är en FSRS-repetition, oavsett läge.
    await expect.poll(repsOf, { timeout: 15_000 }).toBe(before + 2);
  });

  test("tangentbord: mellanslag vänder, siffra skattar, pil hoppar", async ({ page }) => {
    // Bara vändkort: det är vändningen och skattningen med tangenterna som testas.
    await startSession(page, "free", "all", "typer=vand");
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
    await page.getByTestId("category-row").filter({ hasText: SMALL_AREA }).getByRole("checkbox").check();
    await expect(page.getByTestId("selection-summary")).toContainText(SMALL_AREA);
    await page.getByTestId("start-session").click();
    await expect(currentCard(page)).toBeVisible();

    for (let i = 0; i < SMALL_AREA_CARDS; i++) {
      if (await page.getByTestId("session-summary").isVisible()) break;
      await rateCurrentCard(page, ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5);
    }
    await expect(page.getByTestId("session-summary")).toBeVisible();
    await expect(page.getByTestId("summary-reviewed")).toContainText("kort genomgångna");
    await expect(page.getByTestId("next-due")).toContainText("Fri repetition räknas in i schemat");
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
    await expect(currentCard(page)).toBeVisible();
    await expect(page.getByTestId("remaining")).toHaveText("20 kort kvar");
  });

  test("ett område i radardiagrammet öppnas i en dialog och startar ett pass på bara det området", async ({ page }) => {
    await page.goto("/hem");
    await page.getByRole("button", { name: `Öppna ${SMALL_AREA}` }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: SMALL_AREA })).toBeVisible();
    await expect(dialog.getByTestId("focus-study")).toContainText("Schemalagt plugg");
    await expect(dialog.getByTestId("focus-study")).toContainText(`${SMALL_AREA_CARDS} kort i dag`);
    await expectNoSeriousA11yViolations(page);
    await dialog.getByTestId("focus-study").click();
    await expect(currentCard(page)).toBeVisible();
    await expect(page.getByTestId("remaining")).toHaveText(`${SMALL_AREA_CARDS} kort kvar`);
  });

  test("grönt betyder klart: Schemalagt plugg och Kluriga kort lyser först när området är gjort", async ({ page }) => {
    const openArea = async () => {
      await page.goto("/hem");
      await page.getByRole("button", { name: `Öppna ${SMALL_AREA}` }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByTestId("focus-study")).toBeVisible();
      return dialog;
    };
    // Allt kvar: båda genvägarna är gråa (ingen grön yta).
    let dialog = await openArea();
    await expect(dialog.getByTestId("focus-study")).toContainText(`${SMALL_AREA_CARDS} kort i dag`);
    await expect(dialog.getByTestId("focus-study")).not.toHaveClass(/bg-accent-soft/);
    await expect(dialog.getByTestId("focus-tricky")).not.toHaveClass(/bg-accent-soft/);

    // Områdets schemalagda kort med skattning 4: inget kvar i dag och inga kluriga kort.
    await dialog.getByTestId("focus-study").click();
    for (let i = 0; i < SMALL_AREA_CARDS; i++) {
      if (await page.getByTestId("session-summary").isVisible()) break;
      await rateCurrentCard(page, 4);
    }
    await expect(page.getByTestId("session-summary")).toBeVisible();
    await completeAreaInDb(SMALL_AREA);

    dialog = await openArea();
    await expect(dialog.getByTestId("focus-study")).toContainText("Klart för i dag");
    await expect(dialog.getByTestId("focus-study")).toHaveClass(/bg-accent-soft/);
    await expect(dialog.getByTestId("focus-tricky")).toContainText("Inga kluriga kort kvar");
    await expect(dialog.getByTestId("focus-tricky")).toHaveClass(/bg-accent-soft/);
    await expectNoSeriousA11yViolations(page);
    // Knappen fungerar fortfarande: den startar Plugga vidare på området.
    await dialog.getByTestId("focus-study").click();
    await expect(page.getByTestId("session-banner")).toContainText("Plugga vidare");
  });
});

test.describe("inställningar för passet", () => {
  test("varje läge har egna inställningar som följer med in i passet och sparas", async ({ page }) => {
    await page.goto(`/d/${DECK_SLUG}`);
    // Schemalagt: Dagens är förvalt, 10 ger ett kortare pass.
    const settings = page.getByTestId("session-settings");
    await expect(settings).toHaveAttribute("data-mode", "fsrs");
    await expect(settings.getByRole("button", { name: /Dagens/ })).toHaveAttribute("aria-pressed", "true");
    await settings.getByTestId("settings-size").getByRole("button", { name: "10", exact: true }).click();
    await expect(page.getByTestId("start-info")).toContainText("10 nya kort");
    await page.getByTestId("start-session").click();
    await expect(page).toHaveURL(/antal=10/);
    await expect(page.getByTestId("remaining")).toHaveText("10 kort kvar");

    // Valet sparas per läge: tillbaka på kurssidan är 10 fortfarande valt för schemalagt,
    // medan fri repetition har sina egna val.
    await page.goto(`/d/${DECK_SLUG}`);
    await expect(settings.getByTestId("settings-size").getByRole("button", { name: "10", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Fri repetition").check();
    await expect(settings).toHaveAttribute("data-mode", "free");
    await expect(settings.getByTestId("settings-size").getByRole("button", { name: /Alla/ })).toHaveAttribute("aria-pressed", "true");
    await settings.getByTestId("settings-size").getByRole("button", { name: "20", exact: true }).click();
    await settings.getByTestId("settings-order").getByRole("button", { name: "Kursordning" }).click();
    await page.getByTestId("start-session").click();
    await expect(page).toHaveURL(/antal=20&ordning=kurs/);
    await expect(page.getByTestId("remaining")).toHaveText("20 kort kvar");

    // Kluriga kort: Svåraste först och osedda kort är reglage.
    await page.goto(`/d/${DECK_SLUG}`);
    await page.getByLabel("Kluriga kort").check();
    await expect(settings.getByRole("switch", { name: "Svåraste först" })).toHaveAttribute("aria-checked", "true");
    await expect(settings.getByRole("switch", { name: "Ta med osedda kort" })).toHaveAttribute("aria-checked", "true");
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
    await expect(currentCard(page)).toBeVisible();
    await expect(page.getByTestId("remaining")).toHaveText("20 kort kvar");

    // Vänt kort visar intervall per skattning i schemalagt läge. Automaträttade kort först i kön
    // besvaras tills ett vändkort kommer.
    for (let i = 0; i < 5 && (await page.getByTestId("quizcard").isVisible()); i++) await rateCurrentCard(page, 4);
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
    // Man hindras aldrig från att plugga: Plugga vidare och fler nya kort erbjuds direkt.
    await expect(page.getByTestId("extra-offer")).toContainText("räknas in i schemat");
    await expect(page.getByTestId("continue-extra")).toHaveText(/Plugga vidare/);
    await expect(page.getByTestId("continue-new")).toContainText("Ta 20 nya kort till");
    await expectNoSeriousA11yViolations(page);

    // Deck-sidan: dagsmålet är nått, men man kan plugga vidare eller ta fler nya kort.
    await expectStoredCount(20);
    await page.goto(`/d/${DECK_SLUG}`);
    await expect(page.getByTestId("extra-panel")).toContainText("Dagens pass är klart");
    await expect(page.getByTestId("start-extra")).toHaveText(/Plugga vidare/);
    await expect(page.getByTestId("start-info")).toHaveText("Extra plugg räknas, så länge du vill");
    await expect(page.getByTestId("start-more")).toContainText("Ta 20 nya kort till");
    expect(await seenCountText(page)).toContain("20 av");
    await page.goto(`/d/${DECK_SLUG}`);

    // Hemsidan säger samma sak.
    await page.goto("/hem");
    await expect(page.getByTestId("home-today")).toContainText("Klart för i dag");
    await expect(page.getByTestId("home-extra")).toHaveText(/Plugga vidare/);
    await expect(page.getByTestId("home-lead")).toContainText("klar för i dag");

    await page.goto(`/d/${DECK_SLUG}`);
    await page.getByTestId("start-more").click();
    await expect(page.getByTestId("remaining")).toHaveText("20 kort kvar");
  });

  test("Plugga vidare när dagens pass är klart: ett block till, räknas in i schemat, och går att fortsätta igen", async ({ page }) => {
    await studyCards(page, "fsrs", 20, 4);
    await expect(page.getByTestId("session-summary")).toHaveAttribute("data-done", "true");
    await expectStoredCount(20);

    await page.goto(`/d/${DECK_SLUG}`);
    await page.getByTestId("start-extra").click();
    await expect(page.getByTestId("session-banner")).toContainText("Plugga vidare");
    await expect(page.getByTestId("remaining")).toHaveText("20 kort kvar");
    for (let i = 0; i < 20; i++) {
      if (await page.getByTestId("session-summary").isVisible()) break;
      await rateCurrentCard(page, 4);
    }
    const summary = page.getByTestId("session-summary");
    await expect(summary.getByRole("heading", { level: 1 })).toHaveText("Snyggt, extra pass klart");
    await expect(page.getByTestId("continue-extra")).toBeVisible();
    // Alla dagens kort är redan sedda i dag, så blocket bestod av nya kort utöver dosen.
    await expectStoredCount(40);
    await expectNoSeriousA11yViolations(page);
  });
});

test.describe("dugga", () => {
  test("slumpade kort ur en kategori, ingen tillbaka, resultat i procent, svaren räknas in i schemat", async ({ page }) => {
    await page.goto(`/d/${DECK_SLUG}`);
    await page.getByLabel("Dugga").check();
    await expect(page.getByTestId("session-settings")).toHaveAttribute("data-mode", "exam");
    await expect(page.getByTestId("session-settings")).toContainText("Inställningar");
    await page.getByTestId("category-row").filter({ hasText: SMALL_AREA }).getByRole("checkbox").check({ force: true });
    await expect(page.getByTestId("start-info")).toContainText(`${SMALL_AREA_CARDS} kort`);
    await page.getByTestId("start-session").click();
    await expect(currentCard(page)).toBeVisible();
    await expect(page.getByTestId("remaining")).toHaveText(`Fråga 1 av ${SMALL_AREA_CARDS}`);
    await expect(page.getByTestId("prev")).toBeDisabled();
    for (let i = 0; i < SMALL_AREA_CARDS; i++) {
      if (await page.getByTestId("session-summary").isVisible()) break;
      await rateCurrentCard(page, i < 4 ? 5 : 2);
    }
    await expect(page.getByTestId("session-summary")).toBeVisible();
    // Automaträttade frågor rättas efter alternativet testet väljer, så resultatet varierar; formen gör det inte.
    await expect(page.getByTestId("exam-result")).toContainText(new RegExp(`\\d+ av ${SMALL_AREA_CARDS}`));
    await expect(page.getByTestId("exam-result")).toContainText(/\d+ %/);
    await expectStoredCount(SMALL_AREA_CARDS);
    await expectNoSeriousA11yViolations(page);
  });
});
