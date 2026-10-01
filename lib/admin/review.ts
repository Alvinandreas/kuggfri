/**
 * Ren logik för granskningen och innehållsöversikten i admin. Inga beroenden på React eller
 * Supabase, så allt här kan enhetstestas.
 *
 * Granskningen är en inkorg med tre flikar (Alvins beslut 30 sep):
 * - Att granska: utkast som inte är flaggade. De är inte i rotation (inaktiva, dolda för
 *   studenterna) förrän en examinator godkänt dem.
 * - Granskade: kort i rotation (aktiva, utan status), senast granskade först. Oförändrade
 *   originalkort har inget granskningsdatum och står sist, som beprövade originalkort.
 * - Flaggade: kort med en flagga, oavsett status. En flagga är en anteckning om ett misstänkt
 *   fel; kortet står bara här tills flaggan åtgärdats.
 *
 * Terminologi: ett kort hör till ett OMRÅDE (tabellen categories) och har en UPPGIFTSTYP.
 */
import { CARD_KINDS, isAutoGraded, validateKind, type CardKind, type CardOption } from "@/lib/cards/kinds";
import { matchesSource, type SourceFilter } from "@/lib/admin/sources";
import { oneLine } from "@/lib/text/one-line";
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
  /**
   * Utkastet ändrar ett kort som varit publicerat (t.ex. ett rättat originalkort): id:t på den
   * senast publicerade versionen, som Avvisa återställer. Saknas för nya kort.
   */
  published_version_id?: number | null;
};

export type ReviewArea = { id: string; title: string };

// ---------------------------------------------------------------------------
// Flikar
// ---------------------------------------------------------------------------

export const REVIEW_TABS = ["att-granska", "granskade", "flaggade"] as const;
export type ReviewTab = (typeof REVIEW_TABS)[number];

export function isReviewTab(value: unknown): value is ReviewTab {
  return typeof value === "string" && (REVIEW_TABS as readonly string[]).includes(value);
}

type TabFields = Pick<ReviewCard, "review_status" | "is_active" | "flag_note">;

/** Fliken kortet står under, eller null om det inte hör till granskningen (inaktivt eller avvisat). */
export function reviewTab(card: TabFields): ReviewTab | null {
  if (card.flag_note) return "flaggade";
  if (card.review_status === "utkast") return "att-granska";
  if (card.review_status === null && card.is_active) return "granskade";
  return null;
}

/** Korten som granskningen överhuvudtaget visar. */
export function reviewRelevant<C extends TabFields>(cards: readonly C[]): C[] {
  return cards.filter((c) => reviewTab(c) !== null);
}

/** Antal kort under varje flik. */
export function countByTab(cards: readonly TabFields[]): Record<ReviewTab, number> {
  const out: Record<ReviewTab, number> = { "att-granska": 0, granskade: 0, flaggade: 0 };
  for (const c of cards) {
    const tab = reviewTab(c);
    if (tab) out[tab]++;
  }
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

type FilterFields = Pick<ReviewCard, "category_id" | "kind" | "source" | "original" | "front" | "back" | "hint" | "options" | "flag_note">;

export function matchesReviewFilter(card: FilterFields, filter: ReviewFilter): boolean {
  if (filter.area === "ingen" ? card.category_id !== null : filter.area !== "alla" && card.category_id !== filter.area) return false;
  if (filter.kind !== "alla" && card.kind !== filter.kind) return false;
  if (!matchesSource(card, filter.source)) return false;
  if (filter.origin === "original" && !card.original) return false;
  if (filter.origin === "nya" && card.original) return false;
  const words = norm(filter.query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = norm([card.front, card.back, card.hint ?? "", ...(card.options ?? []).map((o) => o.text), card.source ?? "", card.flag_note ?? ""].join("\n"));
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
 * Korten under en flik med filtret, i flikens ordning: Att granska och Flaggade i områdenas
 * ordning (så att ett område kan gås igenom i ett svep), Granskade senast granskade först och
 * kort utan granskningsdatum (oförändrade originalkort) sist i områdenas ordning.
 */
export function reviewList<C extends ReviewCard>(cards: readonly C[], tab: ReviewTab, filter: ReviewFilter, areas: readonly ReviewArea[]): C[] {
  const ordered = orderByArea(
    cards.filter((c) => reviewTab(c) === tab && matchesReviewFilter(c, filter)),
    areas,
  );
  if (tab !== "granskade") return ordered;
  const time = (c: C) => (c.reviewed_at ? Date.parse(c.reviewed_at) : Number.NaN);
  const dated = ordered.filter((c) => Number.isFinite(time(c)));
  const undated = ordered.filter((c) => !Number.isFinite(time(c)));
  // Stabil sortering: samma tidpunkt (massgodkännande) behåller områdenas ordning.
  return [...dated.sort((a, b) => time(b) - time(a)), ...undated];
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

/** En grupp i inkorgens lista: ett område, en dag (Granskade) eller originalkorten (Granskade). */
export type ListGroup<C> =
  | { key: string; type: "area"; areaId: string | null; title: string | null; cards: C[] }
  | { key: string; type: "day"; day: string; cards: C[] }
  | { key: "original"; type: "original"; cards: C[] };

/** Listans grupper för redan ordnade kort (reviewList): per dag under Granskade, annars per område. */
export function groupReviewList<C extends ReviewCard>(orderedCards: readonly C[], tab: ReviewTab, areas: readonly ReviewArea[]): ListGroup<C>[] {
  if (tab !== "granskade") return groupByArea(orderedCards, areas).map((g) => ({ key: g.areaId ?? "ingen", type: "area" as const, ...g }));
  const groups: ListGroup<C>[] = [];
  for (const card of orderedCards) {
    const day = card.reviewed_at ? stockholmDay(card.reviewed_at) : null;
    const last = groups[groups.length - 1];
    if (day === null) {
      if (last?.type === "original") last.cards.push(card);
      else groups.push({ key: "original", type: "original", cards: [card] });
    } else if (last?.type === "day" && last.day === day) last.cards.push(card);
    else groups.push({ key: day, type: "day", day, cards: [card] });
  }
  return groups;
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
