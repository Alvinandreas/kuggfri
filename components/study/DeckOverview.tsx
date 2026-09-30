"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { ProgressMap, ReviewEntry, StudyMode } from "@/lib/progress/types";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { categoryStats, learnedRatio, type SelectableCard, UNCATEGORIZED_ID } from "@/lib/study/selection";
import { planDeckSession, type DeckPlan } from "@/lib/study/deck-plan";
import { DEFAULT_PREFS, readPrefs, type StudyPrefs } from "@/lib/progress/prefs";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { kindMatches, readStoredSettings, writeStoredSettings, type SessionSettings, type SettingsMode } from "@/lib/study/session-settings";
import { useStars } from "@/lib/progress/stars";
import { Badge } from "@/components/ui/Badge";
import { CategoryTable, type SortMode } from "./CategoryTable";
import { ModePicker, type PickerMode } from "./ModePicker";
import { StarredDialog } from "./StarredDialog";
import { SessionPanel } from "./SessionPanel";
import { ShareDeck } from "./ShareDeck";

const MODES: StudyMode[] = ["fsrs", "tricky", "free", "random", "exam"];

/** Per kurs och besökare: studenten som valt originalkorten ska slippa välja igen. */
const ONLY_ORIGINAL_KEY = (deckId: string) => `kuggfri:bara-original:${deckId}`;

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
  /** Med frågetexten, för listan över stjärnmärkta kort. hasHint: kortet har en ledtråd. */
  cards: (SelectableCard & { front: string; original: boolean; hasHint?: boolean })[];
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
export function DeckOverview({ deck, categories, cards: allCards, userId, initialMode = "fsrs", initialAreaId = null }: Props) {
  const store = useProgressStore(userId);
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [pick, setPick] = useState<PickerMode>(initialMode);
  const mode = runMode(pick);
  const [starredOpen, setStarredOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialAreaId ? [initialAreaId] : []);
  // Passets inställningar, en uppsättning per läge. Sparas i webbläsaren när de ändras.
  const [allSettings, setAllSettings] = useState<Record<SettingsMode, SessionSettings>>(() => readStoredSettings(null));
  const { stars } = useStars();
  const [sortMode, setSortMode] = useState<SortMode>("deck");
  const [prefs, setPrefs] = useState<StudyPrefs>(DEFAULT_PREFS);
  const [onlyOriginal, setOnlyOriginal] = useState(false);

  // Nya kort per dag ställs in under Konto; här läses bara värdet.
  useEffect(() => {
    setPrefs(readPrefs(window.localStorage));
    try {
      setAllSettings(readStoredSettings(window.localStorage));
    } catch {
      // Utan lagring gäller standardvärdena.
    }
    try {
      setOnlyOriginal(window.localStorage.getItem(ONLY_ORIGINAL_KEY(deck.id)) === "1");
    } catch {
      // Utan lagring börjar valet avslaget.
    }
  }, [deck.id]);

  const changeOnlyOriginal = useCallback(
    (next: boolean) => {
      setOnlyOriginal(next);
      try {
        window.localStorage.setItem(ONLY_ORIGINAL_KEY(deck.id), next ? "1" : "0");
      } catch {
        // Valet gäller ändå för den här sidvisningen.
      }
    },
    [deck.id],
  );

  const changeSettings = useCallback(
    (next: SessionSettings) => {
      setAllSettings((prev) => {
        const all = { ...prev, [pick]: next };
        try {
          writeStoredSettings(window.localStorage, all);
        } catch {
          // Valet gäller ändå för den här sidvisningen.
        }
        return all;
      });
    },
    [pick],
  );

  // Bara originalkorten: den beprövade uppsättningen. Filtret gäller alla lägen och alla siffror
  // på sidan, så att det som visas stämmer med passet som startas.
  const originalCount = useMemo(() => allCards.filter((c) => c.original).length, [allCards]);
  const offerOriginal = originalCount > 0 && originalCount < allCards.length;
  const cards = useMemo(() => (onlyOriginal && offerOriginal ? allCards.filter((c) => c.original) : allCards), [allCards, onlyOriginal, offerOriginal]);

  // Uppgiftstyper går bara att välja när kursen har både vändkort och flerval; annars gäller
  // alla typer, så att ett sparat val aldrig tömmer passet utan att reglaget syns.
  const kindsOffered = useMemo(() => {
    const quiz = cards.filter((c) => kindMatches(c.kind, "flerval")).length;
    return quiz > 0 && quiz < cards.length;
  }, [cards]);
  const effectiveSettings = useMemo(
    () =>
      kindsOffered
        ? allSettings
        : (Object.fromEntries(Object.entries(allSettings).map(([m, s]) => [m, { ...s, kinds: "alla" }])) as Record<SettingsMode, SessionSettings>),
    [allSettings, kindsOffered],
  );
  const settings = effectiveSettings[pick];

  // Progress laddas för alla kort, så att valet Bara originalkorten inte hämtar om den.
  const cardIds = useMemo(() => allCards.map((c) => c.id), [allCards]);
  // Kort utan område får en egen rad ("Utan område") så att de aldrig försvinner ur urvalet.
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
  // Välj alla: bara områden som har kort (tomma går inte att kryssa i).
  const selectAll = useCallback(
    (all: boolean) => {
      const filled = new Set(perCategory.filter((s) => s.total > 0).map((s) => s.categoryId));
      setSelectedIds(all ? tableCategories.filter((c) => filled.has(c.id)).map((c) => c.id) : []);
    },
    [tableCategories, perCategory],
  );
  const selectOnly = useCallback((id: string) => setSelectedIds([id]), []);

  // I läget kluriga kort går bara kategorier med kluriga kort att välja; övriga avmarkeras.
  useEffect(() => {
    if (mode !== "tricky") return;
    setSelectedIds((prev) => prev.filter((id) => (perCategory.find((s) => s.categoryId === id)?.tricky ?? 0) > 0));
  }, [mode, perCategory]);

  // Bara stjärnmärkta: planen räknar på de markerade korten, så siffrorna stämmer med passet.
  const starredCount = useMemo(() => cards.filter((c) => stars.has(c.id)).length, [cards, stars]);
  const starredCards = useMemo(() => cards.filter((c) => stars.has(c.id)), [cards, stars]);

  // En plan per läge med samma urval och lägets egna inställningar: ger lägesrutornas
  // siffror och det valda passet.
  const plans = useMemo(
    () => {
      const base = { deck, progress, reviews, selectedIds, dailyNew: prefs.dailyNew };
      return {
        ...Object.fromEntries(MODES.map((m) => [m, planDeckSession({ ...base, cards, mode: m, settings: effectiveSettings[m] })])),
        starred: planDeckSession({ ...base, cards: starredCards, mode: "free", settings: effectiveSettings.starred }),
      } as Record<PickerMode, DeckPlan>;
    },
    [deck, cards, starredCards, progress, reviews, selectedIds, prefs.dailyNew, effectiveSettings],
  );
  const plan = plans[pick];
  // Ledtrådsvalet visas bara när passets kort har ledtrådar.
  const hintCards = useMemo(() => {
    const withHint = new Set(cards.filter((c) => c.hasHint).map((c) => c.id));
    const pool = pick === "random" && !settings.followAreas ? cards : plan.selectionCards;
    return withHint.size === 0 ? 0 : pool.filter((c) => withHint.has(c.id)).length;
  }, [cards, plan, pick, settings.followAreas]);
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
            <p className="mt-1.5 text-sm text-muted">
              {[deck.course_code ? `${sv.home.courseCode} ${deck.course_code}` : null, sv.deck.totalCards(allCards.length)].filter(Boolean).join(", ")}
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
            dailyNew={prefs.dailyNew}
            settings={settings}
            onSettings={changeSettings}
            hintCards={hintCards}
            kindsOffered={kindsOffered}
            starredCount={starredCount}
            onShowStarred={() => setStarredOpen(true)}
            original={offerOriginal ? { count: originalCount, on: onlyOriginal, onChange: changeOnlyOriginal } : null}
          />
          <StarredDialog open={starredOpen} onClose={() => setStarredOpen(false)} cards={cards} categories={tableCategories} colorIndex={colorIndex} />
        </div>
      </div>
    </div>
  );
}
