"use client";

import Link from "next/link";
import type { ReviewProgress, ReviewProgressRow } from "@/lib/admin/review";
import { percent } from "@/lib/text/percent";
import { tagBgClass } from "@/lib/ui/tag-colors";
import { cx } from "@/components/ui/cx";
import { useReviewT } from "./ReviewLanguage";

const SEGMENTS = [
  { key: "approved", fill: "bg-accent" },
  { key: "toReview", fill: "bg-chart-3/70" },
  { key: "flagged", fill: "bg-rate-1" },
  { key: "removed", fill: "bg-line-strong" },
] as const;

type Counts = Pick<ReviewProgressRow, "approved" | "toReview" | "flagged" | "removed">;

const sum = (c: Counts) => c.approved + c.toReview + c.flagged + c.removed;

/** Staplad stapel: godkända, att granska, flaggade och ur rotation, som andelar av områdets kort. */
function StackedBar({ counts, tall = false }: { counts: Counts; tall?: boolean }) {
  const total = sum(counts);
  return (
    <div className={cx("flex overflow-hidden rounded-full bg-surface-3", tall ? "h-2.5" : "h-1.5")} aria-hidden="true">
      {total === 0 ? null : SEGMENTS.map((s) => (counts[s.key] === 0 ? null : <div key={s.key} className={cx("h-full", s.fill)} style={{ width: `${(counts[s.key] / total) * 100}%` }} />))}
    </div>
  );
}

/**
 * Granskningsöversikten överst i Granskning: hur stor del av varje område som är granskad
 * (godkänd eller tagen ur rotation). Ett klick på ett område filtrerar granskningen på det.
 */
export function ReviewOverview({
  progress,
  areaColor,
  areaHref,
  activeArea,
}: {
  progress: ReviewProgress;
  areaColor: (id: string) => number;
  areaHref: (id: string) => string;
  activeArea: string;
}) {
  const t = useReviewT();
  const g = t.g;
  const label: Record<(typeof SEGMENTS)[number]["key"], string> = { approved: g.tabReviewed, toReview: g.tabToReview, flagged: g.tabFlagged, removed: g.tabRemoved };
  const nameOf = (row: ReviewProgressRow) => (t.lang === "en" && row.title_en ? row.title_en : row.title);
  const { total } = progress;
  const all = sum(total);
  const done = total.approved + total.removed;

  return (
    <section aria-labelledby="granskningsoversikt" className="rounded-lg border border-line bg-surface p-5 sm:p-6 dark:border-transparent" data-testid="review-overview">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="granskningsoversikt" className="text-lg font-bold tracking-tight">
          {g.overviewTitle}
        </h2>
        <p className="text-sm text-muted tabular-nums">{g.overviewSummary(done, all, percent(done, all))}</p>
      </div>
      <div className="mt-3 grid gap-2">
        <StackedBar counts={total} tall />
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className={cx("h-2.5 w-2.5 rounded-full", s.fill)} aria-hidden="true" />
              {label[s.key]} <span className="font-semibold tabular-nums text-fg">{total[s.key]}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-4 grid gap-x-6 gap-y-1 lg:grid-cols-2">
        {progress.rows.map((row, i) => (
          <li key={row.areaId}>
            <Link
              href={areaHref(row.areaId)}
              aria-current={activeArea === row.areaId ? "true" : undefined}
              className={cx("grid gap-1.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-surface-2", activeArea === row.areaId && "bg-surface-2")}
              data-testid="review-overview-row"
            >
              <span className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-subtle">{i + 1}</span>
                  <span aria-hidden className={cx("h-2.5 w-2.5 shrink-0 rounded-full", tagBgClass(areaColor(row.areaId)))} />
                  <span className="truncate font-medium">{nameOf(row)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{g.overviewOf(row.approved + row.removed, sum(row))}</span>
              </span>
              <span className="pl-9">
                <StackedBar counts={row} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
