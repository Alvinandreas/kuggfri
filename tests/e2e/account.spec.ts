import { expect, test } from "@playwright/test";
import {
  DECK_SLUG,
  expectNoSeriousA11yViolations,
  login,
  readLocalProgress,
  register,
  seenCountText,
  studyCards,
  uniqueEmail,
} from "./helpers";

const PASSWORD = "testlosenord-123";

test.describe("konto", () => {
  test("2. gäst skapar konto och den lokala progressen följer med", async ({ page }) => {
    await studyCards(page, "fsrs", 3, 4);
    expect(Object.keys(await readLocalProgress(page))).toHaveLength(3);

    await page.goto("/registrera");
    await expectNoSeriousA11yViolations(page);

    const email = uniqueEmail("migrering");
    await register(page, email, PASSWORD, `/d/${DECK_SLUG}`);

    // Migreringen körs i klienten efter inloggning.
    await expect(page.getByTestId("migration-status")).toContainText("3 kort flyttades", { timeout: 20_000 });
    await expect.poll(async () => Object.keys(await readLocalProgress(page)).length).toBe(0);

    // Progressen finns nu på kontot.
    const seen = await seenCountText(page);
    expect(seen).toContain("3 av");

    // Bannern för gäster är borta.
    await expect(page.getByText("Du pluggar som gäst.")).toHaveCount(0);
  });

  test("3. inloggad användare nollställer sitt deck och progressen är borta", async ({ page }) => {
    const email = uniqueEmail("nollstall");
    await register(page, email, PASSWORD, "/");
    await studyCards(page, "fsrs", 2, 5);
    expect(await seenCountText(page)).toContain("2 av");

    // Nollställning per deck finns på kontosidan.
    await page.goto("/konto");
    await page.getByTestId(`reset-deck-${DECK_SLUG}`).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Bekräfta" }).click();
    await expect(page.getByText("Klart. Progressen är nollställd.")).toBeVisible();

    await page.goto(`/d/${DECK_SLUG}`);
    await expect(page.getByText("Du har inte pluggat det här decket ännu.")).toBeVisible();
    await expect(page.getByTestId("seen-count")).toHaveCount(0);
  });

  test("gäst kan nollställa decket via länken på deck-sidan", async ({ page }) => {
    await studyCards(page, "fsrs", 2, 4);
    expect(await seenCountText(page)).toContain("2 av");
    await page.getByTestId("reset-deck").click();
    await page.getByRole("dialog").getByRole("button", { name: "Bekräfta" }).click();
    await expect(page.getByText("Klart. Progressen är nollställd.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Du har inte pluggat det här decket ännu.")).toBeVisible();
  });

  test("nollställ schemat behåller skattningarna", async ({ page }) => {
    const email = uniqueEmail("schema");
    await register(page, email, PASSWORD, "/");
    await studyCards(page, "fsrs", 2, 2);
    await page.goto(`/d/${DECK_SLUG}`);
    await expect(page.getByTestId("seen-count")).toContainText("2 av");

    await page.goto("/konto");
    await page.getByTestId("reset-schedule").click();
    await page.getByRole("dialog").getByRole("button", { name: "Bekräfta" }).click();
    await expect(page.getByText("Klart. Progressen är nollställd.")).toBeVisible();
    await page.goto(`/d/${DECK_SLUG}`);
    // Korten är kvar som sedda (skattningen finns) men räknas som nya igen.
    await expect(page.getByTestId("seen-count")).toContainText("2 av");
    await expect(page.getByTestId("due-info")).toContainText("nya kort");
  });

  test("5. vanlig användare blir nekad på /admin med 403", async ({ page }) => {
    const email = uniqueEmail("vanlig");
    await register(page, email, PASSWORD, "/");
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Åtkomst nekad" })).toBeVisible();
    // Admin-länken finns inte i menyn.
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("utloggad skickas till inloggning från /admin och /konto", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/logga-in\?next=%2Fadmin/);
    await page.goto("/konto");
    await expect(page).toHaveURL(/\/logga-in/);
    await expectNoSeriousA11yViolations(page);
  });

  test("ladda ner mina data och radera konto", async ({ page, context }) => {
    const email = uniqueEmail("radera");
    await register(page, email, PASSWORD, "/konto");
    await expect(page.getByRole("heading", { name: "Ditt konto" })).toBeVisible();

    const res = await context.request.get("/api/konto/export");
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { account: { email: string }; card_progress: unknown[] };
    expect(body.account.email).toBe(email);
    expect(Array.isArray(body.card_progress)).toBe(true);

    await page.getByTestId("delete-account").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("RADERA");
    await dialog.getByRole("button", { name: "Bekräfta" }).click();
    await page.waitForURL(/\/\?raderad=1/);

    // Kontot finns inte längre: inloggning misslyckas.
    await page.goto("/logga-in");
    await page.getByLabel("E-postadress").fill(email);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    // Next.js har en egen tom role="alert" (route announcer), så filtrera på texten.
    await expect(page.getByRole("alert").filter({ hasText: "Fel e-post eller lösenord." })).toBeVisible();
  });

  test("inloggning med lösenord fungerar för befintligt konto", async ({ page }) => {
    const email = uniqueEmail("login");
    await register(page, email, PASSWORD, "/");
    await page.getByRole("button", { name: "Logga ut" }).click();
    await expect(page.getByRole("link", { name: "Logga in" })).toBeVisible();
    await login(page, email, PASSWORD, "/konto");
    await expect(page.getByRole("heading", { name: "Ditt konto" })).toBeVisible();
  });
});
