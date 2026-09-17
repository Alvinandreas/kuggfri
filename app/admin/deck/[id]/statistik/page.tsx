import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { firstLine } from "@/lib/text/first-line";
import { getDeckForAdmin, getDeckStats } from "@/lib/admin/queries";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { CategoryTag } from "@/components/ui/CategoryTag";

export const metadata: Metadata = { title: sv.admin.allCardsDetail };

/** Alla kort i detalj: snittskattning och repetitioner per kort, lägst först. */
export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const stats = await getDeckStats(id);
  const colorIndex = categoryColorIndex(data.categories);
  const categoryOf = new Map(data.cards.map((c) => [c.id, c.category_id] as const));
  const titleOf = new Map(data.categories.map((c) => [c.id, c.title] as const));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <nav aria-label={sv.admin.breadcrumb} className="text-sm text-muted">
        <Link href={`/admin/deck/${id}`} className="hover:text-fg">
          ← {sv.admin.tabOverview}
        </Link>
      </nav>
      <div>
        <h2 className="text-lg font-semibold">{sv.admin.allCardsDetail}</h2>
        <p className="mt-1 text-sm text-muted">{sv.admin.statsDetailHelp}</p>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-line bg-surface p-3">
          <dt className="text-xs text-muted">{sv.admin.tileStudents}</dt>
          <dd className="mt-1 text-2xl font-semibold leading-none tabular-nums" data-testid="stats-users">
            {stats.uniqueUsers}
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-3">
          <dt className="text-xs text-muted">{sv.admin.statsReviews}</dt>
          <dd className="mt-1 text-2xl font-semibold leading-none tabular-nums">{stats.totalReviews}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-3">
          <dt className="text-xs text-muted">{sv.admin.statsAvg}</dt>
          <dd className="mt-1 text-2xl font-semibold leading-none tabular-nums">{stats.avgRating === null ? "–" : stats.avgRating.toFixed(2)}</dd>
        </div>
      </dl>
      {stats.cards.every((c) => c.rating_count === 0) ? (
        <p className="text-muted">{sv.admin.statsNone}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">{sv.admin.statsCard}</th>
                <th className="hidden py-2 pr-3 font-medium sm:table-cell">{sv.admin.colCategory}</th>
                <th className="py-2 pr-3 text-right font-medium">{sv.admin.statsAvg}</th>
                <th className="py-2 pr-3 text-right font-medium">{sv.admin.statsRatings}</th>
                <th className="py-2 text-right font-medium">{sv.admin.statsReviews}</th>
              </tr>
            </thead>
            <tbody>
              {stats.cards.map((c) => {
                const cat = categoryOf.get(c.card_id) ?? null;
                return (
                  <tr key={c.card_id} className="border-b border-line last:border-b-0">
                    <td className="max-w-[28rem] py-2 pr-3">
                      <Link href={`/admin/deck/${id}/kort/${c.card_id}`} className="block truncate underline-offset-2 hover:underline" title={firstLine(c.front)}>
                        {firstLine(c.front)}
                      </Link>
                    </td>
                    <td className="hidden py-2 pr-3 sm:table-cell">
                      {cat ? <CategoryTag title={titleOf.get(cat) ?? ""} colorIndex={colorIndex.get(cat) ?? 0} /> : <span className="text-muted">–</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.avg_rating === null ? "–" : c.avg_rating.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.rating_count}</td>
                    <td className="py-2 text-right tabular-nums">{c.total_reps}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">{sv.admin.statsGuestNote}</p>
    </div>
  );
}
