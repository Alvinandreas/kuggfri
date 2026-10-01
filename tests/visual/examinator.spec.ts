/**
 * Examinator (visual-examinator@kuggfri.test, examinator för Materialteknik): sidomenyn, som
 * saknar Alla kurser och designsystemet, och Granskning.
 */
import { AUTH_FILE } from "./data";
import { courseStatsMasks, expect, isMobile, open, openMobileMenu, reviewListMasks, shot, test } from "./fixtures";

test.use({ storageState: AUTH_FILE.examiner });

test.describe("examinator", () => {
  test("översikt med sidomenyn", async ({ page, fx }) => {
    await open(page, "/admin");
    await expect(page).toHaveURL(new RegExp(`/admin/deck/${fx.deckId}$`));
    await shot(page, "oversikt", { mask: courseStatsMasks(page) });
  });

  test("granskning", async ({ page, fx }) => {
    await open(page, `/admin/deck/${fx.deckId}/granskning`);
    await expect(page.getByTestId("review-list")).toBeVisible();
    await shot(page, "granskning", { mask: reviewListMasks(page, { rightLabels: false }) });
  });

  test("mobilmenyn", async ({ page, fx }) => {
    test.skip(!isMobile(page), "Sidomenyn syns redan i varje desktopbild.");
    await open(page, `/admin/deck/${fx.deckId}/granskning`);
    await openMobileMenu(page);
    await shot(page, "mobilmeny", { fullPage: false });
  });
});
