/**
 * Ren logik för granskningsvyn och innehållsöversikten i admin: vilka kort som hör till
 * vilken hög (väntar, avvisade, godkända senaste dygnet), filtrering, gruppering per område,
 * förlopp och vart vyn ska gå efter ett beslut. Inga beroenden på React eller Supabase, så
 * allt här kan enhetstestas.
 *
 * Terminologi: ett kort hör till ett OMRÅDE (tabellen categories) och har en UPPGIFTSTYP.
 */
import { CARD_KINDS, isAutoGraded, validateKind, type CardKind, type CardOption } from "@/lib/cards/kinds";
import { matchesSource, type SourceFilter } from "@/lib/admin/sources";

/** Det granskningsvyn behöver veta om ett kort. CardRow uppfyller typen. */
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
  /** Del av originaluppsättningen (visas som en badge). */
  original?: boolean;
  /** Kortet har en tidigare publicerad version i historiken (ett utkast är då en ändring). */
  published_before?: boolean;
};

export type ReviewArea = { id: string; title: string };

/** Högarna i statusfiltret. */
export const REVIEW_BUCKETS = ["vantar", "avvisade", "godkanda"] as const;
export type ReviewBucket = (typeof REVIEW_BUCKETS)[number];

/** "alla" = inget filter, "ingen" = kort utan område. */
export type AreaFilter = "alla" | "ingen" | (string & {});
export type KindFilter = "alla" | CardKind;

export type ReviewFilter = {
  bucket: ReviewBucket;
  area: AreaFilter;
  kind: KindFilter;
  /** Bara ändringar av publicerade kort (kort med en tidigare publicerad version). */
  changesOnly?: boolean;
  /** Källtyp (se lib/admin/sources); saknas = alla. */
  source?: SourceFilter;
};

export const DEFAULT_REVIEW_FILTER: ReviewFilter = { bucket: "vantar", area: "alla", kind: "alla", changesOnly: false, source: "alla" };

/**
 * Är utkastet en ändring av ett kort som tidigare varit publicerat? Sådana är dolda för
 * studenterna tills de godkänts, så de visas först bland dem som väntar.
 */
export function isPublishedChange(card: Pick<ReviewCard, "review_status" | "published_before">): boolean {
  return card.review_status === "utkast" && card.published_before === true;
}

/** Så länge räknas ett godkänt kort till "Godkända senaste dygnet". */
export const RECENT_MS = 24 * 60 * 60 * 1000;

function isRecent(iso: string | null, now: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && now - t <= RECENT_MS && t - now <= RECENT_MS;
}

/** Vilken hög kortet ligger i, eller null om det inte hör till granskningen alls. */
export function reviewBucket(card: Pick<ReviewCard, "review_status" | "reviewed_at">, now: number): ReviewBucket | null {
  if (card.review_status === "utkast") return "vantar";
  if (card.review_status === "avvisad") return "avvisade";
  return isRecent(card.reviewed_at, now) ? "godkanda" : null;
}

/** Har kortet fått ett beslut (godkänt eller avvisat) det senaste dygnet? */
export function reviewedRecently(card: Pick<ReviewCard, "review_status" | "reviewed_at">, now: number): boolean {
  return card.review_status !== "utkast" && isRecent(card.reviewed_at, now);
}

/** Korten som granskningsvyn överhuvudtaget ska känna till (för att hålla sidan liten). */
export function reviewRelevant<C extends Pick<ReviewCard, "review_status" | "reviewed_at">>(cards: readonly C[], now: number): C[] {
  return cards.filter((c) => c.review_status !== null || reviewBucket(c, now) !== null);
}

function matchesArea(card: Pick<ReviewCard, "category_id">, area: AreaFilter): boolean {
  if (area === "alla") return true;
  if (area === "ingen") return card.category_id === null;
  return card.category_id === area;
}

function matchesKind(card: Pick<ReviewCard, "kind">, kind: KindFilter): boolean {
  return kind === "alla" || card.kind === kind;
}

/** Område, uppgiftstyp och källtyp (allt utom status och "bara ändringar"). */
type ScopeFilter = Pick<ReviewFilter, "area" | "kind" | "source">;

function matchesScope(card: Pick<ReviewCard, "category_id" | "kind" | "source" | "original">, filter: ScopeFilter): boolean {
  return matchesArea(card, filter.area) && matchesKind(card, filter.kind) && matchesSource(card, filter.source);
}

/**
 * Korten som syns med filtret, i områdenas ordning (se orderByArea). Bland dem som väntar
 * kommer ändringar av publicerade kort först (se isPublishedChange).
 */
export function filterReviewCards<C extends ReviewCard>(cards: readonly C[], filter: ReviewFilter, areas: readonly ReviewArea[], now: number): C[] {
  const ordered = orderByArea(
    cards.filter(
      (c) =>
        reviewBucket(c, now) === filter.bucket &&
        matchesScope(c, filter) &&
        (!filter.changesOnly || c.published_before === true),
    ),
    areas,
  );
  if (filter.bucket !== "vantar") return ordered;
  return [...ordered.filter(isPublishedChange), ...ordered.filter((c) => !isPublishedChange(c))];
}

/** Antal ändringar av publicerade kort i högen, inom område-, typ- och källfiltret (för filtrets etikett). */
export function countPublishedChanges(cards: readonly ReviewCard[], filter: ReviewFilter, now: number): number {
  return cards.filter((c) => c.published_before === true && reviewBucket(c, now) === filter.bucket && matchesScope(c, filter)).length;
}

/**
 * Sorterar korten som områdena är ordnade (kort utan område eller med okänt område sist),
 * inom området på sort_order och sedan skapelsetid. Samma ordning som listan visar, så att
 * Nästa och Föregående följer det granskaren ser.
 */
export function orderByArea<C extends Pick<ReviewCard, "category_id" | "sort_order" | "created_at">>(cards: readonly C[], areas: readonly ReviewArea[]): C[] {
  const rank = new Map(areas.map((a, i) => [a.id, i] as const));
  const areaRank = (c: C) => (c.category_id !== null && rank.has(c.category_id) ? rank.get(c.category_id)! : areas.length);
  return [...cards].sort((a, b) => areaRank(a) - areaRank(b) || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
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

/**
 * Förloppet "12 av 48 granskade": av korten som väntar eller fått ett beslut det senaste
 * dygnet (inom område-, typ- och källfiltret), hur många har fått ett beslut.
 */
export function reviewProgress(cards: readonly ReviewCard[], filter: ScopeFilter, now: number): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const c of cards) {
    if (!matchesScope(c, filter)) continue;
    if (c.review_status === "utkast") total++;
    else if (reviewedRecently(c, now)) {
      done++;
      total++;
    }
  }
  return { done, total };
}

/**
 * Vart vyn går efter ett beslut: första kortet i den nya listan som låg efter det aktuella
 * i den gamla, annars det första i den nya listan (runt), annars inget.
 */
export function nextAfterDecision(before: readonly string[], after: readonly string[], currentId: string): string | null {
  const start = before.indexOf(currentId);
  const remaining = new Set(after);
  if (start >= 0) {
    for (let i = start + 1; i < before.length; i++) {
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

export type ReviewListGroup<C> = AreaGroup<C> & { key: string; changes: boolean };

/**
 * Listans grupper för redan filtrerade och ordnade kort (filterReviewCards): står ändringar av
 * publicerade kort först, och finns det även andra kort, får ändringarna en egen grupp överst.
 * Resten grupperas per område. Ordningen blir densamma som listan, så Nästa följer det man ser.
 */
export function groupReviewList<C extends Pick<ReviewCard, "category_id" | "review_status" | "published_before">>(
  orderedCards: readonly C[],
  areas: readonly ReviewArea[],
): ReviewListGroup<C>[] {
  let lead = 0;
  while (lead < orderedCards.length && isPublishedChange(orderedCards[lead]!)) lead++;
  const byArea = (list: readonly C[]) => groupByArea(list, areas).map((g) => ({ ...g, key: g.areaId ?? "ingen", changes: false }));
  if (lead === 0 || lead === orderedCards.length) return byArea(orderedCards);
  return [{ key: "andringar", areaId: null, title: null, cards: orderedCards.slice(0, lead), changes: true }, ...byArea(orderedCards.slice(lead))];
}

/** Antal kort per område, i områdenas ordning (för bekräftelsen av massgodkännande). */
export function countByArea(cards: readonly Pick<ReviewCard, "category_id">[], areas: readonly ReviewArea[]): { areaId: string | null; title: string | null; count: number }[] {
  const out: { areaId: string | null; title: string | null; count: number }[] = [];
  const byId = new Map<string | null, number>();
  for (const c of cards) {
    const known = c.category_id !== null && areas.some((a) => a.id === c.category_id);
    const key = known ? c.category_id : null;
    byId.set(key, (byId.get(key) ?? 0) + 1);
  }
  for (const a of areas) if (byId.has(a.id)) out.push({ areaId: a.id, title: a.title, count: byId.get(a.id)! });
  if (byId.has(null)) out.push({ areaId: null, title: null, count: byId.get(null)! });
  return out;
}

/** Problem som hindrar att kortet godkänns: tomma sidor eller fel i typ och alternativ. */
export function approvalIssues(card: Pick<ReviewCard, "front" | "back" | "kind" | "options">): string[] {
  const issues: string[] = [];
  if (!card.front.trim()) issues.push("Framsidan är tom.");
  if (!card.back.trim()) issues.push(isAutoGraded(card.kind) ? "Förklaringen är tom." : "Baksidan är tom.");
  return [...issues, ...validateKind(card.kind, card.options)];
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
