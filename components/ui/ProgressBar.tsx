import { cx } from "./cx";

type Props = {
  /** Andel 0–1. */
  value: number;
  label: string;
  tone?: "accent" | "chart-2" | "chart-3" | "danger";
  size?: "sm" | "md";
  className?: string;
};

const fills = {
  accent: "bg-accent",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  danger: "bg-danger",
};

/** Tunn, rundad stapel. Fyllningen glider till sitt värde när det ändras. */
export function ProgressBar({ value, label, tone = "accent", size = "sm", className }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cx("w-full overflow-hidden rounded-full bg-surface-3", size === "sm" ? "h-1.5" : "h-2.5", className)}
    >
      <div
        className={cx("h-full rounded-full transition-[width] duration-700 ease-out", fills[tone])}
        // Minst en prick syns även vid några få procent, som hos Knowt.
        style={{ width: pct === 0 ? "0%" : `max(${pct}%, 0.6rem)` }}
      />
    </div>
  );
}
