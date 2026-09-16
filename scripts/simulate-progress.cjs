/* eslint-disable @typescript-eslint/no-require-imports */
// Simulerar studieprogress för ett konto i den LOKALA databasen, så att progressvyn och
// diagrammen kan granskas utan att plugga i dagar. Rör aldrig produktion (kräver lokal URL).
//   node scripts/simulate-progress.cjs <e-post> [antal kort=90] [dagar=14]
const { Client } = require("pg");

const url = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error("Vägrar: DATABASE_URL pekar inte på en lokal databas.");
  process.exit(1);
}
const email = process.argv[2];
const cardCount = Number(process.argv[3] || 90);
const days = Number(process.argv[4] || 14);
if (!email) {
  console.error("Ange e-post.");
  process.exit(1);
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  const u = await c.query("select id from auth.users where email = $1", [email]);
  if (u.rowCount === 0) throw new Error(`hittar ingen användare ${email}`);
  const userId = u.rows[0].id;
  const cards = (await c.query("select c.id from public.cards c join public.decks d on d.id = c.deck_id where d.slug = 'materialteknik' and c.is_active order by c.sort_order")).rows;
  const chosen = cards.slice(0, Math.min(cardCount, cards.length));

  await c.query("begin");
  await c.query("delete from public.review_log where user_id = $1", [userId]);
  await c.query("delete from public.card_progress where user_id = $1", [userId]);

  const now = Date.now();
  const day = 86400000;
  let reviews = 0;
  for (let i = 0; i < chosen.length; i++) {
    const cardId = chosen[i].id;
    // Kort tidigt i decket är "äldre" (fler repetitioner), sena kort nyare.
    const firstDayAgo = Math.min(days - 1, Math.floor(((chosen.length - i) / chosen.length) * (days - 1)) + Math.floor(rnd() * 2));
    const reps = 1 + Math.min(4, Math.floor(firstDayAgo / 3) + Math.floor(rnd() * 2));
    let rating = pick([2, 3, 3, 4]);
    let last = null;
    // Sista repetitionen ligger 0–4 dagar bakåt (inte alla i dag), tidigare jämnt fördelade.
    const lastDayAgo = Math.min(firstDayAgo, Math.floor(rnd() * 5));
    for (let r = 0; r < reps; r++) {
      const dayAgo = reps === 1 ? firstDayAgo : Math.round(firstDayAgo - ((firstDayAgo - lastDayAgo) * r) / (reps - 1));
      const at = new Date(now - dayAgo * day - Math.floor(rnd() * 6) * 3600000);
      rating = Math.max(1, Math.min(5, rating + pick([0, 0, 1, 1, -1])));
      await c.query("insert into public.review_log (user_id, card_id, rating, mode, reviewed_at) values ($1, $2, $3, 'fsrs', $4)", [userId, cardId, rating, at]);
      last = at;
      reviews++;
    }
    const state = reps === 1 ? 1 : 2;
    const stability = 1 + reps * 3 + rnd() * 4;
    const dueIn = rating >= 4 ? Math.round(stability) : rating === 3 ? 2 : 0;
    await c.query(
      `insert into public.card_progress (user_id, card_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, self_rating)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [userId, cardId, new Date(last.getTime() + dueIn * day), stability, 4 + rnd() * 3, 0, dueIn, reps, rating <= 2 ? 1 : 0, state, last, rating],
    );
  }
  await c.query("commit");
  console.log(`Klart: ${chosen.length} kort, ${reviews} repetitioner över ${days} dagar för ${email} (lokalt).`);
  await c.end();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
