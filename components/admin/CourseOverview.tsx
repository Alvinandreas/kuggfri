"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import type { DeckOverviewStats } from "@/lib/supabase/database.types";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { BarChart } from "@/components/stats/BarChart";
import { RadarChart, RadarLegend, type RadarAxis } from "@/components/stats/RadarChart";
import { CategoryTag } from "@/components/ui/CategoryTag";

type Category = { id: string; title: string; cardCount: number };

type Props = {
  deckId: string;
  stats: DeckOverviewStats;
  categories: Category[];
  openReports: number;
};

/** Så många skattningar ett kort behöver innan det visas i "Kluriga frågor". Höj vid lansering. */
export const MIN_CARD_RATINGS = 1;

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? text;
  return line.replace(/^[#*\-\s]+/, "").trim();
}

function dayLabel(day: string): string {
  const [, m, d] = day.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/**
 * Kursöversikten för examinatorn: samma visuella språk som studentens progress-
 * kort, men över alla studenter. Allt är aggregerat och anonymt.
 */
export function CourseOverview({ deckId, stats, categories, openReports }: Props) {
  const [axisHover, setAxisHover] = useState<number | null>(null);
  const colorIndex = categoryColorIndex(categories);
  const byCategory = useMemo(() => new Map(stats.categories.map((c) => [c.category_id, c] as const)), [stats.categories]);
  const students = stats.students;

  // Genomsnitt per student: summan av alla studenters inlärda/delvis inlärda kort delat med antal studenter.
  const axes: RadarAxis[] = useMemo(
    () =>
      categories.map((c, i) => {
        const s = byCategory.get(c.id);
        const div = Math.max(1, students);
        return {
          key: c.id,
          label: c.title,
          colorIndex: i,
          total: c.cardCount,
          learned: s ? s.learned / div : 0,
          partial: s ? s.partial / div : 0,
        };
      }),
    [categories, byCategory, students],
  );

  const tricky = stats.cards.filter((c) => c.low > 0 && c.ratings >= MIN_CARD_RATINGS).slice(0, 10);
  const catTitle = (id: string | null) => (id ? categories.find((c) => c.id === id)?.title : undefined);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <section aria-labelledby="oversikt" className="grid grid-cols-[minmax(0,1fr)] gap-5 rounded-lg border border-line bg-surface p-5 shadow-card">
        <div>
          <h2 id="oversikt" className="text-lg font-semibold">
            {sv.admin.overviewTitle}
          </h2>
          <p className="mt-1 text-sm text-muted">{sv.admin.overviewHelp}</p>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={sv.admin.tileStudents} help={sv.admin.tileStudentsHelp} value={`${students}`} sub={sv.admin.tileStudentsSub} tone="green" testId="overview-students" />
          <Tile label={sv.admin.tileActive} value={`${stats.active_7d}`} sub={sv.admin.tileActiveSub(stats.active_7d)} tone="navy" />
          <Tile label={sv.admin.tileReviews} value={`${stats.reviews_14d}`} sub={sv.admin.tileReviewsSub} tone="teal" />
          <Tile label={sv.admin.tileReports} value={`${openReports}`} sub={sv.admin.tileReportsSub} tone="violet" href={`/admin/deck/${deckId}/rapporter`} />
        </dl>

        {students === 0 ? (
          <p className="text-sm text-muted">{sv.admin.overviewEmpty}</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start">
            <BarChart
              title={sv.stats.reviewsPerDay}
              help={sv.stats.reviewsPerDayHelp}
              points={stats.days.map((d) => ({ key: d.day, label: dayLabel(d.day), value: d.reviews }))}
              formatValue={(v) => sv.stats.cards(v)}
            />
            {axes.length >= 3 ? (
              <>
                <RadarChart title={sv.admin.overviewRadar} help={sv.admin.overviewRadarHelp} axes={axes} hover={axisHover} onHover={setAxisHover} />
                <div className="md:col-span-2">
                  <RadarLegend axes={axes} hover={axisHover} onHover={setAxisHover} />
                </div>
              </>
            ) : null}
          </div>
        )}
        <p className="text-xs text-muted">{sv.admin.statsGuestNote}</p>
      </section>

      {students > 0 ? (
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <section aria-labelledby="per-kategori" className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-line bg-surface p-5 shadow-card">
            <div>
              <h2 id="per-kategori" className="text-lg font-semibold">
                {sv.admin.perCategory}
              </h2>
              <p className="mt-1 text-sm text-muted">{sv.admin.perCategoryHelp}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="w-[44%] py-2 pr-2 font-medium sm:w-[38%]">
                    {sv.admin.colCategory}
                  </th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">
                    {sv.admin.colStudents}
                  </th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">
                    {sv.admin.colLearnedAvg}
                  </th>
                  <th scope="col" className="hidden w-[24%] py-2 font-medium sm:table-cell">
                    <span className="sr-only">{sv.admin.colLearnedAvg}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c, i) => {
                  const s = byCategory.get(c.id);
                  const learnedAvg = s ? s.learned / Math.max(1, students) : 0;
                  const partialAvg = s ? s.partial / Math.max(1, students) : 0;
                  const learnedPct = c.cardCount === 0 ? 0 : Math.min(100, (learnedAvg / c.cardCount) * 100);
                  const partialPct = c.cardCount === 0 ? 0 : Math.min(100, ((learnedAvg + partialAvg) / c.cardCount) * 100);
                  return (
                    <tr key={c.id} className="border-b border-line last:border-b-0">
                      <td className="max-w-0 py-2.5 pr-2">
                        <CategoryTag title={c.title} colorIndex={i} />
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums text-muted">{s?.students ?? 0}</td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">
                        {learnedAvg.toFixed(1)} <span className="text-muted">/ {c.cardCount}</span>
                      </td>
                      <td className="hidden py-2.5 sm:table-cell">
                        <div className="h-2 w-full overflow-hidden rounded bg-surface-2" aria-hidden="true">
                          <div className="relative h-full">
                            <div className="absolute inset-y-0 left-0 rounded bg-chart-1/20" style={{ width: `${partialPct}%` }} />
                            <div className="absolute inset-y-0 left-0 rounded bg-rate-5" style={{ width: `${learnedPct}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="kluriga" className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-line bg-surface p-5 shadow-card">
            <div>
              <h2 id="kluriga" className="text-lg font-semibold">
                {sv.admin.tricky}
              </h2>
              <p className="mt-1 text-sm text-muted">{sv.admin.trickyHelp}</p>
            </div>
            {tricky.length === 0 ? (
              <p className="text-sm text-muted">{sv.admin.trickyNone}</p>
            ) : (
              <table className="w-full text-sm" data-testid="tricky-table">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="w-[52%] py-2 pr-2 font-medium sm:w-[42%]">
                      {sv.admin.colQuestion}
                    </th>
                    <th scope="col" className="hidden w-[30%] py-2 pr-2 font-medium sm:table-cell">
                      {sv.admin.colCategory}
                    </th>
                    <th scope="col" className="py-2 pr-2 text-right font-medium">
                      {sv.admin.colLowShare}
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      {sv.admin.colRatings}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tricky.map((c) => {
                    const title = catTitle(c.category_id);
                    const share = Math.round((c.low / c.ratings) * 100);
                    return (
                      <tr key={c.card_id} className="border-b border-line last:border-b-0">
                        <td className="max-w-0 py-2.5 pr-2 align-middle">
                          <Link href={`/admin/deck/${deckId}/kort/${c.card_id}`} className="block truncate underline-offset-2 hover:underline" title={firstLine(c.front)}>
                            {firstLine(c.front)}
                          </Link>
                        </td>
                        <td className="hidden max-w-0 py-2.5 pr-2 align-middle sm:table-cell">
                          {title && c.category_id ? <CategoryTag title={title} colorIndex={colorIndex.get(c.category_id) ?? 0} /> : <span className="text-muted">–</span>}
                        </td>
                        <td className="py-2.5 pr-2 text-right align-middle">
                          <span className="inline-flex h-7 min-w-12 items-center justify-center rounded-md border border-rate-1 bg-rate-1/15 px-1.5 text-xs font-semibold tabular-nums text-fg">{share} %</span>
                        </td>
                        <td className="py-2.5 text-right align-middle tabular-nums text-muted">{c.ratings}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <Link href={`/admin/deck/${deckId}/statistik`} className="text-sm text-accent underline-offset-2 hover:underline">
              {sv.admin.allCardsDetail} →
            </Link>
          </section>
        </div>
      ) : null}
    </div>
  );
}

type Tone = "green" | "navy" | "teal" | "violet";
const tones: Record<Tone, string> = {
  green: "border-accent/40 bg-accent-soft/60",
  navy: "border-tag-7 bg-tag-7/60 dark:bg-tag-7/35",
  teal: "border-tag-5 bg-tag-5/60 dark:bg-tag-5/35",
  violet: "border-tag-8 bg-tag-8/60 dark:bg-tag-8/35",
};

/** En <dl> får bara innehålla div/dt/dd, så länken (felrapporter) ligger inne i dd:t och täcker rutan. */
function Tile({ label, help, value, sub, tone, href, testId }: { label: string; help?: string; value: string; sub: string; tone: Tone; href?: string; testId?: string }) {
  return (
    <div className={`relative rounded-lg border p-3 ${tones[tone]} ${href ? "transition-shadow hover:shadow-card" : ""}`}>
      <dt className="text-xs text-muted" title={help}>
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold leading-none tabular-nums" data-testid={testId}>
        {href ? (
          <Link href={href} className="after:absolute after:inset-0 after:rounded-lg">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
      <dd className="mt-1 text-xs text-muted">{sub}</dd>
    </div>
  );
}
