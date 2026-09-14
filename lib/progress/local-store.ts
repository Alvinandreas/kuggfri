/**
 * Gästprogress i localStorage. Samma datastruktur som card_progress.
 * Funktionerna tar ett Storage-objekt som argument så att de kan testas utan webbläsare.
 */
import { isSelfRating, type CardProgress, type ProgressMap } from "./types";

export const LOCAL_PROGRESS_KEY = "kuggfri:progress:v1";

type StoredShape = { version: 1; cards: ProgressMap };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isValidProgress(value: unknown): value is CardProgress {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.card_id === "string" &&
    typeof p.due === "string" &&
    !Number.isNaN(Date.parse(p.due)) &&
    typeof p.stability === "number" &&
    typeof p.difficulty === "number" &&
    typeof p.elapsed_days === "number" &&
    typeof p.scheduled_days === "number" &&
    typeof p.reps === "number" &&
    typeof p.lapses === "number" &&
    (p.state === 0 || p.state === 1 || p.state === 2 || p.state === 3) &&
    (p.last_review === null || (typeof p.last_review === "string" && !Number.isNaN(Date.parse(p.last_review)))) &&
    (p.self_rating === null || isSelfRating(p.self_rating))
  );
}

/** Läser all lokal progress. Trasig data ignoreras tyst (per kort). */
export function readLocalProgress(storage: StorageLike): ProgressMap {
  let raw: string | null;
  try {
    raw = storage.getItem(LOCAL_PROGRESS_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const cards = (parsed as Partial<StoredShape>).cards;
  if (!cards || typeof cards !== "object") return {};
  const result: ProgressMap = {};
  for (const [cardId, value] of Object.entries(cards)) {
    if (isValidProgress(value) && value.card_id === cardId) result[cardId] = value;
  }
  return result;
}

export function writeLocalProgress(storage: StorageLike, cards: ProgressMap): void {
  const shape: StoredShape = { version: 1, cards };
  try {
    storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(shape));
  } catch {
    // Fullt eller blockerat lagringsutrymme: progressen lever bara i minnet den här sessionen.
  }
}

export function clearLocalProgress(storage: StorageLike): void {
  try {
    storage.removeItem(LOCAL_PROGRESS_KEY);
  } catch {
    // ignorera
  }
}

export function upsertLocalProgress(storage: StorageLike, progress: CardProgress): ProgressMap {
  const all = readLocalProgress(storage);
  all[progress.card_id] = progress;
  writeLocalProgress(storage, all);
  return all;
}

export function hasLocalProgress(storage: StorageLike): boolean {
  return Object.keys(readLocalProgress(storage)).length > 0;
}
