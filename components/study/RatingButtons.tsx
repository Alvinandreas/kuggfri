"use client";

import { sv } from "@/lib/i18n/sv";
import { SELF_RATINGS, type SelfRating } from "@/lib/progress/types";

type Props = {
  disabled: boolean;
  onRate: (rating: SelfRating) => void;
  /**
   * Intervalltext per skattning ("i morgon", "om 4 dagar"). Visas bara i schemalagt läge:
   * då ser studenten vad skattningen gör, vilket gör skalan ärlig (docs/OMVARLDSANALYS.md 3.4).
   */
  intervals?: Record<SelfRating, string> | null;
};

/** Tonad bakgrund + färgad kant och mörk/ljus text (från tokens) ger AA-kontrast i båda temana. */
export const ratingClass: Record<SelfRating, string> = {
  1: "bg-rate-1/20 border-rate-1",
  2: "bg-rate-2/20 border-rate-2",
  3: "bg-rate-3/20 border-rate-3",
  4: "bg-rate-4/20 border-rate-4",
  5: "bg-rate-5/20 border-rate-5",
};

export function RatingButtons({ disabled, onRate, intervals }: Props) {
  return (
    <fieldset className="grid gap-2" aria-label={sv.study.rateLabel}>
      <legend className="sr-only">{sv.study.rateLabel}</legend>
      <div className="grid grid-cols-5 gap-2">
        {SELF_RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={disabled}
            onClick={() => onRate(r)}
            aria-label={`${r} – ${sv.study.rate[r]}${intervals ? `, ${intervals[r]}` : ""}`}
            data-testid={`rate-${r}`}
            className={`flex flex-col items-center justify-center rounded-md border-2 text-fg transition-[opacity,transform] active:scale-[0.97] disabled:opacity-35 ${
              intervals ? "h-[4.25rem]" : "h-14"
            } ${ratingClass[r]} ${disabled ? "" : "hover:opacity-85"}`}
          >
            <span className="text-lg font-semibold leading-none">{r}</span>
            <span className="mt-1 text-[0.65rem] leading-none">{sv.study.rate[r]}</span>
            {intervals ? (
              <span className="mt-1 text-[0.6rem] leading-none text-muted tabular-nums" aria-hidden="true">
                {intervals[r]}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
