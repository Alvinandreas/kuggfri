"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { nextDueDate, queueStats } from "@/lib/fsrs/scheduler";
import type { ProgressMap, StudyMode } from "@/lib/progress/types";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { filterCards, serializeSelection, type SelectableCard, type Selection } from "@/lib/study/selection";
import { formatRelative } from "@/lib/time/format";
import { Button, buttonClass } from "@/components/ui/Button";
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

export function DeckOverview({ deck, categories, cards, userId }: Props) {
  const store = useProgressStore(userId);
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [mode, setMode] = useState<StudyMode>("fsrs");
  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  const [resetKind, setResetKind] = useState<ResetKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

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

  const selectionCount = useMemo(() => {
    if (!progress) return cards.length;
    if (mode === "random") return cards.length;
    return filterCards(cards, progress, selection).length;
  }, [cards, mode, progress, selection]);

  const startHref = `/d/${deck.slug}/plugga?mode=${mode}&urval=${encodeURIComponent(serializeSelection(mode === "random" ? { kind: "all" } : selection))}`;
  const canStart = selectionCount > 0 && !(mode === "fsrs" && stats !== null && stats.due + stats.new === 0 && selection.kind === "all");

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

  const categoryTitle = (id: string | null) => categories.find((c) => c.id === id)?.title ?? sv.deck.uncategorized;
  const categoryCounts = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const c of cards) m.set(c.category_id, (m.get(c.category_id) ?? 0) + 1);
    return m;
  }, [cards]);

  return (
    <div className="grid gap-8">
      <header>
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
      <section aria-labelledby="progress-rubrik" className="rounded-lg border border-line bg-surface p-5 shadow-card">
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

      {/* Läge */}
      <section aria-labelledby="lage-rubrik" className="grid gap-4">
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
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                mode === value ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                className="mt-1 accent-[var(--accent)]"
              />
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
              value={serializeSelection(selection)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all") setSelection({ kind: "all" });
                else if (v === "low") setSelection({ kind: "low" });
                else setSelection({ kind: "category", categoryId: v.replace("kategori:", "") });
              }}
              className="h-11 rounded-md border border-line-strong bg-surface px-3 text-fg"
            >
              <option value="all">
                {sv.deck.selectionAll} ({cards.length})
              </option>
              {categories.map((c) => (
                <option key={c.id} value={`kategori:${c.id}`}>
                  {c.title} ({categoryCounts.get(c.id) ?? 0})
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

        <div className="flex flex-wrap items-center gap-3">
          {canStart ? (
            <Link href={startHref} className={buttonClass("primary", "lg")} data-testid="start-session">
              {sv.deck.start}
            </Link>
          ) : (
            <Button size="lg" disabled data-testid="start-session">
              {sv.deck.start}
            </Button>
          )}
          <span className="text-sm text-muted">
            {mode === "fsrs" && stats
              ? stats.due + stats.new === 0
                ? sv.deck.nothingDue
                : `${sv.deck.dueNow(stats.due)}, ${sv.deck.newCards(stats.new)}`
              : sv.home.cards(selectionCount)}
          </span>
        </div>
      </section>

      {/* Kategorier */}
      <section aria-labelledby="kategorier-rubrik">
        <h2 id="kategorier-rubrik" className="text-lg font-semibold">
          {sv.deck.categories}
        </h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {categories.map((c) => (
            <li key={c.id} className="flex justify-between border-b border-line py-2">
              <span>{c.title}</span>
              <span className="text-muted">{sv.home.cards(categoryCounts.get(c.id) ?? 0)}</span>
            </li>
          ))}
          {categoryCounts.get(null) ? (
            <li className="flex justify-between border-b border-line py-2">
              <span>{categoryTitle(null)}</span>
              <span className="text-muted">{sv.home.cards(categoryCounts.get(null) ?? 0)}</span>
            </li>
          ) : null}
        </ul>
      </section>

      {/* Nollställning */}
      <section aria-labelledby="nollstall-rubrik" className="grid gap-3 rounded-lg border border-line p-5">
        <h2 id="nollstall-rubrik" className="text-lg font-semibold">
          {sv.deck.resetTitle}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid content-start gap-1">
            <Button variant="danger" size="sm" onClick={() => setResetKind("deck")} disabled={!store} data-testid="reset-deck">
              {sv.deck.resetDeck}
            </Button>
            <p className="text-xs text-muted">{sv.deck.resetDeckHelp}</p>
          </div>
          <div className="grid content-start gap-1">
            <Button variant="secondary" size="sm" onClick={() => setResetKind("schedule")} disabled={!store} data-testid="reset-schedule">
              {sv.deck.resetSchedule}
            </Button>
            <p className="text-xs text-muted">{sv.deck.resetScheduleHelp}</p>
          </div>
          <div className="grid content-start gap-1">
            <Button variant="danger" size="sm" onClick={() => setResetKind("all")} disabled={!store} data-testid="reset-all">
              {sv.deck.resetAll}
            </Button>
            <p className="text-xs text-muted">{sv.deck.resetAllHelp}</p>
          </div>
        </div>
      </section>

      {/* Dela och källa */}
      <section className="grid gap-2 text-sm text-muted">
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
