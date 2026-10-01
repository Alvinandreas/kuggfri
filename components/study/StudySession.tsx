"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Timer, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { percent } from "@/lib/text/percent";
import { previewIntervals, type ScheduleOptions } from "@/lib/fsrs/scheduler";
import { canGoPrevious, currentCardId, goPrevious, rateCurrent, remaining, skipCurrent, summarize } from "@/lib/fsrs/session";
import { SELF_RATINGS, type SelfRating, type StudyMode } from "@/lib/progress/types";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { serializeSelection, type Selection } from "@/lib/study/selection";
import { buildSessionResult, type SessionResult } from "@/lib/study/session-result";
import { settingsQuery, sizeLimit, type SessionSettings, type SettingsMode } from "@/lib/study/session-settings";
import { useStars } from "@/lib/progress/stars";
import { playRatingSound } from "@/lib/ui/sound";
import { formatRelative } from "@/lib/time/format";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Flashcard } from "./Flashcard";
import { QuizCard } from "./QuizCard";
import { ReportDialog } from "./ReportDialog";
import { RatingButtons } from "./RatingButtons";
import { SessionHelpDialog } from "./SessionHelpDialog";
import { SessionSummary } from "./SessionSummary";
import { SessionToolbar } from "./SessionToolbar";
import { usePersistRating } from "./session/usePersistRating";
import { useQuizAnswer } from "./session/useQuizAnswer";
import { useSessionQueue } from "./session/useSessionQueue";
import { useStudyKeyboard } from "./session/useStudyKeyboard";
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
  /** Plugga vidare: extra pass när dagens schema är klart (kort närmast att förfalla, sedan nya). */
  extra?: boolean;
  /** Löpnummer i en kedja av fortsättningar (URL-parametern pass), se buildSessionResult. */
  pass?: number;
  /** Läget som inställningarna hör till (Stjärnmärkta har egna, fast passet är fri repetition). */
  settingsMode?: SettingsMode;
  /** Passets inställningar (antal, ledtrådar, ordning, uppgiftstyper, duggans tidtagning …). */
  settings: SessionSettings;
  /** Bara stjärnmärkta kort. */
  onlyStarred: boolean;
  /** Bara originalkorten (den beprövade uppsättningen). */
  onlyOriginal?: boolean;
};

/** "4:07" eller "1:02:09". */
function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function StudySession({
  deck,
  categories,
  cards: allCards,
  mode,
  selection,
  userId,
  extraNew,
  extra = false,
  pass = 0,
  settingsMode = mode,
  settings,
  onlyStarred,
  onlyOriginal = false,
}: Props) {
  // Duggans regler är passets inställningar i duggaläget (tidtagning, märket i toppen).
  const dugga = mode === "exam" ? settings : null;
  // Bara originalkorten: allt i passet (kö, dagsplan, sammanfattning) räknar på dem.
  const cards = useMemo(() => (onlyOriginal ? allCards.filter((c) => c.original) : allCards), [allCards, onlyOriginal]);
  const store = useProgressStore(userId);
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

  // Kön (progress, historik, inställningar och planen) laddas här, efter övriga tillstånd, så att
  // effekterna körs i samma ordning som förut.
  const { progress, setProgress, reviews, setReviews, prefs, session, setSession, sessionPlan } = useSessionQueue({
    store,
    cards,
    mode,
    selection,
    extraNew,
    extra,
    settings,
    onlyStarred,
    onlyOriginal,
    examDate: deck.exam_date,
  });

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

  // Ledtrådar: inställningen Tillåt ledtrådar (på som standard, av som standard i duggan).
  const hintAllowed = settings.hints;

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

  const persistRating = usePersistRating({ store, progress, mode, schedule, setProgress, setReviews, setQueued, setSaveError });

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
    // setSession är en stabil setter (från useSessionQueue).
    [session, card, flipped, store, progress, feedback, persistRating, setSession],
  );

  const { quiz, quizSelected, quizResult, quizMulti, toggleQuizOption, continueQuiz, quizPrimary } = useQuizAnswer({
    card,
    cardKey,
    store,
    progress,
    mode,
    persistRating,
    setAnnounce,
    setSession,
  });

  const next = useCallback(() => setSession((s) => (s ? skipCurrent(s) : s)), [setSession]);
  const previous = useCallback(() => setSession((s) => (s ? goPrevious(s) : s)), [setSession]);

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
  useStudyKeyboard({
    flip,
    rate,
    next,
    previous,
    card,
    mode,
    hintAllowed,
    quiz,
    quizResult,
    toggleQuizOption,
    quizPrimary,
    continueQuiz,
    setShowHint,
  });

  const canRate = flipped && !!card && feedback === null;

  // Intervalltext per skattning när kortet är vänt. Alla lägen räknas in i schemat, så knapparna
  // visar överallt när kortet kommer tillbaka, utom i duggan där provet inte ska störas.
  const intervals = useMemo(() => {
    if (mode === "exam" || !flipped || !card || !progress) return null;
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
    // Länkarna vidare behåller passets inställningar och originalfiltret.
    const suffix = `${settingsQuery(settingsMode, settings)}${onlyOriginal ? "&original=1" : ""}`;
    // Alla lägen utom duggan visar nästa repetition (varje skattning räknas in i schemat), men
    // bara den schemalagda kön har en slutpunkt för dagen och erbjuder Plugga vidare.
    const result: SessionResult | null =
      mode !== "exam"
        ? buildSessionResult({
            deckSlug: deck.slug,
            cards,
            progress,
            reviews,
            selection,
            dailyNew: prefs.dailyNew,
            weekdaysOnly: prefs.weekdaysOnly,
            finalReview: sessionPlan.finalReview,
            extraPass: sessionPlan.extra,
            pass,
            suffix,
            newCards: settings.newCards,
            size: sizeLimit(settings.size),
          })
        : null;
    // Ett pass till med samma läge, urval och inställningar (inte schemalagt: där finns Plugga vidare).
    const againHref =
      mode === "fsrs"
        ? null
        : `/d/${deck.slug}/plugga?mode=${mode}&urval=${encodeURIComponent(serializeSelection(selection))}${suffix}${onlyStarred ? "&stjarnor=1" : ""}&pass=${pass + 1}`;
    return (
      <SessionSummary
        summary={summary}
        cardsById={cardsById}
        categories={categories}
        colorIndex={colorIndex}
        mode={mode}
        nextDue={result?.nextDue ?? null}
        today={mode === "fsrs" ? (result?.today ?? null) : null}
        deckSlug={deck.slug}
        onPrevious={mode !== "exam" && canGoPrevious(session) ? previous : undefined}
        duration={dugga?.timer ? clock(elapsed) : null}
        againHref={againHref}
      />
    );
  }

  const progressPct = percent(position, total);
  const banner =
    mode !== "fsrs"
      ? null
      : sessionPlan.extra
        ? sv.study.extraBanner
        : sessionPlan.finalReview && sessionPlan.phase.kind === "final"
          ? sv.study.finalReviewBanner(sessionPlan.phase.daysLeft)
          : sessionPlan.plan.catchUp && sessionPlan.plan.neededPerDay !== null && extraNew === null
            ? sv.study.catchUpBanner(sessionPlan.plan.neededPerDay)
            : null;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <h1 className="sr-only">
        {deck.title}: {sv.study.position(position + 1, total)}
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
          eyebrow={sv.cardKind.instruction[card.kind]}
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
