/**
 * Urval av kort för en session. Ren modul.
 */
import { buildExtraQueue, buildFinalReviewQueue, buildFsrsQueue, retrievability, shuffleIds } from "@/lib/fsrs/scheduler";
import { EXAM_SIZE } from "@/lib/study/plan";
import { isTricky, type ProgressMap, type StudyMode } from "@/lib/progress/types";
import type { CardKind } from "@/lib/cards/kinds";
import { defaultSettings, filterKinds, sizeLimit, type SessionOrder, type SessionSettings } from "@/lib/study/session-settings";

export type Selection = { kind: "all" } | { kind: "categories"; categoryIds: string[] } | { kind: "low" };

export type SelectableCard = {
  id: string;
  category_id: string | null;
  sort_order: number;
  /** Uppgiftstyp, för inställningen Uppgiftstyper. Saknas = självskattning. */
  kind?: CardKind;
};

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

/** Aldrig skattat: ingen progress, eller ingen självskattning. */
function unseen(progress: ProgressMap, id: string): boolean {
  const p = progress[id];
  return !p || p.self_rating === null;
}

/** Kort i kursens ordning (sort_order). */
function byCourseOrder(ids: readonly string[], cards: readonly SelectableCard[]): string[] {
  const pos = new Map(cards.map((c) => [c.id, c.sort_order] as const));
  return [...ids].sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0));
}

/**
 * Ett område i taget: korten grupperas per område i kursens ordning (områdets första kort),
 * och behåller kön ordning inom området. Sorteringen är stabil.
 */
function byArea(ids: readonly string[], cards: readonly SelectableCard[]): string[] {
  const areaOf = new Map(cards.map((c) => [c.id, c.category_id ?? UNCATEGORIZED_ID] as const));
  const areaPos = new Map<string, number>();
  for (const c of [...cards].sort((a, b) => a.sort_order - b.sort_order)) {
    const area = c.category_id ?? UNCATEGORIZED_ID;
    if (!areaPos.has(area)) areaPos.set(area, c.sort_order);
  }
  return [...ids].sort((a, b) => (areaPos.get(areaOf.get(a) ?? "") ?? 0) - (areaPos.get(areaOf.get(b) ?? "") ?? 0));
}

/** Fri repetition, kluriga och stjärnmärkta: svagast först, kursordning eller slumpat. */
function orderIds(ids: readonly string[], order: SessionOrder, cards: readonly SelectableCard[], progress: ProgressMap, random: () => number): string[] {
  if (order === "kurs") return byCourseOrder(ids, cards);
  if (order === "slump") return shuffleIds(ids, random);
  return orderByWeakness(ids, progress, random);
}

/**
 * Kort-id i den ordning sessionen ska visa dem.
 * - fsrs: förfallna och nya kort ur urvalet, förfallna först (blandat inom samma dag).
 *   Med onlyNew ("Ta N nya kort till"): bara nya kort, högst maxNew.
 *   Med extraSize (Plugga vidare): kort närmast att förfalla, sedan nya kort utan dos.
 * - free: urvalet, svagast först, blandat inom samma skattning.
 * - tricky: bara kluriga kort ur urvalet, svagast först, blandat inom samma skattning.
 * - random: hela decket i slumpad ordning (urvalet ignoreras).
 * - exam: examSize (standard EXAM_SIZE) slumpade kort ur urvalet, som en dugga.
 *
 * Passets inställningar (settings, se session-settings.ts) finslipar urvalet: antal kort
 * (taket tas efter ordningen, så att schemalagt behåller de förfallna och kluriga de
 * svåraste), uppgiftstyper, nya kort, ordning, osedda kluriga kort och områden i
 * slumpläget. Utan settings gäller lägets standard, alltså samma kö som tidigare.
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
  /** Dugga: antal frågor. Undefined = EXAM_SIZE. */
  examSize?: number;
  /** Schemalagt läge: Plugga vidare med så här många kort (buildExtraQueue). */
  extraSize?: number;
  /** Schemalagt läge: bara nya kort ("Ta N nya kort till"), högst maxNew. Förfallna kort ingår inte. */
  onlyNew?: boolean;
  /** Passets inställningar. Undefined = lägets standard. */
  settings?: SessionSettings;
}): string[] {
  const random = input.random ?? Math.random;
  const s = input.settings ?? defaultSettings(input.mode);
  const limit = sizeLimit(s.size);
  const cap = (ids: string[]) => (limit === undefined ? ids : ids.slice(0, limit));
  const ordered = filterKinds([...input.cards].sort((a, b) => a.sort_order - b.sort_order), s.kinds);
  if (input.mode === "random") {
    // Slumpläget går genom hela kursen, om inte studenten valt att följa de ikryssade områdena.
    const pool = s.followAreas ? filterCards(ordered, input.progress, input.selection) : ordered;
    return cap(shuffleIds(pool.map((c) => c.id), random));
  }
  const filtered = filterCards(ordered, input.progress, input.selection);
  if (input.mode === "exam") {
    const size = input.examSize ?? (input.settings ? (limit ?? Number.POSITIVE_INFINITY) : EXAM_SIZE);
    return shuffleIds(filtered.map((c) => c.id), random).slice(0, size);
  }
  if (input.mode === "fsrs") {
    const now = input.now ?? new Date();
    const isNew = (id: string) => input.progress[id] === undefined || input.progress[id]?.state === 0;
    // Utan nya kort: bara kort som redan finns i schemat. Bara nya: inga förfallna kort.
    const ids = filtered.map((c) => c.id).filter((id) => (input.onlyNew ? isNew(id) : s.newCards || !isNew(id)));
    let queue: string[];
    if (input.extraSize !== undefined) queue = buildExtraQueue(ids, input.progress, now, random, { size: input.extraSize });
    else if (input.finalReview) queue = cap(buildFinalReviewQueue(ids, input.progress, now, random));
    else queue = cap(buildFsrsQueue(ids, input.progress, now, random, { maxNew: s.newCards ? input.maxNew : 0 }));
    return s.order === "omrade" ? byArea(queue, ordered) : queue;
  }
  if (input.mode === "tricky") {
    const tricky = trickyCardsFor(filtered, input.progress, s.unseen).map((c) => c.id);
    return cap(orderIds(tricky, s.order, ordered, input.progress, random));
  }
  return cap(orderIds(filtered.map((c) => c.id), s.order, ordered, input.progress, random));
}

/**
 * Kluriga kort efter inställningen Osedda kort: med osedda (standard) alla kluriga, utan
 * bara de som skattats 1–2.
 */
export function trickyCardsFor(cards: readonly SelectableCard[], progress: ProgressMap, includeUnseen: boolean): SelectableCard[] {
  return trickyCards(cards, progress).filter((c) => includeUnseen || !unseen(progress, c.id));
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
  /** Uppskattad kunskap just nu: summan av återkallelsesannolikheter (aldrig sedda = 0). */
  known: number;
};

/** Statistik per kategori ur progressen. Kort utan kategori räknas till UNCATEGORIZED_ID om det id:t finns med. */
export function categoryStats(
  cards: readonly SelectableCard[],
  progress: ProgressMap,
  categoryIds: readonly string[],
  now: Date = new Date(),
): CategoryStats[] {
  const byId = new Map<string, CategoryStats>(
    categoryIds.map((id) => [id, { categoryId: id, total: 0, studied: 0, learned: 0, weak: 0, tricky: 0, partial: 0, known: 0 }]),
  );
  for (const card of cards) {
    const s = byId.get(card.category_id ?? UNCATEGORIZED_ID);
    if (!s) continue;
    s.total++;
    const p = progress[card.id];
    if (isTricky(p)) s.tricky++;
    if (!p) continue;
    s.studied++;
    s.known += retrievability(p, now);
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
