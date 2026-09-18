/**
 * Urval av kort för en session. Ren modul.
 */
import { buildFinalReviewQueue, buildFsrsQueue, shuffleIds } from "@/lib/fsrs/scheduler";
import { isTricky, type ProgressMap, type StudyMode } from "@/lib/progress/types";

export type Selection = { kind: "all" } | { kind: "categories"; categoryIds: string[] } | { kind: "low" };

export type SelectableCard = { id: string; category_id: string | null; sort_order: number };

/**
 * Pseudo-id för kort som saknar kategori. Låter studenten välja och se statistik för dem
 * precis som för en riktig kategori (samma id används i adminens URL:er).
 */
export const UNCATEGORIZED_ID = "ingen";

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
      return cards.filter((c) => wanted.has(c.category_id ?? UNCATEGORIZED_ID));
    }
    case "low":
      return cards.filter((c) => {
        const r = progress[c.id]?.self_rating;
        return r !== undefined && r !== null && r <= 2;
      });
  }
}

/** Kort som räknas som kluriga: aldrig skattade eller senast 1–2. */
export function trickyCards(cards: readonly SelectableCard[], progress: ProgressMap): SelectableCard[] {
  return cards.filter((c) => isTricky(progress[c.id]));
}

/**
 * Sorteringsnyckel för fri repetition och kluriga kort: svagast först.
 * 1, 2, aldrig skattat, 3, 4, 5. Kort i samma grupp blandas.
 */
function ratingGroup(progress: ProgressMap, id: string): number {
  const r = progress[id]?.self_rating ?? null;
  if (r === null) return 2.5;
  return r;
}

function orderByWeakness(ids: readonly string[], progress: ProgressMap, random: () => number): string[] {
  const groups = new Map<number, string[]>();
  for (const id of ids) {
    const g = ratingGroup(progress, id);
    groups.set(g, [...(groups.get(g) ?? []), id]);
  }
  return [...groups.keys()].sort((a, b) => a - b).flatMap((g) => shuffleIds(groups.get(g) ?? [], random));
}

/**
 * Kort-id i den ordning sessionen ska visa dem.
 * - fsrs: förfallna och nya kort ur urvalet, förfallna först (blandat inom samma dag).
 * - free: urvalet, svagast först, blandat inom samma skattning.
 * - tricky: bara kluriga kort ur urvalet, svagast först, blandat inom samma skattning.
 * - random: hela decket i slumpad ordning (urvalet ignoreras).
 */
export function selectCardIds(input: {
  cards: readonly SelectableCard[];
  progress: ProgressMap;
  mode: StudyMode;
  selection: Selection;
  now?: Date;
  random?: () => number;
  /** Schemalagt läge: tak på nya kort i sessionen (dosering). Undefined = inget tak. */
  maxNew?: number;
  /** Schemalagt läge de sista dagarna före tentan: alla kort, svagast först. */
  finalReview?: boolean;
}): string[] {
  const random = input.random ?? Math.random;
  const ordered = [...input.cards].sort((a, b) => a.sort_order - b.sort_order);
  if (input.mode === "random") {
    return shuffleIds(ordered.map((c) => c.id), random);
  }
  const filtered = filterCards(ordered, input.progress, input.selection);
  if (input.mode === "fsrs") {
    const ids = filtered.map((c) => c.id);
    if (input.finalReview) return buildFinalReviewQueue(ids, input.progress, input.now ?? new Date(), random);
    return buildFsrsQueue(ids, input.progress, input.now ?? new Date(), random, { maxNew: input.maxNew });
  }
  if (input.mode === "tricky") {
    return orderByWeakness(trickyCards(filtered, input.progress).map((c) => c.id), input.progress, random);
  }
  return orderByWeakness(filtered.map((c) => c.id), input.progress, random);
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
  /** Kluriga kort: 1–2 eller aldrig skattade. */
  tricky: number;
  /** Skattning 3–4: på väg, men inte inlärt (5). */
  partial: number;
};

/** Statistik per kategori ur progressen. Kort utan kategori räknas till UNCATEGORIZED_ID om det id:t finns med. */
export function categoryStats(cards: readonly SelectableCard[], progress: ProgressMap, categoryIds: readonly string[]): CategoryStats[] {
  const byId = new Map<string, CategoryStats>(
    categoryIds.map((id) => [id, { categoryId: id, total: 0, studied: 0, learned: 0, weak: 0, tricky: 0, partial: 0 }]),
  );
  for (const card of cards) {
    const s = byId.get(card.category_id ?? UNCATEGORIZED_ID);
    if (!s) continue;
    s.total++;
    const p = progress[card.id];
    if (isTricky(p)) s.tricky++;
    if (!p) continue;
    s.studied++;
    if (p.self_rating === 5) s.learned++;
    if (p.self_rating === 3 || p.self_rating === 4) s.partial++;
    if (p.self_rating !== null && p.self_rating <= 2) s.weak++;
  }
  return categoryIds.map((id) => byId.get(id)!);
}

/** Andel inlärt 0–1, för sortering "minst inlärt först". */
export function learnedRatio(s: CategoryStats): number {
  return s.total === 0 ? 1 : s.learned / s.total;
}
