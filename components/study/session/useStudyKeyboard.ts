"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { SelfRating, StudyMode } from "@/lib/progress/types";
import type { QuizResult } from "../QuizCard";
import type { StudyCard } from "../types";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

type Options = {
  flip: () => void;
  rate: (rating: SelfRating) => void;
  next: () => void;
  previous: () => void;
  card: StudyCard | null;
  mode: StudyMode;
  hintAllowed: boolean;
  quiz: boolean;
  quizResult: QuizResult | null;
  toggleQuizOption: (index: number) => void;
  quizPrimary: () => void;
  continueQuiz: () => void;
  setShowHint: Dispatch<SetStateAction<boolean>>;
};

/** Pluggpassets tangentbordsgenvägar (mellanslag, 1–5, pilar, H och sifferval på quizkort). */
export function useStudyKeyboard({
  flip,
  rate,
  next,
  previous,
  card,
  mode,
  hintAllowed,
  quiz,
  quizResult,
  toggleQuizOption,
  quizPrimary,
  continueQuiz,
  setShowHint,
}: Options) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const onButton = e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.tagName === "A");
      if (quiz) {
        // Automaträttat kort: siffror väljer alternativ, Enter/mellanslag svarar eller går vidare.
        if (/^[1-9]$/.test(e.key)) {
          e.preventDefault();
          toggleQuizOption(Number(e.key) - 1);
          return;
        }
        // Enter på ett alternativ (fokus kvar efter ett musklick) ska svara, inte klicka om alternativet.
        const onOption = e.target instanceof HTMLElement && e.target.closest("[data-testid='quiz-option']") !== null;
        if ((e.key === "Enter" && onOption) || ((e.key === "Enter" || e.key === " ") && !onButton)) {
          e.preventDefault();
          quizPrimary();
          return;
        }
        if (e.key === "ArrowRight" && quizResult) {
          e.preventDefault();
          continueQuiz();
          return;
        }
      }
      switch (e.key) {
        case " ":
          if (onButton) return;
          e.preventDefault();
          flip();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          e.preventDefault();
          rate(Number(e.key) as SelfRating);
          break;
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (mode !== "exam") previous();
          break;
        case "h":
        case "H":
          if (card?.hint && hintAllowed) {
            e.preventDefault();
            setShowHint((v) => !v);
          }
          break;
        default:
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // setShowHint är en stabil setter från useState.
  }, [flip, rate, next, previous, card, mode, hintAllowed, quiz, quizResult, toggleQuizOption, quizPrimary, continueQuiz, setShowHint]);
}
