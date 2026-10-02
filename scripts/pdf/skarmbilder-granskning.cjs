/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Skärmbilderna till granskningsguiderna, som en examinator ser granskningen: ljust tema, 2x
 * upplösning och numrerade markeringar. Skriver till docs/granskningsguide/bilder/.
 *
 *   node scripts/pdf/skarmbilder-granskning.cjs
 *
 * Kräver testkopian på http://localhost:3001 (se docs/Designsystem.pdf, avsnittet Skärmbilder) och
 * den lokala databasen. Skriptet skapar vid behov ett examinatorskonto i den LOKALA databasen
 * (guide-examinator@kuggfri.test) och vägrar köra mot något annat än localhost. Inget sparas i
 * granskningen: flaggpanelen öppnas och stängs med Esc.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const { chromium } = require(path.join(ROOT, "node_modules/playwright"));
const { createClient } = require(path.join(ROOT, "node_modules/@supabase/supabase-js"));

const BASE = process.env.BASE || "http://localhost:3001";
const OUT = path.join(ROOT, "docs/granskningsguide/bilder");
const EXAMINER = { email: "guide-examinator@kuggfri.test", password: "guide-examinator-123", name: "Examinator" };
// Korten i bilderna, med nyckel: ett vanligt kort per språk och ett kort som källgranskningen flaggat.
const CARD = { sv: "jarn-fas-vid-1000", en: "polymer-krackelering-vad-stammer" };
const FLAGGED = "vad-ar-cementit-och-nar-uppstar-det";

function localEnv() {
  const env = Object.fromEntries(
    fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
  );
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.NEXT_PUBLIC_SUPABASE_URL)) throw new Error(`Inte den lokala databasen: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) throw new Error(`Inte en lokal adress: ${BASE}`);
  return env;
}

/** Examinatorskontot i den lokala databasen, och korten och kursen som bilderna visar. */
async function prepare() {
  const env = localEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: deck } = await db.from("decks").select("id").eq("slug", "materialteknik").single();
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  let user = list.users.find((u) => u.email === EXAMINER.email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email: EXAMINER.email, password: EXAMINER.password, email_confirm: true, user_metadata: { display_name: EXAMINER.name }, app_metadata: { kuggfri_skapad_av: "skript" } });
    if (error) throw error;
    user = data.user;
  }
  await db.from("profiles").update({ display_name: EXAMINER.name }).eq("id", user.id);
  const { error } = await db.from("deck_examiners").upsert({ deck_id: deck.id, user_id: user.id }, { onConflict: "deck_id,user_id" });
  if (error) throw error;
  const { data: cards } = await db.from("cards").select("id, key, category_id").eq("deck_id", deck.id).in("key", [CARD.sv, CARD.en, FLAGGED]);
  const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
  const setLang = async (lang) => {
    const { error: e } = await db.from("profiles").update({ lang }).eq("id", user.id);
    if (e) throw e;
  };
  return { deckId: deck.id, card: { sv: byKey[CARD.sv], en: byKey[CARD.en] }, flagged: byKey[FLAGGED], setLang };
}

/** Lägger en numrerad markering vid elementet. pos: l (vänster), ri (inne till höger), g/gt (i marginalen), tl (övre hörnet). */
async function mark(page, selector, n, pos = "tl", dx = 0, dy = 0) {
  const ok = await page.evaluate(({ selector, n, pos, dx, dy }) => {
    const el = [...document.querySelectorAll(selector)].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const S = 28;
    const at = {
      tl: [r.left - S / 2, r.top - S / 2],
      l: [r.left - S - 8, r.top + r.height / 2 - S / 2],
      ri: [r.right - S - 10, r.top + r.height / 2 - S / 2],
      g: [r.left - S - 2, r.top + r.height / 2 - S / 2],
      gt: [r.left - S - 2, r.top + 2],
    }[pos];
    const b = document.createElement("div");
    b.textContent = String(n);
    Object.assign(b.style, {
      position: "absolute", left: `${at[0] + window.scrollX + dx}px`, top: `${at[1] + window.scrollY + dy}px`, width: `${S}px`, height: `${S}px`,
      borderRadius: "999px", background: "#1f7a4d", color: "#fff", font: "800 14px/28px Figtree, sans-serif", textAlign: "center",
      boxShadow: "0 0 0 3px #fff, 0 4px 12px rgb(0 0 0 / 0.25)", zIndex: 99999, pointerEvents: "none",
    });
    document.body.appendChild(b);
    return true;
  }, { selector, n, pos, dx, dy });
  if (!ok) throw new Error(`Hittade inte ${selector}`);
}

/** Skärmbild av ett element med marginal (i fönstrets koordinater; helsidesläge ändrar layouten). */
async function shotEl(page, selector, file, pad = 18, padTop = pad) {
  const box = await page.locator(selector).first().boundingBox();
  await page.screenshot({ path: file, clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - padTop), width: box.width + pad * 2, height: box.height + padTop + pad } });
}

(async () => {
  const { deckId, card, flagged, setLang } = await prepare();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // Logga in som examinatorn.
  const login = await browser.newContext({ baseURL: BASE, locale: "sv-SE" });
  const lp = await login.newPage();
  await lp.goto("/logga-in?next=%2Fhem", { timeout: 120000 });
  await lp.getByLabel("E-postadress").fill(EXAMINER.email);
  await lp.locator('input[name="password"]').fill(EXAMINER.password);
  await lp.getByTestId("login-submit").click();
  await lp.waitForURL((u) => !u.pathname.startsWith("/logga-in"), { timeout: 60000 });
  const storageState = await login.storageState();
  await login.close();

  for (const lang of ["sv", "en"]) {
    const ctx = await browser.newContext({ baseURL: BASE, storageState, viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: "light", locale: lang === "en" ? "en-GB" : "sv-SE" });
    await ctx.addInitScript(() => { try { localStorage.setItem("kuggfri:theme", "light"); localStorage.removeItem("kuggfri:sidebar"); } catch {} });
    // Språket är kontots (Konto → Språk): engelska för den engelska guiden, sedan tillbaka.
    await setLang(lang);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const go = async (url) => { await page.goto(url, { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(900); };
    const tabs = lang === "en" ? 'nav[aria-label="Review tabs"]' : 'nav[aria-label="Granskningens flikar"]';
    const own = card[lang];

    // 1. Fönstret: sidomenyn och granskningssidan, med markeringar i sidans marginal.
    await go(`/admin/deck/${deckId}/granskning`);
    await mark(page, 'aside a[href$="/granskning"]', 1, "ri", -46);
    let n = 2;
    await mark(page, '[data-testid="review-overview"]', n++, "gt");
    await mark(page, tabs, n++, "g");
    await mark(page, '[data-testid="review-area-filter"]', n++, "g");
    await mark(page, '[data-testid="review-group-toggle"]', n++, "g");
    await mark(page, '[data-testid="review-start"]', n++, "tl", -6, -2);
    await page.screenshot({ path: path.join(OUT, `${lang}-fonster.png`) });

    // 2. Ett vanligt kort: högt fönster och hopfälld sidomeny, så att hela kortet syns utan att rulla.
    await page.setViewportSize({ width: 1280, height: 1700 });
    await ctx.addInitScript(() => { try { localStorage.setItem("kuggfri:sidebar", "collapsed"); } catch {} });
    await go(`/admin/deck/${deckId}/granskning?kort=${own.id}&omrade=${own.category_id}`);
    n = 1;
    await mark(page, '[data-testid="review-prev"]', n++, "l");
    await mark(page, '[data-testid="review-status-line"]', n++, "l", 0, -16);
    if (lang === "en") await mark(page, '[data-testid="review-translation-switch"]', n++, "l");
    await mark(page, '[data-testid="review-card-view"] .anim-fade-in', n++, "l");
    await mark(page, '[data-testid="review-sources"]', n++, "l");
    await mark(page, '[data-testid="review-actions"]', n++, "l");
    await shotEl(page, '[data-testid="review-card-view"]', path.join(OUT, `${lang}-kort.png`), 50, 14);

    // 3. Ett flaggat kort från källgranskningen (den svenska guiden).
    if (lang === "sv") {
      await go(`/admin/deck/${deckId}/granskning?kort=${flagged.id}&omrade=${flagged.category_id}`);
      await shotEl(page, '[data-testid="review-card-view"]', path.join(OUT, "sv-flaggat.png"), 20, 14);
    }

    // 4. Flaggpanelen (öppnas med F, stängs med Esc utan att sparas).
    await go(`/admin/deck/${deckId}/granskning?kort=${own.id}&omrade=${own.category_id}`);
    await page.keyboard.press("f");
    await page.waitForTimeout(400);
    await page.keyboard.type(lang === "en" ? "Please use the same term as in the lecture notes." : "Använd samma term som i föreläsningsanteckningarna.");
    await page.waitForTimeout(300);
    await shotEl(page, '[data-testid="review-actions"]', path.join(OUT, `${lang}-flaggpanel.png`), 18);
    await page.keyboard.press("Escape");

    console.log(lang, errors.length ? `SIDFEL ${errors.join(" | ")}` : "klart, inga sidfel");
    await ctx.close();
  }
  await setLang("sv");
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
