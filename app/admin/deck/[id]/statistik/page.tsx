import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getDeckForAdmin, getDeckStats } from "@/lib/admin/queries";

export const metadata: Metadata = { title: sv.admin.stats };

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? text;
  return line.replace(/^[#*\-\s]+/, "").trim();
}

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const stats = await getDeckStats(id);
  const rated = stats.cards.filter((c) => c.rating_count > 0);
  const lowest = rated.slice(0, 10);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {sv.admin.stats}: {data.deck.title}
      </h1>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-sm text-muted">{sv.admin.statsUsers}</dt>
          <dd className="text-2xl font-semibold" data-testid="stats-users">
            {stats.uniqueUsers}
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-sm text-muted">{sv.admin.statsReviews}</dt>
          <dd className="text-2xl font-semibold">{stats.totalReviews}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-sm text-muted">{sv.admin.statsAvg}</dt>
          <dd className="text-2xl font-semibold">{stats.avgRating === null ? "–" : stats.avgRating.toFixed(2)}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted">{sv.admin.statsGuestNote}</p>

      {rated.length === 0 ? (
        <p className="text-muted">{sv.admin.statsNone}</p>
      ) : (
        <>
          <section aria-labelledby="lagst">
            <h2 id="lagst" className="text-lg font-semibold">
              {sv.admin.statsLowest}
            </h2>
            <ol className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
              {lowest.map((c) => (
                <li key={c.card_id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2 text-sm">
                  <span className="truncate">{firstLine(c.front)}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {c.avg_rating?.toFixed(2)} ({c.rating_count})
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="per-kort" className="overflow-x-auto">
            <h2 id="per-kort" className="text-lg font-semibold">
              {sv.admin.statsPerCard}
            </h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-2 pr-3 font-medium">{sv.admin.statsCard}</th>
                  <th className="py-2 pr-3 font-medium">{sv.admin.statsAvg}</th>
                  <th className="py-2 pr-3 font-medium">{sv.admin.statsRatings}</th>
                  <th className="py-2 font-medium">{sv.admin.statsReviews}</th>
                </tr>
              </thead>
              <tbody>
                {stats.cards.map((c) => (
                  <tr key={c.card_id} className="border-b border-line">
                    <td className="max-w-[28rem] truncate py-2 pr-3">{firstLine(c.front)}</td>
                    <td className="py-2 pr-3 tabular-nums">{c.avg_rating === null ? "–" : c.avg_rating.toFixed(2)}</td>
                    <td className="py-2 pr-3 tabular-nums">{c.rating_count}</td>
                    <td className="py-2 tabular-nums">{c.total_reps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
