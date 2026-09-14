"use client";

import { useRef } from "react";
import { sv } from "@/lib/i18n/sv";
import { Markdown } from "@/components/markdown/Markdown";

type Props = {
  cardId: string;
  front: string;
  back: string;
  hint: string | null;
  categoryTitle: string | null;
  flipped: boolean;
  showHint: boolean;
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
  flipped,
  showHint,
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

  return (
    <div className="flip-scene" data-testid="flashcard" data-card-id={cardId} data-flipped={flipped}>
      <div
        className="flip-inner grid cursor-pointer select-none rounded-lg"
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
          className="flip-face flip-front col-start-1 row-start-1 flex min-h-[var(--card-min-height)] flex-col rounded-lg border border-line bg-surface p-5 shadow-card sm:p-7"
        >
          <FaceHeader label={sv.study.front} categoryTitle={categoryTitle} />
          <div className="max-h-[55dvh] flex-1 overflow-y-auto">
            <Markdown text={front} />
          </div>
          {hint ? (
            <div className="mt-4 border-t border-line pt-3 text-sm">
              {showHint ? (
                <p>
                  <span className="font-medium text-muted">{sv.study.hint}: </span>
                  {hint}
                </p>
              ) : (
                <button type="button" onClick={onToggleHint} className="text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent" data-testid="show-hint">
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
          className="flip-face flip-back col-start-1 row-start-1 flex min-h-[var(--card-min-height)] flex-col rounded-lg border border-accent/40 bg-surface p-5 shadow-card sm:p-7"
        >
          <FaceHeader label={sv.study.back} categoryTitle={categoryTitle} />
          <div className="max-h-[55dvh] flex-1 overflow-y-auto">
            <Markdown text={back} />
          </div>
        </section>
      </div>
    </div>
  );
}

function FaceHeader({ label, categoryTitle }: { label: string; categoryTitle: string | null }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 text-xs uppercase tracking-wide text-muted">
      <span>{label}</span>
      {categoryTitle ? <span className="truncate normal-case tracking-normal">{categoryTitle}</span> : null}
    </div>
  );
}
