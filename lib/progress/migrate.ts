/**
 * Sammanslagning av lokal gästprogress med kontots progress.
 * Regel: vid konflikt vinner raden med senast last_review. En rad utan
 * last_review (nytt kort) förlorar alltid mot en rad som har det.
 * Ren funktion; själva skrivningen sker i store-lagret.
 */
import type { CardProgress, ProgressMap } from "./types";

export type MergeResult = {
  /** Rader som ska skrivas till kontot. */
  toUpsert: CardProgress[];
  /** Den sammanslagna bilden. */
  merged: ProgressMap;
  localWon: number;
  remoteWon: number;
};

function ts(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(value);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

export function mergeProgress(local: ProgressMap, remote: ProgressMap): MergeResult {
  const merged: ProgressMap = { ...remote };
  const toUpsert: CardProgress[] = [];
  let localWon = 0;
  let remoteWon = 0;

  for (const [cardId, localRow] of Object.entries(local)) {
    const remoteRow = remote[cardId];
    if (!remoteRow) {
      merged[cardId] = localRow;
      toUpsert.push(localRow);
      localWon++;
      continue;
    }
    const l = ts(localRow.last_review);
    const r = ts(remoteRow.last_review);
    if (l > r) {
      merged[cardId] = localRow;
      toUpsert.push(localRow);
      localWon++;
    } else {
      remoteWon++;
    }
  }

  return { toUpsert, merged, localWon, remoteWon };
}
