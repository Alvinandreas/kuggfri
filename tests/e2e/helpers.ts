import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Adressen, service role-nyckeln och klienten bor i cleanup.ts, som också körs fristående med tsx.
import { serviceClient, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./cleanup";

export { serviceClient, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL };

export const ADMIN_USER = { email: "admin@kuggfri.test", password: "admin-losenord-123" };

export const DECK_SLUG = "materialteknik";

/** Adminens inloggade session (kakor), sparad av global-setup.ts en gång per körning. */
export const ADMIN_STATE = join(__dirname, ".auth", "admin.json");

/**
 * Gör sidans kontext inloggad som admin med sessionen från global-setup, i stället för att logga
 * in via formuläret i varje test. Bara den här kontexten påverkas; andra kontexter i testet
 * (studenter, gäster) förblir utloggade. Saknas filen, eller är den så gammal att åtkomsttoken
 * (en timme lokalt) kan ha gått ut, loggar den in via formuläret som förr. Med `next` öppnas den
 * sidan efteråt, som login() gör.
 */
export async function loginAsAdmin(page: Page, next?: string) {
  const fresh = existsSync(ADMIN_STATE) && Date.now() - statSync(ADMIN_STATE).mtimeMs < 50 * 60_000;
  if (!fresh) {
    await login(page, ADMIN_USER.email, ADMIN_USER.password, next ?? "/hem");
    return;
  }
  const state = JSON.parse(readFileSync(ADMIN_STATE, "utf8")) as { cookies: Parameters<BrowserContext["addCookies"]>[0] };
  await page.context().addCookies(state.cookies);
  if (next) await page.goto(next);
}

/** Öppnar Materialteknik från adminens kurslista och returnerar kursens adminadress. */
export async function openAdminCourse(page: Page): Promise<string> {
  await page.goto("/admin/deck");
  await page.getByTestId("admin-deck-list").getByRole("link", { name: "Materialteknik", exact: true }).click();
  // Första kompileringen av admin-sidan i dev-läge kan ta en stund.
  await page.waitForURL(/\/admin\/deck\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  return page.url();
}

/** Sätter adressen på Materialtekniks deltagarlista (som examinatorn gör i fliken Deltagare). */
export async function enrollTestEmail(email: string, slug = DECK_SLUG) {
  const db = serviceClient();
  const { data: deck, error } = await db.from("decks").select("id").eq("slug", slug).single();
  if (error || !deck) throw new Error(`Hittade inte kursen ${slug}: ${error?.message}`);
  const { error: insertError } = await db.from("deck_enrollments").upsert({ deck_id: deck.id, email: email.toLowerCase() }, { onConflict: "deck_id,email", ignoreDuplicates: true });
  if (insertError) throw new Error(`Kunde inte sätta ${email} på deltagarlistan: ${insertError.message}`);
}

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@kuggfri.test`;
}

/** Inga allvarliga eller kritiska tillgänglighetsfel på sidan. */
export async function expectNoSeriousA11yViolations(page: Page) {
  // Block tonar in (anim-fade-up, förskjutet per block). Mitt i intoningen är texten halvt
  // genomskinlig och axe mäter för låg kontrast; spola fram så att det färdiga läget mäts.
  // Titeln strömmas in efter skelettet i dev-läge; axe ska mäta den färdiga sidan.
  await expect(page).toHaveTitle(/./);
  // Block som strömmas in sent tonar in efter att sidan laddats; vänta tills inget laddas längre.
  await page.waitForLoadState("networkidle");
  // Oändliga animationer (t.ex. laddningsskelett) går inte att spola fram och hoppas över. Ett
  // block som strömmas in efter första framspolningen startar en ny intoning: spola fram tills
  // inga nya startar under två kontroller i rad (högst några varv).
  for (let round = 0, quiet = 0; round < 10 && quiet < 2; round++) {
    const finished = await page.evaluate(() => {
      let n = 0;
      for (const a of document.getAnimations()) {
        if (a.playState === "finished" || a.effect?.getComputedTiming().endTime === Infinity) continue;
        a.finish();
        n++;
      }
      return n;
    });
    quiet = finished === 0 ? quiet + 1 : 0;
    await page.waitForTimeout(150);
  }
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html) })), null, 2)).toEqual([]);
}

/** Startar en session från deckets sida med valt läge och urval. */
/** Passets aktuella kort, vändkort eller automaträttat (flerval, sant/falskt). */
export function currentCard(page: Page) {
  return page.locator('[data-testid="flashcard"], [data-testid="quizcard"]').first();
}

/** Startar ett pass; `extra` är fler passinställningar i adressen, t.ex. "typer=vand". */
export async function startSession(page: Page, mode: "fsrs" | "free" | "random", selection = "all", extra = "") {
  await page.goto(`/d/${DECK_SLUG}/plugga?mode=${mode}&urval=${encodeURIComponent(selection)}${extra ? `&${extra}` : ""}`);
  // Första kortet kan vara ett vändkort eller ett automaträttat kort.
  await expect(page.locator('[data-testid="flashcard"], [data-testid="quizcard"]').first()).toBeVisible();
}

/**
 * Går vidare från det aktuella kortet. Vändkort vänds och skattas; automaträttade kort (flerval,
 * sant/falskt) besvaras med första alternativet och rättas av appen, så `rating` gäller inte dem.
 */
export async function rateCurrentCard(page: Page, rating: 1 | 2 | 3 | 4 | 5) {
  const current = page.locator('[data-testid="flashcard"], [data-testid="quizcard"]').first();
  await expect(current).toBeVisible();
  const before = await current.getAttribute("data-card-id");
  if (await page.getByTestId("quizcard").isVisible()) {
    const primary = page.getByTestId("quiz-primary");
    await page.getByTestId("quiz-option").first().click();
    if (!(await page.getByTestId("quiz-result").isVisible())) {
      await expect(primary).toBeEnabled();
      await primary.click();
    }
    await expect(page.getByTestId("quiz-result")).toBeVisible();
    await primary.click();
  } else {
    const card = page.getByTestId("flashcard");
    await page.getByTestId("flip").click();
    await expect(card).toHaveAttribute("data-flipped", "true");
    await page.getByTestId(`rate-${rating}`).click();
  }
  // Vänta tills nästa kort visas (eller sammanfattningen).
  await expect
    .poll(async () => {
      if (await page.getByTestId("session-summary").isVisible()) return "summary";
      // Mellan sista kortet och sammanfattningen finns inget kort: vänta inte på ett som aldrig kommer.
      const next = page.locator('[data-testid="flashcard"], [data-testid="quizcard"]').first();
      if ((await next.count()) === 0) return null;
      return next.getAttribute("data-card-id", { timeout: 1_000 }).catch(() => null);
    })
    .not.toBe(before);
}

export async function studyCards(page: Page, mode: "fsrs" | "free" | "random", count: number, rating: 1 | 2 | 3 | 4 | 5 = 4) {
  await startSession(page, mode);
  for (let i = 0; i < count; i++) {
    await rateCurrentCard(page, rating);
  }
}

export async function readLocalProgress(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("kuggfri:progress:v1");
    return raw ? (JSON.parse(raw).cards as Record<string, unknown>) : {};
  });
}

export const STUDENT_PASSWORD = "testlosenord-123";

/**
 * Efter registreringen: e-postbekräftelsen är påslagen (supabase/config.toml), så formuläret
 * byts mot "Kolla din inkorg". Hämtar bekräftelsemejlet ur Mailpit och öppnar länken, som
 * loggar in och leder dit registreringen pekade (next sparas i användarens metadata).
 * Länken i mejlet har site_url som värd; bara sökväg och query används, så att testerna
 * fungerar mot vilken baseURL som helst.
 */
export async function confirmSignupFromMail(page: Page, email: string) {
  await expect(page.getByTestId("check-inbox")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("check-inbox")).toContainText(email);
  const mail = await latestMailText(email, 20_000, "type=signup");
  const match = /href="([^"]*token_hash=[^"]*type=signup[^"]*)"/.exec(mail);
  if (!match?.[1]) throw new Error(`Ingen bekräftelselänk i mejlet till ${email}`);
  const link = new URL(match[1].replace(/&amp;/g, "&"));
  await page.goto(`${link.pathname}${link.search}`);
}

/**
 * Skickar registreringsformuläret på den aktuella sidan och bekräftar adressen via mejlet om
 * bekräftelse krävs. Med bekräftelsen avstängd loggas man in direkt, och då hoppas mejlet över.
 */
export async function submitRegistration(page: Page, email: string) {
  // Registreringen kräver att adressen står på en deltagarlista, precis som för riktiga studenter.
  await enrollTestEmail(email);
  const startPath = new URL(page.url()).pathname;
  await page.getByTestId("register-submit").click();
  const inbox = page.getByTestId("check-inbox");
  await expect
    .poll(async () => (await inbox.isVisible()) || new URL(page.url()).pathname !== startPath, { timeout: 20_000 })
    .toBe(true);
  if (await inbox.isVisible()) await confirmSignupFromMail(page, email);
}

export async function register(page: Page, email: string, password: string, next = "/hem", name = "E2E Testare") {
  await page.goto(`/registrera?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Namn").fill(name);
  await page.getByLabel("E-postadress").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await submitRegistration(page, email);
  await page.waitForURL((url) => !url.pathname.startsWith("/registrera"), { timeout: 20_000 });
}

/** Ny student med eget konto; konto krävs för att plugga. Returnerar e-postadressen. */
export async function registerStudent(page: Page, prefix = "student", next = "/hem"): Promise<string> {
  const email = uniqueEmail(prefix);
  await register(page, email, STUDENT_PASSWORD, next);
  return email;
}

/** Loggar ut via profilmenyn (sidomenyn på desktop, toppfältet på mobil) och landar på startsidan. */
export async function logout(page: Page) {
  if (!/\/(hem|kurser|konto|d\/|admin|om|integritet)/.test(page.url())) await page.goto("/hem");
  await page.getByTestId("profile-menu").filter({ visible: true }).first().click();
  await page.getByRole("menuitem", { name: "Logga ut" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });
  await expect(page.getByTestId("register-submit")).toBeVisible();
}

type StoredProgress = { card_id: string; due: string; self_rating: number | null; reps: number };

/** Kontots progress direkt ur databasen (service role, bara i testerna). */
export async function accountProgress(email: string): Promise<Record<string, StoredProgress>> {
  const admin = serviceClient();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const id = users?.users.find((u) => u.email === email)?.id;
  if (!id) throw new Error(`Hittade inte ${email}`);
  const { data, error } = await admin.from("card_progress").select("card_id, due, self_rating, reps").eq("user_id", id);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.card_id, r as StoredProgress]));
}

export async function login(page: Page, email: string, password: string, next = "/hem", timeout = 20_000) {
  await page.goto(`/logga-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-postadress").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/logga-in"), { timeout });
}

/** "N av M kort sedda" från hemsidan, där all statistik ligger sedan Kuggfri 2.0. */
export async function seenCountText(page: Page): Promise<string | null> {
  await page.goto("/hem");
  const seen = page.getByTestId("home-seen");
  await expect(seen).toContainText(" av ");
  return seen.textContent();
}

/**
 * Senaste mejlet till adressen i Mailpit (lokala Supabase-stacken), som HTML eller klartext.
 * Med mustContain väntar den tills det senaste mejlet innehåller texten (t.ex. "type=recovery"),
 * eftersom ett nytt konto först får bekräftelsemejlet.
 */
export async function latestMailText(email: string, timeoutMs = 20_000, mustContain?: string): Promise<string> {
  const base = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = (await (await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${base}/api/v1/message/${id}`)).json()) as { Text?: string; HTML?: string };
      const body = msg.HTML || msg.Text || "";
      if (!mustContain || body.includes(mustContain)) return body;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Inget mejl till ${email} inom ${timeoutMs} ms`);
}
