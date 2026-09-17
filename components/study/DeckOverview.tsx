"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { nextDueDate, queueStats } from "@/lib/fsrs/scheduler";
import type { ProgressMap, ReviewEntry, StudyMode } from "@/lib/progress/types";
import { ProgressStats } from "@/components/stats/ProgressStats";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import {
  categoryStats,
  filterCards,
  learnedRatio,
  serializeSelection,
  trickyCards,
  type SelectableCard,
  type Selection,
  UNCATEGORIZED_ID,
} from "@/lib/study/selection";
import { formatRelative } from "@/lib/time/format";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { Button, buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Props = {
  deck: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    course_code: string | null;
    source_credit: string | null;
  };
  categories: { id: string; title: string }[];
  cards: SelectableCard[];
  userId: string | null;
};

type SortMode = "deck" | "learned";

export function DeckOverview({ deck, categories, cards, userId }: Props) {
  const store = useProgressStore(userId);
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [mode, setMode] = useState<StudyMode>("fsrs");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("deck");
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  // Kort utan kategori får en egen rad ("Utan kategori") så att de aldrig försvinner ur urvalet.
  const tableCategories = useMemo(
    () => (cards.some((c) => c.category_id === null) ? [...categories, { id: UNCATEGORIZED_ID, title: sv.deck.uncategorized }] : categories),
    [cards, categories],
  );
  const colorIndex = useMemo(() => categoryColorIndex(tableCategories), [tableCategories]);

  const reload = useCallback(async () => {
    if (!store) return;
    try {
      const [p, r] = await Promise.all([store.load(cardIds), store.loadReviews(cardIds)]);
      setProgress(p);
      setReviews(r);
    } catch {
      setProgress({});
      setReviews([]);
    }
  }, [store, cardIds]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = useMemo(() => (progress ? queueStats(cardIds, progress, new Date()) : null), [cardIds, progress]);
  const seen = useMemo(() => (progress ? cardIds.filter((id) => progress[id]).length : 0), [cardIds, progress]);
  const nextDue = useMemo(() => (progress ? nextDueDate(cardIds, progress, new Date()) : null), [cardIds, progress]);

  const perCategory = useMemo(
    () =>
      categoryStats(
        cards,
        progress ?? {},
        tableCategories.map((c) => c.id),
      ),
    [cards, progress, tableCategories],
  );
  const sortedCategories = useMemo(() => {
    const byId = new Map(perCategory.map((s) => [s.categoryId, s] as const));
    const list = tableCategories.map((c) => ({ ...c, stats: byId.get(c.id)! }));
    if (sortMode === "learned") {
      list.sort((a, b) => learnedRatio(a.stats) - learnedRatio(b.stats) || a.title.localeCompare(b.title, "sv"));
    }
    return list;
  }, [tableCategories, perCategory, sortMode]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleCategory(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return tableCategories.filter((c) => next.has(c.id)).map((c) => c.id);
    });
  }

  // Urvalet: valda kategorier (eller hela decket). I läget kluriga kort räknas bara kluriga kort.
  const categorySelection = useMemo<Selection>(
    () => (selectedIds.length > 0 ? { kind: "categories", categoryIds: selectedIds } : { kind: "all" }),
    [selectedIds],
  );
  const selectedCards = useMemo(() => filterCards(cards, progress ?? {}, categorySelection), [cards, progress, categorySelection]);
  const selectionCards = useMemo(
    () => (mode === "tricky" ? trickyCards(selectedCards, progress ?? {}) : selectedCards),
    [mode, selectedCards, progress],
  );
  const selectionLearned = useMemo(() => selectionCards.filter((c) => progress?.[c.id]?.self_rating === 5).length, [selectionCards, progress]);

  // I läget kluriga kort går bara kategorier med kluriga kort att välja; övriga avmarkeras.
  useEffect(() => {
    if (mode !== "tricky") return;
    setSelectedIds((prev) => prev.filter((id) => (perCategory.find((s) => s.categoryId === id)?.tricky ?? 0) > 0));
  }, [mode, perCategory]);

  const effectiveSelection: Selection = mode === "random" ? { kind: "all" } : categorySelection;
  const selectionCount = mode === "random" ? cards.length : selectionCards.length;
  const startHref = `/d/${deck.slug}/plugga?mode=${mode}&urval=${encodeURIComponent(serializeSelection(effectiveSelection))}`;
  const nothingDue = mode === "fsrs" && stats !== null && stats.due + stats.new === 0 && selectedIds.length === 0;
  const canStart = selectionCount > 0 && !nothingDue;

  async function doResetDeck() {
    if (!store) return;
    setBusy(true);
    try {
      await store.resetDeck(deck.id, cardIds);
      await reload();
      setNotice(sv.deck.resetDone);
    } catch {
      setNotice(sv.errors.generic);
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/d/${deck.slug}`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // Reserv för webbläsare utan clipboard-API eller utan behörighet.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } finally {
        ta.remove();
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  const selectedTitles = categories.filter((c) => selectedSet.has(c.id));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-12">
      {/* Vänster kolumn: innehåll och progress. På mobil ligger allt i ett flöde där Starta kommer före kategorierna. */}
      <div className="contents lg:grid lg:gap-8">
        <header className="order-1">
          <h1 className="text-3xl font-semibold tracking-tight">{deck.title}</h1>
          {deck.course_code ? (
            <p className="mt-1 text-sm text-muted">
              {sv.home.courseCode} {deck.course_code}
            </p>
          ) : null}
          {deck.description ? <p className="mt-3 text-muted">{deck.description}</p> : null}
          <p className="mt-3 text-sm text-muted">{sv.deck.totalCards(cards.length)}</p>
        </header>

        {/* Progress */}
        <section aria-labelledby="progress-rubrik" className="order-3 rounded-lg border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 id="progress-rubrik" className="text-lg font-semibold">
              {sv.deck.progressTitle}
            </h2>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={!store}
              className="text-xs text-muted underline underline-offset-2 hover:text-fg disabled:opacity-50"
              title={sv.deck.resetLink}
              data-testid="reset-deck"
            >
              {sv.deck.resetShort}
            </button>
          </div>
          {progress === null ? (
            <p className="mt-2 text-muted">{sv.common.loading}</p>
          ) : seen === 0 && reviews.length === 0 ? (
            <p className="mt-2 text-muted">{sv.deck.noProgress}</p>
          ) : (
            <div className="mt-4">
              <ProgressStats
                cardIds={cardIds}
                progress={progress}
                reviews={reviews}
                categories={categories.map((c) => {
                  const s = perCategory.find((p) => p.categoryId === c.id);
                  return { id: c.id, title: c.title, total: s?.total ?? 0, partial: s?.partial ?? 0, learned: s?.learned ?? 0 };
                })}
                dueText={
                  stats && stats.due + stats.new > 0
                    ? `${sv.deck.dueNow(stats.due)}, ${sv.deck.newCards(stats.new)}`
                    : nextDue
                      ? `${sv.deck.nothingDue} ${sv.deck.nextDue(formatRelative(nextDue))}`
                      : sv.deck.nothingDue
                }
              />
            </div>
          )}
          {notice ? (
            <p role="status" className="mt-3 text-sm text-accent">
              {notice}
            </p>
          ) : null}
        </section>

        {/* Kategorier: klickbar tabell */}
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
              <Select fit id="sortering" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
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
                      aria-label={selectedSet.size === tableCategories.length ? sv.deck.selectNone : sv.deck.selectAll}
                      checked={selectedSet.size === tableCategories.length && tableCategories.length > 0}
                      onChange={(e) => setSelectedIds(e.target.checked ? tableCategories.map((c) => c.id) : [])}
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
                  <th scope="col" className="hidden w-32 px-3 py-2 sm:table-cell">
                    <span className="sr-only">{sv.deck.colLearned}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((c) => {
                  const checked = selectedSet.has(c.id);
                  const learnedPct = c.stats.total === 0 ? 0 : Math.round((c.stats.learned / c.stats.total) * 100);
                  const studiedPct = c.stats.total === 0 ? 0 : Math.round((c.stats.studied / c.stats.total) * 100);
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
                          onChange={() => toggleCategory(c.id)}
                          aria-label={c.title}
                          title={selectable ? undefined : sv.deck.trickyEmptyCategory}
                          className="h-4 w-4 accent-[var(--accent)] disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          onClick={() => setSelectedIds([c.id])}
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

        {/* Dela, källa och diskret nollställning (gäster har ingen kontosida) */}
        <section className="order-6 grid gap-4 text-sm text-muted">
          <div className="flex w-fit max-w-full flex-wrap items-center gap-x-8 gap-y-4 rounded-lg border border-line bg-surface p-5 shadow-card">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-fg">{sv.deck.share}</h2>
              <p className="mt-1">{sv.deck.shareHelp}</p>
            </div>
            <Button
              variant={copied ? "secondary" : "primary"}
              onClick={copyLink}
              aria-live="polite"
              className={copied ? "border-accent! bg-accent-soft! text-accent!" : ""}
              data-testid="copy-link"
            >
              {copied ? sv.deck.shareCopied : sv.deck.shareCopy}
            </Button>
          </div>
        </section>
      </div>

      {/* Höger kolumn: läge, urval och Starta (sticky på desktop) */}
      <div className="contents lg:sticky lg:top-6 lg:grid lg:gap-6">
        <section aria-labelledby="lage-rubrik" className="order-2 grid gap-4 rounded-lg border border-line bg-surface p-5 shadow-card">
          <h2 id="lage-rubrik" className="text-lg font-semibold">
            {sv.deck.chooseMode}
          </h2>
          <fieldset className="grid gap-2">
            <legend className="sr-only">{sv.deck.chooseMode}</legend>
            {(
              [
                ["fsrs", sv.deck.modeFsrs, sv.deck.modeFsrsHelp],
                ["tricky", sv.deck.modeTricky, sv.deck.modeTrickyHelp],
                ["free", sv.deck.modeFree, sv.deck.modeFreeHelp],
                ["random", sv.deck.modeRandom, sv.deck.modeRandomHelp],
              ] as const
            ).map(([value, label, help]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  mode === value ? "border-accent bg-accent-soft" : "border-line bg-bg hover:border-line-strong"
                }`}
              >
                <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-[var(--accent)]" />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-sm text-muted">{help}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {mode !== "random" ? (
            <div className="grid gap-2 rounded-lg border border-line bg-bg p-3" data-testid="selection-summary">
              <p className="text-sm font-medium">{sv.deck.summaryTitle}</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedTitles.length === 0 ? (
                  <span className="text-sm text-muted">{sv.deck.summaryAll}</span>
                ) : (
                  selectedTitles.map((c) => <CategoryTag key={c.id} title={c.title} colorIndex={colorIndex.get(c.id) ?? 0} />)
                )}
              </div>
              <p className="text-sm text-muted">
                {mode === "tricky" ? sv.deck.summaryTricky(selectionCount) : sv.deck.summaryCards(selectionCount)}
                {progress && mode !== "tricky" ? ` · ${sv.deck.summaryLearned(selectionLearned)}` : ""}
              </p>
            </div>
          ) : null}

          <div className="grid gap-2">
            {canStart ? (
              <Link href={startHref} className={buttonClass("primary", "lg")} data-testid="start-session">
                {sv.deck.start}
              </Link>
            ) : (
              <Button size="lg" disabled data-testid="start-session">
                {sv.deck.start}
              </Button>
            )}
            <span className="text-center text-sm text-muted">
              {mode === "fsrs" && stats
                ? nothingDue
                  ? sv.deck.nothingDue
                  : `${sv.deck.dueNow(stats.due)}, ${sv.deck.newCards(stats.new)}`
                : sv.home.cards(selectionCount)}
            </span>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={sv.deck.resetConfirmTitle}
        body={sv.deck.resetDeckConfirm(deck.title)}
        danger
        busy={busy}
        onConfirm={doResetDeck}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
