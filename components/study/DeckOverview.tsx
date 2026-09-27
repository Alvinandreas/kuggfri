"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { ProgressMap, ReviewEntry, StudyMode } from "@/lib/progress/types";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { categoryStats, learnedRatio, type SelectableCard, UNCATEGORIZED_ID } from "@/lib/study/selection";
import { planDeckSession, type DeckPlan } from "@/lib/study/deck-plan";
import { DEFAULT_PREFS, readPrefs, writePrefs, type StudyPrefs } from "@/lib/progress/prefs";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { DEFAULT_DUGGA, duggaExamSize, type DuggaSettings } from "@/lib/study/dugga";
import { useStars } from "@/lib/progress/stars";
import { Badge } from "@/components/ui/Badge";
import { CategoryTable, type SortMode } from "./CategoryTable";
import { ModePicker, type PickerMode } from "./ModePicker";
import { StarredDialog } from "./StarredDialog";
import { SessionPanel } from "./SessionPanel";
import { ShareDeck } from "./ShareDeck";

const MODES: StudyMode[] = ["fsrs", "tricky", "free", "random", "exam"];

/** Läget som passet faktiskt körs i: Stjärnmärkta är fri repetition av de markerade korten. */
function runMode(pick: PickerMode): StudyMode {
  return pick === "starred" ? "free" : pick;
}

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
  /** Med frågetexten, för listan över stjärnmärkta kort. */
  cards: (SelectableCard & { front: string })[];
  userId: string | null;
  /** Förvalt läge och område (?lage=, ?omrade=), t.ex. från Duggan på hemsidan. */
  initialMode?: StudyMode;
  initialAreaId?: string | null;
};

/**
 * Kurssidan: här börjar man plugga. Välj läge, välj områden om man vill, starta. All
 * statistik om hur det går ligger på hemsidan; här finns bara det som behövs för att
 * komma igång, och passets inställningar.
 */
export function DeckOverview({ deck, categories, cards, userId, initialMode = "fsrs", initialAreaId = null }: Props) {
  const store = useProgressStore(userId);
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [pick, setPick] = useState<PickerMode>(initialMode);
  const mode = runMode(pick);
  const [starredOpen, setStarredOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialAreaId ? [initialAreaId] : []);
  const [dugga, setDugga] = useState<DuggaSettings>(DEFAULT_DUGGA);
  const { stars } = useStars();
  const [sortMode, setSortMode] = useState<SortMode>("deck");
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

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    Promise.all([store.load(cardIds), store.loadReviews(cardIds)])
      .then(([p, r]) => {
        if (cancelled) return;
        setProgress(p);
        setReviews(r);
      })
      .catch(() => {
        if (cancelled) return;
        setProgress({});
        setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [store, cardIds]);

  const firstVisit = progress !== null && reviews.length === 0 && !cardIds.some((id) => progress[id]);

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

  // Bara stjärnmärkta: planen räknar på de markerade korten, så siffrorna stämmer med passet.
  const starredCount = useMemo(() => cards.filter((c) => stars.has(c.id)).length, [cards, stars]);
  const starredCards = useMemo(() => cards.filter((c) => stars.has(c.id)), [cards, stars]);

  // En plan per läge med samma urval: ger lägesrutornas siffror och det valda passet.
  const plans = useMemo(
    () => {
      const base = { deck, progress, reviews, selectedIds, dailyNew: prefs.dailyNew, examSize: duggaExamSize(dugga.size) };
      return {
        ...Object.fromEntries(MODES.map((m) => [m, planDeckSession({ ...base, cards, mode: m })])),
        starred: planDeckSession({ ...base, cards: starredCards, mode: "free" }),
      } as Record<PickerMode, DeckPlan>;
    },
    [deck, cards, starredCards, progress, reviews, selectedIds, prefs.dailyNew, dugga.size],
  );
  const plan = plans[pick];
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        {/* Vänster: läge, områden och delning. På mobil kommer passet (Starta) direkt efter lägena. */}
        <div className="contents lg:grid lg:gap-8">
          <div className="order-1 lg:order-none">
            <ModePicker mode={pick} onMode={setPick} plans={plans} progressReady={progress !== null} totalCards={cards.length} />
          </div>
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
          <div className="order-4 lg:order-none">
            <ShareDeck slug={deck.slug} />
          </div>
        </div>

        <div className="contents lg:sticky lg:top-6 lg:grid lg:gap-6">
          <SessionPanel
            pick={pick}
            mode={mode}
            plan={plan}
            selectedTitles={selectedTitles}
            colorIndex={colorIndex}
            progressReady={progress !== null}
            firstVisit={firstVisit}
            totalCards={cards.length}
            prefs={prefs}
            onPrefs={updatePrefs}
            dugga={dugga}
            onDugga={setDugga}
            starredCount={starredCount}
            onShowStarred={() => setStarredOpen(true)}
          />
          <StarredDialog open={starredOpen} onClose={() => setStarredOpen(false)} cards={cards} categories={tableCategories} colorIndex={colorIndex} />
        </div>
      </div>
    </div>
  );
}
