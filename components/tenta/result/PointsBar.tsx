import type { Exam } from "@/lib/tentor/model";
import { formatPoints } from "@/lib/tentor/session";
import { cx } from "@/components/ui/cx";

/** Stapel med poängen och betygsgränserna som streck; `ghost` visar det verkliga resultatet under det tänkta. */
export function PointsBar({ points, ghost, max, grades, compact = false }: { points: number; ghost?: number | null; max: number; grades: Exam["grades"]; compact?: boolean }) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  return (
    <div className={compact ? "" : "mt-6"} aria-hidden>
      <div className={cx("relative rounded-full bg-surface-3", compact ? "h-2" : "h-3")}>
        {ghost !== undefined && ghost !== null ? <div className="absolute inset-y-0 left-0 rounded-full bg-fg/25" style={{ width: pct(ghost) }} /> : null}
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500" style={{ width: pct(points) }} />
        {grades.map((g) => (
          <span key={g.grade} className="absolute -bottom-1 -top-1 w-0.5 rounded bg-fg/70" style={{ left: pct(g.min) }} />
        ))}
      </div>
      {compact ? null : (
        <div className="relative mt-1.5 h-9 text-xs font-semibold text-muted">
          {grades.map((g) => (
            <span key={g.grade} className="absolute flex -translate-x-1/2 flex-col items-center tabular-nums leading-tight" style={{ left: pct(g.min) }}>
              <span className="text-fg">{g.grade}</span>
              <span className="font-medium">{formatPoints(g.min)} p</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
