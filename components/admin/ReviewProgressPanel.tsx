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

const SEGMENTS = [
  { key: "published", fill: "bg-accent", label: sv.admin.reviewProgressPublished },
  { key: "toReview", fill: "bg-chart-3/70", label: sv.admin.reviewProgressToReview },
  { key: "flagged", fill: "bg-rate-1", label: sv.admin.reviewProgressFlagged },
] as const;

type Counts = Pick<ReviewProgressRow, "published" | "toReview" | "flagged">;

/** Staplad stapel: publicerade, att granska och flaggade, som andelar av områdets kort. */
function StackedBar({ counts, tall = false }: { counts: Counts; tall?: boolean }) {
  const total = counts.published + counts.toReview + counts.flagged;
  return (
    <div className={`flex overflow-hidden rounded-full bg-surface-3 ${tall ? "h-3" : "h-2"}`} aria-hidden="true">
      {total === 0
        ? null
        : SEGMENTS.map((s) => (counts[s.key] === 0 ? null : <div key={s.key} className={`h-full ${s.fill}`} style={{ width: `${(counts[s.key] / total) * 100}%` }} />))}
    </div>
  );
}

/**
 * Granskningen i Översikt: hur stor del av varje område som är publicerad och vad som återstår.
 * Ger examinatorerna ett tydligt, avgränsat mål ("område 12: 0 av 44") i stället för en lång
 * inkorg. Antalet kvar leder till granskningen filtrerad på området.
 */
export function ReviewProgressPanel({ deckId, progress }: { deckId: string; progress: ReviewProgress }) {
  const colorIndex = categoryColorIndex(progress.rows.map((r) => ({ id: r.areaId })));
  const { total } = progress;
  const all = total.published + total.toReview + total.flagged;

  return (
    <section aria-labelledby="granskningslage" className="anim-fade-up" data-testid="review-progress">
      <Card padding="lg">
        <CardHeader
          id="granskningslage"
          title={sv.admin.reviewProgressTitle}
          description={sv.admin.reviewProgressHelp}
          action={
            <LinkButton href={routes.admin.review(deckId)} size="sm" className="shrink-0">
              {sv.admin.reviewProgressStart}
              <ArrowRight size={15} aria-hidden />
            </LinkButton>
          }
        />

        <div className="grid gap-3">
          <p className="text-sm">
            <span className="text-2xl font-bold tabular-nums">{total.published}</span>
            <span className="text-muted"> {sv.admin.reviewProgressSummary(all, percent(total.published, all), total.toReview + total.flagged)}</span>
          </p>
          <StackedBar counts={total} tall />
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            {SEGMENTS.map((s) => (
              <li key={s.key} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${s.fill}`} aria-hidden="true" />
                {s.label} <span className="font-semibold tabular-nums text-fg">{total[s.key]}</span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="mt-6 grid gap-x-8 gap-y-4 lg:grid-cols-2">
          {progress.rows.map((row, i) => {
            const rowTotal = row.published + row.toReview + row.flagged;
            const left = row.toReview + row.flagged;
            return (
              <li key={row.areaId} className="grid gap-2" data-testid="review-progress-row">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-subtle">{i + 1}</span>
                    <AreaLink deckId={deckId} areaId={row.areaId} title={row.title} colorIndex={colorIndex.get(row.areaId) ?? 0} className="min-w-0" />
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    <span className="font-semibold">{sv.admin.reviewProgressOf(row.published, rowTotal)}</span>
                    {left > 0 ? (
                      <Link
                        href={routes.admin.review(deckId, { omrade: row.areaId })}
                        className="ml-2 font-semibold text-accent underline-offset-2 hover:underline"
                        aria-label={sv.admin.reviewProgressLeftLink(left, row.title)}
                      >
                        {sv.admin.reviewProgressLeft(left)}
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
