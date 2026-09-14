"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { nextDueDate, queueStats } from "@/lib/fsrs/scheduler";
import type { ProgressMap, StudyMode } from "@/lib/progress/types";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import {
  categoryStats,
  filterCards,
  learnedRatio,
  serializeSelection,
  type SelectableCard,
  type Selection,
} from "@/lib/study/selection";
import { formatRelative } from "@/lib/time/format";
import { categoryColorIndex, tagBgClass } from "@/lib/ui/tag-colors";
import { Button, buttonClass } from "@/components/ui/Button";
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

type ResetKind = "deck" | "schedule" | "all";
type SortMode = "deck" | "learned";

export function DeckOverview({ deck, categories, cards, userId }: Props) {
  const store = useProgressStore(userId);
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [mode, setMode] = useState<StudyMode>("fsrs");
  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  const [sortMode, setSortMode] = useState<SortMode>("deck");
  const [resetKind, setResetKind] = useState<ResetKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const colorIndex = useMemo(() => categoryColorIndex(categories), [categories]);

  const reload = useCallback(async () => {
    if (!store) return;
    try {
      setProgress(await store.load(cardIds));
    } catch {
      setProgress({});
    }
  }, [store, cardIds]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = useMemo(() => (progress ? queueStats(cardIds, progress, new Date()) : null), [cardIds, progress]);
  const seen = useMemo(() => (progress ? cardIds.filter((id) => progress[id]).length : 0), [cardIds, progress]);
  const avgRating = useMemo(() => {
    if (!progress) return null;
    const ratings = cardIds.map((id) => progress[id]?.self_rating).filter((r): r is 1 | 2 | 3 | 4 | 5 => typeof r === "number");
    if (ratings.length === 0) return null;
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  }, [cardIds, progress]);
  const nextDue = useMemo(() => (progress ? nextDueDate(cardIds, progress, new Date()) : null), [cardIds, progress]);
  const lowCount = useMemo(() => (progress ? filterCards(cards, progress, { kind: "low" }).length : 0), [cards, progress]);

  const perCategory = useMemo(
    () =>
      categoryStats(
        cards,
        progress ?? {},
        categories.map((c) => c.id),
      ),
    [cards, progress, categories],
  );
  const sortedCategories = useMemo(() => {
    const byId = new Map(perCategory.map((s) => [s.categoryId, s] as const));
    const list = categories.map((c) => ({ ...c, stats: byId.get(c.id)! }));
    if (sortMode === "learned") {
      list.sort((a, b) => learnedRatio(a.stats) - learnedRatio(b.stats) || a.title.localeCompare(b.title, "sv"));
    }
    return list;
  }, [categories, perCategory, sortMode]);

  const selectedSet = useMemo(() => new Set(selection.kind === "categories" ? selection.categoryIds : []), [selection]);

  function toggleCategory(id: string) {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next.size === 0 ? { kind: "all" } : { kind: "categories", categoryIds: categories.filter((c) => next.has(c.id)).map((c) => c.id) });
  }

  const selectionCount = useMemo(() => {
    if (mode === "random") return cards.length;
    return filterCards(cards, progress ?? {}, selection).length;
  }, [cards, mode, progress, selection]);

  const effectiveSelection: Selection = mode === "random" ? { kind: "all" } : selection;
  const startHref = `/d/${deck.slug}/plugga?mode=${mode}&urval=${encodeURIComponent(serializeSelection(effectiveSelection))}`;
  const nothingDue = mode === "fsrs" && stats !== null && stats.due + stats.new === 0 && selection.kind === "all";
  const canStart = selectionCount > 0 && !nothingDue;

  async function confirmReset() {
    if (!store || !resetKind) return;
    setBusy(true);
    try {
      if (resetKind === "deck") await store.resetDeck(deck.id, cardIds);
      else if (resetKind === "schedule") await store.resetSchedule(deck.id, cardIds);
      else await store.resetAll();
      await reload();
      setNotice(sv.deck.resetDone);
    } catch {
      setNotice(sv.errors.generic);
    } finally {
      setBusy(false);
      setResetKind(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/d/${deck.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Urklipp kan vara blockerat; länken syns ändå i adressfältet.
    }
  }

  const dropdownValue = selection.kind === "categories" ? "categories" : selection.kind;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
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
          <h2 id="progress-rubrik" className="text-lg font-semibold">
            {sv.deck.progressTitle}
          </h2>
          {progress === null ? (
            <p className="mt-2 text-muted">{sv.common.loading}</p>
          ) : seen === 0 ? (
            <p className="mt-2 text-muted">{sv.deck.noProgress}</p>
          ) : (
            <>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">{sv.deck.progressTitle}</dt>
                  <dd data-testid="seen-count" className="text-base font-medium">
                    {sv.deck.seen(seen, cards.length)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{sv.deck.averageRating}</dt>
                  <dd className="text-base font-medium">{avgRating === null ? "–" : avgRating.toFixed(1)}</dd>
                </div>
              </dl>
              <p data-testid="due-info" className="mt-3 text-base font-medium">
                {stats && stats.due + stats.new > 0
                  ? `${sv.deck.dueNow(stats.due)}, ${sv.deck.newCards(stats.new)}`
                  : nextDue
                    ? `${sv.deck.nothingDue} ${sv.deck.nextDue(formatRelative(nextDue))}`
                    : sv.deck.nothingDue}
              </p>
            </>
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
              <select
                id="sortering"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-9 rounded-md border border-line-strong bg-surface px-2 text-fg"
              >
                <option value="deck">{sv.deck.sortDeckOrder}</option>
                <option value="learned">{sv.deck.sortLeastLearned}</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={selectedSet.size === categories.length ? sv.deck.selectNone : sv.deck.selectAll}
                      checked={selectedSet.size === categories.length && categories.length > 0}
                      onChange={(e) =>
                        setSelection(e.target.checked ? { kind: "categories", categoryIds: categories.map((c) => c.id) } : { kind: "all" })
                      }
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
                  return (
                    <tr key={c.id} className={`border-b border-line last:border-b-0 ${checked ? "bg-accent-soft/60" : ""}`} data-testid="category-row">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(c.id)}
                          aria-label={c.title}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setSelection({ kind: "categories", categoryIds: [c.id] })}
                          className="text-left"
                          title={sv.deck.categoriesHelp}
                        >
                          <CategoryTag title={c.title} colorIndex={colorIndex.get(c.id) ?? 0} size="md" />
                        </button>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted">{sv.deck.studiedOf(c.stats.studied, c.stats.total)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted">{sv.deck.studiedOf(c.stats.learned, c.stats.total)}</td>
                      <td className="hidden px-3 py-2 sm:table-cell">
                        <div className="h-2 w-full overflow-hidden rounded bg-surface-2" aria-hidden="true">
                          <div className="relative h-full">
                            <div className={`absolute inset-y-0 left-0 rounded opacity-50 ${tagBgClass(colorIndex.get(c.id) ?? 0)}`} style={{ width: `${studiedPct}%` }} />
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

        {/* Dela och källa */}
        <section className="order-6 grid gap-2 text-sm text-muted">
          <div className="flex flex-wrap items-center gap-3">
            <span>{sv.deck.share}</span>
            <code className="rounded bg-surface-2 px-2 py-1 text-fg">/d/{deck.slug}</code>
            <Button variant="ghost" size="sm" onClick={copyLink}>
              {copied ? sv.deck.shareCopied : sv.deck.shareCopy}
            </Button>
          </div>
          {deck.source_credit ? (
            <p>
              <span className="font-medium text-fg">{sv.deck.source}:</span> {deck.source_credit}
            </p>
          ) : null}
        </section>
      </div>

      {/* Höger kolumn: starta och nollställ (sticky på desktop) */}
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
            <div className="grid gap-2">
              <label htmlFor="urval" className="text-sm font-medium">
                {sv.deck.selection}
              </label>
              <select
                id="urval"
                value={dropdownValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "all") setSelection({ kind: "all" });
                  else if (v === "low") setSelection({ kind: "low" });
                  else if (v.startsWith("kategori:")) setSelection({ kind: "categories", categoryIds: [v.slice("kategori:".length)] });
                }}
                className="h-11 w-full min-w-0 rounded-md border border-line-strong bg-bg px-3 text-fg"
              >
                <option value="all">
                  {sv.deck.selectionAll} ({cards.length})
                </option>
                {selection.kind === "categories" ? (
                  <option value="categories">
                    {sv.deck.selectionCategories(selection.categoryIds.length)} ({selectionCount})
                  </option>
                ) : null}
                {categories.map((c) => (
                  <option key={c.id} value={`kategori:${c.id}`}>
                    {c.title} ({perCategory.find((s) => s.categoryId === c.id)?.total ?? 0})
                  </option>
                ))}
                {mode === "free" ? (
                  <option value="low">
                    {sv.deck.selectionLowRated} ({lowCount})
                  </option>
                ) : null}
              </select>
              {selection.kind === "low" && lowCount === 0 ? <p className="text-sm text-muted">{sv.deck.lowRatedEmpty}</p> : null}
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

        <section aria-labelledby="nollstall-rubrik" className="order-5 grid gap-3 rounded-lg border border-line p-5">
          <h2 id="nollstall-rubrik" className="text-lg font-semibold">
            {sv.deck.resetTitle}
          </h2>
          <ul className="grid gap-4">
            {(
              [
                ["deck", sv.deck.resetDeck, sv.deck.resetDeckHelp, "danger", "reset-deck"],
                ["schedule", sv.deck.resetSchedule, sv.deck.resetScheduleHelp, "secondary", "reset-schedule"],
                ["all", sv.deck.resetAll, sv.deck.resetAllHelp, "danger", "reset-all"],
              ] as const
            ).map(([kind, label, help, variant, testId]) => (
              <li key={kind} className="grid gap-1.5">
                <Button variant={variant} size="sm" onClick={() => setResetKind(kind)} disabled={!store} data-testid={testId} className="w-full">
                  {label}
                </Button>
                <p className="text-xs text-muted">{help}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <ConfirmDialog
        open={resetKind !== null}
        title={sv.deck.resetConfirmTitle}
        body={
          resetKind === "deck"
            ? sv.deck.resetDeckConfirm(deck.title)
            : resetKind === "schedule"
              ? sv.deck.resetScheduleConfirm(deck.title)
              : sv.deck.resetAllConfirm
        }
        danger={resetKind !== "schedule"}
        busy={busy}
        onConfirm={confirmReset}
        onCancel={() => setResetKind(null)}
      />
    </div>
  );
}
