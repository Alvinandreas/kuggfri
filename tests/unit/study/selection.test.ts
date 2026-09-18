import { describe, expect, it } from "vitest";
import {
  categoryStats,
  filterCards,
  learnedRatio,
  parseSelection,
  selectCardIds,
  serializeSelection,
  trickyCards,
  UNCATEGORIZED_ID,
  type SelectableCard,
} from "@/lib/study/selection";
import { reviewCard } from "@/lib/fsrs/scheduler";
import type { ProgressMap } from "@/lib/progress/types";

const NOW = new Date("2026-09-11T08:00:00Z");
const cards: SelectableCard[] = [
  { id: "c", category_id: "k2", sort_order: 2 },
  { id: "a", category_id: "k1", sort_order: 0 },
  { id: "b", category_id: "k1", sort_order: 1 },
  { id: "d", category_id: null, sort_order: 3 },
];

/** Deterministisk "slump" som lämnar ordningen orörd (returnerar alltid 0.999…). */
const keepOrder = () => 0.999999;

describe("parseSelection / serializeSelection", () => {
  it("tolkar URL-parametern", () => {
    expect(parseSelection(undefined)).toEqual({ kind: "all" });
    expect(parseSelection("all")).toEqual({ kind: "all" });
    expect(parseSelection("low")).toEqual({ kind: "low" });
    expect(parseSelection("kategori:k1")).toEqual({ kind: "categories", categoryIds: ["k1"] });
    expect(parseSelection("kategori:k1,k2,k1")).toEqual({ kind: "categories", categoryIds: ["k1", "k2"] });
    expect(parseSelection("kategori:")).toEqual({ kind: "all" });
    expect(parseSelection("skräp")).toEqual({ kind: "all" });
    expect(parseSelection(["low", "all"])).toEqual({ kind: "low" });
  });

  it("serialiserar tillbaka", () => {
    for (const raw of ["all", "low", "kategori:k1", "kategori:k1,k2"]) {
      expect(serializeSelection(parseSelection(raw))).toBe(raw);
    }
  });
});

describe("filterCards / trickyCards", () => {
  it("filtrerar på en eller flera kategorier och på låg skattning", () => {
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 1, NOW),
      b: reviewCard("b", undefined, 4, NOW),
      c: reviewCard("c", undefined, 2, NOW),
    };
    expect(filterCards(cards, progress, { kind: "categories", categoryIds: ["k1"] }).map((c) => c.id)).toEqual(["a", "b"]);
    expect(filterCards(cards, progress, { kind: "categories", categoryIds: ["k1", "k2"] }).map((c) => c.id)).toEqual(["c", "a", "b"]);
    expect(filterCards(cards, progress, { kind: "low" }).map((c) => c.id)).toEqual(["c", "a"]);
    expect(filterCards(cards, {}, { kind: "low" })).toEqual([]);
  });

  it("kluriga kort är låg skattning eller aldrig sedda", () => {
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 1, NOW),
      b: reviewCard("b", undefined, 4, NOW),
    };
    expect(trickyCards(cards, progress).map((c) => c.id)).toEqual(["c", "a", "d"]);
    expect(trickyCards(cards, {}).map((c) => c.id)).toEqual(["c", "a", "b", "d"]);
  });
});

describe("selectCardIds", () => {
  it("fri repetition ger svagast först: 1, 2, aldrig sedda, 3, 4, 5", () => {
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 5, NOW),
      b: reviewCard("b", undefined, 2, NOW),
      c: reviewCard("c", undefined, 1, NOW),
    };
    expect(selectCardIds({ cards, progress, mode: "free", selection: { kind: "all" }, random: keepOrder })).toEqual(["c", "b", "d", "a"]);
    expect(selectCardIds({ cards, progress: {}, mode: "free", selection: { kind: "categories", categoryIds: ["k1"] }, random: keepOrder })).toEqual(["a", "b"]);
  });

  it("blandar kort inom samma grupp", () => {
    const seq = [0.9, 0.1, 0.5, 0.3, 0.7];
    let i = 0;
    const random = () => seq[i++ % seq.length] ?? 0;
    const ids = selectCardIds({ cards, progress: {}, mode: "free", selection: { kind: "all" }, random });
    expect([...ids].sort()).toEqual(["a", "b", "c", "d"]);
    expect(ids).not.toEqual(["a", "b", "c", "d"]);
  });

  it("kluriga kort tar bara låga och osedda kort, svagast först", () => {
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 5, NOW),
      b: reviewCard("b", undefined, 2, NOW),
      c: reviewCard("c", undefined, 1, NOW),
    };
    expect(selectCardIds({ cards, progress, mode: "tricky", selection: { kind: "all" }, random: keepOrder })).toEqual(["c", "b", "d"]);
    expect(selectCardIds({ cards, progress, mode: "tricky", selection: { kind: "categories", categoryIds: ["k1"] }, random: keepOrder })).toEqual(["b"]);
  });

  it("schemalagd repetition tar bara förfallna och nya kort, förfallna först", () => {
    const later = new Date(NOW.getTime() + 3 * 24 * 3600 * 1000);
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 5, NOW), // inte förfallet om 3 dagar
      b: reviewCard("b", undefined, 1, NOW), // förfallet
    };
    expect(selectCardIds({ cards, progress, mode: "fsrs", selection: { kind: "all" }, now: later, random: keepOrder })).toEqual(["b", "c", "d"]);
  });

  it("provtentan tar högst 30 slumpade kort ur urvalet och rör inte ordningen i övrigt", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `k${i}`, category_id: i < 25 ? "c1" : "c2", sort_order: i }));
    const all = selectCardIds({ cards: many, progress: {}, mode: "exam", selection: { kind: "all" }, random: () => 0.5 });
    expect(all).toHaveLength(30);
    expect(new Set(all).size).toBe(30);
    const one = selectCardIds({ cards: many, progress: {}, mode: "exam", selection: { kind: "categories", categoryIds: ["c2"] } });
    expect(one).toHaveLength(25);
    expect(one.every((id) => Number(id.slice(1)) >= 25)).toBe(true);
  });

  it("slumpad genomkörning tar hela decket oavsett urval", () => {
    const seq = [0.9, 0.1, 0.5, 0.3];
    let i = 0;
    const random = () => seq[i++ % seq.length] ?? 0;
    const ids = selectCardIds({ cards, progress: {}, mode: "random", selection: { kind: "categories", categoryIds: ["k1"] }, random });
    expect([...ids].sort()).toEqual(["a", "b", "c", "d"]);
    expect(ids).not.toEqual(["a", "b", "c", "d"]);
  });
});

describe("categoryStats", () => {
  it("räknar studerade, inlärda, svaga och kluriga kort per kategori", () => {
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 5, NOW),
      b: reviewCard("b", undefined, 2, NOW),
    };
    const stats = categoryStats(cards, progress, ["k1", "k2"], NOW);
    expect(stats).toEqual([
      { categoryId: "k1", total: 2, studied: 2, learned: 1, weak: 1, tricky: 1, partial: 0, known: 2 },
      { categoryId: "k2", total: 1, studied: 0, learned: 0, weak: 0, tricky: 1, partial: 0, known: 0 },
    ]);
    expect(learnedRatio(stats[0]!)).toBe(0.5);
    expect(learnedRatio({ categoryId: "x", total: 0, studied: 0, learned: 0, weak: 0, tricky: 0, partial: 0, known: 0 })).toBe(1);
  });
});

describe("kort utan kategori", () => {
  it("väljs via UNCATEGORIZED_ID och räknas i statistiken när id:t finns med", () => {
    expect(filterCards(cards, {}, { kind: "categories", categoryIds: [UNCATEGORIZED_ID] }).map((c) => c.id)).toEqual(["d"]);
    expect(filterCards(cards, {}, { kind: "categories", categoryIds: ["k1"] }).map((c) => c.id)).toEqual(["a", "b"]);
    const stats = categoryStats(cards, {}, ["k1", UNCATEGORIZED_ID]);
    expect(stats.map((s) => [s.categoryId, s.total])).toEqual([
      ["k1", 2],
      [UNCATEGORIZED_ID, 1],
    ]);
    // Utan id:t ignoreras korten som tidigare.
    expect(categoryStats(cards, {}, ["k1"]).map((s) => s.total)).toEqual([2]);
  });
});
