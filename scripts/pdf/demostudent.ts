/**
 * Demostudentens historik för studentguidens skärmbilder: 18 dagars plugg fram till i går, olika
 * mycket varje dag, med jämnt fördelad kunskap över områdena. Bara den LOKALA databasen.
 *
 *   npx tsx scripts/pdf/demostudent.ts <e-post>
 *
 * Skriver en SQL-sats (nollställer studentens data och lägger in historiken) och kör den med
 * `npx supabase db query` mot den lokala databasen. Anropas av scripts/pdf/skarmbilder-studentguide.cjs.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCourse } from "@/lib/content/store";

const EMAIL = process.argv[2];
if (!EMAIL || !EMAIL.endsWith("@kuggfri.test")) throw new Error("Ange ett lokalt testkonto (…@kuggfri.test).");
const DAYS = 18;
const DAY = 86_400_000;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261002);
const between = (a: number, b: number) => a + rnd() * (b - a);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

const { course } = loadCourse(process.cwd(), "materialteknik");
type C = { key: string; area: number; auto: boolean; difficulty: number };
const areas: C[][] = course.categories.map((cat, ai) => {
  // Lite olika svårt per område, men inom ett smalt band så att kunskapen blir jämnt fördelad.
  const areaDiff = between(0.25, 0.5);
  return cat.cards
    .filter((k) => k.active || k.review === "utkast")
    .map((k) => ({ key: k.key, area: ai, auto: k.kind === "alternativ" || k.kind === "sant-falskt", difficulty: clamp(areaDiff + between(-0.2, 0.2), 0, 1) }));
});

// Nya kort jämnt över områdena: nästa kort tas alltid från det område som ligger längst efter
// (lägst andel sedda), så att alla områden växer i samma takt.
const queue: C[] = [];
const cursors = areas.map(() => 0);
const total = areas.reduce((s, a) => s + a.length, 0);
while (queue.length < total) {
  let best = -1;
  let bestShare = Infinity;
  for (let ai = 0; ai < areas.length; ai++) {
    if (cursors[ai]! >= areas[ai]!.length) continue;
    const share = cursors[ai]! / areas[ai]!.length + rnd() * 0.01;
    if (share < bestShare) {
      bestShare = share;
      best = ai;
    }
  }
  queue.push(areas[best]![cursors[best]!++]!);
}

type State = { reps: number; lapses: number; last: number; due: number; rating: number; streak: number; card: C };
const state = new Map<string, State>();
const logs: { key: string; rating: number; mode: string; at: string }[] = [];
const sessions: { mode: string; start: string; end: string; n: number }[] = [];

// Gårdagen i svensk tid är sista dagen; i dag (demodagen) är orörd så att Dagens pass har kort.
const midnight = new Date();
midnight.setHours(0, 0, 0, 0);
const todayStart = midnight.getTime();
let next = 0;
for (let d = DAYS; d >= 1; d--) {
  const dayStart = todayStart - d * DAY;
  const weekday = new Date(dayStart + 12 * 3600_000).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const newToday = weekend ? Math.round(between(8, 14)) : [20, 20, 20, 15, 25, 30][Math.floor(rnd() * 6)]!;
  const reviewCap = weekend ? Math.round(between(20, 35)) : Math.round(between(35, 80));
  const due = [...state.values()].filter((s) => s.due <= dayStart + DAY).sort((a, b) => a.due - b.due).slice(0, reviewCap);
  const fresh = queue.slice(next, next + newToday);
  next += fresh.length;
  const items = [...due.map((s) => s.card), ...fresh];
  // Mest eftermiddag och kväll, ibland ett morgonpass.
  let t = dayStart + (rnd() < 0.2 ? between(7.5, 9.5) : between(15, 21.5)) * 3600_000;
  const start = t;
  let count = 0;
  for (const card of items) {
    const s = state.get(card.key) ?? { reps: 0, lapses: 0, last: 0, due: 0, rating: 0, streak: 0, card };
    const since = s.last ? (t - s.last) / DAY : 0;
    const recall = clamp(0.5 + 0.16 * s.reps + 0.12 - card.difficulty * 0.55 - (since > 7 ? 0.08 : 0), 0.05, 0.97);
    const x = recall + between(-0.2, 0.2);
    let r = x < 0.22 ? 1 : x < 0.38 ? 2 : x < 0.55 ? 3 : x < 0.75 ? 4 : 5;
    if (card.auto) {
      // Automaträttat: fel = 1, rätt = 3, 4, 5 för första, andra, tredje gången i rad.
      const correct = r >= 3;
      s.streak = correct ? s.streak + 1 : 0;
      r = correct ? Math.min(5, 2 + s.streak) : 1;
    }
    t += between(9, 38) * 1000;
    const mode = rnd() < 0.86 ? "fsrs" : rnd() < 0.5 ? "free" : "tricky";
    logs.push({ key: card.key, rating: r, mode, at: new Date(t).toISOString() });
    if (r <= 2 && s.reps > 0) s.lapses++;
    s.reps++;
    s.last = t;
    s.rating = r;
    const interval = r === 1 ? 0.4 : r === 2 ? 1 : r === 3 ? 2 : r === 4 ? 3 * s.reps : 6 * s.reps;
    s.due = t + interval * DAY;
    state.set(card.key, s);
    count++;
  }
  sessions.push({ mode: "fsrs", start: new Date(start).toISOString(), end: new Date(t).toISOString(), n: count });
}

const progress = [...state.values()].map((s) => ({
  key: s.card.key,
  due: new Date(s.due).toISOString(),
  stability: Math.round(Math.max(0.4, (s.due - s.last) / DAY) * 100) / 100,
  difficulty: Math.round(clamp(9 - s.rating * 1.3, 1, 10) * 100) / 100,
  scheduled_days: Math.max(0, Math.round((s.due - s.last) / DAY)),
  reps: s.reps,
  lapses: s.lapses,
  state: s.reps === 1 ? 1 : 2,
  last_review: new Date(s.last).toISOString(),
  self_rating: s.rating,
}));

const lit = (v: unknown) => `$demo$${JSON.stringify(v)}$demo$::jsonb`;
const sql = `with
u as (select id from auth.users where email = '${EMAIL}'),
dk as (select id from public.decks where slug = 'materialteknik'),
del_log as (delete from public.review_log where user_id in (select id from u) returning 1),
del_prog as (delete from public.card_progress where user_id in (select id from u) returning 1),
del_sess as (delete from public.study_sessions where user_id in (select id from u) returning 1),
del_exam as (delete from public.exam_attempts where user_id in (select id from u) returning 1),
ins_prog as (
  insert into public.card_progress (user_id, card_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, self_rating)
  select (select id from u), c.id, x.due, x.stability, x.difficulty, 0, x.scheduled_days, x.reps, x.lapses, x.state, x.last_review, x.self_rating
  from jsonb_to_recordset(${lit(progress)}) as x(key text, due timestamptz, stability float8, difficulty float8, scheduled_days int, reps int, lapses int, state int, last_review timestamptz, self_rating int)
  join public.cards c on c.key = x.key and c.deck_id = (select id from dk)
  on conflict (user_id, card_id) do update set due = excluded.due, stability = excluded.stability, difficulty = excluded.difficulty, elapsed_days = 0,
    scheduled_days = excluded.scheduled_days, reps = excluded.reps, lapses = excluded.lapses, state = excluded.state, last_review = excluded.last_review, self_rating = excluded.self_rating
  returning 1
),
ins_log as (
  insert into public.review_log (user_id, card_id, rating, mode, reviewed_at)
  select (select id from u), c.id, x.rating, x.mode, x.at
  from jsonb_to_recordset(${lit(logs)}) as x(key text, rating int, mode text, at timestamptz)
  join public.cards c on c.key = x.key and c.deck_id = (select id from dk)
  returning 1
),
ins_sess as (
  insert into public.study_sessions (user_id, deck_id, mode, started_at, ended_at, cards_reviewed)
  select (select id from u), (select id from dk), x.mode, x.start, x."end", x.n
  from jsonb_to_recordset(${lit(sessions)}) as x(mode text, start timestamptz, "end" timestamptz, n int)
  returning 1
)
select (select count(*) from u) as konto,
  (select count(*) from del_prog) as raderad_progress, (select count(*) from del_log) as raderade_repetitioner,
  (select count(*) from del_sess) as raderade_pass, (select count(*) from del_exam) as raderade_tentaforsok,
  (select count(*) from ins_prog) as ny_progress, (select count(*) from ins_log) as nya_repetitioner, (select count(*) from ins_sess) as nya_pass;
`;
const file = join(mkdtempSync(join(tmpdir(), "kuggfri-demo-")), "historik.sql");
writeFileSync(file, sql);
// Alltid den lokala databasen: inget --linked.
const out = execFileSync("npx", ["supabase", "db", "query", "-f", file], { encoding: "utf8", shell: true });
if (!/"ny_progress":\s*[1-9]/.test(out)) throw new Error(`Historiken lades inte in:
${out}`);

const byArea = course.categories.map((cat, ai) => {
  const mine = progress.filter((p) => state.get(p.key)!.card.area === ai);
  const learned = mine.filter((p) => p.self_rating === 5).length;
  return `${String(ai + 1).padStart(2)} ${cat.title.slice(0, 34).padEnd(34)} sedda ${String(mine.length).padStart(3)}/${String(areas[ai]!.length).padStart(3)}  inlärda ${Math.round((learned / areas[ai]!.length) * 100)} %`;
});
console.log(`kort med progress: ${progress.length} av ${total}, repetitioner: ${logs.length}, dagar: ${DAYS}`);
console.log(`per dag: ${sessions.map((s) => s.n).join(", ")}`);
console.log(`förfaller i dag: ${progress.filter((p) => Date.parse(p.due) < todayStart + DAY).length}`);
console.log(byArea.join("\n"));
