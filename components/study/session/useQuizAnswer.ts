"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { sv } from "@/lib/i18n/sv";
import { rateCurrent, type SessionState } from "@/lib/fsrs/session";
import type { ProgressMap, SelfRating, StudyMode } from "@/lib/progress/types";
import type { ProgressStore } from "@/lib/progress/store";
import { playRatingSound } from "@/lib/ui/sound";
import { autoRating, isAutoGraded, isCorrectAnswer } from "@/lib/cards/kinds";
import type { QuizResult } from "../QuizCard";
import type { StudyCard } from "../types";

type Options = {
  card: StudyCard | null;
  cardKey: string | null;
  store: ProgressStore | null;
  progress: ProgressMap | null;
  mode: StudyMode;
  persistRating: (cardId: string, rating: SelfRating) => void;
  setAnnounce: Dispatch<SetStateAction<string>>;
  setSession: Dispatch<SetStateAction<SessionState | null>>;
};

/**
 * Automaträttade kort (Sant/Falskt, Alternativ). Resultatet hör till kortets plats i kön,
 * så att ett nytt kort alltid börjar obesvarat.
 */
export function useQuizAnswer({ card, cardKey, store, progress, mode, persistRating, setAnnounce, setSession }: Options) {
  const quiz = card !== null && isAutoGraded(card.kind) && card.options !== null && card.options.length >= 2;
  const [quizState, setQuizState] = useState<{ key: string; selected: number[]; result: QuizResult | null } | null>(null);
  const quizSelected = useMemo(() => (quizState && quizState.key === cardKey ? quizState.selected : []), [quizState, cardKey]);
  const quizResult = quizState && quizState.key === cardKey ? quizState.result : null;
  const quizMulti = quiz && card.kind === "alternativ" && (card.options?.filter((o) => o.correct).length ?? 0) > 1;

  const submitQuiz = useCallback(
    (chosen: number[]) => {
      if (!card || !cardKey || !card.options || !store || !progress || quizResult) return;
      if (chosen.length === 0) return;
      const correct = isCorrectAnswer(card.options, chosen);
      // Schemat får Alvins trappa 3 → 4 → 5 (lib/cards/kinds.ts) i alla lägen, även i duggan:
      // ett enda rätt svar på en flervalsfråga ska inte göra kortet "Klockrent". Duggans
      // resultat räknar ändå bara rätt eller fel (se continueQuiz).
      const rating: SelfRating = autoRating(correct, progress[card.id]?.self_rating);
      persistRating(card.id, rating);
      setQuizState({ key: cardKey, selected: chosen, result: { chosen, correct, rating } });
      setAnnounce(sv.quiz.answeredAnnounce(correct));
      playRatingSound(rating);
    },
    // setAnnounce är en stabil setter från useState.
    [card, cardKey, store, progress, quizResult, persistRating, setAnnounce],
  );

  const toggleQuizOption = useCallback(
    (index: number) => {
      if (!card || !cardKey || !card.options || quizResult) return;
      if (index < 0 || index >= card.options.length) return;
      if (!quizMulti) {
        submitQuiz([index]);
        return;
      }
      setQuizState((prev) => {
        const selected = prev && prev.key === cardKey ? prev.selected : [];
        const next = selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index].sort((a, b) => a - b);
        return { key: cardKey, selected: next, result: null };
      });
    },
    [card, cardKey, quizResult, quizMulti, submitQuiz],
  );

  const continueQuiz = useCallback(() => {
    if (!quizResult) return;
    // En dugga är ett prov: sammanfattningen räknar rätt (5) eller fel (1).
    const rating: SelfRating = mode === "exam" ? (quizResult.correct ? 5 : 1) : quizResult.rating;
    setQuizState(null);
    setSession((s) => (s ? rateCurrent(s, rating, { requeue: false }) : s));
    // setSession är en stabil setter från useState.
  }, [quizResult, mode, setSession]);

  /** Mittenknappen och Enter på ett automaträttat kort: svara, eller gå vidare efter svaret. */
  const quizPrimary = useCallback(() => {
    if (quizResult) continueQuiz();
    else if (quizMulti) submitQuiz(quizSelected);
  }, [quizResult, quizMulti, quizSelected, continueQuiz, submitQuiz]);

  return { quiz, quizSelected, quizResult, quizMulti, toggleQuizOption, continueQuiz, quizPrimary };
}
