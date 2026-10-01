import { sv } from "@/lib/i18n/sv";
import { ratingShares, type MyStats } from "@/lib/stats/my-stats";
import { StatTile } from "@/components/stats/StatTile";
import { Card, CardHeader } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";

// Skattningsfärgerna utskrivna, så att Tailwind hittar klasserna.
const RATE_BG = ["bg-rate-1", "bg-rate-2", "bg-rate-3", "bg-rate-4", "bg-rate-5"] as const;

/** Snittskattning, vändningar och fördelningen av alla skattningar, femmor överst. */
export function RatingsCard({ stats, index, className }: { stats: MyStats; index: number; className?: string }) {
  const shares = ratingShares(stats.ratingCounts);
  return (
    <Card padding="lg" className={cx("anim-fade-up", className)} style={{ ["--i" as string]: index }} data-testid="mystats-ratings">
      <CardHeader title={sv.myStats.ratings} description={sv.myStats.ratingsHelp} />
      <dl className="mb-6 grid grid-cols-2 gap-3">
        <StatTile
          label={sv.myStats.avgRating}
          value={stats.avgRating === null ? "–" : stats.avgRating.toFixed(1).replace(".", ",")}
          sub={sv.myStats.avgRatingSub}
          tone="green"
        />
        <StatTile label={sv.myStats.comebacks} value={`${stats.comebacks}`} sub={sv.myStats.comebacksSub} tone="violet" />
      </dl>
      {/* Egna staplar: etiketterna är korta, och i den smala kolumnen ska stapeln få bredden. */}
      <ol className="grid gap-3" aria-label={sv.myStats.ratings}>
        {[5, 4, 3, 2, 1].map((r) => {
          const share = shares[r - 1] ?? 0;
          const count = stats.ratingCounts[r - 1] ?? 0;
          return (
            <li key={r} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="w-3 font-bold tabular-nums">{r}</span>
                <span className="truncate text-muted">{sv.study.rate[r as 1 | 2 | 3 | 4 | 5]}</span>
              </span>
              <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden title={sv.myStats.ratingCount(count)}>
                <span
                  className={cx("block h-full rounded-full transition-[width] duration-700 ease-out", RATE_BG[r - 1])}
                  style={{ width: share === 0 ? "0%" : `max(${Math.round(share * 100)}%, 0.5rem)` }}
                />
              </span>
              <span className="text-right font-semibold tabular-nums">
                {Math.round(share * 100)} %<span className="sr-only"> ({sv.myStats.ratingCount(count)})</span>
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
