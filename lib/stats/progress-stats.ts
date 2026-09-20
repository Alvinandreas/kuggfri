/**
 * Statistik ur progress och repetitionshistorik. Ren modul.
 */
import { isTricky, type ProgressMap, type ReviewEntry } from "@/lib/progress/types";
import { estimateKnowledge, type KnowledgeEstimate } from "@/lib/fsrs/scheduler";

/**
 * Streak med frysningar. En missad dag bryter inte streaken så länge en frysning finns;
 * studenten börjar med STREAK_FREEZES_MAX och får en ny per sju aktiva dagar (upp till taket).
 * Allt räknas ur historiken, så det fungerar likadant för gäster och konton och kan aldrig
 * "gå sönder" av en synkmiss. I dag räknas aldrig som missad förrän dagen är slut.
 */
export const STREAK_FREEZES_MAX = 2;
export const STREAK_FREEZE_EVERY_ACTIVE_DAYS = 7;

import { DAY_MS, localDayKey, startOfDay } from "@/lib/time/day";

export { localDayKey };

export type DayPoint = {
  /** YYYY-MM-DD i lokal tid */
  day: string;
  /** Kort etikett, t.ex. "14/9" */
  label: string;
  /** Antal repetitioner den dagen */
  reviews: number;
  /** Antal unika kort som setts till och med dagen */
  seen: number;
  /** Antal kort vars senaste skattning var 5 vid dagens slut */
  learned: number;
};

export type ProgressStats = {
  totalCards: number;
  seen: number;
  learned: number;
  tricky: number;
  reviewsToday: number;
  totalReviews: number;
  /** Dagar i följd med minst en repetition, med frysningar för enstaka missade dagar. */
  streak: number;
  /** Frysningar kvar (missade dagar som inte bryter streaken). */
  freezesLeft: number;
  /** True om streaken hölls av en frysning senaste missade dagen. */
  freezeUsedRecently: boolean;
  /** Uppskattad kunskap just nu enligt FSRS (summa återkallelsesannolikheter). */
  knowledge: KnowledgeEstimate;
  /** Snittskattning senaste 7 dagarna, null om inga repetitioner. */
  avg7: number | null;
  series: DayPoint[];
  hasReviews: boolean;
};

function shortLabel(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function buildProgressStats(input: {
  cardIds: readonly string[];
  progress: ProgressMap;
  reviews: readonly ReviewEntry[];
  now?: Date;
  days?: number;
  /** Helger räknas inte som missade dagar i streaken. */
  weekdaysOnly?: boolean;
}): ProgressStats {
  const now = input.now ?? new Date();
  const days = input.days ?? 14;
  const ids = new Set(input.cardIds);

  // Endast historik som hör till decket, i tidsordning.
  const reviews = input.reviews
    .filter((r) => ids.has(r.card_id))
    .slice()
    .sort((a, b) => Date.parse(a.reviewed_at) - Date.parse(b.reviewed_at));

  // Per dag: antal repetitioner, och kunskapsläge vid dagens slut.
  const perDayCount = new Map<string, number>();
  const snapshotByDay = new Map<string, { seen: number; learned: number }>();
  const latest = new Map<string, number>();
  let learnedNow = 0;
  for (const r of reviews) {
    const key = localDayKey(new Date(r.reviewed_at));
    perDayCount.set(key, (perDayCount.get(key) ?? 0) + 1);
    const prev = latest.get(r.card_id);
    if (prev === 5) learnedNow--;
    latest.set(r.card_id, r.rating);
    if (r.rating === 5) learnedNow++;
    snapshotByDay.set(key, { seen: latest.size, learned: learnedNow });
  }

  // Serie för de senaste `days` dagarna, med framåtbärande ackumulering.
  const series: DayPoint[] = [];
  const today = startOfDay(now);
  const firstDay = new Date(today.getTime() - (days - 1) * DAY_MS);
  let carry = { seen: 0, learned: 0 };
  // Läget före fönstret: senaste snapshot före firstDay.
  for (const [key, snap] of snapshotByDay) {
    if (key < localDayKey(firstDay)) carry = snap;
  }
  for (let i = 0; i < days; i++) {
    const d = new Date(firstDay.getTime() + i * DAY_MS);
    const key = localDayKey(d);
    const snap = snapshotByDay.get(key);
    if (snap) carry = snap;
    series.push({ day: key, label: shortLabel(d), reviews: perDayCount.get(key) ?? 0, seen: carry.seen, learned: carry.learned });
  }

  // Streak med frysningar
  const todayKey = localDayKey(today);
  const { streak, freezesLeft, freezeUsedRecently } = computeStreak(new Set(perDayCount.keys()), today, input.weekdaysOnly ?? false);

  // Snitt senaste 7 dagarna
  const since = now.getTime() - 7 * DAY_MS;
  const recent = reviews.filter((r) => Date.parse(r.reviewed_at) >= since);
  const avg7 = recent.length === 0 ? null : recent.reduce((s, r) => s + r.rating, 0) / recent.length;

  // Nuläge ur progressen (täcker även progress som saknar historik)
  let seen = 0;
  let learned = 0;
  let tricky = 0;
  for (const id of input.cardIds) {
    const p = input.progress[id];
    if (p) seen++;
    if (p?.self_rating === 5) learned++;
    if (isTricky(p)) tricky++;
  }

  return {
    totalCards: input.cardIds.length,
    seen,
    learned,
    tricky,
    reviewsToday: perDayCount.get(todayKey) ?? 0,
    totalReviews: reviews.length,
    streak,
    freezesLeft,
    freezeUsedRecently,
    knowledge: estimateKnowledge(input.cardIds, input.progress, now),
    avg7,
    series,
    hasReviews: reviews.length > 0,
  };
}

/**
 * Går dag för dag från första aktiva dagen till i går (i dag räknas bara om den är aktiv).
 * Aktiv dag: streak +1, och var sjunde aktiva dag fylls en frysning på. Missad dag: en
 * frysning förbrukas om det finns någon, annars nollställs streaken. Helger kan undantas.
 */
export function computeStreak(
  activeDays: ReadonlySet<string>,
  today: Date,
  weekdaysOnly = false,
): { streak: number; freezesLeft: number; freezeUsedRecently: boolean } {
  const sorted = [...activeDays].sort();
  const first = sorted[0];
  if (!first) return { streak: 0, freezesLeft: STREAK_FREEZES_MAX, freezeUsedRecently: false };
  const [y, m, d] = first.split("-").map(Number);
  let cursor = new Date(y as number, (m as number) - 1, d as number);
  cursor.setHours(0, 0, 0, 0);
  const todayStart = startOfDay(today);
  let streak = 0;
  let freezes = STREAK_FREEZES_MAX;
  let activeCount = 0;
  let freezeUsedRecently = false;
  while (cursor.getTime() <= todayStart.getTime()) {
    const key = localDayKey(cursor);
    const isToday = cursor.getTime() === todayStart.getTime();
    if (activeDays.has(key)) {
      streak++;
      activeCount++;
      freezeUsedRecently = false;
      if (activeCount % STREAK_FREEZE_EVERY_ACTIVE_DAYS === 0) freezes = Math.min(STREAK_FREEZES_MAX, freezes + 1);
    } else if (isToday) {
      // Dagen är inte slut: ingen miss ännu.
    } else if (weekdaysOnly && (cursor.getDay() === 0 || cursor.getDay() === 6)) {
      // Helg: varken miss eller träff.
    } else if (streak > 0 && freezes > 0) {
      freezes--;
      freezeUsedRecently = true;
    } else {
      streak = 0;
      freezeUsedRecently = false;
    }
    cursor = new Date(cursor.getTime() + DAY_MS);
    cursor.setHours(0, 0, 0, 0);
  }
  return { streak, freezesLeft: freezes, freezeUsedRecently };
}

/** Antal kort vars första schemalagda repetition skedde i dag (räknas mot dagsmålet för nya kort). */
export function countIntroducedToday(reviews: readonly ReviewEntry[], now: Date): number {
  const today = localDayKey(now);
  const first = new Map<string, string>();
  for (const r of reviews) {
    if (r.mode !== "fsrs") continue;
    const day = localDayKey(new Date(r.reviewed_at));
    const prev = first.get(r.card_id);
    if (!prev || day < prev) first.set(r.card_id, day);
  }
  let n = 0;
  for (const day of first.values()) if (day === today) n++;
  return n;
}
