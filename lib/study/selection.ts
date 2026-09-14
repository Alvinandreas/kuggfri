/**
 * Urval av kort för en session. Ren modul.
 */
import { buildFsrsQueue } from "@/lib/fsrs/scheduler";
import { shuffle } from "@/lib/fsrs/session";
import type { ProgressMap, StudyMode } from "@/lib/progress/types";

export type Selection = { kind: "all" } | { kind: "categories"; categoryIds: string[] } | { kind: "low" };

export type SelectableCard = { id: string; category_id: string | null; sort_order: number };

/** Från URL-parametern `urval`: "all", "low" eller "kategori:<id>[,<id>...]". */
export function parseSelection(raw: string | string[] | undefined): Selection {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value === "all") return { kind: "all" };
  if (value === "low") return { kind: "low" };
  if (value.startsWith("kategori:")) {
    const categoryIds = value
      .slice("kategori:".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (categoryIds.length > 0) return { kind: "categories", categoryIds: [...new Set(categoryIds)] };
  }
  return { kind: "all" };
}

export function serializeSelection(selection: Selection): string {
  switch (selection.kind) {
    case "all":
      return "all";
    case "low":
      return "low";
    case "categories":
      return `kategori:${selection.categoryIds.join(",")}`;
  }
}

export function filterCards(cards: readonly SelectableCard[], progress: ProgressMap, selection: Selection): SelectableCard[] {
  switch (selection.kind) {
    case "all":
      return [...cards];
    case "categories": {
      const wanted = new Set(selection.categoryIds);
      return cards.filter((c) => c.category_id !== null && wanted.has(c.category_id));
    }
    case "low":
      return cards.filter((c) => {
        const r = progress[c.id]?.self_rating;
        return r !== undefined && r !== null && r <= 2;
      });
  }
}

/**
 * Kort-id i den ordning sessionen ska visa dem.
 * - fsrs: förfallna och nya kort ur urvalet, förfallna först.
 * - free: urvalet i deckets ordning.
 * - random: hela decket i slumpad ordning (urvalet ignoreras).
 */
export function selectCardIds(input: {
  cards: readonly SelectableCard[];
  progress: ProgressMap;
  mode: StudyMode;
  selection: Selection;
  now?: Date;
  random?: () => number;
}): string[] {
  const ordered = [...input.cards].sort((a, b) => a.sort_order - b.sort_order);
  if (input.mode === "random") {
    return shuffle(ordered.map((c) => c.id), input.random);
  }
  const filtered = filterCards(ordered, input.progress, input.selection).map((c) => c.id);
  if (input.mode === "fsrs") {
    return buildFsrsQueue(filtered, input.progress, input.now ?? new Date());
  }
  return filtered;
}

export type CategoryStats = {
  categoryId: string;
  total: number;
  /** Kort med någon progress. */
  studied: number;
  /** Kort vars senaste skattning är 5. */
  learned: number;
  /** Kort vars senaste skattning är 1–2. */
  weak: number;
};

/** Statistik per kategori ur progressen. Kort utan kategori ignoreras. */
export function categoryStats(cards: readonly SelectableCard[], progress: ProgressMap, categoryIds: readonly string[]): CategoryStats[] {
  const byId = new Map<string, CategoryStats>(categoryIds.map((id) => [id, { categoryId: id, total: 0, studied: 0, learned: 0, weak: 0 }]));
  for (const card of cards) {
    if (!card.category_id) continue;
    const s = byId.get(card.category_id);
    if (!s) continue;
    s.total++;
    const p = progress[card.id];
    if (!p) continue;
    s.studied++;
    if (p.self_rating === 5) s.learned++;
    if (p.self_rating !== null && p.self_rating <= 2) s.weak++;
  }
  return categoryIds.map((id) => byId.get(id)!);
}

/** Andel inlärt 0–1, för sortering "minst inlärt först". */
export function learnedRatio(s: CategoryStats): number {
  return s.total === 0 ? 1 : s.learned / s.total;
}
