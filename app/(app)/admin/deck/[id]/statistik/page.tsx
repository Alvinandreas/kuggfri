import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { getLang, getT } from "@/lib/i18n/server";
import { areaName, cardFront } from "@/lib/admin/display";
import { firstLine } from "@/lib/text/first-line";
import { getDeckForAdmin, getDeckOverviewStats, getDeckStats } from "@/lib/admin/queries";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { CourseDistributions } from "@/components/admin/CourseOverview";
import { StatBlock } from "@/components/admin/StatBlock";
import { Card, CardHeader } from "@/components/ui/Card";
import { AreaLink } from "@/components/admin/AreaLink";
import { formatCount, formatDecimal } from "@/lib/admin/format";
import { routes } from "@/lib/routes";
import { buttonClass } from "@/components/ui/Button";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.admin.allCardsDetail };
}

/** Mer statistik: fördelningarna från översikten och alla kort i detalj, lägst snitt först. */
export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const sv = await getT();
  const { id } = await params;
  const [data, rawStats, overview, lang] = await Promise.all([getDeckForAdmin(id), getDeckStats(id), getDeckOverviewStats(id), getLang()]);
  if (!data) notFound();
  const front = new Map(data.cards.map((c) => [c.id, cardFront(c, lang)] as const));
  const stats = { ...rawStats, cards: rawStats.cards.map((c) => ({ ...c, front: front.get(c.card_id) ?? c.front })) };
  const colorIndex = categoryColorIndex(data.categories);
  const categoryOf = new Map(data.cards.map((c) => [c.id, c.category_id] as const));
  const titleOf = new Map(data.categories.map((c) => [c.id, areaName(c, lang)] as const));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <nav aria-label={sv.admin.breadcrumb} className="text-sm text-muted">
        <Link href={routes.admin.deck(id)} className="inline-flex min-h-8 items-center gap-1 rounded-full font-semibold hover:text-fg">
          <ArrowLeft size={15} aria-hidden />
          {sv.admin.tabOverview}
        </Link>
      </nav>
      <CourseDistributions stats={overview} />
      <Card padding="lg">
        <CardHeader title={sv.admin.statsCsvTitle} description={sv.admin.statsCsvHelp} spacing="sm" />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["omraden", sv.admin.statsCsvAreas],
              ["kort", sv.admin.statsCsvCards],
            ] as const
          ).map(([level, label]) => (
            <a key={level} href={routes.admin.statsCsv(id, level)} download className={buttonClass("secondary", "sm")} data-testid={`stats-csv-${level}`}>
              <Download size={15} aria-hidden />
              {label}
            </a>
          ))}
        </div>
      </Card>
      <div>
        <h2 className="text-xl font-bold tracking-tight">{sv.admin.allCardsDetail}</h2>
        <p className="mt-1 text-sm text-muted">{sv.admin.statsDetailHelp}</p>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <StatBlock label={sv.admin.tileStudents} value={formatCount(stats.uniqueUsers, sv.meta.locale)} testId="stats-users" />
        <StatBlock label={sv.admin.statsReviews} value={formatCount(stats.totalReviews, sv.meta.locale)} />
        <StatBlock label={sv.admin.statsAvg} value={formatDecimal(stats.avgRating, 2, sv.meta.locale)} />
      </dl>
      {stats.cards.every((c) => c.rating_count === 0) ? (
        <Card padding="lg" className="text-muted">
          {sv.admin.statsNone}
        </Card>
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold text-subtle">
                <th className="py-3 pl-5 pr-3 font-semibold">{sv.admin.statsCard}</th>
                <th className="hidden py-3 pr-3 font-semibold sm:table-cell">{sv.admin.colCategory}</th>
                <th className="py-3 pr-3 text-right font-semibold">{sv.admin.statsAvg}</th>
                <th className="py-3 pr-3 text-right font-semibold">{sv.admin.statsRatings}</th>
                <th className="py-3 pr-5 text-right font-semibold">{sv.admin.statsReviews}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.cards.map((c) => {
                const cat = categoryOf.get(c.card_id) ?? null;
                return (
                  <tr key={c.card_id} className="transition-colors duration-150 hover:bg-surface-2">
                    <td className="max-w-[28rem] py-2.5 pl-5 pr-3">
                      <Link href={routes.admin.card(id, c.card_id)} className="block truncate underline-offset-2 hover:underline" title={firstLine(c.front)}>
                        {firstLine(c.front)}
                      </Link>
                    </td>
                    <td className="hidden py-2.5 pr-3 sm:table-cell">
                      {cat && titleOf.has(cat) ? <AreaLink deckId={id} areaId={cat} title={titleOf.get(cat) ?? ""} colorIndex={colorIndex.get(cat) ?? 0} sv={sv} /> : <span className="text-muted">–</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatDecimal(c.avg_rating, 2, sv.meta.locale)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatCount(c.rating_count, sv.meta.locale)}</td>
                    <td className="py-2.5 pr-5 text-right tabular-nums">{formatCount(c.total_reps, sv.meta.locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
