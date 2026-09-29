import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_USER, DECK_SLUG, expectNoSeriousA11yViolations, login, registerStudent, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, uniqueEmail } from "./helpers";

/**
 * Adminflöden som Johan använder: områden (skapa, byt namn, ordna, ta bort), kort (ta bort),
 * export, och examinatorrollen (ser bara sin kurs, kan redigera, kan inte skapa deck).
 */

const service = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function cleanup() {
  const db = service();
  await db.from("cards").delete().like("front", "E2E-innehåll%");
  await db.from("categories").delete().like("title", "E2E-kat%");
}

async function openDeckAdmin(page: Page): Promise<string> {
  await page.goto("/admin/deck");
  await page.getByTestId("admin-deck-list").getByRole("link", { name: "Materialteknik", exact: true }).click();
  await page.waitForURL(/\/admin\/deck\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  return page.url();
}

test.describe("admin: innehåll", () => {
  test.afterEach(async () => {
    await cleanup();
  });

  test("område: skapa, byt namn, ordna om och ta bort; korten hamnar under Utan område för studenten", async ({ page, browser }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password, "/admin");
    const deckUrl = await openDeckAdmin(page);
    await page.goto(`${deckUrl}/innehall`);

    // Skapa
    const title = `E2E-kat ${Date.now()}`;
    await page.getByPlaceholder("Områdets namn").fill(title);
    await page.getByRole("button", { name: "Nytt område" }).click();
    const row = page.getByTestId("admin-category-list").locator("li").filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row).toContainText("0 kort");

    // Nytt kort i området
    await row.getByRole("link", { name: title, exact: true }).click({ position: { x: 24, y: 16 } });
    await page.waitForURL(/\/kategori\/[0-9a-f-]{36}$/);
    await page.getByRole("link", { name: "Nytt kort i området" }).click();
    const front = `E2E-innehåll ${Date.now()}`;
    await page.getByTestId("card-front").fill(front);
    await page.getByTestId("card-back").fill("Ett svar.");
    await page.getByTestId("card-save-close").click();
    await page.waitForURL(/\/kategori\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("admin-card-list")).toContainText(front);

    // Byt namn
    await page.goto(`${deckUrl}/innehall`);
    const renamed = `${title} B`;
    await row.getByRole("button", { name: "Byt namn" }).click();
    // I redigeringsläge innehåller raden inte längre titeln som text; fältet ligger i listan, skapa-fältet under den.
    const list = page.getByTestId("admin-category-list");
    await list.getByRole("textbox", { name: "Områdets namn" }).first().fill(renamed);
    await list.getByRole("button", { name: "Spara", exact: true }).click();
    const renamedRow = page.getByTestId("admin-category-list").locator("li").filter({ hasText: renamed });
    await expect(renamedRow).toBeVisible();
    await expect(renamedRow).toContainText("1 kort");

    // Ordna om: flytta upp en gång, sedan ligger den inte sist.
    const listBefore = await page.getByTestId("admin-category-list").locator("li").allInnerTexts();
    expect(listBefore[listBefore.length - 1]).toContain(renamed);
    await renamedRow.getByRole("button", { name: "Flytta upp" }).click();
    await expect.poll(async () => {
      const list = await page.getByTestId("admin-category-list").locator("li").allInnerTexts();
      return list.findIndex((t) => t.includes(renamed));
    }).toBe(listBefore.length - 2);
    await expectNoSeriousA11yViolations(page);

    // Ta bort området: kortet finns kvar utan område och syns under "Utan område" både i admin och för studenten.
    await renamedRow.getByRole("button", { name: `Ta bort område: ${renamed}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Bekräfta" }).click();
    await expect(page.getByTestId("admin-category-list").locator("li").filter({ hasText: renamed })).toHaveCount(0);
    await expect(page.getByTestId("admin-category-list")).toContainText("Utan område");

    const student = await browser.newContext();
    const s = await student.newPage();
    await registerStudent(s, "utankategori", `/d/${DECK_SLUG}`);
    await s.goto(`/d/${DECK_SLUG}`);
    const uncategorized = s.getByTestId("category-row").filter({ hasText: "Utan område" });
    await expect(uncategorized).toBeVisible();
    await expect(uncategorized).toContainText("1 kort");
    // Går att plugga urvalet "Utan område".
    await uncategorized.getByRole("checkbox").check();
    await s.getByRole("radio", { name: /Fri repetition/ }).check();
    await s.getByTestId("start-session").click();
    await expect(s.getByTestId("flashcard")).toContainText(front);
    await student.close();

    // Ta bort kortet (med bekräftelse) från "Utan område".
    await page.goto(`${deckUrl}/kategori/ingen`);
    await page.getByRole("button", { name: `Ta bort kort: ${front}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Bekräfta" }).click();
    await expect(page.getByTestId("admin-card-list").getByText(front)).toHaveCount(0);
  });

  test("export ger hela decket som JSON, bara för inloggad redaktör", async ({ page, browser }) => {
    await login(page, ADMIN_USER.email, ADMIN_USER.password, "/admin");
    const deckUrl = await openDeckAdmin(page);
    const res = await page.request.get(`${deckUrl}/export`);
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { deck: { slug: string }; cards: unknown[]; categories: unknown[] };
    expect(json.deck.slug).toBe(DECK_SLUG);
    expect(json.cards.length).toBeGreaterThan(100);
    expect(json.categories.length).toBeGreaterThan(5);

    const guest = await browser.newContext();
    const denied = await guest.request.get(`${deckUrl}/export`, { maxRedirects: 0 });
    expect([302, 303, 307, 401, 403]).toContain(denied.status());
    await guest.close();
  });
});

test.describe("examinator", () => {
  const examiner = { email: uniqueEmail("examinator"), password: "examinator-losenord-123" };
  let userId: string | null = null;

  test.beforeAll(async () => {
    const db = service();
    const { data, error } = await db.auth.admin.createUser({ email: examiner.email, password: examiner.password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
    const { data: deck } = await db.from("decks").select("id").eq("slug", DECK_SLUG).single();
    const { error: linkError } = await db.from("deck_examiners").insert({ deck_id: deck!.id, user_id: userId } as never);
    if (linkError) throw linkError;
  });

  test.afterAll(async () => {
    if (userId) await service().auth.admin.deleteUser(userId);
  });

  test("ser bara sin kurs, kan redigera ett kort, men varken skapa deck eller ta bort det", async ({ page }) => {
    await login(page, examiner.email, examiner.password, "/hem");
    // Genvägarna till kursens adminflikar står i sidomenyn; på mobil i den utdragbara menyn.
    const openMenu = page.getByRole("button", { name: "Öppna menyn" });
    if (await openMenu.isVisible()) await openMenu.click();
    const adminNav = page.getByTestId("sidebar-admin").filter({ visible: true });
    await expect(adminNav.getByRole("link", { name: "Översikt" })).toBeVisible();
    await expect(adminNav.getByRole("link", { name: "Alla kurser" })).toHaveCount(0);
    await page.goto("/admin");
    await page.waitForURL(/\/admin\/deck\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Materialteknik");
    await expect(page.getByTestId("overview-students")).toBeVisible();
    await expect(page.getByRole("link", { name: "Alla kurser" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ny kurs" })).toHaveCount(0);
    const deckUrl = page.url();

    // Inställningar: inget "Ta bort kurs", ingen examinatorlista.
    await page.goto(`${deckUrl}/installningar`);
    await expect(page.getByRole("heading", { name: "Kursens inställningar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ta bort kurs" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Examinatorer" })).toHaveCount(0);
    // Adressen och publiceringen är administratörens (29 sep): fältet är skrivskyddat, knappen saknas.
    await expect(page.getByTestId("deck-slug")).toHaveAttribute("readonly", "");
    await expect(page.getByTestId("deck-publish")).toHaveCount(0);

    // Kan inte skapa deck.
    const res = await page.goto("/admin/deck/ny");
    expect(res?.status()).toBe(403);

    // Kan redigera ett kort (ledtråden) och spara.
    await page.goto(`${deckUrl}/innehall`);
    const categoryHref = await page.getByTestId("admin-category-list").getByTestId("admin-category-link").first().getAttribute("href");
    await page.goto(categoryHref!);
    const cardHref = await page.getByTestId("admin-card-list").getByTestId("admin-card-front").first().getAttribute("href");
    await page.goto(cardHref!);
    const hint = page.getByLabel("Ledtråd (valfritt)");
    const original = await hint.inputValue();
    await hint.fill(original ? original : "");
    await page.getByTestId("card-save").click();
    await expect(page.getByRole("status").filter({ hasText: "Sparat." })).toBeVisible();
    // Knappen är nedtonad (opacity 60 %) medan sparandet pågår; axe skulle då läsa
    // det som ett kontrastfel. Vänta tills den är klickbar igen innan kontrollen.
    await expect(page.getByTestId("card-save")).toBeEnabled();
    await expectNoSeriousA11yViolations(page);
  });
});
