"use client";

import { useMemo, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";
import { buildProgressStats } from "@/lib/stats/progress-stats";
import { BarChart } from "./BarChart";
import { RadarChart, RadarLegend, type RadarAxis } from "./RadarChart";
import { StatTile } from "./StatTile";

type Props = {
  cardIds: readonly string[];
  progress: ProgressMap;
  reviews: readonly ReviewEntry[];
  /** Rad med "X att repetera nu, Y nya" eller "Nästa repetition …" */
  dueText: string;
  /** Per kategori, i deckets ordning: underlag för radardiagrammet. */
  categories: { id: string; title: string; total: number; partial: number; learned: number }[];
};

/**
 * Din progress: fyra nyckeltal, repetitioner per dag och ackumulerad kunskap.
 * Data-testid seen-count och due-info används av E2E-testerna.
 */
export function ProgressStats({ cardIds, progress, reviews, dueText, categories }: Props) {
  const stats = useMemo(() => buildProgressStats({ cardIds, progress, reviews }), [cardIds, progress, reviews]);
  const [axisHover, setAxisHover] = useState<number | null>(null);
  const axes: RadarAxis[] = useMemo(
    () => categories.map((c, i) => ({ key: c.id, label: c.title, colorIndex: i, total: c.total, partial: c.partial, learned: c.learned })),
    [categories],
  );
  const learnedPct = stats.totalCards === 0 ? 0 : Math.round((stats.learned / stats.totalCards) * 100);

  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={sv.stats.learned} help={sv.stats.learnedHelp} value={`${stats.learned}`} sub={`${learnedPct} % av ${stats.totalCards}`} tone="green" />
        <StatTile label={sv.stats.streak} help={sv.stats.streakHelp} value={`${stats.streak}`} sub={sv.stats.days(stats.streak)} tone="navy" />
        <StatTile label={sv.stats.today} value={`${stats.reviewsToday}`} sub={sv.stats.cards(stats.reviewsToday)} tone="teal" />
        <StatTile label={sv.stats.avg7} value={stats.avg7 === null ? "–" : stats.avg7.toFixed(1)} sub="av 5" tone="violet" />
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
