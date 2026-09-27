import { Moon, Sparkles, Sun, Sunrise, Sunset, type LucideIcon } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { favouriteIndex, favouriteTimeOfDay, TIMES_OF_DAY, type MyStats, type TimeOfDay } from "@/lib/stats/my-stats";
import { percent } from "@/lib/text/percent";
import { BarChart } from "@/components/stats/BarChart";
import { Card, CardHeader } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";

const ICONS: Record<TimeOfDay, LucideIcon> = { morning: Sunrise, day: Sun, evening: Sunset, night: Moon };

/**
 * När studenten pluggar: repetitioner per veckodag (favoritdagen i full färg) och fyra rutor
 * för tiden på dygnet, där den vanligaste blir studentens "pluggtyp".
 */
export function RhythmCard({ stats, index }: { stats: MyStats; index: number }) {
  const favDay = favouriteIndex(stats.weekdayCounts);
  const favTime = favouriteTimeOfDay(stats.timeOfDay);
  const points = stats.weekdayCounts.map((n, i) => ({
    key: `${i}`,
    label: sv.myStats.weekdays[i] ?? "",
    value: n,
    colorClass: i === favDay ? "fill-chart-1" : "fill-chart-1/40",
  }));

  return (
    <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: index }} data-testid="mystats-rhythm">
      <CardHeader
        title={sv.myStats.rhythm}
        description={favDay === null ? undefined : sv.myStats.favouriteDay(sv.myStats.weekdaysPlural[favDay] ?? "")}
      />
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <BarChart title={sv.myStats.weekdayChart} points={points} formatValue={sv.myStats.reviewsCount} />
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{sv.myStats.timeOfDayTitle}</h3>
            {favTime ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
                <Sparkles size={14} aria-hidden />
                {sv.myStats.persona}: {sv.myStats.timesOfDay[favTime].persona}
              </span>
            ) : null}
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {TIMES_OF_DAY.map((t) => {
              const Icon = ICONS[t];
              const fav = t === favTime;
              const text = sv.myStats.timesOfDay[t];
              return (
                <li key={t} className={cx("rounded-lg p-4", fav ? "bg-accent-soft" : "bg-surface-2")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cx("inline-flex items-center gap-2 text-sm font-semibold", fav && "text-accent-ink")}>
                      <Icon size={16} aria-hidden />
                      {text.label}
                    </span>
                    <span className={cx("text-xs tabular-nums", fav ? "text-accent-ink" : "text-muted")}>{text.range}</span>
                  </div>
                  <p className="mt-2 text-2xl font-extrabold leading-none tracking-tight tabular-nums">
                    {percent(stats.timeOfDay[t], stats.totalReviews)} %
                  </p>
                  <p className={cx("mt-1 text-xs", fav ? "text-accent-ink" : "text-muted")}>{sv.myStats.reviewsCount(stats.timeOfDay[t])}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
}
