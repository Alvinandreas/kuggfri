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
import { EXAM_SIZE, EXTRA_SESSION_SIZE, examPhase, parseExamDate, planNewCards, type ExamPhase, type NewCardPlan } from "@/lib/study/plan";
import { filterCards, serializeSelection, trickyCardsFor, type SelectableCard, type Selection } from "@/lib/study/selection";
import { defaultSettings, filterKinds, sizeLimit, type SessionSettings } from "@/lib/study/session-settings";
import { routes } from "@/lib/routes";

export type DeckPlan = {
  phase: ExamPhase;
  /** Sant under slutrepetitionen: då gås hela urvalet igenom, inga nya kort doseras. */
  finalReview: boolean;
  /** Korten i urvalet, efter läge (kluriga kort filtrerar bort resten). */
  selectionCards: SelectableCard[];
  /** Antal kort läget skulle visa. Tentaläget har ett eget tak, och inställningen Antal kort ett. */
  selectionCount: number;
  /**
   * Kort passet kunde ha utan inställningen Antal kort, för valet "Alla (N)": urvalet, och
   * i schemalagt läge dagens kort (förfallna och doserade nya).
   */
  availableCount: number;
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
  /**
   * Plugga vidare när dagens schemalagda pass är klart: kort närmast att förfalla, sedan nya
   * kort utöver dosen. Alltid möjligt så länge urvalet har kort (Alvins beslut 30 sep 2026).
   */
  canExtra: boolean;
  extraCount: number;
  extraHref: string;
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
  /** Duggans antal frågor. Undefined = EXAM_SIZE (eller inställningarnas antal). */
  examSize?: number;
  /**
   * Passets inställningar (antal, nya kort, uppgiftstyper, osedda kluriga, områden i
   * slumpläget). Undefined = lägets standard, samma plan som innan inställningarna fanns.
   */
  settings?: SessionSettings;
  now?: Date;
}): DeckPlan {
  const now = input.now ?? new Date();
  const progress = input.progress ?? {};
  const s = input.settings ?? defaultSettings(input.mode);
  const limit = sizeLimit(s.size);
  const cap = (n: number) => (limit === undefined ? n : Math.min(limit, n));
  const cards = filterKinds(input.cards, s.kinds);

  const categorySelection: Selection =
    input.selectedIds.length > 0 ? { kind: "categories", categoryIds: [...input.selectedIds] } : { kind: "all" };
  const selectedCards = filterCards(cards, progress, categorySelection);
  const selectionCards = input.mode === "tricky" ? trickyCardsFor(selectedCards, progress, s.unseen) : selectedCards;
  const selectionLearned = selectionCards.filter((c) => progress[c.id]?.self_rating === 5).length;

  // Slumpläget går genom hela kursen, oavsett vilka kategorier som är valda, om inte
  // studenten valt att följa de ikryssade områdena.
  const randomAll = input.mode === "random" && !s.followAreas;
  const effectiveSelection: Selection = randomAll ? { kind: "all" } : categorySelection;
  const examLimit = input.examSize ?? (input.settings ? (limit ?? Number.POSITIVE_INFINITY) : EXAM_SIZE);
  const selectionCount =
    input.mode === "random"
      ? cap(randomAll ? cards.length : selectedCards.length)
      : input.mode === "exam"
        ? Math.min(examLimit, selectionCards.length)
        : input.mode === "fsrs"
          ? selectionCards.length
          : cap(selectionCards.length);
  const startHref = routes.study(input.deck.slug, { mode: input.mode, urval: serializeSelection(effectiveSelection) });

  const phase = examPhase(parseExamDate(input.deck.exam_date), now);
  const finalReview = phase.kind === "final";
  const selStats = input.progress ? queueStats(selectedCards.map((c) => c.id), input.progress, now) : null;
  const newCardPlan = selStats
    ? planNewCards({
        newRemaining: selStats.new,
        introducedToday: countIntroducedToday(input.reviews, now, input.progress ?? undefined),
        dailyGoal: input.dailyNew,
        phase,
      })
    : null;

  // Schemalagt: antal kort är ett tak på dagens pass (förfallna först), och utan nya kort
  // blir passet bara repetitioner. Taket gör passet kortare; det som blir kvar väntar.
  const seenCount = selStats ? selStats.total - selStats.new : 0;
  const allDue = selStats?.due ?? 0;
  const allNew = !s.newCards || finalReview ? 0 : Math.min(selStats?.new ?? 0, newCardPlan?.limit ?? 0);
  const sessionDue = cap(allDue);
  const sessionNew = Math.min(allNew, cap(allDue + allNew) - sessionDue);
  const sessionCards = finalReview ? cap(s.newCards ? selectionCount : seenCount) : sessionDue + sessionNew;
  const nothingDue = input.mode === "fsrs" && selStats !== null && sessionCards === 0;
  const moreNew = s.newCards ? cap(Math.min(input.dailyNew, selStats?.new ?? 0)) : 0;
  const extraCount = Math.min(limit ?? EXTRA_SESSION_SIZE, s.newCards ? selectedCards.length : seenCount);
  const fsrsHref = routes.study(input.deck.slug, { mode: "fsrs", urval: serializeSelection(categorySelection) });

  return {
    phase,
    finalReview,
    selectionCards,
    selectionCount,
    availableCount: input.mode === "fsrs" ? (finalReview ? (s.newCards ? selectionCards.length : seenCount) : allDue + allNew) : input.mode === "random" ? (randomAll ? cards.length : selectedCards.length) : selectionCards.length,
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
    canExtra: extraCount > 0,
    extraCount,
    extraHref: `${fsrsHref}&vidare=1`,
  };
}
