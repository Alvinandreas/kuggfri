import { describe, expect, it } from "vitest";
import { planDeckSession } from "@/lib/study/deck-plan";
import { EXAM_SIZE } from "@/lib/study/plan";
import type { SelectableCard } from "@/lib/study/selection";
import type { CardProgress, ProgressMap, SelfRating, StudyMode } from "@/lib/progress/types";

const NOW = new Date("2026-09-20T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

/** 40 kort: 20 i k1, 20 i k2. Fler än EXAM_SIZE, så tentalägets tak går att se. */
const cards: SelectableCard[] = Array.from({ length: 40 }, (_, i) => ({
  id: `c${i}`,
  category_id: i < 20 ? "k1" : "k2",
  sort_order: i,
}));

function rated(cardId: string, rating: SelfRating, dueInDays: number): CardProgress {
  return {
    card_id: cardId,
    due: new Date(NOW.getTime() + dueInDays * DAY).toISOString(),
    stability: 10,
    difficulty: 5,
    elapsed_days: 1,
    scheduled_days: 1,
    reps: 2,
    lapses: 0,
    state: 2,
    last_review: new Date(NOW.getTime() - DAY).toISOString(),
    self_rating: rating,
  };
}

function plan(options: { mode?: StudyMode; selectedIds?: string[]; progress?: ProgressMap | null; examDate?: string | null; dailyNew?: number } = {}) {
  return planDeckSession({
    deck: { slug: "mtt015", exam_date: options.examDate ?? null },
    cards,
    progress: options.progress === undefined ? {} : options.progress,
    reviews: [],
    mode: options.mode ?? "fsrs",
    selectedIds: options.selectedIds ?? [],
    dailyNew: options.dailyNew ?? 10,
    now: NOW,
  });
}

/** YYYY-MM-DD för ett datum N dagar efter NOW. */
function inDays(days: number): string {
  return new Date(NOW.getTime() + days * DAY).toISOString().slice(0, 10);
}

describe("planDeckSession: urval", () => {
  it("hela kursen när inget är valt", () => {
    const p = plan();
    expect(p.selectionCount).toBe(40);
    expect(p.startHref).toBe("/d/mtt015/plugga?mode=fsrs&urval=all");
  });

  it("bara valda kategorier", () => {
    const p = plan({ selectedIds: ["k2"] });
    expect(p.selectionCount).toBe(20);
    expect(p.startHref).toContain("urval=kategori%3Ak2");
  });

  it("slumpläget går genom hela kursen även med kategorier valda", () => {
    const p = plan({ mode: "random", selectedIds: ["k1"] });
    expect(p.selectionCount).toBe(40);
    expect(p.startHref).toBe("/d/mtt015/plugga?mode=random&urval=all");
  });

  it("tentaläget tar högst EXAM_SIZE kort", () => {
    expect(plan({ mode: "exam" }).selectionCount).toBe(EXAM_SIZE);
    // Är urvalet mindre än taket är det urvalet som gäller.
    expect(plan({ mode: "exam", selectedIds: ["k1"] }).selectionCount).toBe(20);
  });

  it("kluriga kort räknar bara osäkra kort", () => {
    const progress: ProgressMap = {};
    for (const c of cards) progress[c.id] = rated(c.id, 5, 3);
    progress.c0 = rated("c0", 1, 3);
    progress.c1 = rated("c1", 2, 3);
    const p = plan({ mode: "tricky", progress });
    expect(p.selectionCount).toBe(2);
  });
});

describe("planDeckSession: dosering", () => {
  it("nya kort begränsas av dagsmålet", () => {
    const p = plan({ dailyNew: 10 });
    expect(p.sessionNew).toBe(10);
    expect(p.sessionDue).toBe(0);
    expect(p.sessionCards).toBe(10);
    expect(p.canStart).toBe(true);
  });

  it("förfallna kort doseras aldrig bort", () => {
    const progress: ProgressMap = {};
    for (const c of cards) progress[c.id] = rated(c.id, 3, -1);
    const p = plan({ progress });
    expect(p.sessionDue).toBe(40);
    expect(p.sessionNew).toBe(0);
  });

  it("slutrepetitionen tar hela urvalet", () => {
    const p = plan({ examDate: inDays(1) });
    expect(p.finalReview).toBe(true);
    expect(p.sessionNew).toBe(0);
    expect(p.sessionCards).toBe(40);
    expect(p.moreHref).toContain("&nya=");
  });

  it("nära tenta höjs takten över dagsmålet och det syns", () => {
    // 40 nya kort och 7 dagar kvar: allt ska vara introducerat fyra dagar före tentan,
    // alltså på tre dagar. Det kräver 14 kort per dag, mer än dagsmålet på 10.
    const p = plan({ examDate: inDays(7), dailyNew: 10 });
    expect(p.newCardPlan?.catchUp).toBe(true);
    expect(p.newCardPlan?.neededPerDay).toBe(14);
    expect(p.sessionNew).toBe(14);

    // Med gott om tid styr studentens eget dagsmål.
    const lugnt = plan({ examDate: inDays(30), dailyNew: 10 });
    expect(lugnt.newCardPlan?.catchUp).toBe(false);
    expect(lugnt.sessionNew).toBe(10);
  });
});

describe("planDeckSession: när det inte finns något att göra", () => {
  it("allt schemalagt framåt ger nothingDue och blockerar start", () => {
    const progress: ProgressMap = {};
    for (const c of cards) progress[c.id] = rated(c.id, 4, 3);
    const p = plan({ progress });
    expect(p.nothingDue).toBe(true);
    expect(p.canStart).toBe(false);
    expect(p.moreNew).toBe(0);
  });

  it("gäller bara schemalagt läge: fri repetition går alltid att starta", () => {
    const progress: ProgressMap = {};
    for (const c of cards) progress[c.id] = rated(c.id, 4, 3);
    const p = plan({ progress, mode: "free" });
    expect(p.nothingDue).toBe(false);
    expect(p.canStart).toBe(true);
  });

  it("tomt urval går inte att starta", () => {
    const progress: ProgressMap = {};
    for (const c of cards) progress[c.id] = rated(c.id, 5, 3);
    const p = plan({ progress, mode: "tricky" });
    expect(p.selectionCount).toBe(0);
    expect(p.canStart).toBe(false);
  });

  it("innan progress laddats doseras inget men urvalet är känt", () => {
    const p = plan({ progress: null });
    expect(p.selectionCount).toBe(40);
    expect(p.newCardPlan).toBeNull();
    expect(p.nothingDue).toBe(false);
    expect(p.canStart).toBe(true);
  });
});
