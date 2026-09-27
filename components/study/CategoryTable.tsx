"use client";

import { sv } from "@/lib/i18n/sv";
import type { StudyMode } from "@/lib/progress/types";
import type { CategoryStats } from "@/lib/study/selection";
import { Card, CardHeader } from "@/components/ui/Card";
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

/**
 * Välj områden inför passet. Bara det som behövs för att välja: kryssruta, kategorins
 * namn och hur många kort den har. Hur det går per område visas på hemsidan.
 */
export function CategoryTable({ rows, colorIndex, selected, mode, sortMode, onSortMode, onToggle, onOnly, onSelectAll }: Props) {
  const allSelected = selected.size === rows.length && rows.length > 0;

  return (
    <Card padding="lg" role="region" aria-labelledby="kategorier-rubrik" className="anim-fade-up order-3 lg:order-none" style={{ ["--i" as string]: 2 }}>
      <CardHeader
        id="kategorier-rubrik"
        title={sv.deck.categories}
        description={sv.deck.categoriesHelp}
        action={
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="sortering" className="hidden text-muted sm:inline">
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
        }
      />

      <label className="mb-2 inline-flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-surface-2">
        <Checkbox checked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} />
        {allSelected ? sv.deck.selectNone : sv.deck.selectAll}
      </label>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {rows.map((c) => {
          const checked = selected.has(c.id);
          // I läget kluriga kort går bara kategorier med kluriga kort att välja.
          const selectable = mode !== "tricky" || c.stats.tricky > 0;
          return (
            <li
              key={c.id}
              data-testid="category-row"
              className={cx(
                "flex min-h-14 select-none items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150",
                checked ? "bg-accent-soft/60" : "bg-surface-2/60 hover:bg-surface-2",
                !selectable && "opacity-45",
              )}
            >
              <label className={cx("-m-2 flex p-2", selectable ? "cursor-pointer" : "cursor-not-allowed")}>
                <Checkbox
                  checked={checked}
                  disabled={!selectable}
                  onChange={() => onToggle(c.id)}
                  aria-label={c.title}
                  title={selectable ? undefined : sv.deck.trickyEmptyCategory}
                />
              </label>
              <button
                type="button"
                onClick={() => onOnly(c.id)}
                disabled={!selectable}
                className="min-w-0 flex-1 rounded-full text-left transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed"
                title={selectable ? sv.deck.categoriesHelp : sv.deck.trickyEmptyCategory}
              >
                <CategoryTag title={c.title} colorIndex={colorIndex.get(c.id) ?? 0} size="md" />
              </button>
              <span className="shrink-0 text-sm tabular-nums text-muted">
                {mode === "tricky" ? sv.deck.summaryTricky(c.stats.tricky) : sv.home.cards(c.stats.total)}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
