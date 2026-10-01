import { CalendarCheck, Eye, Flame, Footprints, Mountain, Rocket, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Milestone, MilestoneKey } from "@/lib/stats/my-stats";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cx } from "@/components/ui/cx";

const ICONS: Record<MilestoneKey, LucideIcon> = {
  firstReview: Footprints,
  reviews100: Zap,
  streak7: Flame,
  comebacks10: TrendingUp,
  reviews1000: Rocket,
  activeDays30: CalendarCheck,
  allSeen: Eye,
  halfLearned: Mountain,
};

/** Milstolpar som märken: upplåsta i grönt, låsta dämpade med hur långt det är kvar. */
export function MilestonesCard({ milestones, index }: { milestones: Milestone[]; index: number }) {
  const sv = useT();
  const unlocked = milestones.filter((m) => m.unlocked).length;
  return (
    <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: index }} data-testid="mystats-milestones">
      <CardHeader title={sv.myStats.milestones} description={sv.myStats.milestonesHelp(unlocked, milestones.length)} />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {milestones.map((m) => {
          const Icon = ICONS[m.key];
          const text = sv.myStats.milestone[m.key];
          return (
            <li key={m.key} className="flex gap-3 rounded-lg bg-surface-2 p-4" data-unlocked={m.unlocked}>
              <span
                className={cx(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  m.unlocked ? "bg-accent-soft text-accent-ink" : "bg-surface-3 text-subtle",
                )}
              >
                <Icon size={20} aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className={cx("font-semibold leading-snug", !m.unlocked && "text-muted")}>{text.title}</p>
                <p className="mt-0.5 text-xs text-muted">{text.body}</p>
                {/* Märket och förloppet längst ner i varje ruta, så att raderna linjerar även när
                    beskrivningen radbryts ("Tio vändningar", "Trettio pluggdagar"). */}
                {m.unlocked ? (
                  <div className="mt-auto pt-2.5">
                    <Badge tone="accent">{sv.myStats.unlocked}</Badge>
                  </div>
                ) : (
                  <div className="mt-auto flex items-center gap-2 pt-2.5">
                    <ProgressBar value={m.target === 0 ? 0 : m.current / m.target} label={text.title} tone="chart-2" />
                    <span className="shrink-0 text-xs tabular-nums text-muted">{sv.myStats.milestoneProgress(m.current, m.target)}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
