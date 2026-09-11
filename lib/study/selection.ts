/**
 * Urval av kort för en session. Ren modul.
 */
import { buildFsrsQueue } from "@/lib/fsrs/scheduler";
import { shuffle } from "@/lib/fsrs/session";
import type { ProgressMap, StudyMode } from "@/lib/progress/types";

export type Selection = { kind: "all" } | { kind: "category"; categoryId: string } | { kind: "low" };

export type SelectableCard = { id: string; category_id: string | null; sort_order: number };

/** Från URL-parametern `urval`: "all", "low" eller "kategori:<id>". */
export function parseSelection(raw: string | string[] | undefined): Selection {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value === "all") return { kind: "all" };
  if (value === "low") return { kind: "low" };
  if (value.startsWith("kategori:")) {
    const categoryId = value.slice("kategori:".length);
    if (categoryId) return { kind: "category", categoryId };
  }
  return { kind: "all" };
}

export function serializeSelection(selection: Selection): string {
  switch (selection.kind) {
    case "all":
      return "all";
    case "low":
      return "low";
    case "category":
      return `kategori:${selection.categoryId}`;
  }
}

export function filterCards(cards: readonly SelectableCard[], progress: ProgressMap, selection: Selection): SelectableCard[] {
  switch (selection.kind) {
    case "all":
      return [...cards];
    case "category":
      return cards.filter((c) => c.category_id === selection.categoryId);
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
