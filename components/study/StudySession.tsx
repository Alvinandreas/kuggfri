"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { applyRating } from "@/lib/fsrs/apply-rating";
import { countDueBy, nextDueDate } from "@/lib/fsrs/scheduler";
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
import type { ProgressMap, SelfRating, StudyMode } from "@/lib/progress/types";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { selectCardIds, type Selection } from "@/lib/study/selection";
import { endOfDay } from "@/lib/time/format";
import { Button, LinkButton } from "@/components/ui/Button";
import { Flashcard } from "./Flashcard";
import { RatingButtons } from "./RatingButtons";
import { SessionSummary } from "./SessionSummary";

export type StudyCard = {
  id: string;
  category_id: string | null;
  front: string;
  back: string;
  hint: string | null;
  sort_order: number;
};

type Props = {
  deck: { id: string; slug: string; title: string };
  categories: { id: string; title: string }[];
  cards: StudyCard[];
  mode: StudyMode;
  selection: Selection;
  userId: string | null;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function StudySession({ deck, categories, cards, mode, selection, userId }: Props) {
  const store = useProgressStore(userId);
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [saveError, setSaveError] = useState(false);
  const startedAt = useRef(new Date());
  const loggedRef = useRef(false);

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c] as const)), [cards]);
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const categoryTitle = useCallback(
    (id: string | null) => (id ? (categories.find((c) => c.id === id)?.title ?? null) : null),
    [categories],
  );

  // Ladda progress och bygg kön.
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      let loaded: ProgressMap = {};
      try {
        loaded = await store.load(cardIds);
      } catch {
        loaded = {};
      }
      if (cancelled) return;
      setProgress(loaded);
      const order = selectCardIds({ cards, progress: loaded, mode, selection });
      setSession(createSession(order, mode));
    })();
    return () => {
      cancelled = true;
    };
  }, [store, cards, cardIds, mode, selection]);

  const currentId = session ? currentCardId(session) : null;
  const card = currentId ? (cardsById.get(currentId) ?? null) : null;
  const position = session?.position ?? 0;
  const total = session?.order.length ?? 0;

  // Nytt kort: visa framsidan, dölj ledtråd, meddela skärmläsare.
  useEffect(() => {
    setFlipped(false);
    setShowHint(false);
    if (session && !session.finished && currentId) {
      setAnnounce(sv.study.cardAnnounce(session.position + 1, session.order.length));
    }
    // Endast när kortet (eller dess position) byts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, position]);

  const flip = useCallback(() => {
    if (!card) return;
    setFlipped((f) => {
      const next = !f;
      setAnnounce(next ? sv.study.flippedAnnounce : sv.study.front);
      return next;
    });
  }, [card]);

  const rate = useCallback(
    (rating: SelfRating) => {
      if (!session || session.finished || !card || !flipped || !store || !progress) return;
      const next = applyRating({ mode, cardId: card.id, rating, progress });
      if (next) {
        setProgress((p) => ({ ...(p ?? {}), [card.id]: next }));
        store.save(next).catch(() => setSaveError(true));
      }
      setSession((s) => (s ? rateCurrent(s, rating) : s));
      setAnnounce(sv.study.ratedAnnounce(rating));
    },
    [session, card, flipped, store, progress, mode],
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
          previous();
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
  }, [flip, rate, next, previous, card]);

  const canRate = flipped && !!card;

  const onSwipeLeft = useCallback(() => {
    if (canRate) rate(1);
    else next();
  }, [canRate, rate, next]);
  const onSwipeRight = useCallback(() => {
    if (canRate) rate(5);
    else previous();
  }, [canRate, rate, previous]);

  if (!session || !progress) {
    return (
      <p role="status" className="py-16 text-center text-muted">
        {sv.study.loading}
      </p>
    );
  }

  if (session.order.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">{mode === "fsrs" ? sv.study.emptyFsrs : sv.study.empty}</p>
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
    let nextDue: { date: Date; count: number } | null = null;
    if (mode === "fsrs") {
      const now = new Date();
      const date = nextDueDate(cardIds, progress, now);
      if (date) nextDue = { date, count: countDueBy(cardIds, progress, endOfDay(date), now) };
    }
    return (
      <SessionSummary
        summary={summary}
        cardsById={cardsById}
        mode={mode}
        nextDue={nextDue}
        deckSlug={deck.slug}
        onPrevious={canGoPrevious(session) ? previous : undefined}
      />
    );
  }

  const progressPct = total === 0 ? 0 : Math.round((position / total) * 100);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <Link href={`/d/${deck.slug}`} className="truncate hover:text-fg">
          ← {deck.title}
        </Link>
        <span data-testid="remaining" className="shrink-0">
          {sv.study.remaining(remaining(session))}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded bg-surface-2" aria-hidden="true">
        <div className="h-full rounded bg-accent transition-[width]" style={{ width: `${progressPct}%` }} />
      </div>

      {card ? (
        <Flashcard
          key={`${card.id}-${position}`}
          cardId={card.id}
          front={card.front}
          back={card.back}
          hint={card.hint}
          categoryTitle={categoryTitle(card.category_id)}
          flipped={flipped}
          showHint={showHint}
          onFlip={flip}
          onToggleHint={() => setShowHint((v) => !v)}
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
        />
      ) : null}

      <div className="grid grid-cols-[auto_1fr_auto] gap-2">
        <Button variant="secondary" onClick={previous} disabled={!canGoPrevious(session)} aria-label={sv.study.previous} data-testid="prev">
          ←
        </Button>
        <Button onClick={flip} aria-pressed={flipped} data-testid="flip">
          {sv.study.flip}
        </Button>
        <Button variant="secondary" onClick={next} aria-label={mode === "fsrs" ? sv.study.skip : sv.study.next} data-testid="next">
          →
        </Button>
      </div>

      <RatingButtons disabled={!canRate} onRate={rate} />

      <p className="hidden text-center text-xs text-muted sm:block">{sv.study.keyboardHelp}</p>
      <p className="text-center text-xs text-muted sm:hidden">{sv.study.swipeHelp}</p>

      {saveError ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {sv.study.saveError}
        </p>
      ) : null}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
