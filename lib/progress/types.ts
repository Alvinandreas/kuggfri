/**
 * Progress per kort. Exakt samma fält som tabellen card_progress (utan user_id),
 * så att gästens localStorage och databasen kan bytas rakt av.
 * Datum lagras som ISO-strängar.
 */
export type CardProgress = {
  card_id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  /** 0 = New, 1 = Learning, 2 = Review, 3 = Relearning */
  state: 0 | 1 | 2 | 3;
  last_review: string | null;
  /** Senaste självskattning 1–5, eller null. */
  self_rating: SelfRating | null;
};

export type SelfRating = 1 | 2 | 3 | 4 | 5;

export const SELF_RATINGS: readonly SelfRating[] = [1, 2, 3, 4, 5];

export function isSelfRating(value: unknown): value is SelfRating {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** card_id -> progress */
export type ProgressMap = Record<string, CardProgress>;

/**
 * fsrs   = schemalagd repetition (uppdaterar FSRS-schemat)
 * free   = fri repetition (rör inte progressen)
 * random = slumpad genomkörning (rör inte progressen)
 * tricky = kluriga kort: låg skattning eller aldrig sedda (uppdaterar bara self_rating)
 */
export type StudyMode = "fsrs" | "free" | "random" | "tricky";

export function isStudyMode(value: unknown): value is StudyMode {
  return value === "fsrs" || value === "free" || value === "random" || value === "tricky";
}

/** En rad i repetitionshistoriken (tabellen review_log, eller localStorage för gäster). */
export type ReviewEntry = {
  card_id: string;
  rating: SelfRating;
  mode: StudyMode;
  reviewed_at: string;
};

/** Ett kort räknas som "klurigt" om det aldrig skattats eller senast fick 1–2. */
export function isTricky(progress: CardProgress | undefined): boolean {
  return !progress || progress.self_rating === null || progress.self_rating <= 2;
}
