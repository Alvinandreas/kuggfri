import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11yViolations, loginAsAdmin, openAdminCourse } from "./helpers";

/**
 * Granskningen som inkorg (30 sep): flikarna Att granska, Granskade och Flaggade, kortvyn med
 * Fråga och Svar, Godkänn (med Ångra), Flagga och Åtgärdad. Testet lämnar databasen som den var:
 * godkännandet ångras och flaggan åtgärdas.
 */

async function openReview(page: Page) {
  await loginAsAdmin(page);
  await page.goto(`${await openAdminCourse(page)}/granskning`);
  await expect(page.getByTestId("review-tabs")).toBeVisible();
}

const count = async (page: Page, tab: string) => Number((await page.getByTestId(`review-count-${tab}`).textContent())?.trim());

// Bara desktop (playwright.config.ts): inget här skiljer sig på mobil.
test.describe("granskning", { tag: "@desktop" }, () => {
  test("godkänn och ångra, flagga och åtgärda", async ({ page }) => {
    await openReview(page);
    // Ingen gemensam flikrad för kurssidorna, bara granskningens egna flikar.
    await expect(page.locator("[data-testid^='deck-tab-']")).toHaveCount(0);
    const toReview = await count(page, "att-granska");
    const reviewed = await count(page, "granskade");
    const flagged = await count(page, "flaggade");
    test.skip(toReview < 2, "kräver minst två kort att granska");
    await expectNoSeriousA11yViolations(page);

    // Kortvyn: tydligt Fråga och Svar och var i kön man är.
    await page.getByTestId("review-start").click();
    const view = page.getByTestId("review-card-view");
    await expect(view).toBeVisible();
    await expect(page.getByTestId("review-question")).toBeVisible();
    await expect(page.getByTestId("review-answer")).toBeVisible();
    await expect(page.getByTestId("review-position")).toHaveText(`1 av ${toReview}`);
    await expectNoSeriousA11yViolations(page);

    // Godkänn går till nästa kort; Ångra tar tillbaka det.
    const first = await view.getAttribute("data-card-id");
    await page.getByTestId("review-approve").click();
    await expect(view).not.toHaveAttribute("data-card-id", first ?? "");
    await expect(page.getByTestId("review-count-granskade")).toHaveText(String(reviewed + 1));
    await page.getByTestId("review-undo").click();
    await expect(view).toHaveAttribute("data-card-id", first ?? "");
    await expect(page.getByTestId("review-count-att-granska")).toHaveText(String(toReview));

    // Flagga kräver en anteckning och går vidare; kortet samlas under Flaggade.
    await page.getByTestId("review-flag").click();
    await expect(page.getByTestId("review-flag-panel-confirm")).toBeDisabled();
    await page.getByTestId("review-flag-panel-note").fill("E2E: kontrollera enheten");
    await page.getByTestId("review-flag-panel-confirm").click();
    await expect(view).not.toHaveAttribute("data-card-id", first ?? "");
    await expect(page.getByTestId("review-count-flaggade")).toHaveText(String(flagged + 1));

    await page.getByTestId("review-tab-flaggade").click();
    const row = page.locator(`[data-review-row="${first}"]`);
    await expect(row).toContainText("E2E: kontrollera enheten");
    await row.click();
    await expect(page.getByTestId("review-flag-note")).toContainText("E2E: kontrollera enheten");

    // Åtgärdad: flaggan bort, kortet tillbaka under Att granska.
    await page.getByTestId("review-resolve").click();
    await page.getByTestId("review-tab-att-granska").click();
    await expect(page.getByTestId("review-count-att-granska")).toHaveText(String(toReview));
    await expect(page.locator(`[data-review-row="${first}"]`)).toBeVisible();

    // Bakåtknappen följer flikarna.
    await page.getByTestId("review-tab-granskade").click();
    await expect(page).toHaveURL(/flik=granskade/);
    await page.goBack();
    await expect(page).not.toHaveURL(/flik=/);
  });
});
