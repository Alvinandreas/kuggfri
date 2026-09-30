import { reviewCard, type ScheduleOptions } from "./scheduler";
import type { CardProgress, ProgressMap, SelfRating, StudyMode } from "@/lib/progress/types";

/**
 * Enda vägen från en självskattning till ny progress.
 *
 * Varje skattning räknas, i alla lägen (Alvins beslut 30 sep 2026): schemalagd repetition,
 * Plugga vidare, fri repetition, slumpad genomkörning, kluriga kort och dugga schemalägger
 * alla om kortet med FSRS. Tidiga repetitioner och flera repetitioner samma dag hanteras av
 * FSRS själv med den verkliga förflutna tiden (se kommentaren i scheduler.ts), så extra plugg
 * ger rätt effekt utan att blåsa upp intervallen.
 *
 * Läget tas fortfarande emot: det loggas i review_log och avgör vad passet visar, men inte
 * hur schemat räknas.
 */
export function applyRating(input: {
  mode: StudyMode;
  cardId: string;
  rating: SelfRating;
  progress: ProgressMap;
  now?: Date;
  /** Intervalltak (t.ex. dagar till tentan). Gäller i alla lägen. */
  schedule?: ScheduleOptions;
}): CardProgress {
  const now = input.now ?? new Date();
  return reviewCard(input.cardId, input.progress[input.cardId], input.rating, now, input.schedule);
}
