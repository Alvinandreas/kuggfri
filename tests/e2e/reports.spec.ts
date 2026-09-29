import { expect, test } from "@playwright/test";
import { ADMIN_USER, expectNoSeriousA11yViolations, login, registerStudent, startSession } from "./helpers";

test.describe("felrapporter", () => {
  test("student rapporterar fel på ett kort, admin ser, åtgärdar och tar bort rapporten", async ({ browser, page }) => {
    const text = `E2E-rapport ${Date.now()}: enheten i svaret ser fel ut`;

    // Student utan kontaktuppgift i rapporten: visas som anonym för admin.
    await registerStudent(page, "rapport");
    await startSession(page, "free");
    await page.getByTestId("report-open").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await dialog.getByTestId("report-message").fill(text);
    await dialog.getByTestId("report-submit").click();
    await expect(dialog.getByTestId("report-done")).toBeVisible();
    await dialog.getByRole("button", { name: "Stäng" }).click();
    await expect(dialog).toBeHidden();
    // Studieläget fungerar vidare efteråt (tangentbordet är inte kvar i dialogläge).
    await page.getByTestId("flip").click();
    await expect(page.getByTestId("flashcard")).toHaveAttribute("data-flipped", "true");

    // Admin i en egen webbläsarkontext.
    const ctx = await browser.newContext();
    const admin = await ctx.newPage();
    try {
      await login(admin, ADMIN_USER.email, ADMIN_USER.password, "/admin/deck");
      await admin.getByTestId("admin-deck-list").getByRole("link", { name: "Materialteknik", exact: true }).click();
      // Kurssidorna i admin nås från sidomenyn (på mobil i den utdragbara menyn); gå direkt.
      await admin.waitForURL(/\/admin\/deck\/[0-9a-f-]{36}$/, { timeout: 30_000 });
      await admin.goto(`${admin.url()}/rapporter`);
      await expect(admin.getByRole("heading", { name: /^Felrapporter/ }).first()).toBeVisible();

      const row = admin.getByTestId("report-row").filter({ hasText: text });
      await expect(row).toBeVisible();
      await expect(row.getByText("Öppen")).toBeVisible();
      await expect(row.getByText("anonym")).toBeVisible();
      await expectNoSeriousA11yViolations(admin);

      await row.getByRole("button", { name: "Markera som åtgärdad" }).click();
      await expect(row.getByText("Åtgärdad", { exact: true })).toBeVisible();

      await row.getByRole("button", { name: "Ta bort" }).click();
      await admin.getByRole("dialog").getByRole("button", { name: "Bekräfta" }).click();
      await expect(row).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});
