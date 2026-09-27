"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { sv } from "@/lib/i18n/sv";
import { heatmapGrid, type HeatCell } from "@/lib/stats/my-stats";
import { cx } from "@/components/ui/cx";

type Props = {
  /** Värde per dag, nyckel YYYY-MM-DD i lokal tid. */
  counts: ReadonlyMap<string, number>;
  title: string;
  help?: string;
  /** Antal veckor bakåt, innevarande vecka inräknad. */
  weeks?: number;
  now?: Date;
  /** Formaterar ett värde för tooltip och tabell. */
  formatValue?: (n: number) => string;
  /** Rubriken finns redan intill (t.ex. blockets rubrik): visa den bara för skärmläsare. */
  hideTitle?: boolean;
};

const CELL = 13;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 28;
const TOP = 16;

// Sekventiell skala i en ton: tom ruta, sedan fyra steg av diagramgrönt.
const LEVEL_FILL = ["fill-surface-3", "fill-chart-1/25", "fill-chart-1/50", "fill-chart-1/75", "fill-chart-1"] as const;
const LEVEL_BG = ["bg-surface-3", "bg-chart-1/25", "bg-chart-1/50", "bg-chart-1/75", "bg-chart-1"] as const;

/** Månadsetikett på kolumnen där en månad börjar; den första kolumnen får sin månad om ingen etikett ligger nära. */
function monthLabels(weeks: HeatCell[][]): Map<number, string> {
  const out = new Map<number, string>();
  weeks.forEach((col, w) => {
    const first = col.find((c) => c.date.getDate() === 1);
    if (first) out.set(w, sv.myStats.month(first.date.getMonth()));
  });
  if (![0, 1, 2].some((w) => out.has(w)) && weeks[0]) {
    const last = weeks[0][6] ?? weeks[0][0];
    if (last) out.set(0, sv.myStats.month(last.date.getMonth()));
  }
  return out;
}

/**
 * Aktivitetskarta i GitHub-stil: en kolumn per vecka, en rad per veckodag (måndag överst),
 * färgstyrka efter antal. Hovring eller tangentbordsfokus visar dagen; piltangenterna flyttar
 * mellan dagarna. En tabell med de aktiva dagarna finns för skärmläsare.
 */
export function ActivityHeatmap({ counts, title, help, weeks = 20, now, formatValue = sv.myStats.reviewsCount, hideTitle = false }: Props) {
  const titleId = useId();
  const hintId = useId();
  const grid = useMemo(() => heatmapGrid(counts, now ?? new Date(), weeks), [counts, now, weeks]);
  const months = useMemo(() => monthLabels(grid.weeks), [grid.weeks]);
  const [active, setActive] = useState<{ w: number; d: number } | null>(null);

  const W = LEFT + weeks * STEP - GAP;
  const H = TOP + 7 * STEP - GAP;
  const todayPos = (() => {
    for (let w = grid.weeks.length - 1; w >= 0; w--) {
      const d = grid.weeks[w]?.findIndex((c) => c.isToday) ?? -1;
      if (d >= 0) return { w, d };
    }
    return { w: 0, d: 0 };
  })();
  const cellAt = (p: { w: number; d: number } | null) => (p ? grid.weeks[p.w]?.[p.d] : undefined);
  const activeCell = cellAt(active);

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = active ?? todayPos;
    let next = from;
    if (e.key === "ArrowLeft") next = { w: from.w - 1, d: from.d };
    else if (e.key === "ArrowRight") next = { w: from.w + 1, d: from.d };
    else if (e.key === "ArrowUp") next = { w: from.w, d: from.d - 1 };
    else if (e.key === "ArrowDown") next = { w: from.w, d: from.d + 1 };
    else if (e.key === "Home") next = { w: 0, d: 0 };
    else if (e.key === "End") next = todayPos;
    else if (e.key === "Escape") {
      setActive(null);
      return;
    } else return;
    e.preventDefault();
    const cell = cellAt(next);
    // Utanför rutnätet eller i framtiden: stanna kvar.
    if (cell && !cell.future) setActive(next);
  };

  const activeDays = grid.weeks.flat().filter((c) => c.count > 0);

  return (
    <figure className="grid gap-3">
      <figcaption className={hideTitle ? "sr-only" : "block"}>
        <span id={titleId} className="block text-sm font-semibold">
          {title}
        </span>
        {help ? <span className="block text-xs text-muted">{help}</span> : null}
        <span id={hintId} className="sr-only">
          {sv.myStats.heatmapKeys}
        </span>
      </figcaption>

      <div className="sr-only">
        <table>
          <thead>
            <tr>
              <th>{sv.stats.day}</th>
              <th>{title}</th>
            </tr>
          </thead>
          <tbody>
            {activeDays.map((c) => (
              <tr key={c.day}>
                <td>{sv.myStats.date(c.date)}</td>
                <td>{formatValue(c.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        role="group"
        tabIndex={0}
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onFocus={() => setActive((a) => a ?? todayPos)}
        onBlur={() => setActive(null)}
        onKeyDown={move}
        onMouseLeave={() => setActive(null)}
        className="relative rounded-md outline-offset-4"
      >
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="h-auto w-full">
          {[...months].map(([w, label]) => (
            <text key={w} x={LEFT + w * STEP} y={10} className="fill-muted" fontSize={10}>
              {label}
            </text>
          ))}
          {[0, 2, 4].map((d) => (
            <text key={d} x={0} y={TOP + d * STEP + CELL - 3} className="fill-muted" fontSize={10}>
              {sv.myStats.weekdays[d]}
            </text>
          ))}
          {grid.weeks.map((col, w) =>
            col.map((c, d) =>
              c.future ? null : (
                <rect
                  key={c.day}
                  x={LEFT + w * STEP}
                  y={TOP + d * STEP}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  onMouseEnter={() => setActive({ w, d })}
                  className={cx(LEVEL_FILL[c.level], (c.isToday || (active?.w === w && active.d === d)) && "stroke-fg")}
                  strokeWidth={active?.w === w && active.d === d ? 2 : 1.25}
                />
              ),
            ),
          )}
        </svg>
        {active && activeCell ? (
          <div
            role="status"
            className="anim-fade-in pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium shadow-pop"
            style={{
              left: `${((LEFT + active.w * STEP + CELL / 2) / W) * 100}%`,
              top: `${((TOP + active.d * STEP) / H) * 100}%`,
              // Nära högerkanten förankras tooltipen åt vänster, så den inte hamnar utanför blocket.
              transform: `translate(${active.w > weeks * 0.7 ? "-100%" : active.w < weeks * 0.2 ? "0" : "-50%"}, calc(-100% - 6px))`,
            }}
          >
            <span className="text-muted">
              {sv.myStats.date(activeCell.date)}
              {activeCell.isToday ? ` (${sv.myStats.heatToday})` : ""}
            </span>{" "}
            · {formatValue(activeCell.count)}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-1.5 text-xs text-muted" aria-hidden>
        <span className="mr-1">{sv.myStats.heatLess}</span>
        {LEVEL_BG.map((bg) => (
          <span key={bg} className={cx("h-3 w-3 rounded-[3px]", bg)} />
        ))}
        <span className="ml-1">{sv.myStats.heatMore}</span>
      </div>
    </figure>
  );
}
