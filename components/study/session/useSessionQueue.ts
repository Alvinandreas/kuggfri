"use client";

import { useEffect, useRef, useState } from "react";
import { createSession, type SessionState } from "@/lib/fsrs/session";
import type { ProgressMap, ReviewEntry, StudyMode } from "@/lib/progress/types";
import { DEFAULT_PREFS, readPrefs, type StudyPrefs } from "@/lib/progress/prefs";
import type { ProgressStore } from "@/lib/progress/store";
import { readStars } from "@/lib/progress/stars";
import { serializeSelection, type Selection } from "@/lib/study/selection";
import type { ExamPhase, NewCardPlan } from "@/lib/study/plan";
import type { SessionSettings } from "@/lib/study/session-settings";
import { buildSessionQueue } from "@/lib/study/session-queue";
import type { StudyCard } from "../types";

export type SessionPlan = {
  phase: ExamPhase;
  plan: NewCardPlan;
  /** Tak på nya kort som sessionen byggdes med. */
  maxNew: number | undefined;
  finalReview: boolean;
  /** Plugga vidare-pass. */
  extra: boolean;
};

type Options = {
  store: ProgressStore | null;
  cards: StudyCard[];
  mode: StudyMode;
  selection: Selection;
  extraNew: number | null;
  extra: boolean;
  /** Högst så här många kort (tak=, från "Kör N kort till"), eller null. */
  max: number | null;
  settings: SessionSettings;
  onlyStarred: boolean;
  examDate: string | null;
};

/**
 * Passets kö: laddar progress och historik och bygger kön en gång per lager/läge/urval.
 * Returnerar null-värden (session, progress, plan) tills kön är byggd.
 */
export function useSessionQueue({ store, cards, mode, selection, extraNew, extra, max, settings, onlyStarred, examDate }: Options) {
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [prefs, setPrefs] = useState<StudyPrefs>(DEFAULT_PREFS);
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);

  // Ladda progress och historik och bygg kön en gång per lager/läge/urval. Kortlistan läses
  // via ref så att en ny arrayidentitet från servern inte startar om sessionen.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const selectionKey = `${mode}|${serializeSelection(selection)}|${extraNew ?? ""}|${extra}|${max ?? ""}|${JSON.stringify(settings)}|${onlyStarred}`;
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    (async () => {
      // Bara stjärnmärkta: urvalet krymper till de kort studenten markerat.
      const starred = onlyStarred ? new Set(readStars()) : null;
      const pool = starred ? cardsRef.current.filter((c) => starred.has(c.id)) : cardsRef.current;
      const ids = cardsRef.current.map((c) => c.id);
      let loaded: ProgressMap = {};
      let history: ReviewEntry[] = [];
      try {
        [loaded, history] = await Promise.all([store.load(ids), store.loadReviews(ids)]);
      } catch {
        loaded = {};
        history = [];
      }
      if (cancelled) return;
      const currentPrefs = readPrefs(window.localStorage);
      const queue = buildSessionQueue({
        cards: pool,
        progress: loaded,
        reviews: history,
        request: { mode, selection, extraNew, extra, max, settings },
        dailyNew: currentPrefs.dailyNew,
        examDate,
      });
      setPrefs(currentPrefs);
      setProgress(loaded);
      setReviews(history);
      setSessionPlan({ phase: queue.phase, plan: queue.plan, maxNew: queue.maxNew, finalReview: queue.finalReview, extra: queue.extra });
      setSession(createSession(queue.order, mode));
    })();
    return () => {
      cancelled = true;
    };
    // selection, extraNew och max ingår via selectionKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, mode, selectionKey, examDate]);

  return { progress, setProgress, reviews, setReviews, prefs, session, setSession, sessionPlan };
}
