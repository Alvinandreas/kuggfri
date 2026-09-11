import { expect, test } from "@playwright/test";
import { ADMIN_USER, DECK_SLUG, expectNoSeriousA11yViolations, login, startSession } from "./helpers";

test.describe("admin", () => {
  test("6. admin importerar en CSV och korten dyker upp i decket", async ({ page }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password, "/admin");
    await expect(page.getByRole("heading", { name: "Deck" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // Antal kort före import (publik sida).
    await page.goto(`/d/${DECK_SLUG}`);
    const totalBefore = Number((await page.getByText(/kort totalt/).textContent())?.match(/\d+/)?.[0] ?? "0");
    expect(totalBefore).toBeGreaterThan(0);

    await page.goto("/admin");
    await page.getByTestId("admin-deck-list").getByRole("link", { name: "Materialteknik", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Materialteknik");
    await page.getByRole("link", { name: "Importera" }).click();
    await expect(page.getByRole("heading", { name: /Importera kort/ })).toBeVisible();

    const unique = `E2E-fråga ${Date.now()}`;
    const csv = [
      "front,back,hint,category,sort_order",
      `${unique},Ett svar från E2E-testet med $E = mc^2$,En ledtråd,E2E-kategori,`,
      `${unique} nummer två,Andra svaret,,E2E-kategori,`,
      ",Rad utan framsida,,,",
    ].join("\n");

    await page.getByTestId("import-text").fill(csv);
    await page.getByTestId("import-preview").click();
    await expect(page.getByTestId("import-diff")).toBeVisible();
    await expect(page.getByTestId("diff-new")).toHaveText("2");
    await expect(page.getByTestId("diff-updated")).toHaveText("0");
    await expect(page.getByText("Framsidan (front) saknas.")).toBeVisible();

    await page.getByTestId("import-confirm").click();
    await expect(page.getByTestId("import-result")).toContainText("2 kort importerade.", { timeout: 20_000 });

    // Korten syns i admin-listan.
    const deckAdminUrl = page.url().replace(/\/import$/, "");
    await page.goto(deckAdminUrl);
    await expect(page.getByTestId("admin-card-list").getByText(unique, { exact: true })).toBeVisible();

    // Och i det publika decket.
    await page.goto(`/d/${DECK_SLUG}`);
    const totalAfter = Number((await page.getByText(/kort totalt/).textContent())?.match(/\d+/)?.[0] ?? "0");
    expect(totalAfter).toBe(totalBefore + 2);
    await expect(page.locator("li", { hasText: "E2E-kategori" }).first()).toBeVisible();

    // Kortet kan pluggas: fri repetition i den nya kategorin.
    const select = page.getByLabel("Urval");
    await page.getByLabel("Fri repetition").check();
    const option = (await select.locator("option").allTextContents()).find((o) => o.startsWith("E2E-kategori"));
    expect(option).toBeTruthy();
    const value = await select.locator("option", { hasText: "E2E-kategori" }).first().getAttribute("value");
    await startSession(page, "free", value ?? "all");
    await expect(page.getByTestId("flashcard")).toContainText(unique);
  });

  test("admin kan skapa, redigera och ta bort ett deck", async ({ page }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password, "/admin/deck/ny");
    const slug = `e2e-deck-${Date.now()}`;
    await page.getByTestId("deck-title").fill("E2E-deck");
    await page.getByTestId("deck-slug").fill(slug);
    await page.getByTestId("deck-save").click();
    await page.waitForURL(/\/admin\/deck\/[0-9a-f-]{36}$/);
    await expectNoSeriousA11yViolations(page);

    // Opublicerat deck syns inte publikt.
    const hidden = await page.goto(`/d/${slug}`);
    expect(hidden?.status()).toBe(404);

    await page.goBack();
    await page.getByTestId("deck-publish").click();
    await expect(page.getByText("Publicerat", { exact: true })).toBeVisible();
    const shown = await page.goto(`/d/${slug}`);
    expect(shown?.status()).toBe(200);

    // Lägg till ett kort med förhandsvisning.
    await page.goBack();
    await page.getByRole("link", { name: "Nytt kort" }).click();
    await page.getByTestId("card-front").fill("Vad är $\\sigma = E \\varepsilon$?");
    await page.getByTestId("card-back").fill("Hookes lag.\n\n* Spänning\n* Töjning");
    await expect(page.locator(".katex").first()).toBeVisible();
    await page.getByTestId("card-save").click();
    await page.waitForURL(/\/kort\/[0-9a-f-]{36}$/);

    // Ta bort decket.
    await page.goto("/admin");
    await page.getByRole("link", { name: "E2E-deck", exact: true }).click();
    await page.getByRole("button", { name: "Ta bort deck" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Bekräfta" }).click();
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "E2E-deck", exact: true })).toHaveCount(0);
  });
});
