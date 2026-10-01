"use client";

import { useEffect, useRef, useState } from "react";
import { createSession, type SessionState } from "@/lib/fsrs/session";
import type { ProgressMap, ReviewEntry, StudyMode } from "@/lib/progress/types";
import { DEFAULT_PREFS, readPrefs, type StudyPrefs } from "@/lib/progress/prefs";
import type { ProgressStore } from "@/lib/progress/store";
import { readStars } from "@/lib/progress/stars";
import { filterCards, selectCardIds, serializeSelection, type Selection } from "@/lib/study/selection";
import { EXTRA_SESSION_SIZE, examPhase, parseExamDate, planNewCards, type ExamPhase, type NewCardPlan } from "@/lib/study/plan";
import { sizeLimit, type SessionSettings } from "@/lib/study/session-settings";
import { countIntroducedToday } from "@/lib/stats/progress-stats";
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
  settings: SessionSettings;
  onlyStarred: boolean;
  onlyOriginal: boolean;
  examDate: string | null;
};

/**
 * Passets kö: laddar progress och historik och bygger kön en gång per lager/läge/urval.
 * Returnerar null-värden (session, progress, plan) tills kön är byggd.
 */
export function useSessionQueue({ store, cards, mode, selection, extraNew, extra, settings, onlyStarred, onlyOriginal, examDate }: Options) {
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [prefs, setPrefs] = useState<StudyPrefs>(DEFAULT_PREFS);
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);

  // Ladda progress och historik och bygg kön en gång per lager/läge/urval. Kortlistan läses
  // via ref så att en ny arrayidentitet från servern inte startar om sessionen.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const selectionKey = `${mode}|${serializeSelection(selection)}|${extraNew ?? ""}|${extra}|${JSON.stringify(settings)}|${onlyStarred}|${onlyOriginal}`;
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
      const now = new Date();
      const currentPrefs = readPrefs(window.localStorage);
      const phase = examPhase(parseExamDate(examDate), now);
      const inSelection = filterCards(pool, loaded, selection);
      const newRemaining = inSelection.filter((c) => !loaded[c.id] || loaded[c.id]?.state === 0).length;
      const plan = planNewCards({
        newRemaining,
        introducedToday: countIntroducedToday(history, now, loaded),
        dailyGoal: currentPrefs.dailyNew,
        phase,
      });
      // Plugga vidare har ingen dos och ingen slutrepetition: kön är kort närmast att förfalla, sedan nya.
      const isExtra = mode === "fsrs" && extra;
      const finalReview = mode === "fsrs" && !isExtra && phase.kind === "final";
      const maxNew = mode === "fsrs" && !finalReview && !isExtra ? (extraNew ?? plan.limit) : undefined;
      // Plugga vidare tar lika många kort som passets antal, annars ett block på EXTRA_SESSION_SIZE.
      const extraSize = isExtra ? (sizeLimit(settings.size) ?? EXTRA_SESSION_SIZE) : undefined;
      const order = selectCardIds({ cards: pool, progress: loaded, mode, selection, now, maxNew, finalReview, extraSize, settings });
      setPrefs(currentPrefs);
      setProgress(loaded);
      setReviews(history);
      setSessionPlan({ phase, plan, maxNew, finalReview, extra: isExtra });
      setSession(createSession(order, mode));
    })();
    return () => {
      cancelled = true;
    };
    // selection och extraNew ingår via selectionKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, mode, selectionKey, examDate]);

  return { progress, setProgress, reviews, setReviews, prefs, session, setSession, sessionPlan };
}
