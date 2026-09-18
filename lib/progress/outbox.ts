/**
 * Utkorg för inloggade: skrivningar som misslyckades (tappad anslutning, spårvagnen)
 * sparas i localStorage och skickas igen vid nästa tillfälle. Så tappas aldrig en
 * repetition. Senaste progress per kort vinner; historikrader läggs till i ordning.
 * Funktionerna tar ett Storage-objekt så att de kan testas utan webbläsare.
 */
import { isSelfRating, isStudyMode, type CardProgress, type ReviewEntry } from "./types";

export const LOCAL_OUTBOX_KEY = "kuggfri:outbox:v1";
/** Tak så att en trasig anslutning inte fyller lagringsutrymmet; äldsta historikrader faller bort. */
export const OUTBOX_REVIEWS_MAX = 2000;

export type Outbox = {
  /** card_id -> senaste progress som inte kunnat sparas. */
  progress: Record<string, CardProgress>;
  reviews: ReviewEntry[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const EMPTY: Outbox = { progress: {}, reviews: [] };

function isReview(value: unknown): value is ReviewEntry {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return typeof r.card_id === "string" && isSelfRating(r.rating) && isStudyMode(r.mode) && typeof r.reviewed_at === "string";
}

function isProgress(value: unknown): value is CardProgress {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return typeof p.card_id === "string" && typeof p.due === "string" && typeof p.stability === "number";
}

export function readOutbox(storage: StorageLike): Outbox {
  let raw: string | null;
  try {
    raw = storage.getItem(LOCAL_OUTBOX_KEY);
  } catch {
    return { progress: {}, reviews: [] };
  }
  if (!raw) return { progress: {}, reviews: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<Outbox> | null;
    const progress: Record<string, CardProgress> = {};
    for (const [id, p] of Object.entries(parsed?.progress ?? {})) if (isProgress(p) && p.card_id === id) progress[id] = p;
    const reviews = Array.isArray(parsed?.reviews) ? parsed.reviews.filter(isReview) : [];
    return { progress, reviews };
  } catch {
    return { progress: {}, reviews: [] };
  }
}

export function writeOutbox(storage: StorageLike, outbox: Outbox): void {
  const reviews = outbox.reviews.length > OUTBOX_REVIEWS_MAX ? outbox.reviews.slice(outbox.reviews.length - OUTBOX_REVIEWS_MAX) : outbox.reviews;
  try {
    if (Object.keys(outbox.progress).length === 0 && reviews.length === 0) storage.removeItem(LOCAL_OUTBOX_KEY);
    else storage.setItem(LOCAL_OUTBOX_KEY, JSON.stringify({ version: 1, progress: outbox.progress, reviews }));
  } catch {
    // Fullt eller blockerat lagringsutrymme.
  }
}

export function queueProgress(storage: StorageLike, progress: CardProgress): void {
  const box = readOutbox(storage);
  box.progress[progress.card_id] = progress;
  writeOutbox(storage, box);
}

export function queueReview(storage: StorageLike, entry: ReviewEntry): void {
  const box = readOutbox(storage);
  box.reviews.push(entry);
  writeOutbox(storage, box);
}

export function outboxSize(storage: StorageLike): number {
  const box = readOutbox(storage);
  return Object.keys(box.progress).length + box.reviews.length;
}

export function clearOutbox(storage: StorageLike): void {
  writeOutbox(storage, EMPTY);
}

/** Det som behövs för att tömma utkorgen mot kontot. */
export type OutboxSink = {
  saveMany(items: readonly CardProgress[]): Promise<void>;
  logReviews(entries: readonly ReviewEntry[]): Promise<void>;
};

/**
 * Skickar allt i utkorgen. Lyckas det töms den; misslyckas det ligger allt kvar
 * (inklusive det som hunnit läggas till under tiden). Returnerar antal skickade poster.
 */
export async function flushOutbox(storage: StorageLike, sink: OutboxSink): Promise<number> {
  const box = readOutbox(storage);
  const progress = Object.values(box.progress);
  if (progress.length === 0 && box.reviews.length === 0) return 0;
  await sink.saveMany(progress);
  await sink.logReviews(box.reviews);
  // Ta bara bort det som skickades; nya poster som köats under tiden behålls.
  const after = readOutbox(storage);
  const sentReviews = new Set(box.reviews.map((r) => `${r.card_id}|${r.reviewed_at}`));
  const remaining: Outbox = {
    progress: Object.fromEntries(Object.entries(after.progress).filter(([id, p]) => box.progress[id]?.last_review !== p.last_review)),
    reviews: after.reviews.filter((r) => !sentReviews.has(`${r.card_id}|${r.reviewed_at}`)),
  };
  writeOutbox(storage, remaining);
  return progress.length + box.reviews.length;
}
