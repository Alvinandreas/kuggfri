"use client";

import { useEffect, useState } from "react";
import type { ProgressStore } from "./store";
import type { ProgressMap, ReviewEntry } from "./types";

/**
 * Progress och historik för en uppsättning kort, laddade ur progresslagret.
 *
 * `progress` är null tills första laddningen är klar (vyerna visar skelett så länge);
 * misslyckas laddningen blir det en tom karta och tom historik. Svar som kommer efter att
 * lagret eller korten bytts, eller efter avmontering, kastas.
 */
export function useCardProgress(
  store: ProgressStore | null,
  ids: readonly string[],
): { progress: ProgressMap | null; reviews: ReviewEntry[] } {
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    Promise.all([store.load(ids), store.loadReviews(ids)])
      .then(([p, r]) => {
        if (cancelled) return;
        setProgress(p);
        setReviews(r);
      })
      .catch(() => {
        if (cancelled) return;
        setProgress({});
        setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [store, ids]);

  return { progress, reviews };
}
