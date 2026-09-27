"use client";

import { useMemo, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";
import { buildProgressStats } from "@/lib/stats/progress-stats";
import { BarChart } from "./BarChart";
import { RadarChart, RadarLegend, type RadarAxis } from "./RadarChart";
import { ShareReadiness } from "./ShareReadiness";
import { StatTile } from "./StatTile";
import { percent } from "@/lib/text/percent";

type Props = {
  cardIds: readonly string[];
  progress: ProgressMap;
  reviews: readonly ReviewEntry[];
  /** Rad med "X att repetera nu, Y nya" eller "Nästa repetition …" */
  dueText: string;
  /** Per kategori, i deckets ordning: underlag för radardiagrammet. */
  categories: { id: string; title: string; total: number; partial: number; learned: number }[];
  /** Helger räknas inte som missade dagar i streaken. */
  weekdaysOnly?: boolean;
  /** För den delbara beredskapsbilden. */
  deck?: { title: string; slug: string };
};

/**
 * Din progress: fyra nyckeltal, repetitioner per dag och ackumulerad kunskap.
 * Data-testid seen-count och due-info används av E2E-testerna.
 */
export function ProgressStats({ cardIds, progress, reviews, dueText, categories, weekdaysOnly = false, deck }: Props) {
  const stats = useMemo(() => buildProgressStats({ cardIds, progress, reviews, weekdaysOnly }), [cardIds, progress, reviews, weekdaysOnly]);
  const [axisHover, setAxisHover] = useState<number | null>(null);
  const axes: RadarAxis[] = useMemo(
    () => categories.map((c, i) => ({ key: c.id, label: c.title, colorIndex: i, total: c.total, partial: c.partial, learned: c.learned })),
    [categories],
  );
  const learnedPct = percent(stats.learned, stats.totalCards);

  return (
    <div className="grid gap-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={sv.stats.learned} help={sv.stats.learnedHelp} value={`${stats.learned}`} sub={`${learnedPct} % av ${stats.totalCards}`} tone="green" />
        <StatTile
          label={sv.stats.streak}
          help={sv.stats.streakHelp}
          value={`${stats.streak}`}
          sub={stats.freezeUsedRecently ? sv.summary.freezeUsed : sv.summary.freezesLeft(stats.freezesLeft)}
          tone="navy"
        />
        <StatTile label={sv.stats.today} value={`${stats.reviewsToday}`} sub={sv.stats.cards(stats.reviewsToday)} tone="teal" />
        <StatTile label={sv.stats.avg7} value={stats.avg7 === null ? "–" : stats.avg7.toFixed(1)} sub="av 5" tone="violet" />
      </dl>

      <div className="grid gap-1.5">
        <p className="text-sm">
          <span data-testid="seen-count" className="font-semibold">
            {sv.deck.seen(stats.seen, stats.totalCards)}
          </span>
          <span className="text-muted"> · </span>
          <span data-testid="due-info">{dueText}</span>
        </p>
        <p className="text-sm text-muted" data-testid="knowledge-now">
          {stats.knowledge.reviewed === 0
            ? sv.deck.knowledgeNowEmpty
            : sv.deck.knowledgeNow(Math.round(stats.knowledge.share * 100), stats.knowledge.reviewed)}
        </p>
      </div>
      {deck && stats.knowledge.reviewed > 0 ? (
        <ShareReadiness
          card={{
            deckTitle: deck.title,
            share: stats.knowledge.share,
            streak: stats.streak,
            reviewed: stats.knowledge.reviewed,
            total: stats.totalCards,
            url: `kuggfri.com/d/${deck.slug}`,
            date: new Date(),
          }}
        />
      ) : null}

      {stats.hasReviews ? (
        <div className="grid gap-6 border-t border-line pt-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start">
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
