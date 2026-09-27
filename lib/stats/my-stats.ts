/**
 * Fördjupad statistik för sidan Min statistik: rekord, rytm, skattningar och milstolpar.
 * Allt räknas ur repetitionshistoriken (och progressen där det behövs), så det blir samma
 * siffror för gäst och konto. Ren modul.
 */
import type { ReviewEntry } from "@/lib/progress/types";
import { computeStreak, localDayKey } from "@/lib/stats/progress-stats";
import { startOfDay } from "@/lib/time/day";

/** Mer än så här långt mellan två repetitioner räknas som ett nytt pass. */
export const SESSION_GAP_MS = 30 * 60 * 1000;
/** Längsta tid ett enskilt kort räknas som pluggtid; längre pauser inom ett pass är avbrott. */
export const MAX_CARD_MS = 3 * 60 * 1000;
/** Pluggtid för passets sista kort, som saknar en efterföljare att mäta mot. */
export const LAST_CARD_MS = 20 * 1000;

export type TimeOfDay = "morning" | "day" | "evening" | "night";
export const TIMES_OF_DAY: readonly TimeOfDay[] = ["morning", "day", "evening", "night"];

/** Morgon 05–10, dag 10–17, kväll 17–22, natt 22–05. */
export function timeOfDayOf(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export type MyStats = {
  totalReviews: number;
  /** Antal dagar med minst en repetition. */
  activeDays: number;
  /** Första dagen med en repetition (YYYY-MM-DD), null utan historik. */
  firstDay: string | null;
  /** Nuvarande streak, med frysningar (samma regler som hemsidan). */
  streak: number;
  /** Längsta streaken någonsin, med samma regler. Alltid minst lika lång som den nuvarande. */
  longestStreak: number;
  /** Dagen med flest repetitioner (den tidigaste vid lika). */
  bestDay: { day: string; reviews: number } | null;
  /** Snittskattning över all historik. */
  avgRating: number | null;
  /** Antal skattningar per värde, index 0 = skattning 1. */
  ratingCounts: [number, number, number, number, number];
  /** Repetitioner per veckodag, måndag först. */
  weekdayCounts: number[];
  /** Repetitioner per timme, 0–23. */
  hourCounts: number[];
  timeOfDay: Record<TimeOfDay, number>;
  /** Pass: repetitioner med högst SESSION_GAP_MS mellan sig. */
  sessions: number;
  /** Uppskattad pluggtid i minuter. */
  studyMinutes: number;
  /** Kort som någon gång fått 1–2 och senare fått 5. */
  comebacks: number;
  /** Repetitioner per dag, nyckel YYYY-MM-DD. */
  perDay: Map<string, number>;
};

/** Bygger all statistik ur historiken. Repetitioner för kort utanför `cardIds` räknas inte. */
export function buildMyStats(input: {
  cardIds: readonly string[];
  reviews: readonly ReviewEntry[];
  now?: Date;
  weekdaysOnly?: boolean;
}): MyStats {
  const now = input.now ?? new Date();
  const ids = new Set(input.cardIds);
  const reviews = input.reviews
    .filter((r) => ids.has(r.card_id))
    .slice()
    .sort((a, b) => Date.parse(a.reviewed_at) - Date.parse(b.reviewed_at));

  const perDay = new Map<string, number>();
  const ratingCounts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  const hourCounts = new Array<number>(24).fill(0);
  const timeOfDay: Record<TimeOfDay, number> = { morning: 0, day: 0, evening: 0, night: 0 };
  const struggled = new Set<string>();
  const comebacks = new Set<string>();
  let ratingSum = 0;
  let sessions = 0;
  let studyMs = 0;
  let prevTime: number | null = null;

  for (const r of reviews) {
    const t = Date.parse(r.reviewed_at);
    const d = new Date(t);
    const key = localDayKey(d);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
    ratingCounts[r.rating - 1]!++;
    ratingSum += r.rating;
    // getDay() har söndag = 0; vi vill ha måndag först.
    weekdayCounts[(d.getDay() + 6) % 7]!++;
    hourCounts[d.getHours()]!++;
    timeOfDay[timeOfDayOf(d.getHours())]++;

    if (r.rating <= 2) struggled.add(r.card_id);
    else if (r.rating === 5 && struggled.has(r.card_id)) comebacks.add(r.card_id);

    // Pass och pluggtid: varje kort räknas fram till nästa, med ett tak.
    if (prevTime === null || t - prevTime > SESSION_GAP_MS) {
      sessions++;
      if (prevTime !== null) studyMs += LAST_CARD_MS;
    } else {
      studyMs += Math.min(t - prevTime, MAX_CARD_MS);
    }
    prevTime = t;
  }
  if (prevTime !== null) studyMs += LAST_CARD_MS;

  let bestDay: MyStats["bestDay"] = null;
  for (const [day, n] of [...perDay].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!bestDay || n > bestDay.reviews) bestDay = { day, reviews: n };
  }

  const activeDays = new Set(perDay.keys());
  const weekdaysOnly = input.weekdaysOnly ?? false;
  const { streak } = computeStreak(activeDays, now, weekdaysOnly);

  return {
    totalReviews: reviews.length,
    activeDays: activeDays.size,
    firstDay: [...activeDays].sort()[0] ?? null,
    streak,
    longestStreak: Math.max(streak, longestStreak(activeDays, now, weekdaysOnly)),
    bestDay,
    avgRating: reviews.length === 0 ? null : ratingSum / reviews.length,
    ratingCounts,
    weekdayCounts,
    hourCounts,
    timeOfDay,
    sessions,
    studyMinutes: Math.round(studyMs / 60_000),
    comebacks: comebacks.size,
    perDay,
  };
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

/**
 * Längsta streaken någonsin, med samma regler som computeStreak: frysningar täcker enstaka
 * missade dagar och fylls på var sjunde aktiva dag, helger kan undantas. Går igenom varje
 * dag från den första aktiva till i dag och minns det högsta värdet.
 */
export function longestStreak(activeDays: ReadonlySet<string>, today: Date, weekdaysOnly = false): number {
  const sorted = [...activeDays].sort();
  const first = sorted[0];
  if (!first) return 0;
  // computeStreak ger streaken vid dagens slut; kör den med "i dag" = varje aktiv dag och
  // ta den största. Streaken kan bara växa på aktiva dagar, så det räcker att titta där.
  const todayKey = localDayKey(today);
  let best = 0;
  for (const key of sorted) {
    if (key > todayKey) break;
    best = Math.max(best, computeStreak(activeDays, parseDayKey(key), weekdaysOnly).streak);
  }
  return best;
}

/** Index för det största värdet, null om alla är noll. Vid lika vinner det första. */
export function favouriteIndex(counts: readonly number[]): number | null {
  let best: number | null = null;
  counts.forEach((n, i) => {
    if (n > 0 && (best === null || n > (counts[best] ?? 0))) best = i;
  });
  return best;
}

/** Vanligaste tiden på dygnet, null utan historik. */
export function favouriteTimeOfDay(counts: Record<TimeOfDay, number>): TimeOfDay | null {
  const i = favouriteIndex(TIMES_OF_DAY.map((t) => counts[t]));
  return i === null ? null : (TIMES_OF_DAY[i] ?? null);
}

export type HeatCell = {
  /** YYYY-MM-DD */
  day: string;
  date: Date;
  count: number;
  /** Färgsteg 0–4; 0 = ingen aktivitet. */
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  /** Dagar efter i dag i den innevarande veckan: ritas inte. */
  future: boolean;
};

/** Färgsteg relativt fönstrets bästa dag, i fyra lika breda steg. */
export function heatLevel(count: number, max: number): HeatCell["level"] {
  if (count <= 0 || max <= 0) return 0;
  const r = count / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

/**
 * Kalenderrutnät för aktivitetskartan: en kolumn per vecka (måndag först), den sista är
 * innevarande vecka. Datum stegas med kalenderdagar, inte millisekunder, så sommartid inte
 * flyttar någon dag.
 */
export function heatmapGrid(perDay: ReadonlyMap<string, number>, now: Date, weeks: number): { weeks: HeatCell[][]; max: number } {
  const today = startOfDay(now);
  const todayKey = localDayKey(today);
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset - (weeks - 1) * 7);
  const columns: HeatCell[][] = [];
  let max = 0;
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      const day = localDayKey(date);
      const future = day > todayKey;
      const count = future ? 0 : (perDay.get(day) ?? 0);
      max = Math.max(max, count);
      col.push({ day, date, count, level: 0, isToday: day === todayKey, future });
    }
    columns.push(col);
  }
  for (const col of columns) for (const c of col) c.level = heatLevel(c.count, max);
  return { weeks: columns, max };
}

/**
 * Slår ihop en dagsserie till veckor (måndag–söndag). Används när perioden är för lång för
 * en stapel per dag. Etiketten är veckans första dag i serien.
 */
export function weeklyTotals<T extends { day: string; label: string; reviews: number }>(series: readonly T[]): { key: string; label: string; reviews: number; days: number }[] {
  const out: { key: string; label: string; reviews: number; days: number }[] = [];
  for (const p of series) {
    const date = parseDayKey(p.day);
    const last = out[out.length - 1];
    if (!last || date.getDay() === 1) out.push({ key: p.day, label: p.label, reviews: p.reviews, days: 1 });
    else {
      last.reviews += p.reviews;
      last.days++;
    }
  }
  return out;
}

export type RankedArea<T> = T & { share: number; studied: number; known: number };

/**
 * Starkaste och svagaste områdena efter andel inlärda kort. Bara påbörjade områden räknas,
 * och listorna delar aldrig på ett område: med få påbörjade områden får de starka den
 * övre halvan och de svaga resten.
 */
export function rankAreas<T>(areas: readonly RankedArea<T>[], n = 3): { strongest: RankedArea<T>[]; weakest: RankedArea<T>[] } {
  const started = areas.filter((a) => a.studied > 0);
  const sorted = [...started].sort((a, b) => b.share - a.share || b.known - a.known);
  const strongCount = Math.min(n, Math.ceil(sorted.length / 2));
  const strongest = sorted.slice(0, strongCount);
  const weakest = sorted.slice(strongCount).reverse().slice(0, n);
  return { strongest, weakest };
}

export type MilestoneKey = "firstReview" | "reviews100" | "reviews1000" | "streak7" | "activeDays30" | "allSeen" | "halfLearned" | "comebacks10";

export type Milestone = { key: MilestoneKey; current: number; target: number; unlocked: boolean };

/** Milstolparna i visningsordning. Mål som beror på kursens storlek utelämnas utan kort. */
export function buildMilestones(input: {
  totalReviews: number;
  longestStreak: number;
  activeDays: number;
  seen: number;
  learned: number;
  totalCards: number;
  comebacks: number;
}): Milestone[] {
  const list: Array<[MilestoneKey, number, number]> = [
    ["firstReview", input.totalReviews, 1],
    ["reviews100", input.totalReviews, 100],
    ["streak7", input.longestStreak, 7],
    ["comebacks10", input.comebacks, 10],
    ["reviews1000", input.totalReviews, 1000],
    ["activeDays30", input.activeDays, 30],
  ];
  if (input.totalCards > 0) {
    list.push(["allSeen", input.seen, input.totalCards]);
    list.push(["halfLearned", input.learned, Math.ceil(input.totalCards / 2)]);
  }
  return list.map(([key, current, target]) => ({ key, current: Math.min(current, target), target, unlocked: current >= target }));
}

/** Andel per skattning 1–5 (0–1). */
export function ratingShares(counts: readonly number[]): number[] {
  const total = counts.reduce((s, n) => s + n, 0);
  return counts.map((n) => (total === 0 ? 0 : n / total));
}
