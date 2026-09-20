"use client";

import { sv } from "@/lib/i18n/sv";
import type { StudyMode } from "@/lib/progress/types";
import type { CategoryStats } from "@/lib/study/selection";
import { CategoryTag } from "@/components/ui/CategoryTag";
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
    <section aria-labelledby="kategorier-rubrik" className="order-4 grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="kategorier-rubrik" className="text-lg font-semibold">
            {sv.deck.categories}
          </h2>
          <p className="text-sm text-muted">{sv.deck.categoriesHelp}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="sortering" className="text-muted">
            {sv.deck.sortBy}
          </label>
          <Select fit id="sortering" value={sortMode} onChange={(e) => onSortMode(e.target.value as SortMode)}>
            <option value="deck">{sv.deck.sortDeckOrder}</option>
            <option value="learned">{sv.deck.sortLeastLearned}</option>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="w-12 py-3 pl-4 pr-2 align-middle">
                <input
                  type="checkbox"
                  aria-label={allSelected ? sv.deck.selectNone : sv.deck.selectAll}
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {sv.deck.selectionCategory}
              </th>
              <th scope="col" className="w-12 px-1 py-2 text-right font-medium sm:w-24 sm:px-2">
                <span className="sm:hidden">{sv.deck.colStudiedShort}</span>
                <span className="hidden sm:inline">{sv.deck.colStudied}</span>
              </th>
              <th scope="col" className="w-12 px-1 py-2 text-right font-medium sm:w-24 sm:px-2" title={sv.deck.learnedHelp}>
                <span className="sm:hidden">{sv.deck.colLearnedShort}</span>
                <span className="hidden sm:inline">{sv.deck.colLearned}</span>
              </th>
              <th scope="col" className="w-12 px-1 py-2 text-right font-medium sm:w-20 sm:px-2" title={sv.deck.knownHelp}>
                <span className="sm:hidden">{sv.deck.colKnownShort}</span>
                <span className="hidden sm:inline">{sv.deck.colKnown}</span>
              </th>
              <th scope="col" className="hidden w-32 px-3 py-2 sm:table-cell">
                <span className="sr-only">{sv.deck.colLearned}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const checked = selected.has(c.id);
              const learnedPct = c.stats.total === 0 ? 0 : Math.round((c.stats.learned / c.stats.total) * 100);
              const studiedPct = c.stats.total === 0 ? 0 : Math.round((c.stats.studied / c.stats.total) * 100);
              // I läget kluriga kort går bara kategorier med kluriga kort att välja.
              const selectable = mode !== "tricky" || c.stats.tricky > 0;
              return (
                <tr
                  key={c.id}
                  className={`border-b border-line last:border-b-0 ${checked ? "bg-accent-soft/60" : ""} ${selectable ? "" : "opacity-45"}`}
                  data-testid="category-row"
                >
                  <td className="py-2.5 pl-4 pr-2 align-middle">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!selectable}
                      onChange={() => onToggle(c.id)}
                      aria-label={c.title}
                      title={selectable ? undefined : sv.deck.trickyEmptyCategory}
                      className="h-4 w-4 accent-[var(--accent)] disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOnly(c.id)}
                      disabled={!selectable}
                      className="text-left disabled:cursor-not-allowed"
                      title={selectable ? sv.deck.categoriesHelp : sv.deck.trickyEmptyCategory}
                    >
                      <CategoryTag title={c.title} colorIndex={colorIndex.get(c.id) ?? 0} size="md" />
                    </button>
                    {mode === "tricky" ? <span className="ml-2 text-xs text-muted">{sv.deck.summaryTricky(c.stats.tricky)}</span> : null}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted">{sv.deck.studiedOf(c.stats.studied, c.stats.total)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted">{sv.deck.studiedOf(c.stats.learned, c.stats.total)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted" data-testid="category-known">
                    {c.stats.studied >= 3 && c.stats.total > 0 ? `${Math.round((c.stats.known / c.stats.total) * 100)} %` : sv.deck.knownTooEarly}
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    <div className="h-2 w-full overflow-hidden rounded bg-surface-2" aria-hidden="true">
                      <div className="relative h-full">
                        <div className="absolute inset-y-0 left-0 rounded bg-chart-1/20" style={{ width: `${studiedPct}%` }} />
                        <div className="absolute inset-y-0 left-0 rounded bg-rate-5" style={{ width: `${learnedPct}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
