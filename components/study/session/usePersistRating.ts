"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { applyRating } from "@/lib/fsrs/apply-rating";
import type { ScheduleOptions } from "@/lib/fsrs/scheduler";
import type { ProgressMap, ReviewEntry, SelfRating, StudyMode } from "@/lib/progress/types";
import type { ProgressStore } from "@/lib/progress/store";

type Options = {
  store: ProgressStore | null;
  progress: ProgressMap | null;
  mode: StudyMode;
  schedule: ScheduleOptions | undefined;
  setProgress: Dispatch<SetStateAction<ProgressMap | null>>;
  setReviews: Dispatch<SetStateAction<ReviewEntry[]>>;
  setQueued: Dispatch<SetStateAction<number>>;
  setSaveError: Dispatch<SetStateAction<boolean>>;
};

/** Sparar en skattning (progress enligt läget + historik). Delas av vändkort och automaträttade kort. */
export function usePersistRating({ store, progress, mode, schedule, setProgress, setReviews, setQueued, setSaveError }: Options) {
  return useCallback(
    (cardId: string, rating: SelfRating) => {
      if (!store || !progress) return;
      const now = new Date();
      // Varje skattning räknas, i alla lägen: FSRS schemalägger om kortet (tidiga repetitioner
      // och flera samma dag hanteras i lib/fsrs/scheduler.ts).
      const next = applyRating({ mode, cardId, rating, progress, now, schedule });
      setProgress((p) => ({ ...(p ?? {}), [cardId]: next }));
      store
        .save(next)
        .then(() => setQueued(store.pending()))
        .catch(() => setSaveError(true));
      // Historiken loggas i alla lägen, med samma skattning som schemat fick.
      const entry: ReviewEntry = { card_id: cardId, rating, mode, reviewed_at: now.toISOString() };
      setReviews((r) => [...r, entry]);
      store
        .logReview(entry)
        .then(() => setQueued(store.pending()))
        .catch(() => {
          // Historik är inte kritisk.
        });
    },
    // Setterna från useState är stabila; de står med för att hooken tar emot dem som argument.
    [store, progress, mode, schedule, setProgress, setReviews, setQueued, setSaveError],
  );
}
