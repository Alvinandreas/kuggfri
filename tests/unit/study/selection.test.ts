import { describe, expect, it } from "vitest";
import { filterCards, parseSelection, selectCardIds, serializeSelection, type SelectableCard } from "@/lib/study/selection";
import { reviewCard } from "@/lib/fsrs/scheduler";
import type { ProgressMap } from "@/lib/progress/types";

const NOW = new Date("2026-09-11T08:00:00Z");
const cards: SelectableCard[] = [
  { id: "c", category_id: "k2", sort_order: 2 },
  { id: "a", category_id: "k1", sort_order: 0 },
  { id: "b", category_id: "k1", sort_order: 1 },
  { id: "d", category_id: null, sort_order: 3 },
];

describe("parseSelection / serializeSelection", () => {
  it("tolkar URL-parametern", () => {
    expect(parseSelection(undefined)).toEqual({ kind: "all" });
    expect(parseSelection("all")).toEqual({ kind: "all" });
    expect(parseSelection("low")).toEqual({ kind: "low" });
    expect(parseSelection("kategori:k1")).toEqual({ kind: "category", categoryId: "k1" });
    expect(parseSelection("kategori:")).toEqual({ kind: "all" });
    expect(parseSelection("skräp")).toEqual({ kind: "all" });
    expect(parseSelection(["low", "all"])).toEqual({ kind: "low" });
  });

  it("serialiserar tillbaka", () => {
    for (const raw of ["all", "low", "kategori:k1"]) {
      expect(serializeSelection(parseSelection(raw))).toBe(raw);
    }
  });
});

describe("filterCards", () => {
  it("filtrerar på kategori och låg skattning", () => {
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 1, NOW),
      b: reviewCard("b", undefined, 4, NOW),
      c: reviewCard("c", undefined, 2, NOW),
    };
    expect(filterCards(cards, progress, { kind: "category", categoryId: "k1" }).map((c) => c.id)).toEqual(["a", "b"]);
    expect(filterCards(cards, progress, { kind: "low" }).map((c) => c.id)).toEqual(["c", "a"]);
    expect(filterCards(cards, {}, { kind: "low" })).toEqual([]);
  });
});

describe("selectCardIds", () => {
  it("fri repetition ger urvalet i deckets ordning", () => {
    expect(selectCardIds({ cards, progress: {}, mode: "free", selection: { kind: "all" } })).toEqual(["a", "b", "c", "d"]);
    expect(selectCardIds({ cards, progress: {}, mode: "free", selection: { kind: "category", categoryId: "k1" } })).toEqual(["a", "b"]);
  });

  it("schemalagd repetition tar bara förfallna och nya kort, förfallna först", () => {
    const later = new Date(NOW.getTime() + 3 * 24 * 3600 * 1000);
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 5, NOW), // inte förfallet om 3 dagar
      b: reviewCard("b", undefined, 1, NOW), // förfallet
    };
    expect(selectCardIds({ cards, progress, mode: "fsrs", selection: { kind: "all" }, now: later })).toEqual(["b", "c", "d"]);
  });

  it("slumpad genomkörning tar hela decket oavsett urval", () => {
    const seq = [0.9, 0.1, 0.5, 0.3];
    let i = 0;
    const random = () => seq[i++ % seq.length] ?? 0;
    const ids = selectCardIds({ cards, progress: {}, mode: "random", selection: { kind: "category", categoryId: "k1" }, random });
    expect([...ids].sort()).toEqual(["a", "b", "c", "d"]);
    expect(ids).not.toEqual(["a", "b", "c", "d"]);
  });
});
