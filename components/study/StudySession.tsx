"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { countIntroducedToday } from "@/lib/stats/progress-stats";
import { formatRelative } from "@/lib/time/format";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { Button, LinkButton } from "@/components/ui/Button";
import { Flashcard } from "./Flashcard";
import { ReportDialog } from "./ReportDialog";
import { RatingButtons } from "./RatingButtons";
import { SessionSummary } from "./SessionSummary";
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
};

type SessionPlan = {
  phase: ExamPhase;
  plan: NewCardPlan;
  /** Tak på nya kort som sessionen byggdes med. */
  maxNew: number | undefined;
  finalReview: boolean;
};

/** Under så här många ms från visning till vändning räknas vändningen som "säker". */
const CONFIDENT_FLIP_MS = 2500;
/** Så länge stannar ett säkert-men-fel-kort innan nästa visas. */
const CONFIDENT_STAY_MS = 2600;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function StudySession({ deck, categories, cards, mode, selection, userId, extraNew }: Props) {
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
  const [announce, setAnnounce] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [queued, setQueued] = useState(0);
  const startedAt = useRef(new Date());
  const loggedRef = useRef(false);
  /** När aktuellt kort visades och när det vändes första gången (kalibrering). */
  const shownAt = useRef<number>(Date.now());
  const flippedAt = useRef<number | null>(null);
  const [confidentWrong, setConfidentWrong] = useState(false);

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
  const selectionKey = `${mode}|${serializeSelection(selection)}|${extraNew ?? ""}`;
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
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
      const inSelection = filterCards(cardsRef.current, loaded, selection);
      const newRemaining = inSelection.filter((c) => !loaded[c.id] || loaded[c.id]?.state === 0).length;
      const plan = planNewCards({
        newRemaining,
        introducedToday: countIntroducedToday(history, now),
        dailyGoal: currentPrefs.dailyNew,
        phase,
      });
      const finalReview = mode === "fsrs" && phase.kind === "final";
      const maxNew = mode === "fsrs" && !finalReview ? (extraNew ?? plan.limit) : undefined;
      const order = selectCardIds({ cards: cardsRef.current, progress: loaded, mode, selection, now, maxNew, finalReview });
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
    shownAt.current = Date.now();
    flippedAt.current = null;
    setConfidentWrong(false);
    if (session && !session.finished && currentId) {
      setAnnounce(sv.study.cardAnnounce(session.position + 1, session.order.length));
    }
    // Endast när kortet (eller dess position) byts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  const flip = useCallback(() => {
    if (!card || !cardKey) return;
    setFlippedKey((prev) => {
      const next = prev === cardKey ? null : cardKey;
      if (next && flippedAt.current === null) flippedAt.current = Date.now();
      setAnnounce(next ? sv.study.flippedAnnounce : sv.study.front);
      return next;
    });
  }, [card, cardKey]);

  const [feedback, setFeedback] = useState<SelfRating | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const rate = useCallback(
    (rating: SelfRating) => {
      if (!session || session.finished || !card || !flipped || !store || !progress) return;
      if (feedback !== null) return; // Ett kort i taget: vänta tills kvittensen är klar.
      const now = new Date();
      const next = applyRating({ mode, cardId: card.id, rating, progress, now, schedule });
      if (next) {
        setProgress((p) => ({ ...(p ?? {}), [card.id]: next }));
        store
          .save(next)
          .then(() => setQueued(store.pending()))
          .catch(() => setSaveError(true));
      }
      // Historiken loggas i alla lägen (underlag för statistiken); progressen rörs bara enligt applyRating.
      const entry: ReviewEntry = { card_id: card.id, rating, mode, reviewed_at: now.toISOString() };
      setReviews((r) => [...r, entry]);
      store
        .logReview(entry)
        .then(() => setQueued(store.pending()))
        .catch(() => {
          // Historik är inte kritisk.
        });
      // Kalibrering (hypercorrection): vändes kortet snabbt men skattades 1–2 var studenten
      // sannolikt säker på fel svar. Då stannar kortet längre och en rad ber om en omläsning.
      const timeToFlip = flippedAt.current === null ? Infinity : flippedAt.current - shownAt.current;
      // Bara kort som setts förut: ett nytt kort vänds snabbt för att man inte vet, inte för att man är säker.
      const confident = rating <= 2 && timeToFlip < CONFIDENT_FLIP_MS && (progress[card.id]?.state ?? 0) !== 0;
      setConfidentWrong(confident);
      setAnnounce(confident ? `${sv.study.ratedAnnounce(rating)} ${sv.study.confidentWrong}` : sv.study.ratedAnnounce(rating));
      // Stämpla kortet, låt det glida ut, och visa först därefter nästa kort (på framsidan).
      setFeedback(rating);
      feedbackTimer.current = setTimeout(
        () => {
          setFeedback(null);
          setSession((s) => (s ? rateCurrent(s, rating) : s));
        },
        confident ? CONFIDENT_STAY_MS : 960,
      );
    },
    [session, card, flipped, store, progress, mode, feedback, schedule],
  );

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
          if (card?.hint) {
            e.preventDefault();
            setShowHint((v) => !v);
          }
          break;
        default:
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip, rate, next, previous, card, mode]);

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
      <div className="py-12 text-center">
        <p className="text-muted">{mode === "fsrs" ? sv.study.emptyFsrs : mode === "tricky" ? sv.study.emptyTricky : sv.study.empty}</p>
        <div className="mt-6">
          <LinkButton href={`/d/${deck.slug}`} variant="secondary">
            {sv.study.backToDeck}
          </LinkButton>
        </div>
      </div>
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
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <h1 className="sr-only">
        {deck.title} – {sv.study.position(position + 1, total)}
      </h1>
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <Link href={`/d/${deck.slug}`} className="-my-2 truncate py-2 hover:text-fg">
          ← {deck.title}
        </Link>
        <span data-testid="remaining" className="shrink-0">
          {mode === "exam" ? sv.study.examProgress(position + 1, total) : sv.study.remaining(remaining(session))}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded bg-surface-2" aria-hidden="true">
        <div className="h-full rounded bg-accent transition-[width]" style={{ width: `${progressPct}%` }} />
      </div>
      {banner ? (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-center text-sm" data-testid="session-banner">
          {banner}
        </p>
      ) : null}

      {card ? (
        <Flashcard
          key={`${card.id}-${position}`}
          cardId={card.id}
          front={card.front}
          back={card.back}
          hint={mode === "exam" ? null : card.hint}
          categoryTitle={categoryTitle(card.category_id)}
          categoryColorIndex={card.category_id ? (colorIndex.get(card.category_id) ?? 0) : 0}
          flipped={flipped}
          showHint={showHint}
          feedback={feedback}
          confidentWrong={confidentWrong}
          onFlip={flip}
          onToggleHint={() => setShowHint((v) => !v)}
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
        />
      ) : null}

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] gap-2 lg:mx-auto lg:w-full lg:max-w-xl">
        <Button variant="secondary" onClick={previous} disabled={mode === "exam" || !canGoPrevious(session)} aria-label={sv.study.previous} data-testid="prev">
          ←
        </Button>
        <Button onClick={flip} aria-pressed={flipped} data-testid="flip">
          {sv.study.flip}
        </Button>
        <Button variant="secondary" onClick={next} aria-label={mode === "fsrs" ? sv.study.skip : sv.study.next} data-testid="next">
          →
        </Button>
      </div>

      <div className="lg:mx-auto lg:w-full lg:max-w-xl">
        <RatingButtons disabled={!canRate} onRate={rate} intervals={intervals} />
        <p className="mt-2 hidden text-center text-xs text-muted [@media(hover:hover)]:block" aria-hidden="true">
          {sv.study.keyboardHelp}
        </p>
      </div>

      {card ? (
        <>
          <p className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="-m-2 p-2 text-xs text-muted underline underline-offset-2 decoration-line-strong hover:text-fg"
              data-testid="report-open"
            >
              {sv.report.open}
            </button>
          </p>
          <ReportDialog open={reportOpen} cardId={card.id} onClose={() => setReportOpen(false)} />
        </>
      ) : null}

      {saveError ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {sv.study.saveError}
        </p>
      ) : queued > 0 ? (
        <p role="status" className="rounded-md bg-surface-2 px-3 py-2 text-center text-sm text-muted" data-testid="queued-notice">
          {sv.study.queued(queued)}
        </p>
      ) : null}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
