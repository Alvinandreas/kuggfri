/**
 * Ett pass: vad adressen säger (parsePassQuery) och vilka kort det blir (buildSessionQueue).
 *
 * Ren modul. Båda användes tidigare bara inne i passets sida och kö (StudySession), medan
 * sammanfattningens knappar ("Kör N kort till", "Ta N nya kort till", Plugga vidare) räknade
 * fram sina antal på egen hand. Antalet på knappen och passet knappen startade kunde då glida
 * isär: "Ta 2 nya kort till" startade ett vanligt schemalagt pass med alla förfallna kort plus
 * två nya, och blev 20 kort. Nu räknar knapparna med samma funktion som passet byggs med, och
 * tests/unit/study/session-links.test.ts låser att etikettens antal är passets längd.
 */
import type { ProgressMap, ReviewEntry, StudyMode } from "@/lib/progress/types";
import { isStudyMode } from "@/lib/progress/types";
import { countIntroducedToday } from "@/lib/stats/progress-stats";
import { first, flag, positiveInt, type SearchParamValue } from "@/lib/http/search-params";
import { EXTRA_SESSION_SIZE, examPhase, parseExamDate, planNewCards, type ExamPhase, type NewCardPlan } from "@/lib/study/plan";
import { filterCards, parseSelection, selectCardIds, type SelectableCard, type Selection } from "@/lib/study/selection";
import { parseSessionSettings, sizeLimit, type SessionSettings, type SettingsMode } from "@/lib/study/session-settings";

/** Det en adress till /d/[slug]/plugga beställer. */
export type PassRequest = {
  mode: StudyMode;
  selection: Selection;
  /**
   * nya=N ("Ta N nya kort till"): ett pass med bara nya kort, högst N, utöver dagsmålet.
   * Förfallna kort ingår inte, så att passet blir exakt så många nya kort som knappen sa.
   */
  extraNew: number | null;
  /** vidare=1: Plugga vidare (schemalagt läge). */
  extra: boolean;
  /** tak=N ("Kör N kort till"): högst N kort, så att passet inte växer efter att knappen visats. */
  max: number | null;
  /** Läget som inställningarna hör till (Stjärnmärkta har egna, fast passet är fri repetition). */
  settingsMode: SettingsMode;
  settings: SessionSettings;
  onlyStarred: boolean;
  /** Löpnummer i en kedja av fortsättningar från sammanfattningen (pass=). */
  pass: number;
};

type Query = Record<string, SearchParamValue>;

/** Läser passets adress. Okända parametrar (t.ex. det borttagna original=1) ignoreras. */
export function parsePassQuery(query: Query): PassRequest {
  const rawMode = first(query.mode);
  const mode: StudyMode = isStudyMode(rawMode) ? rawMode : "fsrs";
  const onlyStarred = flag(query.stjarnor);
  const settingsMode: SettingsMode = onlyStarred && mode === "free" ? "starred" : mode;
  return {
    mode,
    selection: parseSelection(query.urval),
    extraNew: positiveInt(query.nya, 200),
    extra: mode === "fsrs" && flag(query.vidare),
    max: positiveInt(query.tak, 10_000),
    settingsMode,
    settings: parseSessionSettings(settingsMode, query),
    onlyStarred,
    pass: positiveInt(query.pass, 10_000) ?? 0,
  };
}

export type SessionQueue = {
  /** Kort-id i den ordning passet visar dem. */
  order: string[];
  phase: ExamPhase;
  plan: NewCardPlan;
  /** Tak på nya kort som passet byggdes med. */
  maxNew: number | undefined;
  finalReview: boolean;
  /** Plugga vidare-pass. */
  extra: boolean;
};

/**
 * Passets kö ur korten (redan filtrerade på stjärnmärkta när det gäller), progress och
 * historik. Samma uträkning för passet självt och för knapparna som länkar till ett pass.
 */
export function buildSessionQueue(input: {
  cards: readonly SelectableCard[];
  progress: ProgressMap;
  reviews: readonly ReviewEntry[];
  request: Pick<PassRequest, "mode" | "selection" | "extraNew" | "extra" | "max" | "settings">;
  /** Studentens dagsmål för nya kort. */
  dailyNew: number;
  examDate: string | null;
  now?: Date;
  random?: () => number;
}): SessionQueue {
  const { mode, selection, extraNew, extra, max, settings } = input.request;
  const now = input.now ?? new Date();
  const phase = examPhase(parseExamDate(input.examDate), now);
  const inSelection = filterCards(input.cards, input.progress, selection);
  const newRemaining = inSelection.filter((c) => !input.progress[c.id] || input.progress[c.id]?.state === 0).length;
  const plan = planNewCards({
    newRemaining,
    introducedToday: countIntroducedToday(input.reviews, now, input.progress),
    dailyGoal: input.dailyNew,
    phase,
  });
  // Plugga vidare har ingen dos och ingen slutrepetition: kön är kort närmast att förfalla, sedan nya.
  const isExtra = mode === "fsrs" && extra;
  const finalReview = mode === "fsrs" && !isExtra && phase.kind === "final";
  const onlyNew = mode === "fsrs" && !finalReview && !isExtra && extraNew !== null;
  const maxNew = mode === "fsrs" && !finalReview && !isExtra ? (extraNew ?? plan.limit) : undefined;
  // Plugga vidare tar lika många kort som passets antal, annars ett block på EXTRA_SESSION_SIZE.
  const extraSize = isExtra ? (sizeLimit(settings.size) ?? EXTRA_SESSION_SIZE) : undefined;
  const queue = selectCardIds({
    cards: input.cards,
    progress: input.progress,
    mode,
    selection,
    now,
    random: input.random,
    maxNew,
    onlyNew,
    finalReview,
    extraSize,
    settings,
  });
  return { order: max === null ? queue : queue.slice(0, max), phase, plan, maxNew, finalReview, extra: isExtra };
}
