"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { DeckOverviewStats, DeckReportRow } from "@/lib/supabase/database.types";
import { firstLine } from "@/lib/text/first-line";
import { percent, percentText } from "@/lib/text/percent";
import { formatDateTime } from "@/lib/time/format";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { BarChart } from "@/components/stats/BarChart";
import { Card, CardHeader } from "@/components/ui/Card";
import { MIN_STUDENTS } from "@/lib/admin/thresholds";
import { formatCount, formatDecimal } from "@/lib/admin/format";
import { AreaLink } from "./AreaLink";
import { StatBlock } from "./StatBlock";

type Category = { id: string; title: string; cardCount: number };

type Props = {
  deckId: string;
  stats: DeckOverviewStats;
  categories: Category[];
  /** Öppna felrapporter, nyast först (de tre senaste visas). */
  openReports: DeckReportRow[];
};

export { MIN_STUDENTS };

const ratingFill: Record<number, string> = { 1: "bg-rate-1", 2: "bg-rate-2", 3: "bg-rate-3", 4: "bg-rate-4", 5: "bg-rate-5" };
const ratingFillSvg: Record<number, string> = { 1: "fill-rate-1", 2: "fill-rate-2", 3: "fill-rate-3", 4: "fill-rate-4", 5: "fill-rate-5" };
const BUCKET_LABELS = ["0–20 %", "20–40 %", "40–60 %", "60–80 %", "80–100 %"];

function ratingStep(avg: number): number {
  return Math.min(5, Math.max(1, Math.round(avg)));
}

/** "3.7 / 5" med nämnaren nedtonad, så att talet är det man ser först. */
function OutOfFive({ value }: { value: number | null }) {
  if (value === null) return <>–</>;
  return (
    <>
      {formatDecimal(value, 1)}
      <span className="text-[0.55em] font-bold text-muted"> / 5</span>
    </>
  );
}

const th = "py-3 text-xs font-semibold text-subtle";

/**
 * Examinatorns kursöversikt: bara det som hjälper i kursarbetet. Fyra nyckeltal, vilka
 * områden och frågor studenterna har svårast för, aktiviteten vecka för vecka och de
 * senaste felrapporterna. Fördelningarna ligger under "Mer statistik". Allt är aggregerat
 * och anonymt.
 */
export function CourseOverview({ deckId, stats, categories, openReports }: Props) {
  const colorIndex = categoryColorIndex(categories);
  const titleOf = new Map(categories.map((c) => [c.id, c.title] as const));
  const students = stats.students;

  // Databasen har redan filtrerat bort allt under anonymitetsgränsen (deck_stats_overview),
  // så inget som inte får visas har ens lämnat servern.
  const threshold = stats.min_students ?? MIN_STUDENTS;
  const hardest = stats.categories.filter((c) => c.avg !== null && titleOf.has(c.category_id)).sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0));
  const tricky = stats.cards.filter((c) => c.low > 0).slice(0, 8);
  const suppressed = stats.suppressed ?? { cards: 0, categories: 0 };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <section aria-labelledby="oversikt" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="anim-fade-up">
          <h2 id="oversikt" className="text-xl font-bold tracking-tight">
            {sv.admin.overviewTitle}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">{sv.admin.overviewHelp}</p>
        </div>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatBlock
            label={sv.admin.tileStudents}
            help={sv.admin.tileStudentsHelp}
            value={formatCount(students)}
            sub={sv.admin.tileStudentsSub}
            testId="overview-students"
            className="anim-fade-up"
            style={{ ["--i" as string]: 1 }}
          />
          <StatBlock
            label={sv.admin.tileActive}
            value={formatCount(stats.active_7d)}
            sub={sv.admin.tileActiveSub(stats.reviews_7d)}
            className="anim-fade-up"
            style={{ ["--i" as string]: 2 }}
          />
          <StatBlock
            label={sv.admin.tileAvg}
            value={<OutOfFive value={stats.avg_rating} />}
            sub={sv.admin.tileAvgSub}
            className="anim-fade-up"
            style={{ ["--i" as string]: 3 }}
          />
          <StatBlock
            label={sv.admin.tileReports}
            value={formatCount(stats.open_reports)}
            sub={sv.admin.tileReportsSub}
            href={`/admin/deck/${deckId}/rapporter`}
            className="anim-fade-up"
            style={{ ["--i" as string]: 4 }}
          />
        </dl>
        {students === 0 ? (
          <Card padding="lg" className="text-muted">
            {sv.admin.overviewEmpty}
          </Card>
        ) : null}
      </section>

      {students > 0 ? (
        <>
          <Panel id="svarast" title={sv.admin.hardest} help={sv.admin.hardestHelp} index={5}>
            {hardest.length === 0 ? (
              <p className="text-sm text-muted">{suppressed.categories > 0 ? sv.admin.thresholdNote(threshold) : sv.admin.hardestNone}</p>
            ) : (
              <div className="-mx-6 overflow-x-auto sm:-mx-7" tabIndex={0} role="region" aria-labelledby="svarast">
                <table className="w-full min-w-[36rem] text-sm" data-testid="hardest-table">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th scope="col" className={`${th} pl-6 pr-4 sm:pl-7`}>
                        {sv.admin.colArea}
                      </th>
                      <th scope="col" className={`${th} w-[34%] pr-4`}>
                        {sv.admin.colAvg}
                      </th>
                      <th scope="col" className={`${th} pr-4 text-right`}>
                        {sv.admin.colRatings}
                      </th>
                      <th scope="col" className={`${th} pr-6 text-right sm:pr-7`}>
                        {sv.admin.colLow}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {hardest.map((c) => {
                      const avg = c.avg ?? 0;
                      return (
                        <tr key={c.category_id} className="transition-colors duration-150 hover:bg-surface-2">
                          <td className="py-3 pl-6 pr-4 sm:pl-7">
                            <AreaLink deckId={deckId} areaId={c.category_id} title={titleOf.get(c.category_id) ?? ""} colorIndex={colorIndex.get(c.category_id) ?? 0} size="md" />
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                                <div className={`h-full rounded-full ${ratingFill[ratingStep(avg)] ?? "bg-rate-3"}`} style={{ width: `${(avg / 5) * 100}%` }} />
                              </div>
                              <span className="w-14 shrink-0 text-right font-bold tabular-nums">{formatDecimal(avg, 1)} / 5</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-muted">{formatCount(c.ratings)}</td>
                          <td className="py-3 pr-6 text-right tabular-nums sm:pr-7">{percent(c.low, c.ratings)} %</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel id="kluriga" title={sv.admin.tricky} help={sv.admin.trickyHelp} index={6}>
            {tricky.length === 0 ? (
              <p className="text-sm text-muted">{suppressed.cards > 0 ? sv.admin.thresholdNote(threshold) : sv.admin.trickyNone}</p>
            ) : (
              <div className="-mx-6 overflow-x-auto sm:-mx-7" tabIndex={0} role="region" aria-labelledby="kluriga">
                <table className="w-full min-w-[40rem] text-sm" data-testid="tricky-table">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th scope="col" className={`${th} pl-6 pr-4 sm:pl-7`}>
                        {sv.admin.colQuestion}
                      </th>
                      <th scope="col" className={`${th} w-[30%] pr-4`}>
                        {sv.admin.colArea}
                      </th>
                      <th scope="col" className={`${th} pr-4 text-right`}>
                        {sv.admin.colLowShare}
                      </th>
                      <th scope="col" className={`${th} pr-6 text-right sm:pr-7`}>
                        {sv.admin.colRatings}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {tricky.map((c) => (
                      <tr key={c.card_id} className="transition-colors duration-150 hover:bg-surface-2">
                        <td className="py-3 pl-6 pr-4 sm:pl-7">
                          <Link href={`/admin/deck/${deckId}/kort/${c.card_id}`} className="line-clamp-2 font-medium underline-offset-2 hover:underline" title={firstLine(c.front)}>
                            {firstLine(c.front)}
                          </Link>
                        </td>
                        <td className="py-3 pr-4">
                          {c.category_id && titleOf.has(c.category_id) ? (
                            <AreaLink deckId={deckId} areaId={c.category_id} title={titleOf.get(c.category_id) ?? ""} colorIndex={colorIndex.get(c.category_id) ?? 0} size="md" />
                          ) : (
                            <span className="text-muted">–</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className="inline-flex h-7 min-w-14 items-center justify-center rounded-full border border-rate-1 bg-rate-1/15 px-2.5 text-xs font-bold tabular-nums text-fg">
                            {percent(c.low, c.ratings)} %
                          </span>
                        </td>
                        <td className="py-3 pr-6 text-right tabular-nums text-muted sm:pr-7">{formatCount(c.ratings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {suppressed.cards > 0 ? <p className="text-xs text-muted">{sv.admin.suppressedCards(suppressed.cards, threshold)}</p> : null}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Panel id="aktivitet" title={sv.admin.weekly} help={sv.admin.weeklyHelp} index={7}>
              <BarChart
                title={sv.admin.weekly}
                hideTitle
                points={stats.weeks.map((w) => ({ key: w.start, label: `v.${w.week}`, value: w.students, detail: sv.admin.weeklyDetail(w.reviews) }))}
                formatValue={(v) => sv.admin.studentCount(v)}
              />
            </Panel>

            <Panel id="rapporter" title={sv.admin.latestReports} help={sv.admin.latestReportsHelp} index={8}>
              {openReports.length === 0 ? (
                <p className="text-sm text-muted">{sv.admin.reportsNone}</p>
              ) : (
                <ul className="grid gap-2">
                  {openReports.slice(0, 3).map((r) => (
                    <li key={r.id} className="rounded-md bg-surface-2 px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <Link href={`/admin/deck/${deckId}/kort/${r.card_id}`} className="min-w-0 truncate font-semibold underline-offset-2 hover:underline" title={firstLine(r.card_front)}>
                          {firstLine(r.card_front)}
                        </Link>
                        <span className="text-xs text-muted">{formatDateTime(r.created_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted">{r.message}</p>
                    </li>
                  ))}
                </ul>
              )}
              <MoreLink href={`/admin/deck/${deckId}/rapporter`}>{sv.admin.allReports}</MoreLink>
            </Panel>
          </div>

          <MoreLink href={`/admin/deck/${deckId}/statistik`}>{sv.admin.moreStats}</MoreLink>
        </>
      ) : null}
    </div>
  );
}

/**
 * Fördelningarna som inte får plats i översikten: kommer studenterna tillbaka, hur långt
 * har de kommit och hur skattar de sig. Visas på sidan Mer statistik.
 */
export function CourseDistributions({ stats }: { stats: DeckOverviewStats }) {
  if (stats.students === 0) return null;
  const totalRatings = stats.rating_dist.reduce((s, r) => s + r.n, 0);
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {stats.activation ? (
        <div className="lg:col-span-2">
          <Panel id="aktivering" title={sv.admin.activation} help={sv.admin.activationHelp}>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="activation-tiles">
              <StatBlock inset label={sv.admin.activationStarted} value={formatCount(stats.activation.started)} sub={sv.admin.activationStartedSub} />
              <StatBlock
                inset
                label={sv.admin.activationFirst}
                value={percentText(stats.activation.first_session_20, stats.activation.started)}
                sub={sv.admin.activationFirstSub}
              />
              <StatBlock
                inset
                label={sv.admin.activationReturned}
                value={percentText(stats.activation.returned_3d, stats.activation.eligible)}
                sub={sv.admin.activationReturnedSub(stats.activation.eligible)}
              />
            </dl>
          </Panel>
        </div>
      ) : null}

      <Panel id="framsteg" title={sv.admin.progressDist} help={sv.admin.progressDistHelp}>
        <BarChart
          title={sv.admin.progressDist}
          hideTitle
          points={stats.progress_buckets.map((b) => ({ key: `b${b.bucket}`, label: BUCKET_LABELS[b.bucket] ?? "", value: b.students }))}
          formatValue={(v) => sv.admin.studentCount(v)}
        />
      </Panel>

      <Panel id="skattningar" title={sv.admin.ratingDist} help={sv.admin.ratingDistHelp}>
        <BarChart
          title={sv.admin.ratingDist}
          hideTitle
          points={stats.rating_dist.map((r) => ({
            key: `r${r.rating}`,
            label: `${r.rating}`,
            value: r.n,
            colorClass: ratingFillSvg[r.rating] ?? "fill-chart-1",
            detail: totalRatings === 0 ? undefined : percentText(r.n, totalRatings),
          }))}
          formatValue={(v) => sv.stats.cards(v)}
        />
      </Panel>
    </div>
  );
}

function Panel({ id, title, help, index, children }: { id: string; title: string; help: string; index?: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={index ? "anim-fade-up" : undefined} style={index ? { ["--i" as string]: index } : undefined}>
      <Card padding="lg">
        <CardHeader id={id} title={title} description={help} />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">{children}</div>
      </Card>
    </section>
  );
}

/** "Alla felrapporter", "Mer statistik": grön textlänk med en pil som glider vid hovring. */
function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-accent underline-offset-2 hover:underline">
      {children}
      <ArrowRight size={15} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}
