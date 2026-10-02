/* eslint-disable @typescript-eslint/no-require-imports */
// Simulerade studenter i den LOKALA databasen, så att examinatorns kursöversikt och statistik
// kan visas med innehåll (de kräver minst 5 studenter per område och kort). Rör aldrig
// produktionen: både databasen och Supabase-adressen måste vara lokala.
//
//   node scripts/verktyg/demo-studenter.cjs [antal=42] [dagar=21]   skapar (tar först bort gamla)
//   node scripts/verktyg/demo-studenter.cjs --ta-bort                tar bort alla demostudenter
//
// Kontona heter demo-<ms>-<nr>@kuggfri.test. Samma form som E2E-studenterna, så E2E-städningen
// (tests/e2e/global-teardown.ts) tar också bort dem. Progress och historik följer med (cascade).
//
// Modellen: varje student har ett engagemang (flitig, jämn, sporadisk eller slutade), pluggar
// dagens dos av nya kort och de kort som förfallit, och skattar utifrån kortets svårighet
// (områdets plus kortets egen) och hur många gånger kortet repeterats. Intervallen växer med
// skattningen, ungefär som FSRS. Allt är seedat, så samma körning ger samma siffror.
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const LOCAL = /^(postgresql|https?):\/\/[^/]*(127\.0\.0\.1|localhost)[:/]/;
if (!LOCAL.test(DB_URL) || !LOCAL.test(SUPABASE_URL)) {
  console.error("Vägrar: databasen eller Supabase-adressen är inte lokal.");
  process.exit(1);
}

const DECK_SLUG = "materialteknik";
const EMAIL_LIKE = "demo-%@kuggfri.test";
const DAY = 86400000;

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261002);
const between = (a, b) => a + rnd() * (b - a);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Områden som brukar ta emot (efter sorteringsordningen 0–13): fasdiagram, brott och utmattning,
// termiska egenskaper och diffusion, stål och värmebehandling. Övriga ligger nära medel.
const AREA_DIFFICULTY = { 3: 0.75, 6: 0.7, 7: 0.8, 8: 0.6, 2: 0.45, 5: 0.5 };

const PROFILES = [
  { name: "flitig", share: 0.25, activeDays: [0.75, 0.95], dose: 20, stopAfter: 1 },
  { name: "jämn", share: 0.35, activeDays: [0.45, 0.7], dose: 20, stopAfter: 1 },
  { name: "sporadisk", share: 0.25, activeDays: [0.15, 0.35], dose: 15, stopAfter: 1 },
  { name: "slutade", share: 0.15, activeDays: [0.6, 0.9], dose: 20, stopAfter: 0.3 },
];

function profileFor(i, n) {
  let acc = 0;
  for (const p of PROFILES) {
    acc += p.share;
    if (i / n < acc) return p;
  }
  return PROFILES[PROFILES.length - 1];
}

/** Skattning 1–5 utifrån svårighet (0–1), antal tidigare repetitioner och tid sedan förra. */
function rate(difficulty, reps, daysSince, skill) {
  const recall = clamp(0.35 + 0.17 * reps + skill - difficulty * 0.55 - (daysSince > 6 ? 0.1 : 0), 0.02, 0.97);
  const x = recall + between(-0.22, 0.22);
  if (x < 0.25) return 1;
  if (x < 0.42) return 2;
  if (x < 0.6) return 3;
  if (x < 0.8) return 4;
  return 5;
}

const INTERVAL = { 1: 0, 2: 1, 3: 2, 4: 5, 5: 9 };

async function removeDemo(db, pg) {
  const { rows } = await pg.query("select id from auth.users where email like $1", [EMAIL_LIKE]);
  for (const r of rows) {
    const { error } = await db.auth.admin.deleteUser(r.id);
    if (error) throw new Error(`Kunde inte ta bort ${r.id}: ${error.message}`);
  }
  await pg.query("delete from public.deck_enrollments where email like $1", [EMAIL_LIKE]);
  return rows.length;
}

(async () => {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const removed = await removeDemo(db, pg);
  if (process.argv.includes("--ta-bort")) {
    console.log(`Tog bort ${removed} demostudenter (lokalt).`);
    await pg.end();
    return;
  }
  const n = Number(process.argv[2] || 42);
  const days = Number(process.argv[3] || 21);

  const cards = (
    await pg.query(
      `select c.id, coalesce(cat.sort_order, 0) as area from public.cards c
       join public.decks d on d.id = c.deck_id left join public.categories cat on cat.id = c.category_id
       where d.slug = $1 and c.is_active order by cat.sort_order, c.sort_order`,
      [DECK_SLUG],
    )
  ).rows.map((c) => ({ id: c.id, difficulty: clamp((AREA_DIFFICULTY[c.area] ?? 0.35) + between(-0.25, 0.25), 0, 1) }));
  if (cards.length === 0) throw new Error("Hittar inga aktiva kort i Materialteknik.");

  const now = Date.now();
  const stamp = String(now);
  let totalReviews = 0;
  for (let i = 0; i < n; i++) {
    const profile = profileFor(i, n);
    const email = `demo-${stamp}-${i + 1}@kuggfri.test`;
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: `demo-${stamp}-${Math.floor(rnd() * 1e9)}`,
      email_confirm: true,
      user_metadata: { display_name: `Demostudent ${i + 1}` },
      app_metadata: { kuggfri_skapad_av: "skript" },
    });
    if (error) throw new Error(`Kunde inte skapa ${email}: ${error.message}`);
    const userId = data.user.id;
    // Demostudenterna står på kursens deltagarlista, som riktiga studenter.
    await pg.query(
      `insert into public.deck_enrollments (deck_id, email, user_id) select id, $2, $3 from public.decks where slug = $1 on conflict do nothing`,
      [DECK_SLUG, email, userId],
    );

    const skill = between(-0.12, 0.12);
    const startDay = Math.floor(between(0, days * 0.4)); // dagar efter periodens början
    const lastDay = Math.floor(startDay + (days - startDay) * profile.stopAfter);
    const pActive = between(...profile.activeDays);
    // Var och en tar korten i en egen, lätt blandad ordning (områdena i kursens ordning, blandat inom).
    const order = cards.map((c, k) => ({ c, key: k + between(0, 25) })).sort((a, b) => a.key - b.key).map((x) => x.c);
    const state = new Map(); // card id -> { reps, lapses, last, due, rating }
    const log = [];
    let next = 0;

    for (let d = startDay; d <= lastDay && d < days; d++) {
      if (d !== startDay && rnd() > pActive) continue;
      const dayStart = now - (days - d) * DAY;
      const hour = Math.floor(between(8, 22));
      let t = dayStart + hour * 3600000;
      const due = [...state.entries()].filter(([, s]) => s.due <= dayStart + DAY).map(([id]) => id);
      const fresh = order.slice(next, next + profile.dose);
      next += fresh.length;
      const queue = [...due, ...fresh.map((c) => c.id)];
      for (const id of queue) {
        const card = cards.find((c) => c.id === id);
        const s = state.get(id) ?? { reps: 0, lapses: 0, last: null, due: 0, rating: null };
        const since = s.last === null ? 0 : (t - s.last) / DAY;
        const r = rate(card.difficulty, s.reps, since, skill);
        const mode = rnd() < 0.85 ? "fsrs" : rnd() < 0.5 ? "free" : "tricky";
        t += Math.floor(between(8, 40)) * 1000;
        log.push([userId, id, r, mode, new Date(t).toISOString()]);
        s.reps += 1;
        if (r <= 2 && s.reps > 1) s.lapses += 1;
        s.last = t;
        s.rating = r;
        s.due = t + INTERVAL[r] * DAY * (r >= 4 ? Math.max(1, s.reps - 1) : 1);
        state.set(id, s);
      }
    }

    if (log.length === 0) continue;
    await pg.query("begin");
    await pg.query(
      `insert into public.review_log (user_id, card_id, rating, mode, reviewed_at)
       select * from unnest($1::uuid[], $2::uuid[], $3::int[], $4::text[], $5::timestamptz[])`,
      [log.map((l) => l[0]), log.map((l) => l[1]), log.map((l) => l[2]), log.map((l) => l[3]), log.map((l) => l[4])],
    );
    const ids = [...state.keys()];
    const st = ids.map((id) => state.get(id));
    await pg.query(
      `insert into public.card_progress (user_id, card_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, self_rating)
       select $1, * from unnest($2::uuid[], $3::timestamptz[], $4::float8[], $5::float8[], $6::int[], $7::int[], $8::int[], $9::int[], $10::int[], $11::timestamptz[], $12::int[])`,
      [
        userId,
        ids,
        st.map((s) => new Date(s.due).toISOString()),
        st.map((s) => 1 + s.reps * 2.5 * (s.rating / 3)),
        st.map((s) => clamp(9 - s.rating * 1.4, 1, 10)),
        st.map(() => 0),
        st.map((s) => Math.round((s.due - s.last) / DAY)),
        st.map((s) => s.reps),
        st.map((s) => s.lapses),
        st.map((s) => (s.reps === 1 ? 1 : 2)),
        st.map((s) => new Date(s.last).toISOString()),
        st.map((s) => s.rating),
      ],
    );
    await pg.query("commit");
    totalReviews += log.length;
  }

  console.log(`Klart: ${n} demostudenter, ${totalReviews} repetitioner över ${days} dagar (lokalt). Ta bort med --ta-bort.`);
  await pg.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
