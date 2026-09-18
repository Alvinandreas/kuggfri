import { newProgress, reviewCard, type ScheduleOptions } from "./scheduler";
import type { CardProgress, ProgressMap, SelfRating, StudyMode } from "@/lib/progress/types";

/**
 * Enda vägen från en självskattning till ny progress.
 * - fsrs: full omschemaläggning med FSRS.
 * - tricky: bara self_rating och last_review uppdateras; schemat lämnas orört
 *   (ett aldrig sett kort får en rad i state New så att det slutar räknas som klurigt).
 * - free, random och exam: null, progressen rörs aldrig.
 */
export function applyRating(input: {
  mode: StudyMode;
  cardId: string;
  rating: SelfRating;
  progress: ProgressMap;
  now?: Date;
  /** Schemalagt läge: intervalltak (t.ex. dagar till tentan). */
  schedule?: ScheduleOptions;
}): CardProgress | null {
  const now = input.now ?? new Date();
  switch (input.mode) {
    case "fsrs":
      return reviewCard(input.cardId, input.progress[input.cardId], input.rating, now, input.schedule);
    case "tricky": {
      const previous = input.progress[input.cardId] ?? newProgress(input.cardId, now);
      return { ...previous, self_rating: input.rating, last_review: now.toISOString() };
    }
    case "free":
    case "random":
    case "exam":
      return null;
  }
}
