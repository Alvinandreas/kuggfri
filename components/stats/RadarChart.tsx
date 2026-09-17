"use client";

import { useId, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { tagBgClass } from "@/lib/ui/tag-colors";

export type RadarAxis = {
  key: string;
  label: string;
  /** Kategorins färgindex (samma som taggen i kategoritabellen). */
  colorIndex: number;
  total: number;
  /** Skattning 3–4. */
  partial: number;
  learned: number;
};

type Props = {
  axes: RadarAxis[];
  title: string;
  help?: string;
  /** Styrd hover (delas med RadarLegend); utelämnas → intern. */
  hover?: number | null;
  onHover?: (index: number | null) => void;
};

const SIZE = 260;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 100; // radie för 100 %
const LABEL_R = R + 16;
const RINGS = [0.25, 0.5, 0.75, 1];

function polar(angle: number, r: number): [number, number] {
  // 0 rakt upp, medurs.
  return [CX + r * Math.sin(angle), CY - r * Math.cos(angle)];
}

/**
 * Radardiagram: en axel per kategori (numrerad, listan under ger namnen med kategorins färg).
 * Fylld yta = andel inlärda kort, streckad kontur = andel studerade. Ren SVG med hover per
 * axel och en tabellvy.
 */
export function RadarChart({ axes, title, help, hover: hoverProp, onHover }: Props) {
  const [hoverState, setHoverState] = useState<number | null>(null);
  const hover = hoverProp === undefined ? hoverState : hoverProp;
  const setHover = (i: number | null) => {
    setHoverState(i);
    onHover?.(i);
  };
  const titleId = useId();
  const n = axes.length;
  const angle = (i: number) => (n === 0 ? 0 : (i / n) * Math.PI * 2);
  const ratio = (num: number, den: number) => (den === 0 ? 0 : num / den);
  const pts = (pick: (a: RadarAxis) => number) => axes.map((a, i) => polar(angle(i), R * pick(a)));
  const toPath = (p: [number, number][]) => (p.length === 0 ? "" : p.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z");
  const learnedPts = pts((a) => ratio(a.learned, a.total));
  // Staplat: yttre ytan är inlärda + delvis inlärda, inre ytan bara inlärda.
  const stackedPts = pts((a) => ratio(a.learned + a.partial, a.total));
  const pct = (num: number, den: number) => `${Math.round(ratio(num, den) * 100)} %`;

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

      <div className="sr-only">
      <table>
        <thead>
          <tr>
            <th>{sv.deck.selectionCategory}</th>
            <th>{sv.stats.seriesPartial}</th>
            <th>{sv.stats.seriesLearned}</th>
          </tr>
        </thead>
        <tbody>
          {axes.map((a, i) => (
            <tr key={a.key}>
              <td>
                {i + 1}. {a.label}
              </td>
              <td>{pct(a.partial, a.total)}</td>
              <td>{pct(a.learned, a.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {(
        <div className="grid gap-3">
          <div className="relative">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-labelledby={titleId} className="mx-auto h-auto w-full max-w-[20rem]" onMouseLeave={() => setHover(null)}>
              {RINGS.map((f) => (
                <polygon key={f} points={axes.map((_, i) => polar(angle(i), R * f).join(",")).join(" ")} fill="none" className="stroke-chart-grid" strokeWidth={1} />
              ))}
              {axes.map((a, i) => {
                const [x, y] = polar(angle(i), R);
                return <line key={a.key} x1={CX} y1={CY} x2={x} y2={y} className="stroke-chart-grid" strokeWidth={1} />;
              })}
              {n >= 3 ? (
                <>
                  <path d={toPath(stackedPts)} className="fill-chart-1/7 stroke-chart-1/35" strokeWidth={1.5} strokeLinejoin="round" />
                  <path d={toPath(learnedPts)} className="fill-chart-1/60 stroke-chart-1" strokeWidth={2} strokeLinejoin="round" />
                </>
              ) : null}
              {axes.map((a, i) => {
                const [lx, ly] = polar(angle(i), LABEL_R);
                const [px, py] = learnedPts[i] ?? [CX, CY];
                const active = hover === i;
                const [hx, hy] = polar(angle(i), R * 0.55);
                return (
                  <g key={a.key} onMouseEnter={() => setHover(i)}>
                    <circle cx={hx} cy={hy} r={R * 0.5} fill="transparent" />
                    <circle cx={px} cy={py} r={active ? 5 : 3.5} className={active ? "fill-accent-hover stroke-bg" : "fill-chart-1 stroke-bg"} strokeWidth={1.5} />
                    <circle cx={lx} cy={ly} r={8.5} className={active ? "fill-accent" : "fill-surface-2"} />
                    <text x={lx} y={ly + 3.5} textAnchor="middle" className={active ? "fill-white" : "fill-fg"} fontSize={10} fontWeight={600}>
                      {i + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
            {hover !== null && axes[hover] ? (
              <div role="status" className="pointer-events-none absolute left-1/2 top-0 max-w-[95%] -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-card">
                <span className="font-medium">{axes[hover].label}</span>
                <span className="text-muted"> · </span>
                {sv.stats.seriesLearned} {axes[hover].learned}/{axes[hover].total}
                <span className="text-muted"> · </span>
                {sv.stats.seriesPartial} {axes[hover].partial}/{axes[hover].total}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-chart-1/70 ring-1 ring-chart-1" /> {sv.stats.seriesLearned}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-chart-1/15 ring-1 ring-chart-1/40" /> {sv.stats.seriesPartial}
            </span>
          </div>
        </div>
      )}
    </figure>
  );
}

/** Numrerad kategorilista som hör till radardiagrammet; läggs där det finns plats (t.ex. under båda diagrammen). */
export function RadarLegend({ axes, hover, onHover }: { axes: RadarAxis[]; hover: number | null; onHover: (i: number | null) => void }) {
  const pct = (num: number, den: number) => `${den === 0 ? 0 : Math.round((num / den) * 100)} %`;
  return (
    <ol className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3" aria-label={sv.deck.selectionCategory}>
      {axes.map((a, i) => (
        <li
          key={a.key}
          onMouseEnter={() => onHover(i)}
          onMouseLeave={() => onHover(null)}
          className={`flex min-w-0 items-center gap-2 rounded px-1 py-0.5 transition-colors ${hover === i ? "bg-surface-2" : ""}`}
        >
          <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-fg ${tagBgClass(a.colorIndex)}`}>{i + 1}</span>
          <span className="min-w-0 flex-1 truncate" title={a.label}>
            {a.label}
          </span>
          <span className="shrink-0 tabular-nums text-muted">{pct(a.learned, a.total)}</span>
        </li>
      ))}
    </ol>
  );
}
