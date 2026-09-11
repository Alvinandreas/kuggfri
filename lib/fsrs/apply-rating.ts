import { reviewCard } from "./scheduler";
import type { CardProgress, ProgressMap, SelfRating, StudyMode } from "@/lib/progress/types";

/**
 * Enda vägen från en självskattning till ny progress.
 * Bara schemalagd repetition ('fsrs') ger något att spara. Fri och slumpad
 * repetition returnerar null och rör aldrig progressen.
 */
export function applyRating(input: {
  mode: StudyMode;
  cardId: string;
  rating: SelfRating;
  progress: ProgressMap;
  now?: Date;
}): CardProgress | null {
  if (input.mode !== "fsrs") return null;
  return reviewCard(input.cardId, input.progress[input.cardId], input.rating, input.now ?? new Date());
}
