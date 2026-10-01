"use client";

import { useT } from "@/lib/i18n/client";
import { SELF_RATINGS, type SelfRating } from "@/lib/progress/types";
import { cx } from "@/components/ui/cx";
import { Tooltip } from "@/components/ui/Tooltip";

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
  const sv = useT();
  return (
    <fieldset className="grid gap-2" aria-label={sv.study.rateLabel}>
      <legend className="sr-only">{sv.study.rateLabel}</legend>
      <div className="grid grid-cols-5 gap-2">
        {SELF_RATINGS.map((r) => (
          // Namnet (och i schemalagt läge när kortet kommer tillbaka) står i etiketten vid hovring, inte på knappen.
          <Tooltip key={r} label={intervals ? `${sv.study.rate[r]}, ${intervals[r]}` : sv.study.rate[r]} className="w-full">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRate(r)}
            aria-label={`${r} – ${sv.study.rate[r]}${intervals ? `, ${intervals[r]}` : ""}`}
            data-testid={`rate-${r}`}
            className={cx(
              "flex w-full select-none flex-col items-center justify-center rounded-lg border-2 px-1 text-fg transition-[opacity,transform] duration-150 ease-out active:scale-[0.96] disabled:opacity-35",
              "h-14",
              ratingClass[r],
              !disabled && "hover:-translate-y-0.5 hover:opacity-90",
            )}
          >
            <span className="text-xl font-extrabold leading-none">{r}</span>
          </button>
          </Tooltip>
        ))}
      </div>
    </fieldset>
  );
}
