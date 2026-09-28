import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { firstLine } from "@/lib/text/first-line";
import { getDeckForAdmin, getDeckOverviewStats, getDeckStats } from "@/lib/admin/queries";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { CourseDistributions } from "@/components/admin/CourseOverview";
import { StatBlock } from "@/components/admin/StatBlock";
import { Card } from "@/components/ui/Card";
import { AreaLink } from "@/components/admin/AreaLink";

export const metadata: Metadata = { title: sv.admin.allCardsDetail };

/** Mer statistik: fördelningarna från översikten och alla kort i detalj, lägst snitt först. */
export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, stats, overview] = await Promise.all([getDeckForAdmin(id), getDeckStats(id), getDeckOverviewStats(id)]);
  if (!data) notFound();
  const colorIndex = categoryColorIndex(data.categories);
  const categoryOf = new Map(data.cards.map((c) => [c.id, c.category_id] as const));
  const titleOf = new Map(data.categories.map((c) => [c.id, c.title] as const));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <nav aria-label={sv.admin.breadcrumb} className="text-sm text-muted">
        <Link href={`/admin/deck/${id}`} className="inline-flex min-h-8 items-center gap-1 rounded-full font-semibold hover:text-fg">
          <ArrowLeft size={15} aria-hidden />
          {sv.admin.tabOverview}
        </Link>
      </nav>
      <CourseDistributions stats={overview} />
      <div>
        <h2 className="text-xl font-bold tracking-tight">{sv.admin.allCardsDetail}</h2>
        <p className="mt-1 text-sm text-muted">{sv.admin.statsDetailHelp}</p>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <StatBlock label={sv.admin.tileStudents} value={`${stats.uniqueUsers}`} testId="stats-users" />
        <StatBlock label={sv.admin.statsReviews} value={`${stats.totalReviews}`} />
        <StatBlock label={sv.admin.statsAvg} value={stats.avgRating === null ? "–" : stats.avgRating.toFixed(2)} />
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
                      <Link href={`/admin/deck/${id}/kort/${c.card_id}`} className="block truncate underline-offset-2 hover:underline" title={firstLine(c.front)}>
                        {firstLine(c.front)}
                      </Link>
                    </td>
                    <td className="hidden py-2.5 pr-3 sm:table-cell">
                      {cat && titleOf.has(cat) ? <AreaLink deckId={id} areaId={cat} title={titleOf.get(cat) ?? ""} colorIndex={colorIndex.get(cat) ?? 0} /> : <span className="text-muted">–</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{c.avg_rating === null ? "–" : c.avg_rating.toFixed(2)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{c.rating_count}</td>
                    <td className="py-2.5 pr-5 text-right tabular-nums">{c.total_reps}</td>
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
