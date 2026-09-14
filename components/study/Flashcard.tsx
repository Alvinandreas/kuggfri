"use client";

import { useRef } from "react";
import { sv } from "@/lib/i18n/sv";
import type { SelfRating } from "@/lib/progress/types";
import { Markdown } from "@/components/markdown/Markdown";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { ratingClass } from "./RatingButtons";

type Props = {
  cardId: string;
  front: string;
  back: string;
  hint: string | null;
  categoryTitle: string | null;
  categoryColorIndex: number;
  flipped: boolean;
  showHint: boolean;
  /** Skattning som just gavs: kortet stämplas och glider ut åt vänster. */
  feedback: SelfRating | null;
  onFlip: () => void;
  onToggleHint: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
};

const SWIPE_MIN_PX = 56;

/**
 * Själva kortet. Klick/tapp vänder; horisontellt svep anropar onSwipe*.
 * Innehållet ligger i vanliga sektioner (inte i en knapp) så att skärmläsare
 * läser hela texten. Den synliga knappen "Vänd kortet" finns i sessionen.
 */
export function Flashcard({
  cardId,
  front,
  back,
  hint,
  categoryTitle,
  categoryColorIndex,
  flipped,
  showHint,
  feedback,
  onFlip,
  onToggleHint,
  onSwipeLeft,
  onSwipeRight,
}: Props) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiped = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    swiped.current = false;
  }

  function onPointerUp(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped.current = true;
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
  }

  function onClick(e: React.MouseEvent) {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (feedback !== null) return;
    // Klick på knappar och länkar inuti kortet ska inte vända det.
    if (e.target instanceof HTMLElement && e.target.closest("button, a")) return;
    onFlip();
  }

  const faceClass =
    "flip-face col-start-1 row-start-1 flex min-h-[var(--card-min-height)] flex-col rounded-lg bg-surface p-5 shadow-card sm:p-7";

  return (
    <div className="card-stack" data-testid="flashcard" data-card-id={cardId} data-flipped={flipped}>
      <div className={`flip-scene card-enter ${feedback !== null ? "card-leave" : ""}`.trim()}>
        <div
          className={`flip-inner grid cursor-pointer select-none rounded-lg ${feedback !== null ? `rate-pulse rate-pulse-${feedback}` : ""}`.trim()}
          data-flipped={flipped}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            start.current = null;
          }}
          onClick={onClick}
          style={{ touchAction: "pan-y" }}
        >
          <section aria-label={sv.study.front} aria-hidden={flipped} inert={flipped} className={`${faceClass} flip-front border border-line`}>
            <FaceHeader label={sv.study.front} categoryTitle={categoryTitle} colorIndex={categoryColorIndex} />
            <div className="flex max-h-[55dvh] flex-1 items-center justify-center overflow-y-auto py-2 text-center">
              <Markdown text={front} />
            </div>
            {hint ? (
              <div className="mt-4 border-t border-line pt-3 text-center text-sm">
                {showHint ? (
                  <p>
                    <span className="font-medium text-muted">{sv.study.hint}: </span>
                    {hint}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={onToggleHint}
                    className="text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent"
                    data-testid="show-hint"
                  >
                    {sv.study.showHint}
                  </button>
                )}
              </div>
            ) : null}
            <p className="mt-4 text-center text-xs text-muted">{sv.study.flipHint}</p>
          </section>

          <section aria-label={sv.study.back} aria-hidden={!flipped} inert={!flipped} className={`${faceClass} flip-back border border-accent/40`}>
            <FaceHeader label={sv.study.back} categoryTitle={categoryTitle} colorIndex={categoryColorIndex} />
            <div className="flex max-h-[55dvh] flex-1 items-center overflow-y-auto py-2">
              <Markdown text={back} className="w-full" />
            </div>
            {feedback !== null ? <Stamp rating={feedback} /> : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function FaceHeader({ label, categoryTitle, colorIndex }: { label: string; categoryTitle: string | null; colorIndex: number }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      {categoryTitle ? <CategoryTag title={categoryTitle} colorIndex={colorIndex} size="lg" /> : <span />}
      <span className="shrink-0 text-xs uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

/** Stämpel med vald skattning, i skattningens färg. */
function Stamp({ rating }: { rating: SelfRating }) {
  return (
    <div
      aria-hidden="true"
      data-testid="stamp"
      className={`card-stamp pointer-events-none absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 bg-surface/92 text-fg shadow-card sm:h-28 sm:w-28 ${ratingClass[rating]}`}
    >
      <span className="text-3xl font-bold leading-none sm:text-4xl">{sv.study.stamp(rating)}</span>
      <span className="mt-1 text-[0.65rem] font-medium uppercase tracking-wide">{sv.study.rate[rating]}</span>
    </div>
  );
}
