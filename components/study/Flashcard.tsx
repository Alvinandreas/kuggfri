"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Lightbulb, Star } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { SelfRating } from "@/lib/progress/types";
import { Markdown } from "@/components/markdown/Markdown";
import { buttonClass, IconButton } from "@/components/ui/Button";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Tooltip } from "@/components/ui/Tooltip";
import { cx } from "@/components/ui/cx";
import { ratingClass } from "./RatingButtons";

/**
 * Frågan: stycken, bilder och formler centreras som text. Listor, tabeller och kodblock
 * centreras som block (mitt i kortet, bara så breda som innehållet) med vänsterställda rader.
 */
export const CENTERED_QUESTION =
  "text-center [&>:is(ul,ol,table,pre)]:mx-auto [&>:is(ul,ol,table,pre)]:w-fit [&>:is(ul,ol,table,pre)]:max-w-full [&>:is(ul,ol,table,pre)]:text-left";

/**
 * Svaret (baksidan) är ett block mitt i kortet, bara så brett som sin längsta rad. Ett kort svar
 * blir därför centrerat som text, och i en lista eller ett svar över flera rader ligger punkterna
 * och radernas vänsterkant i linje inuti blocket, som går att läsa även när det är långt. Blocket
 * är högst 28em brett (en bekväm radlängd), så även ett långt svar står synligt mitt i kortet;
 * på mobilen fyller det kortets bredd.
 */
export const CENTERED_ANSWER = "mx-auto w-fit max-w-[min(100%,28em)] text-left";

/** Samma sak för förklaringen på automaträttade kort, som har mindre text (prose-body). */
export const CENTERED_EXPLANATION = "mx-auto w-fit max-w-[min(100%,42em)] text-left";

type Props = {
  cardId: string;
  front: string;
  back: string;
  /** Uppgiftstypen som uppmaning i kortets huvud, fram och bak (cardKindInstruction), t.ex. "Förklara begreppet". */
  eyebrow?: string | null;
  hint: string | null;
  categoryTitle: string | null;
  categoryColorIndex: number;
  flipped: boolean;
  showHint: boolean;
  /** Skattning som just gavs: kortet stämplas och glider ut åt vänster. */
  feedback: SelfRating | null;
  /** Stjärnmärkt av studenten (bokmärke). */
  starred: boolean;
  onToggleStar: () => void;
  onFlip: () => void;
  onToggleHint: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
};

const SWIPE_MIN_PX = 56;

/** De små ikonknapparna på kortet är 32 px; en osynlig kant gör träffytan 44 px på mobilen. */
const HIT_AREA = "relative after:absolute after:-inset-1.5";

/**
 * Själva kortet. Klick/tapp vänder; horisontellt svep anropar onSwipe*.
 * Innehållet ligger i vanliga sektioner (inte i en knapp) så att skärmläsare
 * läser hela texten. Den synliga knappen "Vänd kortet" finns i sessionen.
 */
export function Flashcard({
  cardId,
  front,
  back,
  eyebrow = null,
  hint,
  categoryTitle,
  categoryColorIndex,
  flipped,
  showHint,
  feedback,
  starred,
  onToggleStar,
  onFlip,
  onToggleHint,
  onSwipeLeft,
  onSwipeRight,
}: Props) {
  const sv = useT();
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
    "flip-face col-start-1 row-start-1 flex min-h-[var(--card-min-height)] flex-col rounded-lg bg-surface p-5 shadow-card sm:p-8";

  return (
    <div className="card-stack" data-testid="flashcard" data-card-id={cardId} data-flipped={flipped}>
      <div className={`flip-scene card-enter ${feedback !== null ? "card-leave" : ""}`.trim()}>
        <div
          className={`flip-inner grid cursor-pointer select-none rounded-lg ${feedback !== null ? `rate-pulse rate-pulse-${feedback}` : ""} ${
            feedback !== null && feedback <= 2 ? "rate-shake" : ""
          }`.trim()}
          data-flipped={flipped}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            start.current = null;
          }}
          onClick={onClick}
          style={{ touchAction: "pan-y" }}
        >
          <section aria-label={sv.study.front} aria-hidden={flipped} inert={flipped} className={`${faceClass} flip-front border border-line dark:border-transparent`}>
            <FaceHeader categoryTitle={categoryTitle} colorIndex={categoryColorIndex} kindLabel={eyebrow} starred={starred} onToggleStar={onToggleStar} />
            {/* m-auto på innehållet (inte items-center på behållaren): centrerat när det får plats,
                scrollbart från toppen när det inte gör det, så inget hamnar under rubrikraden. */}
            <div className="flex max-h-[var(--card-content-max)] flex-1 overflow-y-auto py-2">
              <Markdown text={front} className={`m-auto w-full ${CENTERED_QUESTION}`} />
            </div>
            {hint ? (
              <div className="mt-4 border-t border-line pt-3 text-center text-sm">
                {showHint ? (
                  <p className="anim-fade-in">
                    <span className="font-semibold text-muted">{sv.study.hint}: </span>
                    {hint}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={onToggleHint}
                    className={buttonClass("secondary", "sm")}
                    data-testid="show-hint"
                  >
                    <Lightbulb size={15} aria-hidden />
                    {sv.study.showHint}
                  </button>
                )}
              </div>
            ) : null}
          </section>

          <section aria-label={sv.study.back} aria-hidden={!flipped} inert={!flipped} className={`${faceClass} flip-back border border-accent/40`}>
            <FaceHeader categoryTitle={categoryTitle} colorIndex={categoryColorIndex} kindLabel={eyebrow} starred={starred} onToggleStar={onToggleStar} />
            <div className="flex max-h-[var(--card-content-max)] flex-1 overflow-y-auto py-2">
              <Markdown text={back} className={`m-auto ${CENTERED_ANSWER}`} />
            </div>
            {feedback !== null ? <Stamp rating={feedback} /> : null}
            {feedback !== null && feedback >= 4 ? <span aria-hidden="true" className={`rate-burst rate-burst-${feedback}`} /> : null}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Stjärnknappen är 32 px bred (IconButton size sm). */
const STAR_PX = 32;
/** Minsta luft mellan uppgiftstypen och områdesnamnet (eller stjärnan) när de står på samma rad. */
const CLEARANCE_PX = 24;

/**
 * Kortets huvud, en rad: område till vänster, uppgiftstypen mitt i kortet på samma höjd och
 * stjärnan ensam i övre högra hörnet. Får områdesnamnet och typen inte plats bredvid varandra
 * (smal skärm, långt områdesnamn) hamnar typen centrerad på en egen rad under. Det mäts, inte
 * gissas: ett osynligt lager håller områdets och typens naturliga bredd. Stjärnan vänder inte kortet.
 */
export function FaceHeader({
  categoryTitle,
  colorIndex,
  kindLabel,
  starred,
  onToggleStar,
}: {
  categoryTitle: string | null;
  colorIndex: number;
  /** Uppgiftstypen som uppmaning, t.ex. "Förklara begreppet" (cardKindInstruction). */
  kindLabel: string | null;
  starred: boolean;
  onToggleStar: () => void;
}) {
  const sv = useT();
  const rowRef = useRef<HTMLDivElement>(null);
  const tagMeasure = useRef<HTMLSpanElement>(null);
  const labelMeasure = useRef<HTMLSpanElement>(null);
  const [stacked, setStacked] = useState(false);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || !kindLabel) return;
    const measure = () => {
      const width = row.clientWidth;
      const tag = tagMeasure.current?.offsetWidth ?? 0;
      const label = labelMeasure.current?.offsetWidth ?? 0;
      // Typen står mitt i raden; varje sida behöver plats för sitt innehåll plus luft, så att
      // typen inte ser ihopklistrad ut med områdesnamnet.
      const side = (width - label) / 2 - CLEARANCE_PX;
      setStacked(tag > side || STAR_PX > side);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    if (tagMeasure.current) observer.observe(tagMeasure.current);
    if (labelMeasure.current) observer.observe(labelMeasure.current);
    return () => observer.disconnect();
  }, [kindLabel, categoryTitle]);

  const star = (
    <Tooltip label={starred ? sv.session.unstar : sv.session.star} side="bottom">
      <IconButton
        label={starred ? sv.session.unstar : sv.session.star}
        variant="outline"
        size="sm"
        className={HIT_AREA}
        onClick={onToggleStar}
        aria-pressed={starred}
        data-testid="card-star"
        // Inline: klasser kan inte skriva över knappens kant- och textfärg förutsägbart.
        style={starred ? { color: "var(--chart-3)", borderColor: "var(--chart-3)" } : undefined}
      >
        <Star size={16} aria-hidden fill={starred ? "currentColor" : "none"} />
      </IconButton>
    </Tooltip>
  );

  return (
    <div
      ref={rowRef}
      data-testid="card-header"
      data-stacked={kindLabel ? stacked : undefined}
      className={cx(
        "relative mb-4 grid items-center gap-x-3 gap-y-3",
        kindLabel && !stacked ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_auto]",
      )}
    >
      <div className="col-start-1 row-start-1 min-w-0 justify-self-start">
        {categoryTitle ? <CategoryTag title={categoryTitle} colorIndex={colorIndex} size="lg" /> : null}
      </div>
      {kindLabel ? (
        <p
          className={cx(
            "text-center text-xs font-semibold uppercase leading-snug tracking-wide text-muted",
            stacked ? "col-span-2 row-start-2" : "col-start-2 row-start-1 whitespace-nowrap",
          )}
          data-testid="card-kind"
        >
          {kindLabel}
        </p>
      ) : null}
      <div className={cx("row-start-1 flex justify-self-end", kindLabel && !stacked ? "col-start-3" : "col-start-2")}>{star}</div>
      {kindLabel ? (
        // Mätlagret: osynligt, utan egen plats i layouten och dolt för skärmläsare.
        <div aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex whitespace-nowrap">
          <span ref={tagMeasure} className="inline-flex">
            {categoryTitle ? <CategoryTag title={categoryTitle} colorIndex={colorIndex} size="lg" className="whitespace-nowrap" /> : null}
          </span>
          <span ref={labelMeasure} className="text-xs font-semibold uppercase tracking-wide">
            {kindLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Stämpel med vald skattning, alltid en bit in i kortets övre högra hörn.
 * 5 och 4 får en större stämpel med kraftigare intåg (och en grön ring runt kortet),
 * 1 och 2 en mindre, tyngre stämpel.
 */
const stampSize: Record<SelfRating, string> = {
  1: "h-20 w-20 sm:h-24 sm:w-24 card-stamp-low",
  2: "h-20 w-20 sm:h-24 sm:w-24 card-stamp-low",
  3: "h-24 w-24 sm:h-28 sm:w-28",
  4: "h-28 w-28 sm:h-32 sm:w-32 card-stamp-big",
  5: "h-32 w-32 sm:h-36 sm:w-36 card-stamp-big",
};

function Stamp({ rating }: { rating: SelfRating }) {
  const sv = useT();
  return (
    <div
      aria-hidden="true"
      data-testid="stamp"
      className={`card-stamp pointer-events-none absolute right-4 top-14 flex flex-col items-center justify-center rounded-full border-4 bg-surface/92 text-fg shadow-card sm:right-7 sm:top-16 ${stampSize[rating]} ${ratingClass[rating]}`}
    >
      <span className={`font-extrabold leading-none ${rating >= 4 ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"}`}>{sv.study.stamp(rating)}</span>
      <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide">{sv.study.rate[rating]}</span>
    </div>
  );
}
