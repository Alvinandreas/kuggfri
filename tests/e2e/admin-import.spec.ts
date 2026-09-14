import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_USER, DECK_SLUG, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, expectNoSeriousA11yViolations, login, startSession } from "./helpers";

/** Städar bort det importtestet lägger in i det riktiga decket, så att lokala databasen inte fylls på. */
async function cleanupImportedCards() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  await admin.from("cards").delete().like("front", "E2E-fråga%");
  await admin.from("categories").delete().eq("title", "E2E-kategori");
}

test.describe("admin", () => {
  test.afterEach(async () => {
    await cleanupImportedCards();
  });

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
    // Första kompileringen av admin-sidan i dev-läge kan ta en stund.
    await page.waitForURL(/\/admin\/deck\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Materialteknik");
    await expect(page.getByRole("link", { name: "Importera" })).toBeVisible();
    // Navigera direkt: på smala skärmar kan knappraden flytta sig medan listorna renderas.
    await page.goto(`${page.url()}/import`);
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
    const select = page.getByLabel("Urval", { exact: true });
    await page.getByLabel("Fri repetition").check();
    const option = (await select.locator("option").allTextContents()).find((o) => o.startsWith("E2E-kategori"));
    expect(option).toBeTruthy();
    const value = await select.locator("option", { hasText: "E2E-kategori" }).first().getAttribute("value");
    await startSession(page, "free", value ?? "all");
    await expect(page.getByTestId("flashcard")).toContainText(unique);
  });

  test("admin kan skapa, redigera och ta bort ett deck", async ({ page, browser }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password, "/admin/deck/ny");
    const slug = `e2e-deck-${Date.now()}`;
    const title = `E2E-deck ${Date.now()}`;
    await page.getByTestId("deck-title").fill(title);
    await page.getByTestId("deck-slug").fill(slug);
    await page.getByTestId("deck-save").click();
    await page.waitForURL(/\/admin\/deck\/[0-9a-f-]{36}$/);
    const deckAdminUrl = page.url();
    await expectNoSeriousA11yViolations(page);

    // Opublicerat deck syns inte för en utloggad besökare (admin själv ser det).
    const visitor = await browser.newContext();
    const hidden = await visitor.request.get(`/d/${slug}`);
    expect(hidden.status()).toBe(404);

    await page.getByTestId("deck-publish").click();
    await expect(page.getByText("Publicerat", { exact: true })).toBeVisible();
    await expect.poll(async () => (await visitor.request.get(`/d/${slug}`)).status(), { timeout: 15_000 }).toBe(200);
    await visitor.close();

    // Lägg till ett kort med förhandsvisning.
    await page.goto(deckAdminUrl);
    await page.getByRole("link", { name: "Nytt kort" }).click();
    await page.getByTestId("card-front").fill("Vad är $\\sigma = E \\varepsilon$?");
    await page.getByTestId("card-back").fill("Hookes lag.\n\n* Spänning\n* Töjning");
    await expect(page.locator(".katex").first()).toBeVisible();
    await page.getByTestId("card-save").click();
    await page.waitForURL(/\/kort\/[0-9a-f-]{36}$/);

    // Ta bort decket.
    await page.goto("/admin");
    await page.getByRole("link", { name: title, exact: true }).click();
    await page.getByRole("button", { name: "Ta bort deck" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Bekräfta" }).click();
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);
  });
});
