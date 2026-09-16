"use client";

import { useMemo, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";
import { buildProgressStats } from "@/lib/stats/progress-stats";
import { BarChart } from "./BarChart";
import { RadarChart, RadarLegend, type RadarAxis } from "./RadarChart";

type Props = {
  cardIds: readonly string[];
  progress: ProgressMap;
  reviews: readonly ReviewEntry[];
  /** Rad med "X att repetera nu, Y nya" eller "Nästa repetition …" */
  dueText: string;
  /** Per kategori, i deckets ordning: underlag för radardiagrammet. */
  categories: { id: string; title: string; total: number; studied: number; learned: number }[];
};

/**
 * Din progress: fyra nyckeltal, repetitioner per dag och ackumulerad kunskap.
 * Data-testid seen-count och due-info används av E2E-testerna.
 */
export function ProgressStats({ cardIds, progress, reviews, dueText, categories }: Props) {
  const stats = useMemo(() => buildProgressStats({ cardIds, progress, reviews }), [cardIds, progress, reviews]);
  const [axisHover, setAxisHover] = useState<number | null>(null);
  const axes: RadarAxis[] = useMemo(
    () => categories.map((c, i) => ({ key: c.id, label: c.title, colorIndex: i, total: c.total, studied: c.studied, learned: c.learned })),
    [categories],
  );
  const learnedPct = stats.totalCards === 0 ? 0 : Math.round((stats.learned / stats.totalCards) * 100);

  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={sv.stats.learned} help={sv.stats.learnedHelp} value={`${stats.learned}`} sub={`${learnedPct} % av ${stats.totalCards}`} accent />
        <Tile label={sv.stats.streak} help={sv.stats.streakHelp} value={`${stats.streak}`} sub={sv.stats.days(stats.streak)} />
        <Tile label={sv.stats.today} value={`${stats.reviewsToday}`} sub={sv.stats.cards(stats.reviewsToday)} />
        <Tile label={sv.stats.avg7} value={stats.avg7 === null ? "–" : stats.avg7.toFixed(1)} sub="av 5" />
      </dl>

      <p className="text-sm">
        <span data-testid="seen-count" className="font-medium">
          {sv.deck.seen(stats.seen, stats.totalCards)}
        </span>
        <span className="text-muted"> · </span>
        <span data-testid="due-info">{dueText}</span>
      </p>

      {stats.hasReviews ? (
        <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start">
          <BarChart
            title={sv.stats.reviewsPerDay}
            help={sv.stats.reviewsPerDayHelp}
            points={stats.series.map((p) => ({ key: p.day, label: p.label, value: p.reviews }))}
            formatValue={(v) => sv.stats.cards(v)}
          />
          {axes.length >= 3 ? (
            <>
              <RadarChart title={sv.stats.radar} help={sv.stats.radarHelp} axes={axes} hover={axisHover} onHover={setAxisHover} />
              <div className="md:col-span-2">
                <RadarLegend axes={axes} hover={axisHover} onHover={setAxisHover} />
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">{sv.stats.empty}</p>
      )}
    </div>
  );
}

function Tile({ label, help, value, sub, accent = false }: { label: string; help?: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-accent/40 bg-accent-soft/50" : "border-line bg-bg"}`}>
      <dt className="text-xs text-muted" title={help}>
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold leading-none tabular-nums">{value}</dd>
      <dd className="mt-1 text-xs text-muted">{sub}</dd>
    </div>
  );
}
