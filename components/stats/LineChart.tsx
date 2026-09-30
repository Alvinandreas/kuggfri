"use client";

import { useId, useState, type PointerEvent } from "react";
import { sv } from "@/lib/i18n/sv";
import { niceTicks } from "@/components/stats/BarChart";
import { useSvgTextScale } from "./useSvgTextScale";

export type LineTone = "chart-1" | "chart-2" | "chart-3" | "chart-4";

export type LineSeries = {
  key: string;
  label: string;
  tone: LineTone;
  /** Ett värde per etikett på x-axeln. */
  values: number[];
};

type Props = {
  /** Etiketter på x-axeln, t.ex. "14/9". */
  labels: string[];
  series: LineSeries[];
  title: string;
  help?: string;
  formatValue: (v: number) => string;
  /** Tonad yta under varje linje. */
  area?: boolean;
  /** Rubriken finns redan intill: visa den bara för skärmläsare. */
  hideTitle?: boolean;
};

// Klasserna skrivs ut i sin helhet så att Tailwind hittar dem.
const TONES: Record<LineTone, { stroke: string; area: string; dot: string; swatch: string }> = {
  "chart-1": { stroke: "stroke-chart-1", area: "fill-chart-1/12", dot: "fill-chart-1", swatch: "bg-chart-1" },
  "chart-2": { stroke: "stroke-chart-2", area: "fill-chart-2/12", dot: "fill-chart-2", swatch: "bg-chart-2" },
  "chart-3": { stroke: "stroke-chart-3", area: "fill-chart-3/12", dot: "fill-chart-3", swatch: "bg-chart-3" },
  "chart-4": { stroke: "stroke-chart-4", area: "fill-chart-4/12", dot: "fill-chart-4", swatch: "bg-chart-4" },
};

const W = 440;
const H = 250;
const PAD = { top: 12, right: 10, bottom: 26, left: 30 };

/**
 * Linjediagram för en eller flera serier över samma x-axel (t.ex. sedda och inlärda kort
 * per dag). Ren SVG som BarChart: tre stödlinjer, 2 px linjer, valfri tonad yta, hårkors
 * med tooltip vid hovring, förklaring med senaste värdet när det finns flera serier och
 * en tabellvy för skärmläsare.
 */
export function LineChart({ labels, series, title, help, formatValue, area = false, hideTitle = false }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();
  const [svgRef, k] = useSvgTextScale(W);
  const n = labels.length;

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] ?? max;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => (n <= 1 ? PAD.left + innerW / 2 : PAD.left + (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const labelStep = n <= 8 ? 1 : Math.ceil(n / 6);

  const linePath = (values: number[]) => values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const areaPath = (values: number[]) =>
    values.length === 0 ? "" : `${linePath(values)} L${x(values.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || n === 0) return;
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const i = n <= 1 ? 0 : Math.round(((sx - PAD.left) / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const hoverPct = hover === null ? 0 : (x(hover) / W) * 100;

  return (
    <figure className="grid gap-2">
      <figcaption className={hideTitle ? "sr-only" : "block"}>
        <span id={titleId} className="block text-sm font-semibold">
          {title}
        </span>
        {help ? <span className="block text-xs text-muted">{help}</span> : null}
      </figcaption>

      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-hidden>
          {series.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${TONES[s.tone].swatch}`} />
              <span className="text-muted">{s.label}</span>
              <span className="font-semibold tabular-nums">{formatValue(s.values[s.values.length - 1] ?? 0)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="sr-only">
        <table>
          <thead>
            <tr>
              <th>{sv.stats.day}</th>
              {series.map((s) => (
                <th key={s.key}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={`${label}-${i}`}>
                <td>{label}</td>
                {series.map((s) => (
                  <td key={s.key}>{formatValue(s.values[i] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="relative">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} overflow="visible" role="img" aria-labelledby={titleId} className="h-auto w-full touch-pan-y" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-chart-grid" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted" fontSize={11 * k}>
                {t}
              </text>
            </g>
          ))}
          {labels.map((label, i) =>
            i % labelStep === 0 ? (
              <text key={`${label}-${i}`} x={x(i)} y={H - 8} textAnchor={i === 0 && n > 1 ? "start" : "middle"} className="fill-muted" fontSize={11 * k}>
                {label}
              </text>
            ) : null,
          )}
          {area ? series.map((s) => <path key={`a-${s.key}`} d={areaPath(s.values)} className={TONES[s.tone].area} />) : null}
          {series.map((s) =>
            n === 1 ? (
              <circle key={`l-${s.key}`} cx={x(0)} cy={y(s.values[0] ?? 0)} r={4} className={TONES[s.tone].dot} />
            ) : (
              <path key={`l-${s.key}`} d={linePath(s.values)} fill="none" className={TONES[s.tone].stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ),
          )}
          {hover !== null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} className="stroke-line-strong" strokeWidth={1} />
              {series.map((s) => (
                <circle key={`h-${s.key}`} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} className={`${TONES[s.tone].dot} stroke-surface`} strokeWidth={2} />
              ))}
            </g>
          ) : null}
        </svg>
        {hover !== null && labels[hover] !== undefined ? (
          <div
            role="status"
            className="anim-fade-in pointer-events-none absolute top-0 z-10 grid gap-0.5 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium shadow-pop"
            style={{ left: `${hoverPct}%`, transform: `translateX(${hoverPct > 60 ? "calc(-100% - 10px)" : "10px"})` }}
          >
            <span className="text-muted">{labels[hover]}</span>
            {series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={`h-2 w-2 rounded-full ${TONES[s.tone].swatch}`} />
                {s.label}: <span className="tabular-nums">{formatValue(s.values[hover] ?? 0)}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </figure>
  );
}
