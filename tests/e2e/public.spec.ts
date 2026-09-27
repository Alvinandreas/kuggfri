import { expect, test } from "@playwright/test";
import { DECK_SLUG, expectNoSeriousA11yViolations } from "./helpers";

// Skapar inga konton och skriver ingenting: kan köras mot produktion
// (E2E_BASE_URL=https://kuggfri.com E2E_SKIP_SETUP=1, se docs/ATERSTALLNING.md).
test.describe("utan konto", () => {
  test("landningssidan visar formuläret och klarar tillgänglighetskontrollen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plugga smartare inför tentan.");
    await expect(page.getByTestId("register-submit")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("allt bakom inloggning skickar till landningssidan, med adressen kvar som next", async ({ page }) => {
    await page.goto("/hem");
    await expect(page).toHaveURL(/\/\?next=%2Fhem$/);
    await page.goto(`/d/${DECK_SLUG}/plugga?mode=exam`);
    await expect(page).toHaveURL(/\/\?next=%2Fd%2Fmaterialteknik%2Fplugga%3Fmode%3Dexam$/);
    await expect(page.getByText("Logga in eller skapa ett konto för att öppna kursen.")).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/\?next=%2Fadmin$/);
    await page.goto("/konto");
    await expect(page).toHaveURL(/\/\?next=%2Fkonto$/);
  });

  test("informationssidorna går att nå utan konto", async ({ page }) => {
    await page.goto("/om");
    await expect(page).toHaveURL(/\/om$/);
    await page.goto("/hjalp");
    await expect(page).toHaveURL(/\/hjalp$/);
    await page.goto("/integritet");
    await expect(page).toHaveURL(/\/integritet$/);
    await expectNoSeriousA11yViolations(page);
  });

  test("en kurslänk visar kursens inbjudan på samma adress, med kursens delningsbild", async ({ page, request }) => {
    await page.goto(`/d/${DECK_SLUG}`);
    await expect(page).toHaveURL(new RegExp(`/d/${DECK_SLUG}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Materialteknik");
    await expect(page.getByTestId("register-submit")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // Det en chattklient ser: kursens titel och en delningsbild som går att hämta utan konto.
    const html = await (await request.get(`/d/${DECK_SLUG}`, { maxRedirects: 0 })).text();
    expect(html).toContain('property="og:title" content="Materialteknik"');
    const image = /property="og:image" content="([^"]+)"/.exec(html)?.[1];
    expect(image, "og:image på kurslänken").toContain(`/kurs/${DECK_SLUG}/opengraph-image`);
    const og = await request.get(new URL(image!).pathname + new URL(image!).search, { maxRedirects: 0 });
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
  });
});
