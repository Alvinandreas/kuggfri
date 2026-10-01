/**
 * Ren logik för granskningen och innehållsöversikten i admin. Inga beroenden på React eller
 * Supabase, så allt här kan enhetstestas.
 *
 * Granskningen är en inkorg med fyra flikar (Alvins beslut 1 okt). Varje kort har exakt ett
 * granskningsläge, och flaggan är en egen dimension ovanpå:
 * - Att granska: kort i rotation som ingen examinator godkänt ännu (aktiva, utan status, utan
 *   granskningsdatum), och utkast utanför rotation (nya kort efter lanseringen).
 * - Granskade: kort i rotation som en examinator godkänt, senast granskade först.
 * - Ur rotation: kort som tagits ur rotation i granskningen (status avvisad).
 * - Flaggade: alla kort med en flagga, oavsett läge (utom ur rotation). Ett flaggat kort står
 *   alltså både här och under sitt läge; fliken är ett sätt att gå igenom flaggorna för sig.
 *
 * Godkännandet är granskningsdatumet: ändras ett korts innehåll utan att det godkänns i samma
 * uppdatering nollställs datumet av databasen (triggern cards_review_reset), så att kortet
 * granskas igen.
 *
 * Terminologi: ett kort hör till ett OMRÅDE (tabellen categories) och har en UPPGIFTSTYP.
 */
import { CARD_KINDS, isAutoGraded, validateKind, type CardKind, type CardOption } from "@/lib/cards/kinds";
import { matchesSource, type SourceFilter } from "@/lib/admin/sources";
import { oneLine } from "@/lib/text/one-line";
import type { CardTranslation } from "@/lib/supabase/database.types";
import { stockholmDayHeading, stockholmDayKey, stockholmRelativeDay, stockholmTime } from "@/lib/time/stockholm";

/** Det granskningen behöver veta om ett kort. CardRow uppfyller typen (utom de valfria fälten). */
export type ReviewCard = {
  id: string;
  category_id: string | null;
  front: string;
  back: string;
  hint: string | null;
  kind: CardKind;
  options: CardOption[] | null;
  is_active: boolean;
  review_status: "utkast" | "avvisad" | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  source: string | null;
  sort_order: number;
  created_at: string;
  /** Del av originaluppsättningen. */
  original?: boolean;
  flag_note: string | null;
  flagged_at: string | null;
  flagged_by: string | null;
  /** Engelsk översättning för granskningen (lib/cards/translation.ts). */
  translation_en?: CardTranslation | null;
  /**
   * Utkastet ändrar ett kort som varit publicerat (t.ex. ett rättat originalkort): id:t på den
   * senast publicerade versionen, som Avvisa återställer. Saknas för nya kort.
   */
  published_version_id?: number | null;
};

export type ReviewArea = { id: string; title: string; title_en?: string | null };

// ---------------------------------------------------------------------------
// Flikar
// ---------------------------------------------------------------------------

export const REVIEW_TABS = ["att-granska", "granskade", "flaggade", "ur-rotation"] as const;
export type ReviewTab = (typeof REVIEW_TABS)[number];

export function isReviewTab(value: unknown): value is ReviewTab {
  return typeof value === "string" && (REVIEW_TABS as readonly string[]).includes(value);
}

type TabFields = Pick<ReviewCard, "review_status" | "is_active" | "flag_note" | "reviewed_at">;

export type ReviewState = Exclude<ReviewTab, "flaggade">;

/** Kortets granskningsläge, eller null om det inte hör till granskningen (inaktiverat utanför den). */
export function reviewTab(card: TabFields): ReviewState | null {
  if (card.review_status === "avvisad") return "ur-rotation";
  if (card.review_status === "utkast") return "att-granska";
  if (card.review_status === null && card.is_active) return card.reviewed_at ? "granskade" : "att-granska";
  return null;
}

/** Står kortet under fliken? Ett flaggat kort står både under Flaggade och under sitt läge. */
export function inTab(card: TabFields, tab: ReviewTab): boolean {
  const state = reviewTab(card);
  if (tab === "flaggade") return Boolean(card.flag_note) && state !== null && state !== "ur-rotation";
  return state === tab;
}

/** Ett kort i rotation som ingen examinator godkänt ännu. */
export function isUnreviewed(card: TabFields): boolean {
  return card.review_status === null && card.is_active && !card.reviewed_at;
}

/** Korten som granskningen överhuvudtaget visar. */
export function reviewRelevant<C extends TabFields>(cards: readonly C[]): C[] {
  return cards.filter((c) => reviewTab(c) !== null);
}

/** Antal kort under varje flik. */
export function countByTab(cards: readonly TabFields[]): Record<ReviewTab, number> {
  const out: Record<ReviewTab, number> = { "att-granska": 0, granskade: 0, flaggade: 0, "ur-rotation": 0 };
  for (const c of cards) for (const tab of REVIEW_TABS) if (inTab(c, tab)) out[tab]++;
  return out;
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

/** "alla" = inget filter, "ingen" = kort utan område. */
export type AreaFilter = "alla" | "ingen" | (string & {});
export type KindFilter = "alla" | CardKind;
/** Originalkort (den beprövade uppsättningen) eller nya kort. */
export const ORIGIN_FILTERS = ["alla", "original", "nya"] as const;
export type OriginFilter = (typeof ORIGIN_FILTERS)[number];

export function isOriginFilter(value: unknown): value is OriginFilter {
  return typeof value === "string" && (ORIGIN_FILTERS as readonly string[]).includes(value);
}

export type ReviewFilter = {
  area: AreaFilter;
  kind: KindFilter;
  source: SourceFilter;
  origin: OriginFilter;
  /** Fritext: söker i fråga, svar, alternativ, ledtråd, källa och flagga. */
  query: string;
};

export const DEFAULT_REVIEW_FILTER: ReviewFilter = { area: "alla", kind: "alla", source: "alla", origin: "alla", query: "" };

/** Antal aktiva filter (sökningen räknas inte; den syns i sökrutan). */
export function activeFilterCount(filter: ReviewFilter): number {
  return [filter.area !== "alla", filter.kind !== "alla", filter.source !== "alla", filter.origin !== "alla"].filter(Boolean).length;
}

function norm(text: string): string {
  return text.toLocaleLowerCase("sv-SE");
}

type FilterFields = Pick<ReviewCard, "category_id" | "kind" | "source" | "original" | "front" | "back" | "hint" | "options" | "flag_note" | "translation_en">;

export function matchesReviewFilter(card: FilterFields, filter: ReviewFilter): boolean {
  if (filter.area === "ingen" ? card.category_id !== null : filter.area !== "alla" && card.category_id !== filter.area) return false;
  if (filter.kind !== "alla" && card.kind !== filter.kind) return false;
  if (!matchesSource(card, filter.source)) return false;
  if (filter.origin === "original" && !card.original) return false;
  if (filter.origin === "nya" && card.original) return false;
  const words = norm(filter.query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  // Den engelska översättningen räknas också, så att en examinator kan söka på engelska.
  const en = card.translation_en;
  const english = en ? [en.front, en.back, en.hint ?? "", ...(en.options ?? [])] : [];
  const haystack = norm([card.front, card.back, card.hint ?? "", ...(card.options ?? []).map((o) => o.text), card.source ?? "", card.flag_note ?? "", ...english].join("\n"));
  return words.every((w) => haystack.includes(w));
}

// ---------------------------------------------------------------------------
// Ordning och gruppering
// ---------------------------------------------------------------------------

/**
 * Sorterar korten som områdena är ordnade (kort utan område eller med okänt område sist),
 * inom området på sort_order och sedan skapelsetid.
 */
export function orderByArea<C extends Pick<ReviewCard, "category_id" | "sort_order" | "created_at">>(cards: readonly C[], areas: readonly ReviewArea[]): C[] {
  const rank = new Map(areas.map((a, i) => [a.id, i] as const));
  const areaRank = (c: C) => (c.category_id !== null && rank.has(c.category_id) ? rank.get(c.category_id)! : areas.length);
  return [...cards].sort((a, b) => areaRank(a) - areaRank(b) || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

/**
 * Korten under en flik med filtret, i områdenas ordning (listan visar ett område i taget, och
 * ett område kan gås igenom i ett svep). Under Granskade står det senast granskade kortet först
 * inom varje område.
 */
export function reviewList<C extends ReviewCard>(cards: readonly C[], tab: ReviewTab, filter: ReviewFilter, areas: readonly ReviewArea[]): C[] {
  const ordered = orderByArea(
    cards.filter((c) => inTab(c, tab) && matchesReviewFilter(c, filter)),
    areas,
  );
  if (tab !== "granskade") return ordered;
  const rank = new Map(areas.map((a, i) => [a.id, i] as const));
  const areaRank = (c: C) => (c.category_id !== null && rank.has(c.category_id) ? rank.get(c.category_id)! : areas.length);
  const time = (c: C) => (c.reviewed_at ? Date.parse(c.reviewed_at) : 0);
  // Stabil sortering: samma tidpunkt (massgodkännande) behåller ordningen inom området.
  return [...ordered].sort((a, b) => areaRank(a) - areaRank(b) || time(b) - time(a));
}

export type AreaGroup<C> = { areaId: string | null; title: string | null; cards: C[] };

/**
 * Grupperar redan ordnade kort per område. Titel null = utan område (vyn sätter texten).
 * Tomma grupper tas inte med.
 */
export function groupByArea<C extends Pick<ReviewCard, "category_id">>(orderedCards: readonly C[], areas: readonly ReviewArea[]): AreaGroup<C>[] {
  const title = new Map(areas.map((a) => [a.id, a.title] as const));
  const groups: AreaGroup<C>[] = [];
  for (const card of orderedCards) {
    const areaId = card.category_id !== null && title.has(card.category_id) ? card.category_id : null;
    let group = groups.find((g) => g.areaId === areaId);
    if (!group) {
      group = { areaId, title: areaId ? title.get(areaId)! : null, cards: [] };
      groups.push(group);
    }
    group.cards.push(card);
  }
  return groups;
}

/** En grupp i inkorgens lista: ett område (null = utan område), med en nyckel för vyn. */
export type ListGroup<C> = { key: string; areaId: string | null; title: string | null; cards: C[] };

/** Listans grupper för redan ordnade kort (reviewList): ett område per grupp, i alla flikar. */
export function groupReviewList<C extends ReviewCard>(orderedCards: readonly C[], areas: readonly ReviewArea[]): ListGroup<C>[] {
  return groupByArea(orderedCards, areas).map((g) => ({ key: g.areaId ?? "ingen", ...g }));
}

/** Gruppnyckeln för ett kort (samma som groupReviewList ger). */
export function groupKey(card: Pick<ReviewCard, "category_id">, areas: readonly ReviewArea[]): string {
  return card.category_id !== null && areas.some((a) => a.id === card.category_id) ? card.category_id : "ingen";
}

// ---------------------------------------------------------------------------
// Datum (alltid i svensk tid, så att server och klient visar samma sak)
// ---------------------------------------------------------------------------

/** Dagen (ÅÅÅÅ-MM-DD) i svensk tid. */
export function stockholmDay(iso: string): string {
  return stockholmDayKey(iso);
}

/** "30 sep", med år om det inte är i år ("30 sep 2025"). Månaden utan punkt. */
export function formatDay(iso: string, now: number): string {
  return stockholmDayHeading(iso, now);
}

/** Klockslaget ("14:32") i svensk tid. */
export function formatTime(iso: string): string {
  return stockholmTime(iso);
}

/** Relativ dag: "today", "yesterday" eller null (vyn sätter texten). */
export function relativeDay(iso: string, now: number): "today" | "yesterday" | null {
  return stockholmRelativeDay(iso, now);
}

// ---------------------------------------------------------------------------
// Navigering och beslut
// ---------------------------------------------------------------------------

/**
 * Vart vyn går efter ett beslut: första kortet i den nya listan som låg efter det aktuella
 * i den gamla, annars det sista före (inget runt), annars inget.
 */
export function nextAfterDecision(before: readonly string[], after: readonly string[], currentId: string): string | null {
  const start = before.indexOf(currentId);
  const remaining = new Set(after);
  if (start >= 0) {
    for (let i = start + 1; i < before.length; i++) {
      const id = before[i]!;
      if (id !== currentId && remaining.has(id)) return id;
    }
    for (let i = start - 1; i >= 0; i--) {
      const id = before[i]!;
      if (id !== currentId && remaining.has(id)) return id;
    }
  }
  return after.find((id) => id !== currentId) ?? null;
}

/** Steg till föregående (-1) eller nästa (1) kort i listan, utan att gå runt. */
export function step(ids: readonly string[], currentId: string | null, delta: -1 | 1): string | null {
  if (ids.length === 0) return null;
  const i = currentId === null ? -1 : ids.indexOf(currentId);
  if (i === -1) return ids[0]!;
  const to = i + delta;
  return to >= 0 && to < ids.length ? ids[to]! : ids[i]!;
}

/** Problem som hindrar att kortet godkänns: tomma sidor eller fel i typ och alternativ. */
export function approvalIssues(card: Pick<ReviewCard, "front" | "back" | "kind" | "options">): string[] {
  const issues: string[] = [];
  if (!card.front.trim()) issues.push("Frågan är tom.");
  if (!card.back.trim()) issues.push(isAutoGraded(card.kind) ? "Förklaringen är tom." : "Svaret är tomt.");
  return [...issues, ...validateKind(card.kind, card.options)];
}

/** En flaggas anteckning: en rad, utan omgivande blanksteg (samma form som i kortfilerna). */
export function cleanFlagNote(note: string): string {
  return oneLine(note);
}

// ---------------------------------------------------------------------------
// Beslutens fält (samma på klienten, som visar beslutet direkt, och på servern)
// ---------------------------------------------------------------------------

/** Fälten som tar bort en flagga. */
export const NO_FLAG = { flag_note: null, flagged_at: null, flagged_by: null } as const;

type DecisionPatch = Pick<ReviewCard, "review_status" | "is_active" | "reviewed_by" | "reviewed_at" | "flag_note" | "flagged_at" | "flagged_by">;

/** Godkänt: utan status, aktivt (i rotation), granskat av userId vid reviewedAt, och utan flagga. */
export function approvedPatch(userId: string, reviewedAt: string): DecisionPatch & { review_status: null; is_active: true } {
  return { review_status: null, is_active: true, reviewed_by: userId, reviewed_at: reviewedAt, ...NO_FLAG };
}

/** Avvisat: status avvisad med kommentaren (tom blir null), inaktivt, granskat av userId vid reviewedAt, och utan flagga. */
export function rejectedPatch(userId: string, reviewedAt: string, note: string): DecisionPatch & { review_status: "avvisad"; is_active: false; review_note: string | null } {
  return { review_status: "avvisad", review_note: note || null, is_active: false, reviewed_by: userId, reviewed_at: reviewedAt, ...NO_FLAG };
}

// ---------------------------------------------------------------------------
// Innehållsöversikten: område × uppgiftstyp
// ---------------------------------------------------------------------------

export type MatrixRow = {
  areaId: string | null;
  title: string | null;
  /** Aktiva, granskade kort per uppgiftstyp. */
  byKind: Record<CardKind, number>;
  active: number;
  /** Utkast som väntar på granskning. */
  drafts: number;
};

export type ContentMatrix = { rows: MatrixRow[]; total: MatrixRow };

function emptyRow(areaId: string | null, title: string | null): MatrixRow {
  return { areaId, title, byKind: Object.fromEntries(CARD_KINDS.map((k) => [k, 0])) as Record<CardKind, number>, active: 0, drafts: 0 };
}

/**
 * Matrisen i Innehåll: en rad per område (i områdenas ordning, även tomma), en rad för kort
 * utan område om det finns några, och en summarad. Inaktiva och avvisade kort räknas inte.
 */
export function contentMatrix(cards: readonly Pick<ReviewCard, "category_id" | "kind" | "is_active" | "review_status">[], areas: readonly ReviewArea[]): ContentMatrix {
  const rows = new Map<string | null, MatrixRow>(areas.map((a) => [a.id, emptyRow(a.id, a.title)] as const));
  const total = emptyRow(null, null);
  for (const c of cards) {
    const key = c.category_id !== null && rows.has(c.category_id) ? c.category_id : null;
    const counts = c.review_status === "utkast" || (c.review_status === null && c.is_active);
    if (!counts) continue;
    let row = rows.get(key);
    if (!row) {
      row = emptyRow(null, null);
      rows.set(null, row);
    }
    if (c.review_status === "utkast") {
      row.drafts++;
      total.drafts++;
    } else {
      row.byKind[c.kind]++;
      row.active++;
      total.byKind[c.kind]++;
      total.active++;
    }
  }
  const ordered = areas.map((a) => rows.get(a.id)!);
  const none = rows.get(null);
  if (none) ordered.push(none);
  return { rows: ordered, total };
}

// ---------------------------------------------------------------------------
// Granskningsläget per område (panelen i Översikt)
// ---------------------------------------------------------------------------

export type ReviewProgressRow = {
  areaId: string;
  title: string;
  title_en?: string | null;
  /** Godkända av en examinator (fliken Granskade). */
  approved: number;
  /** Väntar på granskning (fliken Att granska). */
  toReview: number;
  /** Flaggade (ingår också i sitt läge ovan). */
  flagged: number;
  /** Tagna ur rotation i granskningen. */
  removed: number;
};

export type ReviewProgress = {
  rows: ReviewProgressRow[];
  total: Omit<ReviewProgressRow, "areaId" | "title" | "title_en">;
};

const PROGRESS_KEY: Record<ReviewState, "approved" | "toReview" | "removed"> = {
  granskade: "approved",
  "att-granska": "toReview",
  "ur-rotation": "removed",
};

/**
 * Hur långt granskningen har kommit i varje område, i områdenas ordning, efter flikarna i
 * granskningen. Kort utan område och kort utanför granskningen räknas inte.
 */
export function reviewProgress(cards: readonly (TabFields & Pick<ReviewCard, "category_id">)[], areas: readonly ReviewArea[]): ReviewProgress {
  const empty = () => ({ approved: 0, toReview: 0, flagged: 0, removed: 0 });
  const rows = new Map<string, ReviewProgressRow>(areas.map((a) => [a.id, { areaId: a.id, title: a.title, title_en: a.title_en ?? null, ...empty() }]));
  const total = empty();
  for (const c of cards) {
    const row = c.category_id === null ? undefined : rows.get(c.category_id);
    const state = reviewTab(c);
    if (!row || !state) continue;
    row[PROGRESS_KEY[state]]++;
    total[PROGRESS_KEY[state]]++;
    if (inTab(c, "flaggade")) {
      row.flagged++;
      total.flagged++;
    }
  }
  return { rows: areas.map((a) => rows.get(a.id)!), total };
}
