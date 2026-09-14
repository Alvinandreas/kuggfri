"use client";

import { useRef } from "react";
import { sv } from "@/lib/i18n/sv";
import type { SelfRating } from "@/lib/progress/types";
import { Markdown } from "@/components/markdown/Markdown";
import { CategoryTag } from "@/components/ui/CategoryTag";

type Props = {
  cardId: string;
  front: string;
  back: string;
  hint: string | null;
  categoryTitle: string | null;
  categoryColorIndex: number;
  flipped: boolean;
  showHint: boolean;
  /** Skattning som just gavs: kortet pulserar i den färgen och glider ut. */
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
    // Klick på knappar och länkar inuti kortet ska inte vända det.
    if (e.target instanceof HTMLElement && e.target.closest("button, a")) return;
    onFlip();
  }

  const leaveClass = feedback === null ? "" : feedback >= 3 ? "card-leave-good" : "card-leave-bad";
  const pulseClass = feedback === null ? "" : `rate-pulse rate-pulse-${feedback}`;

  return (
    <div className={`flip-scene card-enter ${leaveClass}`.trim()} data-testid="flashcard" data-card-id={cardId} data-flipped={flipped}>
      <div
        className={`flip-inner grid cursor-pointer select-none rounded-lg ${pulseClass}`.trim()}
        data-flipped={flipped}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
        }}
        onClick={onClick}
        style={{ touchAction: "pan-y" }}
      >
        <section
          aria-label={sv.study.front}
          aria-hidden={flipped}
          inert={flipped}
          className="flip-face flip-front col-start-1 row-start-1 flex min-h-[var(--card-min-height)] flex-col rounded-lg border border-line bg-surface p-5 shadow-card sm:p-7 lg:min-h-[24rem]"
        >
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

        <section
          aria-label={sv.study.back}
          aria-hidden={!flipped}
          inert={!flipped}
          className="flip-face flip-back col-start-1 row-start-1 flex min-h-[var(--card-min-height)] flex-col rounded-lg border border-accent/40 bg-surface p-5 shadow-card sm:p-7 lg:min-h-[24rem]"
        >
          <FaceHeader label={sv.study.back} categoryTitle={categoryTitle} colorIndex={categoryColorIndex} />
          <div className="flex max-h-[55dvh] flex-1 items-center overflow-y-auto py-2">
            <Markdown text={back} className="w-full" />
          </div>
        </section>
      </div>
    </div>
  );
}

function FaceHeader({ label, categoryTitle, colorIndex }: { label: string; categoryTitle: string | null; colorIndex: number }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      {categoryTitle ? <CategoryTag title={categoryTitle} colorIndex={colorIndex} /> : <span />}
      <span className="shrink-0 text-xs uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}
