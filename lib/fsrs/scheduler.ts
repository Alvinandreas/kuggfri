/**
 * FSRS-schemaläggning. Ren modul utan React- eller Supabase-beroenden.
 * All state är oföränderlig: funktionerna returnerar nya objekt.
 */
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type FSRS,
  type Grade,
} from "ts-fsrs";
import type { CardProgress, ProgressMap, SelfRating } from "@/lib/progress/types";
import { SELF_RATINGS } from "@/lib/progress/types";

/** Längsta intervall i dagar när inget tentadatum styr. */
export const DEFAULT_MAX_INTERVAL = 365;

/**
 * Parametrar. Korta inlärningssteg (1 min, 10 min) är avstängda eftersom
 * sessionen själv visar kort med skattning 1–2 igen innan den är slut.
 * Tabellen card_progress har därför inget fält för learning_steps.
 *
 * Fuzz är på: intervallen sprids några procent slumpmässigt (deterministiskt per kort)
 * så att kort som lärts in samma dag inte alla förfaller samma dag igen. Det jämnar
 * ut dagsbelastningen, samma skäl som i Anki.
 *
 * Intervalltaket kan sättas per anrop (tentadatum): ett kort ska aldrig schemaläggas
 * bortom tentan. ts-fsrs håller ändå ordningen Again < Hard < Good < Easy med minst en
 * dags mellanrum, så taket biter i praktiken först från fyra dagar.
 */
function makeScheduler(maxInterval: number): FSRS {
  return fsrs(
    generatorParameters({
      enable_fuzz: true,
      enable_short_term: false,
      maximum_interval: maxInterval,
    }),
  );
}

const schedulers = new Map<number, FSRS>();
function schedulerFor(maxInterval: number = DEFAULT_MAX_INTERVAL): FSRS {
  const key = Math.max(1, Math.round(maxInterval));
  let s = schedulers.get(key);
  if (!s) {
    s = makeScheduler(key);
    schedulers.set(key, s);
  }
  return s;
}

export type ScheduleOptions = {
  /** Längsta tillåtna intervall i dagar (t.ex. dagar kvar till tentan). */
  maxInterval?: number;
};

/** Spec: 1 -> Again, 2 -> Again, 3 -> Hard, 4 -> Good, 5 -> Easy. */
export function ratingToGrade(rating: SelfRating): Grade {
  switch (rating) {
    case 1:
    case 2:
      return Rating.Again;
    case 3:
      return Rating.Hard;
    case 4:
      return Rating.Good;
    case 5:
      return Rating.Easy;
  }
}

function toState(state: State): CardProgress["state"] {
  switch (state) {
    case State.New:
      return 0;
    case State.Learning:
      return 1;
    case State.Review:
      return 2;
    case State.Relearning:
      return 3;
    default:
      return 0;
  }
}

function fromState(state: CardProgress["state"]): State {
  switch (state) {
    case 0:
      return State.New;
    case 1:
      return State.Learning;
    case 2:
      return State.Review;
    case 3:
      return State.Relearning;
  }
}

/** Nytt, aldrig repeterat kort. Förfaller direkt. */
export function newProgress(cardId: string, now: Date = new Date()): CardProgress {
  const empty = createEmptyCard(now);
  return {
    card_id: cardId,
    due: empty.due.toISOString(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsed_days: empty.elapsed_days,
    scheduled_days: empty.scheduled_days,
    reps: empty.reps,
    lapses: empty.lapses,
    state: 0,
    last_review: null,
    self_rating: null,
  };
}

export function toFsrsCard(p: CardProgress): FsrsCard {
  return {
    due: new Date(p.due),
    stability: p.stability,
    difficulty: p.difficulty,
    elapsed_days: p.elapsed_days,
    scheduled_days: p.scheduled_days,
    learning_steps: 0,
    reps: p.reps,
    lapses: p.lapses,
    state: fromState(p.state),
    last_review: p.last_review ? new Date(p.last_review) : undefined,
  };
}

export function fromFsrsCard(cardId: string, card: FsrsCard, selfRating: SelfRating | null): CardProgress {
  return {
    card_id: cardId,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: toState(card.state),
    last_review: card.last_review ? card.last_review.toISOString() : null,
    self_rating: selfRating,
  };
}

/**
 * Schemalägger om ett kort efter en självskattning. Returnerar ett nytt
 * progressobjekt; indata muteras aldrig.
 */
export function reviewCard(
  cardId: string,
  previous: CardProgress | undefined,
  rating: SelfRating,
  now: Date = new Date(),
  options: ScheduleOptions = {},
): CardProgress {
  const current = previous ? toFsrsCard(previous) : toFsrsCard(newProgress(cardId, now));
  const { card } = schedulerFor(options.maxInterval).next(current, now, ratingToGrade(rating));
  return fromFsrsCard(cardId, card, rating);
}

/**
 * Förhandsvisning: när kortet kommer tillbaka för varje skattning 1–5, utan att
 * något sparas. Underlag för intervalltexten på skattningsknapparna.
 */
export function previewIntervals(
  cardId: string,
  previous: CardProgress | undefined,
  now: Date = new Date(),
  options: ScheduleOptions = {},
): Record<SelfRating, Date> {
  const current = previous ? toFsrsCard(previous) : toFsrsCard(newProgress(cardId, now));
  const preview = schedulerFor(options.maxInterval).repeat(current, now);
  const result = {} as Record<SelfRating, Date>;
  for (const r of SELF_RATINGS) result[r] = preview[ratingToGrade(r)].card.due;
  return result;
}

/**
 * Sannolikheten (0–1) att kortet kan återkallas just nu enligt FSRS. Ett aldrig
 * repeterat kort ger 0. Det här är "kunskap just nu" i statistiken.
 */
export function retrievability(progress: CardProgress | undefined, now: Date = new Date()): number {
  if (!progress || progress.state === 0) return 0;
  const r = schedulerFor().get_retrievability(toFsrsCard(progress), now, false);
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0;
}

export type KnowledgeEstimate = {
  /** Summan av återkallelsesannolikheter: "så många kort kan du just nu". */
  known: number;
  /** Andel 0–1 av alla kort i urvalet. */
  share: number;
  /** Antal kort med progress (underlaget). */
  reviewed: number;
  total: number;
};

/** Uppskattad kunskap just nu för ett urval kort. */
export function estimateKnowledge(cardIds: readonly string[], progress: ProgressMap, now: Date = new Date()): KnowledgeEstimate {
  let known = 0;
  let reviewed = 0;
  for (const id of cardIds) {
    const p = progress[id];
    if (!p || p.state === 0) continue;
    reviewed++;
    known += retrievability(p, now);
  }
  const total = cardIds.length;
  return { known, share: total === 0 ? 0 : known / total, reviewed, total };
}

/** Ett kort är förfallet om det saknar progress (nytt) eller om due har passerat. */
export function isDue(progress: CardProgress | undefined, now: Date = new Date()): boolean {
  if (!progress) return true;
  return new Date(progress.due).getTime() <= now.getTime();
}

export function isNew(progress: CardProgress | undefined): boolean {
  return !progress || progress.state === 0;
}

export type QueueStats = { due: number; new: number; total: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export type QueueOptions = {
  /** Högst så här många nya (aldrig sedda) kort i kön. Undefined = alla. */
  maxNew?: number;
};

/**
 * Bygger kön för schemalagd repetition: förfallna kort först, mest förfallna
 * först räknat i hela dagar, därefter nya kort. Kort med samma förfallodag
 * blandas slumpmässigt, liksom de nya korten, så att ordningen aldrig blir
 * densamma två sessioner i rad. Antalet nya kort kan begränsas (dosering).
 */
export function buildFsrsQueue(
  cardIds: readonly string[],
  progress: ProgressMap,
  now: Date = new Date(),
  random: () => number = Math.random,
  options: QueueOptions = {},
): string[] {
  const due: { id: string; day: number }[] = [];
  const fresh: string[] = [];
  for (const id of cardIds) {
    const p = progress[id];
    if (!p || p.state === 0) {
      fresh.push(id);
    } else if (isDue(p, now)) {
      due.push({ id, day: Math.floor(new Date(p.due).getTime() / DAY_MS) });
    }
  }
  const byDay = new Map<number, string[]>();
  for (const d of due) byDay.set(d.day, [...(byDay.get(d.day) ?? []), d.id]);
  const orderedDue = [...byDay.keys()].sort((a, b) => a - b).flatMap((day) => shuffleIds(byDay.get(day) ?? [], random));
  const shuffledFresh = shuffleIds(fresh, random);
  const limitedFresh = options.maxNew === undefined ? shuffledFresh : shuffledFresh.slice(0, Math.max(0, options.maxNew));
  return [...orderedDue, ...limitedFresh];
}

/**
 * Slutrepetition inför tentan: alla kort i urvalet, de med lägst återkallelsesannolikhet
 * först (aldrig sedda räknas som 0). Används de sista dagarna före tentan.
 */
export function buildFinalReviewQueue(
  cardIds: readonly string[],
  progress: ProgressMap,
  now: Date = new Date(),
  random: () => number = Math.random,
): string[] {
  const scored = shuffleIds(cardIds, random).map((id) => ({ id, r: retrievability(progress[id], now) }));
  scored.sort((a, b) => a.r - b.r);
  return scored.map((s) => s.id);
}

/** Fisher–Yates utan beroende på session-modulen (som importerar härifrån). */
export function shuffleIds(ids: readonly string[], random: () => number = Math.random): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = arr[i] as string;
    arr[i] = arr[j] as string;
    arr[j] = a;
  }
  return arr;
}

export function queueStats(cardIds: readonly string[], progress: ProgressMap, now: Date = new Date()): QueueStats {
  let due = 0;
  let fresh = 0;
  for (const id of cardIds) {
    const p = progress[id];
    if (!p || p.state === 0) fresh++;
    else if (isDue(p, now)) due++;
  }
  return { due, new: fresh, total: cardIds.length };
}

/** Tidigast kommande förfallodatum bland kort som inte redan är förfallna. */
export function nextDueDate(cardIds: readonly string[], progress: ProgressMap, now: Date = new Date()): Date | null {
  let best: number | null = null;
  for (const id of cardIds) {
    const p = progress[id];
    if (!p || p.state === 0) continue;
    const t = new Date(p.due).getTime();
    if (t > now.getTime() && (best === null || t < best)) best = t;
  }
  return best === null ? null : new Date(best);
}

/** Antal kort som förfaller senast vid en viss tidpunkt (men inte redan är förfallna nu). */
export function countDueBy(cardIds: readonly string[], progress: ProgressMap, by: Date, now: Date = new Date()): number {
  let n = 0;
  for (const id of cardIds) {
    const p = progress[id];
    if (!p || p.state === 0) continue;
    const t = new Date(p.due).getTime();
    if (t > now.getTime() && t <= by.getTime()) n++;
  }
  return n;
}

/** Nollställt schema men behållen skattning (motsvarar reset_schedule_keep_ratings i databasen). */
export function resetScheduleKeepRating(p: CardProgress, now: Date = new Date()): CardProgress {
  return { ...newProgress(p.card_id, now), self_rating: p.self_rating };
}
