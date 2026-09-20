"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { nextDueDate, queueStats } from "@/lib/fsrs/scheduler";
import type { ProgressMap, ReviewEntry, StudyMode } from "@/lib/progress/types";
import { ProgressStats } from "@/components/stats/ProgressStats";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { categoryStats, learnedRatio, type SelectableCard, UNCATEGORIZED_ID } from "@/lib/study/selection";
import { formatRelative } from "@/lib/time/format";
import { estimateMinutes } from "@/lib/study/plan";
import { planDeckSession } from "@/lib/study/deck-plan";
import { DEFAULT_PREFS, readPrefs, writePrefs, type StudyPrefs } from "@/lib/progress/prefs";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CategoryTable, type SortMode } from "./CategoryTable";
import { SessionPanel } from "./SessionPanel";
import { ShareDeck } from "./ShareDeck";

type Props = {
  deck: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    course_code: string | null;
    source_credit: string | null;
    exam_date: string | null;
  };
  categories: { id: string; title: string }[];
  cards: SelectableCard[];
  userId: string | null;
};

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
  const [prefs, setPrefs] = useState<StudyPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(readPrefs(window.localStorage));
  }, []);
  const updatePrefs = useCallback((next: StudyPrefs) => {
    setPrefs(next);
    writePrefs(window.localStorage, next);
  }, []);

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
  const categoryRows = useMemo(() => {
    const byId = new Map(perCategory.map((s) => [s.categoryId, s] as const));
    const list = tableCategories.map((c) => ({ ...c, stats: byId.get(c.id)! }));
    if (sortMode === "learned") {
      list.sort((a, b) => learnedRatio(a.stats) - learnedRatio(b.stats) || a.title.localeCompare(b.title, "sv"));
    }
    return list;
  }, [tableCategories, perCategory, sortMode]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleCategory = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        // Håll urvalet i kursens ordning, oavsett i vilken ordning rutorna kryssats i.
        return tableCategories.filter((c) => next.has(c.id)).map((c) => c.id);
      });
    },
    [tableCategories],
  );
  const selectAll = useCallback((all: boolean) => setSelectedIds(all ? tableCategories.map((c) => c.id) : []), [tableCategories]);
  const selectOnly = useCallback((id: string) => setSelectedIds([id]), []);

  // I läget kluriga kort går bara kategorier med kluriga kort att välja; övriga avmarkeras.
  useEffect(() => {
    if (mode !== "tricky") return;
    setSelectedIds((prev) => prev.filter((id) => (perCategory.find((s) => s.categoryId === id)?.tricky ?? 0) > 0));
  }, [mode, perCategory]);

  const plan = useMemo(
    () => planDeckSession({ deck, cards, progress, reviews, mode, selectedIds, dailyNew: prefs.dailyNew }),
    [deck, cards, progress, reviews, mode, selectedIds, prefs.dailyNew],
  );

  async function doResetDeck() {
    if (!store) return;
    setBusy(true);
    try {
      await store.resetDeck({ deckId: deck.id, cardIds });
      await reload();
      setNotice(sv.deck.resetDone);
    } catch {
      setNotice(sv.errors.generic);
    } finally {
      setBusy(false);
      setConfirmReset(false);
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
          {plan.phase.kind !== "none" && deck.exam_date ? (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-sm" data-testid="exam-line">
              <span className="font-medium">
                {plan.phase.kind === "past" ? sv.deck.examDate(deck.exam_date) : sv.deck.examIn(plan.phase.daysLeft)}
              </span>
              <span className="text-muted">
                {plan.phase.kind === "past"
                  ? sv.deck.examPast
                  : plan.phase.kind === "final"
                    ? sv.deck.examFinalHelp
                    : plan.newCardPlan?.catchUp && plan.newCardPlan.neededPerDay !== null
                      ? sv.deck.examCatchUp(plan.newCardPlan.neededPerDay)
                      : `${deck.exam_date}. ${sv.deck.examUpcomingHelp}`}
              </span>
            </p>
          ) : null}
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
            <div className="mt-2 grid gap-1" data-testid="first-visit">
              <p className="font-medium">{sv.deck.firstVisitTitle}</p>
              <p className="text-muted">
                {sv.deck.firstVisitBody(Math.min(prefs.dailyNew, cards.length), estimateMinutes(Math.min(prefs.dailyNew, cards.length)))}
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <ProgressStats
                cardIds={cardIds}
                progress={progress}
                reviews={reviews}
                weekdaysOnly={prefs.weekdaysOnly}
                deck={{ title: deck.title, slug: deck.slug }}
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

        <CategoryTable
          rows={categoryRows}
          colorIndex={colorIndex}
          selected={selectedSet}
          mode={mode}
          sortMode={sortMode}
          onSortMode={setSortMode}
          onToggle={toggleCategory}
          onOnly={selectOnly}
          onSelectAll={selectAll}
        />

        <ShareDeck slug={deck.slug} />
      </div>

      {/* Höger kolumn: läge, urval och Starta (sticky på desktop) */}
      <div className="contents lg:sticky lg:top-6 lg:grid lg:gap-6">
        <SessionPanel
          mode={mode}
          onMode={setMode}
          plan={plan}
          selectedTitles={selectedTitles}
          colorIndex={colorIndex}
          progressReady={progress !== null}
          prefs={prefs}
          onPrefs={updatePrefs}
        />
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
