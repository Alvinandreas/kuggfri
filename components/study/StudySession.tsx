"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Timer, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { percent } from "@/lib/text/percent";
import { applyRating } from "@/lib/fsrs/apply-rating";
import { previewIntervals, type ScheduleOptions } from "@/lib/fsrs/scheduler";
import {
  canGoPrevious,
  createSession,
  currentCardId,
  goPrevious,
  rateCurrent,
  remaining,
  skipCurrent,
  summarize,
  type SessionState,
} from "@/lib/fsrs/session";
import { SELF_RATINGS, type ProgressMap, type ReviewEntry, type SelfRating, type StudyMode } from "@/lib/progress/types";
import { DEFAULT_PREFS, readPrefs, type StudyPrefs } from "@/lib/progress/prefs";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { filterCards, selectCardIds, serializeSelection, type Selection } from "@/lib/study/selection";
import { examPhase, parseExamDate, planNewCards, type ExamPhase, type NewCardPlan } from "@/lib/study/plan";
import { buildSessionResult, type SessionResult } from "@/lib/study/session-result";
import { duggaExamSize, type DuggaSettings } from "@/lib/study/dugga";
import { readStars, useStars } from "@/lib/progress/stars";
import { playRatingSound } from "@/lib/ui/sound";
import { countIntroducedToday } from "@/lib/stats/progress-stats";
import { formatRelative } from "@/lib/time/format";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { autoRating, isAutoGraded, isCorrectAnswer } from "@/lib/cards/kinds";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Flashcard } from "./Flashcard";
import { QuizCard, type QuizResult } from "./QuizCard";
import { ReportDialog } from "./ReportDialog";
import { RatingButtons } from "./RatingButtons";
import { SessionHelpDialog } from "./SessionHelpDialog";
import { SessionSummary } from "./SessionSummary";
import { SessionToolbar } from "./SessionToolbar";
import type { StudyCard } from "./types";

export type { StudyCard };

type Props = {
  deck: { id: string; slug: string; title: string; exam_date: string | null };
  categories: { id: string; title: string }[];
  cards: StudyCard[];
  mode: StudyMode;
  selection: Selection;
  userId: string | null;
  /** Uttryckligt antal nya kort för den här sessionen (från "Ta N nya kort till"), utöver dagsmålet. */
  extraNew: number | null;
  /** Duggans regler (antal frågor, ledtrådar, tidtagning); null i övriga lägen. */
  dugga: DuggaSettings | null;
  /** Bara stjärnmärkta kort. */
  onlyStarred: boolean;
};

type SessionPlan = {
  phase: ExamPhase;
  plan: NewCardPlan;
  /** Tak på nya kort som sessionen byggdes med. */
  maxNew: number | undefined;
  finalReview: boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** "4:07" eller "1:02:09". */
function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function StudySession({ deck, categories, cards, mode, selection, userId, extraNew, dugga, onlyStarred }: Props) {
  const store = useProgressStore(userId);
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [prefs, setPrefs] = useState<StudyPrefs>(DEFAULT_PREFS);
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  /** Nyckel (kort + position) för det kort som är vänt. Ett nytt kort börjar alltid på framsidan. */
  const [flippedKey, setFlippedKey] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { stars, toggle: toggleStar } = useStars();
  const [elapsed, setElapsed] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [queued, setQueued] = useState(0);
  const startedAt = useRef(new Date());
  const loggedRef = useRef(false);

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c] as const)), [cards]);
  const categoryTitle = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.title ?? null) : null),
    [categories],
  );
  const colorIndex = useMemo(() => categoryColorIndex(categories), [categories]);

  // Ladda progress och historik och bygg kön en gång per lager/läge/urval. Kortlistan läses
  // via ref så att en ny arrayidentitet från servern inte startar om sessionen.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const selectionKey = `${mode}|${serializeSelection(selection)}|${extraNew ?? ""}|${JSON.stringify(dugga)}|${onlyStarred}`;
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      // Bara stjärnmärkta: urvalet krymper till de kort studenten markerat.
      const starred = onlyStarred ? new Set(readStars()) : null;
      const pool = starred ? cardsRef.current.filter((c) => starred.has(c.id)) : cardsRef.current;
      const ids = cardsRef.current.map((c) => c.id);
      let loaded: ProgressMap = {};
      let history: ReviewEntry[] = [];
      try {
        [loaded, history] = await Promise.all([store.load(ids), store.loadReviews(ids)]);
      } catch {
        loaded = {};
        history = [];
      }
      if (cancelled) return;
      const now = new Date();
      const currentPrefs = readPrefs(window.localStorage);
      const phase = examPhase(parseExamDate(deck.exam_date), now);
      const inSelection = filterCards(pool, loaded, selection);
      const newRemaining = inSelection.filter((c) => !loaded[c.id] || loaded[c.id]?.state === 0).length;
      const plan = planNewCards({
        newRemaining,
        introducedToday: countIntroducedToday(history, now),
        dailyGoal: currentPrefs.dailyNew,
        phase,
      });
      const finalReview = mode === "fsrs" && phase.kind === "final";
      const maxNew = mode === "fsrs" && !finalReview ? (extraNew ?? plan.limit) : undefined;
      const examSize = dugga ? duggaExamSize(dugga.size) : undefined;
      const order = selectCardIds({ cards: pool, progress: loaded, mode, selection, now, maxNew, finalReview, examSize });
      setPrefs(currentPrefs);
      setProgress(loaded);
      setReviews(history);
      setSessionPlan({ phase, plan, maxNew, finalReview });
      setSession(createSession(order, mode));
    })();
    return () => {
      cancelled = true;
    };
    // selection och extraNew ingår via selectionKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, mode, selectionKey, deck.exam_date]);

  const timing = !!dugga?.timer && !!session && !session.finished;
  useEffect(() => {
    if (!timing) return;
    const tick = () => setElapsed(Date.now() - startedAt.current.getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timing]);

  const schedule = useMemo<ScheduleOptions | undefined>(
    () => (sessionPlan?.phase.kind === "upcoming" ? { maxInterval: sessionPlan.phase.maxInterval } : undefined),
    [sessionPlan],
  );

  const currentId = session ? currentCardId(session) : null;
  const card = currentId ? (cardsById.get(currentId) ?? null) : null;
  const position = session?.position ?? 0;
  const total = session?.order.length ?? 0;
  const cardKey = currentId ? `${currentId}-${position}` : null;
  const flipped = cardKey !== null && flippedKey === cardKey;

  // Nytt kort: dölj ledtråd, meddela skärmläsare.
  useEffect(() => {
    setShowHint(false);
    if (session && !session.finished && currentId) {
      setAnnounce(sv.study.cardAnnounce(session.position + 1, session.order.length));
    }
    // Endast när kortet (eller dess position) byts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  // Ledtrådar: alltid, utom i en dugga där studenten valt bort dem.
  const hintAllowed = mode !== "exam" || !!dugga?.hints;

  const flip = useCallback(() => {
    if (!card || !cardKey) return;
    setFlippedKey((prev) => {
      const next = prev === cardKey ? null : cardKey;
      setAnnounce(next ? sv.study.flippedAnnounce : sv.study.front);
      return next;
    });
  }, [card, cardKey]);

  const [feedback, setFeedback] = useState<SelfRating | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  /** Sparar en skattning (progress enligt läget + historik). Delas av vändkort och automaträttade kort. */
  const persistRating = useCallback(
    (cardId: string, rating: SelfRating) => {
      if (!store || !progress) return;
      const now = new Date();
      const next = applyRating({ mode, cardId, rating, progress, now, schedule });
      if (next) {
        setProgress((p) => ({ ...(p ?? {}), [cardId]: next }));
        store
          .save(next)
          .then(() => setQueued(store.pending()))
          .catch(() => setSaveError(true));
      }
      // Historiken loggas i alla lägen (underlag för statistiken); progressen rörs bara enligt applyRating.
      const entry: ReviewEntry = { card_id: cardId, rating, mode, reviewed_at: now.toISOString() };
      setReviews((r) => [...r, entry]);
      store
        .logReview(entry)
        .then(() => setQueued(store.pending()))
        .catch(() => {
          // Historik är inte kritisk.
        });
    },
    [store, progress, mode, schedule],
  );

  const rate = useCallback(
    (rating: SelfRating) => {
      if (!session || session.finished || !card || !flipped || !store || !progress) return;
      if (feedback !== null) return; // Ett kort i taget: vänta tills kvittensen är klar.
      persistRating(card.id, rating);
      setAnnounce(sv.study.ratedAnnounce(rating));
      // Stämpla kortet, låt det glida ut, och visa först därefter nästa kort (på framsidan).
      setFeedback(rating);
      playRatingSound(rating);
      feedbackTimer.current = setTimeout(() => {
        setFeedback(null);
        setSession((s) => (s ? rateCurrent(s, rating) : s));
      }, 960);
    },
    [session, card, flipped, store, progress, feedback, persistRating],
  );

  // Automaträttade kort (Sant/Falskt, Alternativ). Resultatet hör till kortets plats i kön,
  // så att ett nytt kort alltid börjar obesvarat.
  const quiz = card !== null && isAutoGraded(card.kind) && card.options !== null && card.options.length >= 2;
  const [quizState, setQuizState] = useState<{ key: string; selected: number[]; result: QuizResult | null } | null>(null);
  const quizSelected = useMemo(() => (quizState && quizState.key === cardKey ? quizState.selected : []), [quizState, cardKey]);
  const quizResult = quizState && quizState.key === cardKey ? quizState.result : null;
  const quizMulti = quiz && card.kind === "alternativ" && (card.options?.filter((o) => o.correct).length ?? 0) > 1;

  const submitQuiz = useCallback(
    (chosen: number[]) => {
      if (!card || !cardKey || !card.options || !store || !progress || quizResult) return;
      if (chosen.length === 0) return;
      const correct = isCorrectAnswer(card.options, chosen);
      // En dugga är ett prov: rätt eller fel. Annars Alvins trappa 3 → 4 → 5 (lib/cards/kinds.ts).
      const rating: SelfRating = mode === "exam" ? (correct ? 5 : 1) : autoRating(correct, progress[card.id]?.self_rating);
      persistRating(card.id, rating);
      setQuizState({ key: cardKey, selected: chosen, result: { chosen, correct, rating } });
      setAnnounce(sv.quiz.answeredAnnounce(correct));
      playRatingSound(rating);
    },
    [card, cardKey, store, progress, quizResult, mode, persistRating],
  );

  const toggleQuizOption = useCallback(
    (index: number) => {
      if (!card || !cardKey || !card.options || quizResult) return;
      if (index < 0 || index >= card.options.length) return;
      if (!quizMulti) {
        submitQuiz([index]);
        return;
      }
      setQuizState((prev) => {
        const selected = prev && prev.key === cardKey ? prev.selected : [];
        const next = selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index].sort((a, b) => a - b);
        return { key: cardKey, selected: next, result: null };
      });
    },
    [card, cardKey, quizResult, quizMulti, submitQuiz],
  );

  const continueQuiz = useCallback(() => {
    if (!quizResult) return;
    const rating = quizResult.rating;
    setQuizState(null);
    setSession((s) => (s ? rateCurrent(s, rating, { requeue: false }) : s));
  }, [quizResult]);

  /** Mittenknappen och Enter på ett automaträttat kort: svara, eller gå vidare efter svaret. */
  const quizPrimary = useCallback(() => {
    if (quizResult) continueQuiz();
    else if (quizMulti) submitQuiz(quizSelected);
  }, [quizResult, quizMulti, quizSelected, continueQuiz, submitQuiz]);

  const next = useCallback(() => setSession((s) => (s ? skipCurrent(s) : s)), []);
  const previous = useCallback(() => setSession((s) => (s ? goPrevious(s) : s)), []);

  // Logga sessionen en gång när den är klar.
  useEffect(() => {
    if (!session?.finished || !store || loggedRef.current) return;
    loggedRef.current = true;
    const summary = summarize(session);
    store.logSession({ deckId: deck.id, mode, startedAt: startedAt.current, cardsReviewed: summary.reviewed }).catch(() => {
      // Loggning är inte kritisk.
    });
  }, [session, store, deck.id, mode]);

  // Tangentbord.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const onButton = e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.tagName === "A");
      if (quiz) {
        // Automaträttat kort: siffror väljer alternativ, Enter/mellanslag svarar eller går vidare.
        if (/^[1-9]$/.test(e.key)) {
          e.preventDefault();
          toggleQuizOption(Number(e.key) - 1);
          return;
        }
        if ((e.key === "Enter" || e.key === " ") && !onButton) {
          e.preventDefault();
          quizPrimary();
          return;
        }
        if (e.key === "ArrowRight" && quizResult) {
          e.preventDefault();
          continueQuiz();
          return;
        }
      }
      switch (e.key) {
        case " ":
          if (onButton) return;
          e.preventDefault();
          flip();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          e.preventDefault();
          rate(Number(e.key) as SelfRating);
          break;
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (mode !== "exam") previous();
          break;
        case "h":
        case "H":
          if (card?.hint && hintAllowed) {
            e.preventDefault();
            setShowHint((v) => !v);
          }
          break;
        default:
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip, rate, next, previous, card, mode, hintAllowed, quiz, quizResult, toggleQuizOption, quizPrimary, continueQuiz]);

  const canRate = flipped && !!card && feedback === null;

  // Intervalltext per skattning, bara i schemalagt läge och bara när kortet är vänt.
  const intervals = useMemo(() => {
    if (mode !== "fsrs" || !flipped || !card || !progress) return null;
    const now = new Date();
    const dates = previewIntervals(card.id, progress[card.id], now, schedule);
    const result = {} as Record<SelfRating, string>;
    for (const r of SELF_RATINGS) result[r] = formatRelative(dates[r], now);
    return result;
  }, [mode, flipped, card, progress, schedule]);

  const onSwipeLeft = useCallback(() => {
    if (canRate) rate(1);
    else next();
  }, [canRate, rate, next]);
  const onSwipeRight = useCallback(() => {
    if (canRate) rate(5);
    else if (mode !== "exam") previous();
  }, [canRate, rate, previous, mode]);

  if (!session || !progress || !sessionPlan) {
    return (
      <p role="status" className="py-16 text-center text-muted">
        {sv.study.loading}
      </p>
    );
  }

  if (session.order.length === 0) {
    return (
      <Card padding="lg" className="anim-fade-up mx-auto mt-10 w-full max-w-xl text-center">
        <p className="text-lg text-muted">{mode === "fsrs" ? sv.study.emptyFsrs : mode === "tricky" ? sv.study.emptyTricky : sv.study.empty}</p>
        <div className="mt-6">
          <LinkButton href={`/d/${deck.slug}`} variant="secondary">
            {sv.study.backToDeck}
          </LinkButton>
        </div>
      </Card>
    );
  }

  if (session.finished) {
    const summary = summarize(session);
    // Bara den schemalagda kön har en slutpunkt för dagen; övriga lägen är fria pass.
    const result: SessionResult | null =
      mode === "fsrs"
        ? buildSessionResult({
            deckSlug: deck.slug,
            cards,
            progress,
            reviews,
            selection,
            dailyNew: prefs.dailyNew,
            weekdaysOnly: prefs.weekdaysOnly,
            finalReview: sessionPlan.finalReview,
          })
        : null;
    return (
      <SessionSummary
        summary={summary}
        cardsById={cardsById}
        categories={categories}
        colorIndex={colorIndex}
        mode={mode}
        nextDue={result?.nextDue ?? null}
        today={result?.today ?? null}
        deckSlug={deck.slug}
        onPrevious={mode !== "exam" && canGoPrevious(session) ? previous : undefined}
        duration={dugga?.timer ? clock(elapsed) : null}
      />
    );
  }

  const progressPct = percent(position, total);
  const banner =
    mode !== "fsrs"
      ? null
      : sessionPlan.finalReview && sessionPlan.phase.kind === "final"
        ? sv.study.finalReviewBanner(sessionPlan.phase.daysLeft)
        : sessionPlan.plan.catchUp && sessionPlan.plan.neededPerDay !== null && extraNew === null
          ? sv.study.catchUpBanner(sessionPlan.plan.neededPerDay)
          : null;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <h1 className="sr-only">
        {deck.title} – {sv.study.position(position + 1, total)}
      </h1>
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <Link
          href={`/d/${deck.slug}`}
          aria-label={`${sv.study.backToDeck}: ${deck.title}`}
          className="group -my-1 inline-flex min-w-0 items-center gap-3 rounded-full py-1 pr-2 font-semibold text-fg"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong transition-colors group-hover:bg-surface-2">
            <X size={17} strokeWidth={2} aria-hidden />
          </span>
          <span className="truncate">{deck.title}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {dugga ? <Badge tone="accent">{sv.dugga.badge}</Badge> : null}
          {dugga?.timer ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 font-semibold tabular-nums" aria-label={`${sv.dugga.elapsed}: ${clock(elapsed)}`} data-testid="dugga-timer">
              <Timer size={14} aria-hidden />
              {clock(elapsed)}
            </span>
          ) : null}
          <span data-testid="remaining" className="rounded-full bg-surface-2 px-3 py-1 font-semibold tabular-nums">
            {mode === "exam" ? sv.study.examProgress(position + 1, total) : sv.study.remaining(remaining(session))}
          </span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${progressPct}%` }} />
      </div>
      {banner ? (
        <p className="rounded-lg bg-accent-soft px-4 py-2.5 text-center text-sm font-medium text-accent-ink" data-testid="session-banner">
          {banner}
        </p>
      ) : null}

      {card && quiz && card.options && (card.kind === "sant-falskt" || card.kind === "alternativ") ? (
        <QuizCard
          key={`${card.id}-${position}`}
          cardId={card.id}
          kind={card.kind}
          front={card.front}
          back={card.back}
          options={card.options}
          categoryTitle={categoryTitle(card.category_id)}
          categoryColorIndex={card.category_id ? (colorIndex.get(card.category_id) ?? 0) : 0}
          starred={stars.has(card.id)}
          onToggleStar={() => toggleStar(card.id)}
          result={quizResult}
          selected={quizSelected}
          onToggle={toggleQuizOption}
        />
      ) : card ? (
        <Flashcard
          key={`${card.id}-${position}`}
          cardId={card.id}
          front={card.front}
          back={card.back}
          eyebrow={card.kind === "begrepp" ? sv.quiz.conceptPrompt : null}
          hint={hintAllowed ? card.hint : null}
          categoryTitle={categoryTitle(card.category_id)}
          categoryColorIndex={card.category_id ? (colorIndex.get(card.category_id) ?? 0) : 0}
          flipped={flipped}
          showHint={showHint}
          feedback={feedback}
          starred={stars.has(card.id)}
          onToggleStar={() => toggleStar(card.id)}
          onFlip={flip}
          onToggleHint={() => setShowHint((v) => !v)}
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
        />
      ) : null}

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] gap-2 lg:mx-auto lg:w-full lg:max-w-xl">
        <Button variant="secondary" onClick={previous} disabled={mode === "exam" || !canGoPrevious(session)} aria-label={sv.study.previous} data-testid="prev">
          <ArrowLeft size={18} aria-hidden />
        </Button>
        {quiz ? (
          <Button onClick={quizPrimary} disabled={!quizResult && (!quizMulti || quizSelected.length === 0)} data-testid="quiz-primary">
            {quizResult ? sv.quiz.continue : quizMulti ? sv.quiz.submit : sv.quiz.pickOne}
          </Button>
        ) : (
          <Button onClick={flip} aria-pressed={flipped} data-testid="flip">
            {sv.study.flip}
          </Button>
        )}
        <Button variant="secondary" onClick={next} aria-label={mode === "fsrs" ? sv.study.skip : sv.study.next} data-testid="next">
          <ArrowRight size={18} aria-hidden />
        </Button>
      </div>

      {quiz ? (
        <p className="text-center text-xs text-muted" aria-hidden="true">
          {sv.quiz.keyboardHelp}
        </p>
      ) : (
        <div className="lg:mx-auto lg:w-full lg:max-w-xl">
          <RatingButtons disabled={!canRate} onRate={rate} intervals={intervals} />
        </div>
      )}

      <SessionToolbar onInfo={() => setHelpOpen(true)} onReport={() => setReportOpen(true)} canReport={!!card} />
      <SessionHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      {card ? <ReportDialog open={reportOpen} cardId={card.id} onClose={() => setReportOpen(false)} /> : null}

      {saveError ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger">
          {sv.study.saveError}
        </p>
      ) : queued > 0 ? (
        <p role="status" className="rounded-lg bg-surface-2 px-4 py-2.5 text-center text-sm text-muted" data-testid="queued-notice">
          {sv.study.queued(queued)}
        </p>
      ) : null}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
