/**
 * Admin (admin@kuggfri.test) i Materialteknik: översikten, innehållet, ett område och ett kort,
 * granskningens flikar och kortvy, tentorna med facit, förhandsgranskningen och studentvyn i
 * tentaläget, felrapporterna, importen, inställningarna, Alla kurser och designsystemet.
 */
import type { Page } from "@playwright/test";
import { AUTH_FILE, DECK_SLUG } from "./data";
import { courseStatsMasks, expect, isMobile, open, openMobileMenu, reviewCardMasks, reviewListMasks, shot, test } from "./fixtures";

test.use({ storageState: AUTH_FILE.admin });

const STUDENT_VIEW_COOKIE = "kuggfri_studentvy";

/** Redaktörens studentvy i tentaläget är en kaka: "<kursens id>:oppen" eller ":last". */
async function setStudentView(page: Page, deckId: string, mode: "oppen" | "last") {
  const url = test.info().project.use.baseURL!;
  await page.context().addCookies([{ name: STUDENT_VIEW_COOKIE, value: `${deckId}:${mode}`, url }]);
}

test.describe("admin", () => {
  test("översikt", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}`);
    await shot(page, "oversikt", { mask: courseStatsMasks(page) });
  });

  test("statistik", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/statistik`);
    await shot(page, "statistik", { mask: courseStatsMasks(page) });
  });

  test("innehåll", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/innehall`);
    await shot(page, "innehall");
  });

  test("ett område", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/kategori/${fx.firstCategory.id}`);
    await shot(page, "omrade");
  });

  test("ett kort (redigering)", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/kort/${fx.editCardId}`);
    await expect(page.getByTestId("card-editor")).toBeVisible();
    await shot(page, "kort");
  });

  test("nytt kort", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/kort/ny`);
    await shot(page, "kort-nytt");
  });

  test("granskning: att granska", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/granskning`);
    await expect(page.getByTestId("review-list")).toBeVisible();
    await shot(page, "granskning-att-granska", { mask: reviewListMasks(page, { rightLabels: false }) });
  });

  test("granskning: ett kort", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/granskning`);
    await page.getByTestId("review-start").click();
    await expect(page.getByTestId("review-card-view")).toBeVisible();
    await shot(page, "granskning-kort", { mask: reviewCardMasks(page) });
  });

  test("granskning: granskade", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/granskning?flik=granskade`);
    await expect(page.getByTestId("review-list")).toBeVisible();
    await shot(page, "granskning-granskade", { mask: reviewListMasks(page, { rightLabels: false }) });
  });

  test("granskning: flaggade", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/granskning?flik=flaggade`);
    await expect(page.getByTestId("review-list")).toBeVisible();
    await shot(page, "granskning-flaggade", { mask: reviewListMasks(page, { rightLabels: true }) });
  });

  test("granskning: ett flaggat kort", async ({ page, fx }) => {
    test.skip(!fx.flaggedCardId, "Kursen har inga flaggade kort.");
    await open(page, `/admin/deck/${fx.deckId}/granskning?flik=flaggade&kort=${fx.flaggedCardId}`);
    await expect(page.getByTestId("review-card-view")).toBeVisible();
    await shot(page, "granskning-flaggat-kort", { mask: reviewCardMasks(page) });
  });

  test("tentor", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/tentor`);
    await shot(page, "tentor");
  });

  test("en tentas facit", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/tentor/${fx.coverExamKey}`);
    await shot(page, "tenta-facit");
  });

  test("förhandsgranskning: försättsblad", async ({ page, fx }) => {
    await open(page, `/d/${DECK_SLUG}/tenta/${fx.coverExamKey}?fran=admin`);
    await expect(page.getByTestId("exam-cover")).toBeVisible();
    await shot(page, "forhandsgranskning-forsattsblad");
  });

  test("förhandsgranskning: en uppgift", async ({ page, fx }) => {
    await open(page, `/d/${DECK_SLUG}/tenta/${fx.runnerExamKey}?forsok=${fx.runnerAttemptId}&fran=admin`);
    await expect(page.getByTestId("exam-runner")).toBeVisible();
    // Skrivtiden som återstår räknas från när setup skapade försöket.
    await shot(page, "forhandsgranskning-uppgift", { fullPage: false, mask: [page.getByTestId("exam-clock")] });
  });

  test("tentaläget (redaktör)", async ({ page }) => {
    await open(page, `/d/${DECK_SLUG}/tenta`);
    await shot(page, "tentalage-redaktor");
  });

  test("studentvyn i tentaläget, öppet", async ({ page, fx }) => {
    await setStudentView(page, fx.deckId, "oppen");
    await open(page, `/d/${DECK_SLUG}/tenta`);
    await expect(page.getByTestId("student-view-bar")).toBeVisible();
    await shot(page, "studentvy-oppen");
  });

  test("studentvyn i tentaläget, låst", async ({ page, fx }) => {
    await setStudentView(page, fx.deckId, "last");
    await open(page, `/d/${DECK_SLUG}/tenta`);
    await expect(page.getByTestId("exam-mode-locked")).toBeVisible();
    await shot(page, "studentvy-last");
  });

  test("felrapporter", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/rapporter`);
    await shot(page, "felrapporter");
  });

  test("importera", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/import`);
    await shot(page, "importera");
  });

  test("inställningar", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/installningar`);
    await shot(page, "installningar");
  });

  test("alla kurser", async ({ page }) => {
    await open(page, "/admin/deck");
    await shot(page, "alla-kurser");
  });

  test("ny kurs", async ({ page }) => {
    await open(page, "/admin/deck/ny");
    await shot(page, "ny-kurs");
  });

  test.describe("designsystem", () => {
    // Exempelsidan räknar ut datum redan på servern (aktivitetskartan, nedräkningen). Med en
    // förskjuten klientklocka misslyckas hydreringen och mörkt läge går förlorat, så sidan
    // körs med den riktiga klockan och det som beror på dagens datum maskas.
    test.use({ shiftClock: false });
    test("designsystem", async ({ page }) => {
      await open(page, "/designsystem");
      await shot(page, "designsystem", { mask: [page.getByRole("timer"), page.getByRole("group", { name: "Aktivitet" })] });
    });
  });

  test("mobilmenyn", async ({ page, fx }) => {
    test.skip(!isMobile(page), "Sidomenyn syns redan i varje desktopbild.");
    await open(page, `/admin/deck/${fx.deckId}`);
    await openMobileMenu(page);
    await shot(page, "mobilmeny", { fullPage: false });
  });
});
