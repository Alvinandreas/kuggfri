/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Skärmbilderna till studentguiden, som en student ser tjänsten: ljust tema, 2x (dator) och 3x
 * (mobil), med numrerade markeringar. Skriver till docs/studentguide/bilder/.
 *
 *   node scripts/pdf/skarmbilder-studentguide.cjs [--ny-historik]
 *
 * Kräver testkopian på http://localhost:3001 och den lokala databasen. Skapar vid behov en
 * demostudent i den LOKALA databasen (guide-student@kuggfri.test, "Alex") med 18 dagars historik
 * (scripts/pdf/demostudent.ts), och vägrar köra mot något annat än localhost. Sista bilderna tas
 * efter ett kort pass, så studentens historik får några repetitioner till; --ny-historik börjar om.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "../..");
const { chromium } = require(path.join(ROOT, "node_modules/playwright"));
const { createClient } = require(path.join(ROOT, "node_modules/@supabase/supabase-js"));

const BASE = process.env.BASE || "http://localhost:3001";
const OUT = path.join(ROOT, "docs/studentguide/bilder");
const STUDENT = { email: "guide-student@kuggfri.test", password: "guide-student-123", name: "Alex" };
const SLUG = "materialteknik";

function localDb() {
  const env = Object.fromEntries(
    fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
  );
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.NEXT_PUBLIC_SUPABASE_URL)) throw new Error(`Inte den lokala databasen: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) throw new Error(`Inte en lokal adress: ${BASE}`);
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/** Demostudenten och, om den saknas eller --ny-historik, dess historik. */
async function prepare() {
  const db = localDb();
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  let user = list.users.find((u) => u.email === STUDENT.email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email: STUDENT.email, password: STUDENT.password, email_confirm: true, user_metadata: { display_name: STUDENT.name }, app_metadata: { kuggfri_skapad_av: "skript" } });
    if (error) throw error;
    user = data.user;
  }
  await db.from("profiles").update({ display_name: STUDENT.name }).eq("id", user.id);
  // Demostudenten står på Materialtekniks deltagarlista, som riktiga studenter.
  const { data: deck } = await db.from("decks").select("id").eq("slug", "materialteknik").single();
  await db.from("deck_enrollments").upsert({ deck_id: deck.id, email: STUDENT.email, user_id: user.id }, { onConflict: "deck_id,email" });
  const { count } = await db.from("card_progress").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  if (!count || process.argv.includes("--ny-historik")) {
    console.log("lägger in demohistorik …");
    execFileSync("npx", ["tsx", "scripts/pdf/demostudent.ts", STUDENT.email], { cwd: ROOT, stdio: "inherit", shell: true });
  }
}

/** Numrerad markering vid elementet. pos: l (vänster), r (höger), tl (övre vänstra hörnet), tr, ri (inne till höger). */
async function mark(page, selector, n, pos = "tl", dx = 0, dy = 0) {
  const ok = await page.evaluate(({ selector, n, pos, dx, dy }) => {
    const el = [...document.querySelectorAll(selector)].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const S = 28;
    const at = {
      tl: [r.left - S / 2, r.top - S / 2],
      tr: [r.right - S / 2, r.top - S / 2],
      l: [r.left - S - 8, r.top + r.height / 2 - S / 2],
      r: [r.right + 8, r.top + r.height / 2 - S / 2],
      ri: [r.right - S - 10, r.top + r.height / 2 - S / 2],
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

async function shotEl(page, selector, file, pad = 18, padTop = pad) {
  const box = await page.locator(selector).first().boundingBox();
  await page.screenshot({ path: file, clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - padTop), width: box.width + pad * 2, height: box.height + padTop + pad } });
}

/** Om något i kortet rullar (baksidan får inte plats på skärmen). */
const overflows = (page) =>
  page.evaluate(() => [...document.querySelectorAll('[data-testid="flashcard"] *')].some((e) => e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== "visible"));

/**
 * Går fram i passet till ett vändkort vars baksida får plats på skärmen, och sparar framsidan och
 * baksidan. Kort som inte passar hoppas över med pilen (ingen skattning sparas).
 */
async function shootFlipCard(page, front, back) {
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId("flip").isVisible().catch(() => false)) {
      const frontShot = await page.screenshot();
      await page.getByTestId("flip").click();
      await page.waitForTimeout(900);
      if (!(await overflows(page))) {
        fs.writeFileSync(front, frontShot);
        await page.screenshot({ path: back });
        return;
      }
    }
    await page.getByTestId("next").click();
    await page.waitForTimeout(450);
  }
  throw new Error("Hittade inget vändkort som får plats");
}

(async () => {
  await prepare();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // Logga in som studenten.
  const login = await browser.newContext({ baseURL: BASE, locale: "sv-SE" });
  const lp = await login.newPage();
  await lp.goto("/logga-in?next=%2Fhem", { timeout: 120000 });
  await lp.getByLabel("E-postadress").fill(STUDENT.email);
  await lp.locator('input[name="password"]').fill(STUDENT.password);
  await lp.getByTestId("login-submit").click();
  await lp.waitForURL((u) => !u.pathname.startsWith("/logga-in"), { timeout: 60000 });
  const storageState = await login.storageState();
  await login.close();

  const newCtx = async (viewport, scale, opts = {}) => {
    const ctx = await browser.newContext({ baseURL: BASE, storageState: opts.anon ? undefined : storageState, viewport, deviceScaleFactor: scale, colorScheme: "light", locale: "sv-SE", isMobile: scale === 3, hasTouch: scale === 3 });
    await ctx.addInitScript(() => { try { localStorage.setItem("kuggfri:theme", "light"); localStorage.removeItem("kuggfri:sidebar"); } catch {} });
    return ctx;
  };
  const errors = [];
  const go = async (page, url) => { await page.goto(url, { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(1000); };

  // 1. Kurslänken, utloggad: inbjudan och konto.
  {
    const ctx = await newCtx({ width: 1280, height: 820 }, 2, { anon: true });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await go(p, `/kurs/${SLUG}`);
    await p.screenshot({ path: path.join(OUT, "kurslank.png") });
    await ctx.close();
  }

  // 2. Hemsidan (dator), med markeringar.
  const desk = await newCtx({ width: 1280, height: 1130 }, 2);
  const p = await desk.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await go(p, "/hem");
  await mark(p, "main h1", 1, "l", 2);
  await mark(p, '[data-testid="home-streak"]', 2, "tl", 4, 0);
  await mark(p, '[data-testid="home-course"]', 3, "tl", 4, 4);
  await mark(p, '[data-testid="home-start"]', 4, "tl", 4, 0);
  await mark(p, '[data-testid="home-tricky"]', 5, "tl", 4, 2);
  await mark(p, '[data-testid="home-radar"]', 6, "tl", 4, 4);
  await mark(p, 'aside a[href="/statistik"]', 7, "ri", -6);
  await p.screenshot({ path: path.join(OUT, "hem.png") });

  // 3. Kurssidan: lägena och Ditt pass.
  await p.setViewportSize({ width: 1280, height: 1120 });
  await go(p, `/d/${SLUG}`);
  await mark(p, '[data-testid="mode-picker"]', 1, "tl", 4, 4);
  await mark(p, '[data-testid="selection-summary"]', 2, "l", -2);
  await mark(p, '[data-testid="session-settings"]', 3, "tl", 4, 4);
  await mark(p, '[data-testid="start-session"]', 4, "tl", 4, 0);
  await mark(p, '[data-testid="category-row"]', 5, "l", 2);
  await p.screenshot({ path: path.join(OUT, "kurssida.png") });

  // 4. Min statistik: nyckeltalen och aktiviteten.
  await p.setViewportSize({ width: 1280, height: 1000 });
  await go(p, "/statistik");
  await mark(p, '[data-testid="mystats-tiles"]', 1, "tl", 4, 4);
  await mark(p, '[data-testid="mystats-activity"]', 2, "tl", 4, 4);
  await mark(p, '[data-testid="mystats-growth"]', 3, "tl", 4, 4);
  await p.screenshot({ path: path.join(OUT, "statistik.png") });
  await desk.close();

  // 5. Mobilen: hemsidan, och ett vändkort fram och bak.
  {
    const ctx = await newCtx({ width: 390, height: 844 }, 3);
    const m = await ctx.newPage();
    m.on("pageerror", (e) => errors.push(e.message));
    await go(m, "/hem");
    await m.screenshot({ path: path.join(OUT, "mobil-hem.png") });
    await go(m, `/d/${SLUG}/plugga?mode=fsrs`);
    await shootFlipCard(m, path.join(OUT, "mobil-fram.png"), path.join(OUT, "mobil-bak.png"));
    await ctx.close();
  }

  // 6. Datorn: ett flervalskort före och efter svaret, och sammanfattningen efter ett kort pass.
  {
    // Högt fönster, så att förklaringen under ett besvarat flervalskort får plats.
    const ctx = await newCtx({ width: 1280, height: 1500 }, 2);
    const q = await ctx.newPage();
    q.on("pageerror", (e) => errors.push(e.message));
    // Ett pass på tjugo kort: välj 20 under Ditt pass och starta.
    await go(q, `/d/${SLUG}`);
    await q.getByTestId("session-settings").getByText("20", { exact: true }).click();
    await q.waitForTimeout(300);
    await q.getByTestId("start-session").click();
    await q.waitForURL(/plugga/, { timeout: 60000 });
    await q.waitForTimeout(1200);
    let quizShot = false;
    for (let i = 0; i < 80; i++) {
      if (await q.getByTestId("session-summary").isVisible().catch(() => false)) break;
      if (await q.getByTestId("flip").isVisible().catch(() => false)) {
        await q.keyboard.press("Space");
        await q.waitForTimeout(500);
        await q.keyboard.press(String(3 + (i % 3)));
      } else if (await q.getByTestId("quizcard").isVisible().catch(() => false)) {
        // Ett alternativ eller sant/falskt svarar direkt på siffran; flera rätta kräver Enter.
        const need = await q.getByTestId("quiz-instruction").innerText().catch(() => "");
        const n = Number((need.match(/Välj (\d+)/) || [])[1] || 0);
        if (n > 1 && !quizShot) {
          await shotEl(q, '[data-testid="quizcard"]', path.join(OUT, "quiz-fore.png"), 18);
          for (let k = 1; k <= n; k++) await q.keyboard.press(String(k));
          await q.keyboard.press("Enter");
          await q.waitForTimeout(800);
          await shotEl(q, '[data-testid="quizcard"]', path.join(OUT, "quiz-efter.png"), 18);
          quizShot = true;
        } else if (n > 1) {
          for (let k = 1; k <= n; k++) await q.keyboard.press(String(k));
          await q.keyboard.press("Enter");
        } else {
          await q.keyboard.press("1");
        }
        await q.waitForTimeout(600);
        await q.keyboard.press("Enter");
      }
      await q.waitForTimeout(700);
    }
    if (!quizShot) throw new Error("Passet hade ingen flervalsfråga med flera rätta svar");
    await q.setViewportSize({ width: 1280, height: 1150 });
    await q.waitForTimeout(800);
    await shotEl(q, '[data-testid="session-summary"]', path.join(OUT, "sammanfattning.png"), 18);
    await ctx.close();
  }

  await browser.close();
  console.log(errors.length ? `SIDFEL ${errors.join(" | ")}` : "klart, inga sidfel");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
