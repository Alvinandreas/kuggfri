"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, RotateCcw } from "lucide-react";
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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
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
    <div>
      <header className="anim-fade-up mb-8">
        <div className="flex min-w-0 items-start gap-4">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink sm:inline-flex">
            <BookOpen size={24} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{deck.title}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              {deck.course_code ? (
                <>
                  <span>
                    {sv.home.courseCode} {deck.course_code}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <span>{sv.deck.totalCards(cards.length)}</span>
            </p>
          </div>
        </div>
        {deck.description ? <p className="mt-4 max-w-3xl text-lg text-muted">{deck.description}</p> : null}
        {plan.phase.kind !== "none" && deck.exam_date ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm" data-testid="exam-line">
            <Badge tone={plan.phase.kind === "past" ? "outline" : "accent"}>
              {plan.phase.kind === "past" ? sv.deck.examDate(deck.exam_date) : sv.deck.examIn(plan.phase.daysLeft)}
            </Badge>
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        {/* Vänster kolumn: progress, kategorier och delning. På mobil ligger allt i ett flöde där Starta kommer före kategorierna. */}
        <div className="contents lg:grid lg:gap-6">
          {/* Progress */}
          <Card padding="lg" role="region" aria-labelledby="progress-rubrik" className="anim-fade-up order-3" style={{ ["--i" as string]: 1 }}>
            <CardHeader
              id="progress-rubrik"
              title={sv.deck.progressTitle}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmReset(true)}
                  disabled={!store}
                  title={sv.deck.resetLink}
                  data-testid="reset-deck"
                >
                  <RotateCcw size={15} aria-hidden />
                  {sv.deck.resetShort}
                </Button>
              }
            />
            {progress === null ? (
              <p className="text-muted">{sv.common.loading}</p>
            ) : seen === 0 && reviews.length === 0 ? (
              <div className="grid gap-1 rounded-lg bg-surface-2 p-4" data-testid="first-visit">
                <p className="font-semibold">{sv.deck.firstVisitTitle}</p>
                <p className="text-muted">
                  {sv.deck.firstVisitBody(Math.min(prefs.dailyNew, cards.length), estimateMinutes(Math.min(prefs.dailyNew, cards.length)))}
                </p>
              </div>
            ) : (
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
            )}
            {notice ? (
              <p role="status" className="mt-4 text-sm font-medium text-accent-ink">
                {notice}
              </p>
            ) : null}
          </Card>

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
