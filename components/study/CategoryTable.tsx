"use client";

import { sv } from "@/lib/i18n/sv";
import { percent, percentText } from "@/lib/text/percent";
import type { StudyMode } from "@/lib/progress/types";
import type { CategoryStats } from "@/lib/study/selection";
import { Card } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Checkbox } from "@/components/ui/Choice";
import { cx } from "@/components/ui/cx";
import { Select } from "@/components/ui/Select";

export type SortMode = "deck" | "learned";

export type CategoryRow = { id: string; title: string; stats: CategoryStats };

type Props = {
  rows: CategoryRow[];
  colorIndex: Map<string, number>;
  selected: ReadonlySet<string>;
  mode: StudyMode;
  sortMode: SortMode;
  onSortMode: (mode: SortMode) => void;
  /** Kryssrutan: lägg till eller ta bort en kategori ur urvalet. */
  onToggle: (id: string) => void;
  /** Klick på namnet: välj bara den kategorin. */
  onOnly: (id: string) => void;
  onSelectAll: (all: boolean) => void;
};

export function CategoryTable({ rows, colorIndex, selected, mode, sortMode, onSortMode, onToggle, onOnly, onSelectAll }: Props) {
  const allSelected = selected.size === rows.length && rows.length > 0;

  return (
    <Card padding="none" role="region" aria-labelledby="kategorier-rubrik" className="anim-fade-up order-4 overflow-hidden" style={{ ["--i" as string]: 2 }}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pb-4 pt-6 sm:px-7 sm:pt-7">
        <div className="min-w-0">
          <h2 id="kategorier-rubrik" className="text-lg font-bold tracking-tight">
            {sv.deck.categories}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{sv.deck.categoriesHelp}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="sortering" className="text-muted">
            {sv.deck.sortBy}
          </label>
          <Select
            fit
            size="sm"
            id="sortering"
            value={sortMode}
            onChange={onSortMode}
            options={[
              { value: "deck", label: sv.deck.sortDeckOrder },
              { value: "learned", label: sv.deck.sortLeastLearned },
            ]}
          />
        </div>
      </div>

      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-subtle">
            <th scope="col" className="w-14 py-3 pl-5 pr-2 align-middle sm:w-16 sm:pl-7">
              {/* Etiketten syns inte men gör träffytan 36 px i stället för kryssrutans 20. */}
              <label className="-m-2 flex w-fit cursor-pointer p-2">
                <Checkbox
                  aria-label={allSelected ? sv.deck.selectNone : sv.deck.selectAll}
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                />
              </label>
            </th>
            <th scope="col" className="px-2 py-3 font-semibold">
              {sv.deck.selectionCategory}
            </th>
            <th scope="col" className="w-12 px-1 py-3 text-right font-semibold sm:w-24 sm:px-2">
              <span className="sm:hidden">{sv.deck.colStudiedShort}</span>
              <span className="hidden sm:inline">{sv.deck.colStudied}</span>
            </th>
            <th scope="col" className="w-12 px-1 py-3 text-right font-semibold sm:w-24 sm:px-2" title={sv.deck.learnedHelp}>
              <span className="sm:hidden">{sv.deck.colLearnedShort}</span>
              <span className="hidden sm:inline">{sv.deck.colLearned}</span>
            </th>
            <th scope="col" className="w-14 py-3 pl-1 pr-5 text-right font-semibold sm:w-20 sm:px-2" title={sv.deck.knownHelp}>
              <span className="sm:hidden">{sv.deck.colKnownShort}</span>
              <span className="hidden sm:inline">{sv.deck.colKnown}</span>
            </th>
            <th scope="col" className="hidden w-36 py-3 pl-3 pr-7 sm:table-cell">
              <span className="sr-only">{sv.deck.colLearned}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const checked = selected.has(c.id);
            const learnedPct = percent(c.stats.learned, c.stats.total);
            const studiedPct = percent(c.stats.studied, c.stats.total);
            // I läget kluriga kort går bara kategorier med kluriga kort att välja.
            const selectable = mode !== "tricky" || c.stats.tricky > 0;
            return (
              <tr
                key={c.id}
                className={cx(
                  "border-b border-line transition-colors duration-150 last:border-b-0",
                  checked ? "bg-accent-soft/60" : selectable && "hover:bg-surface-2/60",
                  !selectable && "opacity-45",
                )}
                data-testid="category-row"
              >
                <td className="py-3 pl-5 pr-2 align-middle sm:pl-7">
                  <label className={cx("-m-2 flex w-fit p-2", selectable ? "cursor-pointer" : "cursor-not-allowed")}>
                    <Checkbox
                      checked={checked}
                      disabled={!selectable}
                      onChange={() => onToggle(c.id)}
                      aria-label={c.title}
                      title={selectable ? undefined : sv.deck.trickyEmptyCategory}
                    />
                  </label>
                </td>
                <td className="px-2 py-3">
                  <button
                    type="button"
                    onClick={() => onOnly(c.id)}
                    disabled={!selectable}
                    className="rounded-full text-left transition-transform duration-150 active:scale-[0.97] disabled:cursor-not-allowed"
                    title={selectable ? sv.deck.categoriesHelp : sv.deck.trickyEmptyCategory}
                  >
                    <CategoryTag title={c.title} colorIndex={colorIndex.get(c.id) ?? 0} size="md" />
                  </button>
                  {mode === "tricky" ? <span className="ml-2 text-xs text-muted">{sv.deck.summaryTricky(c.stats.tricky)}</span> : null}
                </td>
                <td className="px-1 py-3 text-right tabular-nums text-muted sm:px-2">{sv.deck.studiedOf(c.stats.studied, c.stats.total)}</td>
                <td className="px-1 py-3 text-right tabular-nums text-muted sm:px-2">{sv.deck.studiedOf(c.stats.learned, c.stats.total)}</td>
                <td className="py-3 pl-1 pr-5 text-right tabular-nums text-muted sm:px-2" data-testid="category-known">
                  {c.stats.studied >= 3 ? percentText(c.stats.known, c.stats.total, sv.deck.knownTooEarly) : sv.deck.knownTooEarly}
                </td>
                <td className="hidden py-3 pl-3 pr-7 sm:table-cell">
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-chart-1/25" style={{ width: `${studiedPct}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-rate-5" style={{ width: `${learnedPct}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
