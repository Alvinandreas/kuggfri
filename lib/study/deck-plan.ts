/**
 * Vad ett tryck på "Starta" skulle ge: urval, dosering och den text som beskriver passet.
 *
 * Ren modul. Uträkningen låg tidigare som ett dussin useMemo i DeckOverview, där varje
 * regel (tentaläget tar 30 kort, slutrepetitionen tar allt, kluriga kort filtrerar
 * urvalet) bara gick att kontrollera genom att klicka sig fram i gränssnittet.
 */
import { queueStats } from "@/lib/fsrs/scheduler";
import type { ProgressMap, ReviewEntry, StudyMode } from "@/lib/progress/types";
import { countIntroducedToday } from "@/lib/stats/progress-stats";
import { EXAM_SIZE, examPhase, parseExamDate, planNewCards, type ExamPhase, type NewCardPlan } from "@/lib/study/plan";
import { filterCards, serializeSelection, trickyCards, type SelectableCard, type Selection } from "@/lib/study/selection";

export type DeckPlan = {
  phase: ExamPhase;
  /** Sant under slutrepetitionen: då gås hela urvalet igenom, inga nya kort doseras. */
  finalReview: boolean;
  /** Korten i urvalet, efter läge (kluriga kort filtrerar bort resten). */
  selectionCards: SelectableCard[];
  /** Antal kort läget skulle visa. Tentaläget har ett eget tak. */
  selectionCount: number;
  /** Hur många av korten i urvalet studenten skattat som säkra. */
  selectionLearned: number;
  /** Dosering för schemalagd repetition, eller null innan progress laddats. */
  newCardPlan: NewCardPlan | null;
  sessionDue: number;
  sessionNew: number;
  /** Kort i nästa schemalagda pass: förfallna + doserade nya. */
  sessionCards: number;
  /** Schemalagt läge utan något att göra just nu. */
  nothingDue: boolean;
  canStart: boolean;
  startHref: string;
  /** "Ta N nya kort till" när dagen är slut men nya kort finns kvar. */
  moreNew: number;
  moreHref: string;
};

export function planDeckSession(input: {
  deck: { slug: string; exam_date: string | null };
  cards: readonly SelectableCard[];
  /** Null innan progress laddats: allt räknas då som osett. */
  progress: ProgressMap | null;
  reviews: readonly ReviewEntry[];
  mode: StudyMode;
  /** Valda kategorier. Tom lista = hela kursen. */
  selectedIds: readonly string[];
  dailyNew: number;
  now?: Date;
}): DeckPlan {
  const now = input.now ?? new Date();
  const progress = input.progress ?? {};

  const categorySelection: Selection =
    input.selectedIds.length > 0 ? { kind: "categories", categoryIds: [...input.selectedIds] } : { kind: "all" };
  const selectedCards = filterCards(input.cards, progress, categorySelection);
  const selectionCards = input.mode === "tricky" ? trickyCards(selectedCards, progress) : selectedCards;
  const selectionLearned = selectionCards.filter((c) => progress[c.id]?.self_rating === 5).length;

  // Slumpläget går alltid genom hela kursen, oavsett vilka kategorier som är valda.
  const effectiveSelection: Selection = input.mode === "random" ? { kind: "all" } : categorySelection;
  const selectionCount =
    input.mode === "random" ? input.cards.length : input.mode === "exam" ? Math.min(EXAM_SIZE, selectionCards.length) : selectionCards.length;
  const startHref = `/d/${input.deck.slug}/plugga?mode=${input.mode}&urval=${encodeURIComponent(serializeSelection(effectiveSelection))}`;

  const phase = examPhase(parseExamDate(input.deck.exam_date), now);
  const finalReview = phase.kind === "final";
  const selStats = input.progress ? queueStats(selectedCards.map((c) => c.id), input.progress, now) : null;
  const newCardPlan = selStats
    ? planNewCards({
        newRemaining: selStats.new,
        introducedToday: countIntroducedToday(input.reviews, now),
        dailyGoal: input.dailyNew,
        phase,
      })
    : null;

  const sessionDue = selStats?.due ?? 0;
  const sessionNew = finalReview ? 0 : Math.min(selStats?.new ?? 0, newCardPlan?.limit ?? 0);
  const sessionCards = finalReview ? selectionCount : sessionDue + sessionNew;
  const nothingDue = input.mode === "fsrs" && selStats !== null && sessionCards === 0;
  const moreNew = Math.min(input.dailyNew, selStats?.new ?? 0);

  return {
    phase,
    finalReview,
    selectionCards,
    selectionCount,
    selectionLearned,
    newCardPlan,
    sessionDue,
    sessionNew,
    sessionCards,
    nothingDue,
    canStart: selectionCount > 0 && !nothingDue,
    startHref,
    moreNew,
    moreHref: `${startHref}&nya=${moreNew}`,
  };
}
