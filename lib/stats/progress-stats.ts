/**
 * Statistik ur progress och repetitionshistorik. Ren modul.
 */
import { isTricky, type ProgressMap, type ReviewEntry } from "@/lib/progress/types";

const DAY_MS = 24 * 60 * 60 * 1000;

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
  /** Dagar i följd med minst en repetition, räknat bakåt från i dag (eller i går om inget i dag). */
  streak: number;
  /** Snittskattning senaste 7 dagarna, null om inga repetitioner. */
  avg7: number | null;
  series: DayPoint[];
  hasReviews: boolean;
};

/** Lokal kalenderdag som YYYY-MM-DD. */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortLabel(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function buildProgressStats(input: {
  cardIds: readonly string[];
  progress: ProgressMap;
  reviews: readonly ReviewEntry[];
  now?: Date;
  days?: number;
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

  // Streak
  let streak = 0;
  const todayKey = localDayKey(today);
  let cursor = perDayCount.has(todayKey) ? today : new Date(today.getTime() - DAY_MS);
  while (perDayCount.has(localDayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

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
    avg7,
    series,
    hasReviews: reviews.length > 0,
  };
}
