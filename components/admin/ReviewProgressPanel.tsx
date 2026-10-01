"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { ReviewProgress, ReviewProgressRow } from "@/lib/admin/review";
import { percent } from "@/lib/text/percent";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { AreaLink } from "./AreaLink";
import { routes } from "@/lib/routes";
import { useReviewT } from "./review/ReviewLanguage";

/** Panelens texter; följer granskningens språkreglage (English), så att Roland kan läsa den. */
const TEXT = {
  sv: {
    title: sv.admin.reviewProgressTitle,
    help: sv.admin.reviewProgressHelp,
    start: sv.admin.reviewProgressStart,
    summary: sv.admin.reviewProgressSummary,
    of: sv.admin.reviewProgressOf,
    left: sv.admin.reviewProgressLeft,
    leftLink: sv.admin.reviewProgressLeftLink,
    approved: sv.admin.reviewProgressApproved,
    toReview: sv.admin.reviewProgressToReview,
    flagged: sv.admin.reviewProgressFlagged,
    removed: sv.admin.reviewProgressRemoved,
  },
  en: {
    title: "Review",
    help: "All cards are in rotation from the start and are reviewed by the examiners. A card that does not hold up is removed from rotation. The course opens to students when everything has been reviewed. Choose a topic to review just that one.",
    start: "Start reviewing",
    summary: (all: number, pct: number, left: number) =>
      `of ${all} cards reviewed (${pct} %). ${left === 0 ? "Everything has been reviewed." : left === 1 ? "1 card left." : `${left} cards left.`}`,
    of: (done: number, all: number) => `${done} of ${all}`,
    left: (n: number) => `${n} left`,
    leftLink: (n: number, area: string) => `Review ${n} cards in ${area}`,
    approved: "Approved",
    toReview: "To review",
    flagged: "Flagged",
    removed: "Removed",
  },
};

const SEGMENTS = [
  { key: "approved", fill: "bg-accent" },
  { key: "toReview", fill: "bg-chart-3/70" },
  { key: "flagged", fill: "bg-rate-1" },
  { key: "removed", fill: "bg-line-strong" },
] as const;

type Counts = Pick<ReviewProgressRow, "approved" | "toReview" | "flagged" | "removed">;

/** Staplad stapel: godkända, att granska, flaggade och ur rotation, som andelar av områdets kort. */
function StackedBar({ counts, tall = false }: { counts: Counts; tall?: boolean }) {
  const total = counts.approved + counts.toReview + counts.flagged + counts.removed;
  return (
    <div className={`flex overflow-hidden rounded-full bg-surface-3 ${tall ? "h-3" : "h-2"}`} aria-hidden="true">
      {total === 0
        ? null
        : SEGMENTS.map((s) => (counts[s.key] === 0 ? null : <div key={s.key} className={`h-full ${s.fill}`} style={{ width: `${(counts[s.key] / total) * 100}%` }} />))}
    </div>
  );
}

/**
 * Granskningen i Översikt: hur stor del av varje område som är granskad och vad som återstår.
 * Ger examinatorerna ett tydligt, avgränsat mål ("område 12: 0 av 44") i stället för en lång
 * inkorg. Antalet kvar leder till granskningen filtrerad på området.
 */
export function ReviewProgressPanel({ deckId, progress }: { deckId: string; progress: ReviewProgress }) {
  const lang = useReviewT().lang;
  const T = TEXT[lang];
  const nameOf = (row: ReviewProgressRow) => (lang === "en" && row.title_en ? row.title_en : row.title);
  const colorIndex = categoryColorIndex(progress.rows.map((r) => ({ id: r.areaId })));
  const { total } = progress;
  const all = total.approved + total.toReview + total.flagged + total.removed;
  const done = total.approved + total.removed;

  return (
    <section aria-labelledby="granskningslage" className="anim-fade-up" data-testid="review-progress">
      <Card padding="lg">
        <CardHeader
          id="granskningslage"
          title={T.title}
          description={T.help}
          action={
            <LinkButton href={routes.admin.review(deckId)} size="sm" className="shrink-0">
              {T.start}
              <ArrowRight size={15} aria-hidden />
            </LinkButton>
          }
        />

        <div className="grid gap-3">
          <p className="text-sm">
            <span className="text-2xl font-bold tabular-nums">{done}</span>
            <span className="text-muted"> {T.summary(all, percent(done, all), total.toReview + total.flagged)}</span>
          </p>
          <StackedBar counts={total} tall />
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            {SEGMENTS.map((s) => (
              <li key={s.key} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${s.fill}`} aria-hidden="true" />
                {T[s.key]} <span className="font-semibold tabular-nums text-fg">{total[s.key]}</span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="mt-6 grid gap-x-8 gap-y-4 lg:grid-cols-2">
          {progress.rows.map((row, i) => {
            const rowTotal = row.approved + row.toReview + row.flagged + row.removed;
            const left = row.toReview + row.flagged;
            return (
              <li key={row.areaId} className="grid gap-2" data-testid="review-progress-row">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-subtle">{i + 1}</span>
                    <AreaLink deckId={deckId} areaId={row.areaId} title={nameOf(row)} colorIndex={colorIndex.get(row.areaId) ?? 0} className="min-w-0" />
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    <span className="font-semibold">{T.of(row.approved + row.removed, rowTotal)}</span>
                    {left > 0 ? (
                      <Link
                        href={routes.admin.review(deckId, { omrade: row.areaId })}
                        className="ml-2 font-semibold text-accent underline-offset-2 hover:underline"
                        aria-label={T.leftLink(left, nameOf(row))}
                      >
                        {T.left(left)}
                      </Link>
                    ) : null}
                  </span>
                </div>
                <div className="pl-7">
                  <StackedBar counts={row} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
