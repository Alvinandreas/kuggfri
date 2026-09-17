"use client";

import { useId, useState } from "react";
import { sv } from "@/lib/i18n/sv";

export type BarPoint = { key: string; label: string; value: number };

type Props = {
  points: BarPoint[];
  title: string;
  help?: string;
  /** Formaterar ett värde för tooltip och tabell. */
  formatValue: (v: number) => string;
};

const W = 440;
const H = 250;
const PAD = { top: 12, right: 8, bottom: 26, left: 30 };

/**
 * Stapeldiagram för en serie (t.ex. repetitioner per dag). Ren SVG:
 * tunna staplar med 2 px mellanrum, rundad topp, tre stödlinjer,
 * hover-tooltip och en tabellvy för skärmläsare och den som föredrar siffror.
 */
export function BarChart({ points, title, help, formatValue }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();

  const max = Math.max(1, ...points.map((p) => p.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] ?? max;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, points.length);
  const barW = Math.max(4, slot - 2);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  // Högst sju datumetiketter, jämnt fördelade från första dagen.
  const labelStep = Math.max(1, Math.ceil(points.length / 7));

  return (
    <figure className="grid gap-2">
      <figcaption className="flex items-start justify-between gap-3">
        <div>
          <span id={titleId} className="block text-sm font-medium">
            {title}
          </span>
          {help ? <span className="block text-xs text-muted">{help}</span> : null}
        </div>
      </figcaption>

      {/* Tabellen finns kvar för skärmläsare, osynlig för alla andra. */}
      <div className="sr-only">
      <table>
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-1 pr-2 font-medium">{sv.stats.day}</th>
              <th className="py-1 text-right font-medium">{title}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.key} className="border-b border-line last:border-b-0">
                <td className="py-1 pr-2">{p.label}</td>
                <td className="py-1 text-right tabular-nums">{formatValue(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-labelledby={titleId}
            className="h-auto w-full"
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-chart-grid" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted" fontSize={11}>
                  {t}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const x = PAD.left + i * slot + (slot - barW) / 2;
              const h = Math.max(0, y(0) - y(p.value));
              const active = hover === i;
              return (
                <g key={p.key} onMouseEnter={() => setHover(i)}>
                  {/* Osynlig, bredare träffyta */}
                  <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" />
                  {p.value > 0 ? (
                    <rect x={x} y={y(p.value)} width={barW} height={h} rx={3} className={active ? "fill-accent-hover" : "fill-chart-1"} />
                  ) : (
                    <rect x={x} y={y(0) - 1} width={barW} height={1} className="fill-chart-grid" />
                  )}
                  {i % labelStep === 0 && (
                    <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={11}>
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover !== null && points[hover] ? (
            <div
              role="status"
              className="pointer-events-none absolute -top-1 rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-card"
              style={{ left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`, transform: "translateX(-50%)" }}
            >
              <span className="text-muted">{points[hover].label}</span> · {formatValue(points[hover].value)}
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}

/** Tre jämna stödlinjer upp till närmaste snygga tal över max. */
export function niceTicks(max: number): number[] {
  const raw = Math.max(1, max);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm <= 1 ? 0.5 : norm <= 2 ? 1 : norm <= 5 ? 2 : 5;
  const top = Math.ceil(raw / (step * mag)) * step * mag;
  const half = top / 2;
  return [0, half, top].map((t) => Math.round(t * 100) / 100);
}
