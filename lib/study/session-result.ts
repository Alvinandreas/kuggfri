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
import { EXTRA_SESSION_SIZE } from "@/lib/study/plan";
import { endOfDay } from "@/lib/time/day";

/** Dagsläget efter en schemalagd session: underlag för "Klar för i dag". */
export type TodaySummary = {
  reviewsToday: number;
  streak: number;
  freezesLeft: number;
  freezeUsedRecently: boolean;
  /** Uppskattat antal kort studenten kan just nu. */
  known: number;
  total: number;
  /** Inget förfallet kvar och dagsmålet nått: en tydlig slutpunkt. */
  done: boolean;
  /** Länk för att ta fler nya kort utöver dagsmålet, eller null. */
  continueHref: string | null;
  continueCount: number;
  /** Plugga vidare: nästa extra pass (kort närmast att förfalla, sedan nya), eller null. */
  extraHref: string | null;
  extraCount: number;
  /** Passet som just tog slut var ett Plugga vidare-pass. */
  extraPass: boolean;
};

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
  /** True när sessionen var ett Plugga vidare-pass. */
  extraPass?: boolean;
  /**
   * Löpnummer för passet i en kedja av fortsättningar (URL-parametern pass, 0 från kurssidan).
   * Länkarna vidare får nästa nummer, så att de aldrig pekar på exakt samma adress som passet
   * man står i: då skulle klicket inte starta något nytt pass.
   */
  pass?: number;
  /**
   * Passets inställningar i adressform (settingsQuery, plus t.ex. &original=1), som länkarna
   * vidare behåller: samma antal kort, samma val av nya kort.
   */
  suffix?: string;
  /** Inställningen Nya kort i dag. Av: inga "Ta N nya kort till", och Plugga vidare utan nya kort. */
  newCards?: boolean;
  /** Antal kort per pass enligt inställningarna. Undefined = EXTRA_SESSION_SIZE i Plugga vidare. */
  size?: number;
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
  const newCards = input.newCards ?? true;
  const continueCount = newCards ? Math.min(input.dailyNew, queue.new, input.size ?? Number.POSITIVE_INFINITY) : 0;
  const canContinue = continueCount > 0 && !input.finalReview;
  // Plugga vidare finns alltid när dagen är klar och urvalet har kort: ingen dos, inget tak.
  const extraCount = Math.min(input.size ?? EXTRA_SESSION_SIZE, newCards ? inSelection.length : inSelection.length - queue.new);
  const base = `/d/${input.deckSlug}/plugga?mode=fsrs&urval=${encodeURIComponent(serializeSelection(input.selection))}`;
  const next = `${input.suffix ?? ""}&pass=${(input.pass ?? 0) + 1}`;

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
      continueHref: canContinue ? `${base}&nya=${continueCount}${next}` : null,
      continueCount,
      extraHref: done && extraCount > 0 ? `${base}&vidare=1${next}` : null,
      extraCount,
      extraPass: input.extraPass ?? false,
    },
  };
}
