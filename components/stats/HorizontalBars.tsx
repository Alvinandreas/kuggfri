import type { ReactNode } from "react";

export type HorizontalBarRow = {
  key: string;
  label: ReactNode;
  /** 0–1 */
  fraction: number;
  valueLabel: string;
  detail?: string;
  /** Tailwind-klass för stapelns fyllning, t.ex. "bg-rate-2". */
  colorClass: string;
};

/**
 * Liggande staplar med etikett till vänster och värde till höger. Ren HTML:
 * lämpar sig för rangordningar ("svåraste områdena") där etiketterna är långa.
 */
export function HorizontalBars({ rows, ariaLabel }: { rows: HorizontalBarRow[]; ariaLabel: string }) {
  return (
    <ol className="grid gap-2.5" aria-label={ariaLabel}>
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <div className="min-w-0">{r.label}</div>
          <div className="h-3 w-full overflow-hidden rounded bg-surface-2" aria-hidden="true">
            <div className={`h-full rounded ${r.colorClass}`} style={{ width: `${Math.max(2, Math.min(100, r.fraction * 100))}%` }} />
          </div>
          <div className="text-right tabular-nums">
            <span className="font-medium">{r.valueLabel}</span>
            {r.detail ? <span className="hidden text-xs text-muted sm:block">{r.detail}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
