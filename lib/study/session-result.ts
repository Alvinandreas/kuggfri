/**
 * Vad som visas när en schemalagd session är slut: nästa repetitionsdatum och
 * "Klar för i dag"-rutan.
 *
 * Ren modul. Regeln för när dagen räknas som klar fanns tidigare inbäddad i en
 * render-gren i StudySession och gick därför inte att testa. Den är den enda platsen
 * där slutpunkten definieras, så den förtjänar egna tester.
 */
import { countDueBy, nextDueDate, queueStats } from "@/lib/fsrs/scheduler";
import { buildProgressStats } from "@/lib/stats/progress-stats";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";
import { filterCards, serializeSelection, type SelectableCard, type Selection } from "@/lib/study/selection";
import { endOfDay } from "@/lib/time/day";
import type { TodaySummary } from "@/components/study/types";

export type SessionResult = {
  /** Nästa schemalagda repetition, och hur många kort som förfaller den dagen. */
  nextDue: { date: Date; count: number } | null;
  today: TodaySummary;
};

export function buildSessionResult(input: {
  deckSlug: string;
  cards: readonly SelectableCard[];
  progress: ProgressMap;
  reviews: readonly ReviewEntry[];
  selection: Selection;
  /** Studentens dagsmål för nya kort. */
  dailyNew: number;
  weekdaysOnly: boolean;
  /** True när sessionen var en slutrepetition inför tentan. */
  finalReview: boolean;
  now?: Date;
}): SessionResult {
  const now = input.now ?? new Date();
  const cardIds = input.cards.map((c) => c.id);

  const date = nextDueDate(cardIds, input.progress, now);
  const nextDue = date ? { date, count: countDueBy(cardIds, input.progress, endOfDay(date), now) } : null;

  const stats = buildProgressStats({ cardIds, progress: input.progress, reviews: input.reviews, now, weekdaysOnly: input.weekdaysOnly });
  const inSelection = filterCards(input.cards, input.progress, input.selection).map((c) => c.id);
  const queue = queueStats(inSelection, input.progress, now);

  // Dagen är klar när inget är förfallet. Nya kort kvar hindrar inte: de ingår i morgondagens
  // dos. Under slutrepetitionen inför tentan ska däremot allt gås igenom, så då räknas
  // kvarvarande nya kort som att dagen inte är slut.
  const done = queue.due === 0 && (queue.new === 0 || !input.finalReview);
  const continueCount = Math.min(input.dailyNew, queue.new);
  const canContinue = continueCount > 0 && !input.finalReview;

  return {
    nextDue,
    today: {
      reviewsToday: stats.reviewsToday,
      streak: stats.streak,
      freezesLeft: stats.freezesLeft,
      freezeUsedRecently: stats.freezeUsedRecently,
      known: Math.round(stats.knowledge.known),
      total: stats.totalCards,
      done,
      continueHref: canContinue
        ? `/d/${input.deckSlug}/plugga?mode=fsrs&urval=${encodeURIComponent(serializeSelection(input.selection))}&nya=${continueCount}`
        : null,
      continueCount,
    },
  };
}
