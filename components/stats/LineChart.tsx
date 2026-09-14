"use client";

import { useId, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { niceTicks } from "./BarChart";

export type LinePoint = { key: string; label: string; values: number[] };
export type LineSeries = { name: string; colorClass: { stroke: string; fill: string; text: string } };

type Props = {
  points: LinePoint[];
  series: LineSeries[];
  title: string;
  help?: string;
  formatValue: (v: number) => string;
};

const W = 440;
const H = 190;
const PAD = { top: 14, right: 58, bottom: 26, left: 30 };

/**
 * Linjediagram med upp till två serier (t.ex. sedda och inlärda kort över tid).
 * 2 px linjer, markörer vid hover, direkt etikett vid linjens slut, legend,
 * korshårs-tooltip och tabellvy.
 */
export function LineChart({ points, series, title, help, formatValue }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const titleId = useId();

  const max = Math.max(1, ...points.flatMap((p) => p.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] ?? max;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = Math.max(1, points.length - 1);
  const x = (i: number) => PAD.left + (i / n) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * n);
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  }

  return (
    <figure className="grid gap-2">
      <figcaption className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span id={titleId} className="block text-sm font-medium">
            {title}
          </span>
          {help ? <span className="block text-xs text-muted">{help}</span> : null}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <ul className="flex gap-3" aria-label={title}>
            {series.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5">
                <span className={`inline-block h-0.5 w-4 rounded ${s.colorClass.fill}`} aria-hidden="true" />
                <span className="text-muted">{s.name}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setTable((t) => !t)} className="text-muted underline underline-offset-2 hover:text-fg">
            {table ? sv.stats.showChart : sv.stats.showTable}
          </button>
        </div>
      </figcaption>

      {table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-1 pr-2 font-medium">{sv.stats.day}</th>
              {series.map((s) => (
                <th key={s.name} className="py-1 text-right font-medium">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.key} className="border-b border-line last:border-b-0">
                <td className="py-1 pr-2">{p.label}</td>
                {p.values.map((v, i) => (
                  <td key={i} className="py-1 text-right tabular-nums">
                    {formatValue(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId} className="h-auto w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-chart-grid" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted" fontSize={11}>
                  {t}
                </text>
              </g>
            ))}
            {series.map((s, si) => {
              const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.values[si] ?? 0).toFixed(1)}`).join(" ");
              const last = points[points.length - 1];
              return (
                <g key={s.name}>
                  <path d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className={s.colorClass.stroke} />
                  {last ? (
                    <text x={x(points.length - 1) + 6} y={y(last.values[si] ?? 0) + 3} fontSize={11} className="fill-muted">
                      {s.name}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {hover !== null && points[hover] ? (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-line-strong" strokeWidth={1} strokeDasharray="3 3" />
                {series.map((s, si) => (
                  <circle key={s.name} cx={x(hover)} cy={y(points[hover]?.values[si] ?? 0)} r={4.5} className={`${s.colorClass.fill} stroke-surface`} strokeWidth={2} />
                ))}
              </g>
            ) : null}
            {points.map((p, i) =>
              i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 7) === 0 ? (
                <text key={p.key} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={11}>
                  {p.label}
                </text>
              ) : null,
            )}
          </svg>
          {hover !== null && points[hover] ? (
            <div
              role="status"
              className="pointer-events-none absolute -top-1 rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-card"
              style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > points.length / 2 ? "translateX(-100%)" : "none" }}
            >
              <span className="text-muted">{points[hover].label}</span>
              {series.map((s, si) => (
                <span key={s.name} className="ml-2">
                  {s.name} {formatValue(points[hover]?.values[si] ?? 0)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}
