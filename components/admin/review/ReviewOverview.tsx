"use client";

import type { ReviewProgress, ReviewProgressRow } from "@/lib/admin/review";
import { percent } from "@/lib/text/percent";
import { cx } from "@/components/ui/cx";
import { useReviewT } from "./ReviewLanguage";

/** Stapeln visar läget (varje kort har exakt ett); flaggade räknas för sig, de ingår i läget. */
const SEGMENTS = [
  { key: "approved", fill: "bg-accent" },
  { key: "toReview", fill: "bg-chart-3/70" },
  { key: "removed", fill: "bg-line-strong" },
] as const;

type Counts = Pick<ReviewProgressRow, "approved" | "toReview" | "removed">;

const sum = (c: Counts) => c.approved + c.toReview + c.removed;

/** Granskade (godkända eller tagna ur rotation) och totalt, för en rad eller hela kursen. */
export function reviewedOf(c: Counts): { done: number; all: number } {
  return { done: c.approved + c.removed, all: sum(c) };
}

/** Staplad stapel: granskade, att granska och ur rotation, som andelar av korten. */
export function ReviewBar({ counts, size = "md", className }: { counts: Counts; size?: "sm" | "md"; className?: string }) {
  const total = sum(counts);
  return (
    <div className={cx("flex overflow-hidden rounded-full bg-surface-3", size === "md" ? "h-2.5" : "h-1.5", className)} aria-hidden="true">
      {total === 0 ? null : SEGMENTS.map((s) => (counts[s.key] === 0 ? null : <div key={s.key} className={cx("h-full", s.fill)} style={{ width: `${(counts[s.key] / total) * 100}%` }} />))}
    </div>
  );
}

/**
 * Granskningsöversikten överst i Granskning, som en del av sidan: hur stor del av kursen som är
 * granskad, med en stapel och flikarnas antal. Läget per område står på områdenas rubriker i
 * listan under.
 */
export function ReviewOverview({ progress }: { progress: ReviewProgress }) {
  const g = useReviewT().g;
  const label: Record<(typeof SEGMENTS)[number]["key"], string> = { approved: g.tabReviewed, toReview: g.tabToReview, removed: g.tabRemoved };
  const { total } = progress;
  const { done, all } = reviewedOf(total);

  return (
    <section aria-labelledby="granskningsoversikt" className="grid gap-3" data-testid="review-overview">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="granskningsoversikt" className="text-xl font-bold tracking-tight">
          {g.overviewTitle}
        </h2>
        <p className="text-sm text-muted tabular-nums">{g.overviewSummary(done, all, percent(done, all))}</p>
      </div>
      <ReviewBar counts={total} />
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cx("h-2.5 w-2.5 rounded-full", s.fill)} aria-hidden="true" />
            {label[s.key]} <span className="font-semibold tabular-nums text-fg">{total[s.key]}</span>
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rate-1" aria-hidden="true" />
          {g.tabFlagged} <span className="font-semibold tabular-nums text-fg">{total.flagged}</span>
        </li>
      </ul>
    </section>
  );
}
