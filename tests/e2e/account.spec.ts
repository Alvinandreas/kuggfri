import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  latestMailText,
  DECK_SLUG,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  login,
  logout,
  readLocalProgress,
  register,
  seenCountText,
  studyCards,
  submitRegistration,
  uniqueEmail,
} from "./helpers";

const PASSWORD = "testlosenord-123";

/** Id:n för några kort i decket, för att bygga gammal lokal progress. */
async function someCardIds(n: number): Promise<string[]> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: deck } = await admin.from("decks").select("id").eq("slug", DECK_SLUG).single();
  const { data } = await admin.from("cards").select("id").eq("deck_id", deck!.id).eq("is_active", true).order("sort_order").limit(n);
  return (data ?? []).map((c) => c.id);
}

test.describe("landningssidan", () => {
  test("registrering från landningssidan leder rakt in i kursen som länken pekade på", async ({ page }) => {
    await page.goto(`/?next=${encodeURIComponent(`/d/${DECK_SLUG}`)}`);
    const email = uniqueEmail("landning");
    await page.getByLabel("Namn").fill("Landa Landsson");
    await page.getByLabel("E-postadress").fill(email);
    await page.locator('input[name="password"]').fill(PASSWORD);
    // Bekräftelselänken i mejlet leder tillbaka till kursen (målet sparas vid registreringen).
    await submitRegistration(page, email);
    await page.waitForURL(new RegExp(`/d/${DECK_SLUG}$`), { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Materialteknik");
    // Namnet syns i profilmenyn.
    await expect(page.getByTestId("profile-menu").filter({ visible: true }).first()).toHaveAttribute("aria-label", /Landa Landsson/);
  });

  test("namn krävs för att skapa konto", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("E-postadress").fill(uniqueEmail("utannamn"));
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByTestId("register-submit").click();
    // Webbläsarens egen validering stoppar formuläret; vi är kvar på landningssidan.
    await expect(page).toHaveURL(/\/$/);
    expect(await page.getByLabel("Namn").evaluate((el) => (el as HTMLInputElement).validity.valueMissing)).toBe(true);
  });

  test("inloggningsfliken på landningssidan loggar in befintligt konto", async ({ page }) => {
    const email = uniqueEmail("flik");
    await register(page, email, PASSWORD);
    await logout(page);
    await page.getByRole("button", { name: "Logga in" }).first().click();
    await page.getByLabel("E-postadress").fill(email);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/hem$/, { timeout: 20_000 });
    await expect(page.getByTestId("home-today")).toBeVisible();
  });
});

test.describe("konto", () => {
  test("2. gammal lokal progress från gästtiden flyttas till kontot vid registrering", async ({ page }) => {
    const ids = await someCardIds(3);
    const now = new Date();
    const due = new Date(now.getTime() + 86_400_000).toISOString();
    const cards = Object.fromEntries(
      ids.map((id) => [
        id,
        { card_id: id, due, stability: 2, difficulty: 5, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, state: 2, last_review: now.toISOString(), self_rating: 4 },
      ]),
    );
    await page.goto("/");
    await page.evaluate((c) => localStorage.setItem("kuggfri:progress:v1", JSON.stringify({ version: 1, cards: c })), cards);

    await register(page, uniqueEmail("migrering"), PASSWORD, `/d/${DECK_SLUG}`);

    // Migreringen körs i klienten efter inloggning.
    await expect(page.getByTestId("migration-status")).toContainText("3 kort flyttades", { timeout: 20_000 });
    await expect.poll(async () => Object.keys(await readLocalProgress(page)).length).toBe(0);

    const seen = await seenCountText(page);
    expect(seen).toContain("3 av");
  });

  test("3. inloggad användare nollställer sitt deck och progressen är borta", async ({ page }) => {
    await register(page, uniqueEmail("nollstall"), PASSWORD);
    await studyCards(page, "fsrs", 2, 5);
    await expect.poll(async () => seenCountText(page)).toContain("2 av");

    // Nollställning per deck finns på kontosidan.
    await page.goto("/konto");
    await page.getByTestId(`reset-deck-${DECK_SLUG}`).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Bekräfta" }).click();
    await expect(page.getByText("Klart. Progressen är nollställd.")).toBeVisible();

    await page.goto(`/d/${DECK_SLUG}`);
    await expect(page.getByTestId("first-visit")).toBeVisible();
    expect(await seenCountText(page)).toContain("0 av");
    // Kurssidan har ingen nollställning längre; den finns bara under Konto.
    await page.goto(`/d/${DECK_SLUG}`);
    await expect(page.getByRole("button", { name: /Nollställ/ })).toHaveCount(0);
  });

  test("nollställ schemat behåller skattningarna", async ({ page }) => {
    await register(page, uniqueEmail("schema"), PASSWORD);
    await studyCards(page, "fsrs", 2, 2);
    await expect.poll(async () => seenCountText(page)).toContain("2 av");

    await page.goto("/konto");
    await page.getByTestId("reset-schedule").click();
    await page.getByRole("dialog").getByRole("button", { name: "Bekräfta" }).click();
    await expect(page.getByText("Klart. Progressen är nollställd.")).toBeVisible();
    // Korten är kvar som sedda (skattningen finns) men räknas som nya igen.
    expect(await seenCountText(page)).toContain("2 av");
    await expect(page.getByTestId("home-today-plan")).toContainText("nya");
  });

  test("5. vanlig användare blir nekad på /admin med 403", async ({ page }) => {
    await register(page, uniqueEmail("vanlig"), PASSWORD);
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Åtkomst nekad" })).toBeVisible();
    // Sidomenyn har inga genvägar till admin.
    await page.goto("/hem");
    await expect(page.getByTestId("sidebar-admin")).toHaveCount(0);
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

  test("byter lösenord under Konto och loggar in med det nya", async ({ page }) => {
    const email = uniqueEmail("byt");
    const newPassword = "nytt-losenord-456";
    await register(page, email, PASSWORD, "/konto");
    await page.locator('input[name="password"]').fill(newPassword);
    await page.getByTestId("save-password").click();
    await expect(page.getByRole("status").filter({ hasText: "Lösenordet är bytt." })).toBeVisible();

    await logout(page);
    await login(page, email, newPassword, "/konto");
    await expect(page.getByRole("heading", { name: "Ditt konto" })).toBeVisible();
  });

  test("glömt lösenord: länken i mejlet loggar in och det nya lösenordet fungerar", async ({ page }) => {
    const email = uniqueEmail("glomt");
    const newPassword = "aterstallt-losenord-789";
    await register(page, email, PASSWORD);
    await logout(page);

    await page.goto("/logga-in");
    await page.getByRole("link", { name: "Glömt lösenordet?" }).click();
    await expect(page).toHaveURL(/\/glomt-losenord$/);
    await page.getByTestId("forgot-email").fill(email);
    await page.getByTestId("forgot-submit").click();
    await expect(page.getByRole("status").filter({ hasText: /skickat en länk/ })).toBeVisible();

    const mail = await latestMailText(email, 20_000, "type=recovery");
    const match = /href="([^"]*token_hash=[^"]*type=recovery[^"]*)"/.exec(mail) ?? /(https?:\/\/\S*token_hash=\S*type=recovery\S*)/.exec(mail);
    expect(match, "återställningslänk i mejlet").not.toBeNull();
    const link = match![1]!.replace(/&amp;/g, "&");
    await page.goto(link);
    await expect(page).toHaveURL(/\/konto\?byt-losenord=1/);
    await expect(page.getByTestId("set-new-password-banner")).toBeVisible();

    await page.locator('input[name="password"]').fill(newPassword);
    await page.getByTestId("save-password").click();
    await expect(page.getByRole("status").filter({ hasText: "Lösenordet är bytt." })).toBeVisible();
    await logout(page);
    await login(page, email, newPassword, "/konto");
    await expect(page.getByRole("heading", { name: "Ditt konto" })).toBeVisible();
  });

  test("obekräftad adress: Kolla din inkorg, och inloggningen erbjuder att skicka bekräftelsen igen", async ({ page }) => {
    const email = uniqueEmail("obekraftad");
    await page.goto("/registrera");
    await page.getByLabel("Namn").fill("Olle Obekräftad");
    await page.getByLabel("E-postadress").fill(email);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("check-inbox")).toContainText(email, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Kolla din inkorg" })).toBeVisible();

    await page.goto("/logga-in");
    await page.getByLabel("E-postadress").fill(email);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-unconfirmed")).toContainText("inte bekräftad");
    await page.getByTestId("resend-confirmation").click();
    await expect(page.getByRole("status").filter({ hasText: "nytt bekräftelsemejl" })).toBeVisible();
  });

  test("inloggning med lösenord fungerar för befintligt konto", async ({ page }) => {
    const email = uniqueEmail("login");
    await register(page, email, PASSWORD);
    await logout(page);
    await login(page, email, PASSWORD, "/konto");
    await expect(page.getByRole("heading", { name: "Ditt konto" })).toBeVisible();
  });
});
