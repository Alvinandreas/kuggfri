"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cardKindInstruction, type CardOption } from "@/lib/cards/kinds";
import type { SelfRating } from "@/lib/progress/types";
import { Markdown } from "@/components/markdown/Markdown";
import { cx } from "@/components/ui/cx";
import { CENTERED_EXPLANATION, CENTERED_QUESTION, FaceHeader } from "./Flashcard";

export type QuizResult = { chosen: number[]; correct: boolean; rating: SelfRating };

type Props = {
  cardId: string;
  kind: "sant-falskt" | "alternativ";
  front: string;
  back: string;
  options: CardOption[];
  categoryTitle: string | null;
  categoryColorIndex: number;
  starred: boolean;
  onToggleStar: () => void;
  /** Satt när frågan är besvarad: då visas facit och förklaring. */
  result: QuizResult | null;
  /** Val som ännu inte skickats (flera rätta svar). Styrs av sessionen för tangentbordets skull. */
  selected: number[];
  onToggle: (index: number) => void;
};

/**
 * Automaträttad fråga: Sant/Falskt eller Alternativ (ett eller flera rätta).
 * Kortet vänds inte; efter svaret färgas alternativen och förklaringen visas under.
 * Alternativens ordning följer källan (tentor har "Alla ovanstående" och liknande).
 */
export function QuizCard({
  cardId,
  kind,
  front,
  back,
  options,
  categoryTitle,
  categoryColorIndex,
  starred,
  onToggleStar,
  result,
  selected,
  onToggle,
}: Props) {
  const sv = useT();
  const correctCount = options.filter((o) => o.correct).length;
  const multi = kind === "alternativ" && correctCount > 1;
  const answered = result !== null;
  const kindLabel = cardKindInstruction(sv, kind, options);
  // Förklaringen tonar in först efter att facit hunnit synas.
  const [showExplanation, setShowExplanation] = useState(false);
  useEffect(() => {
    if (!answered) {
      setShowExplanation(false);
      return;
    }
    const t = setTimeout(() => setShowExplanation(true), 180);
    return () => clearTimeout(t);
  }, [answered]);

  return (
    <div className="card-stack" data-testid="quizcard" data-card-id={cardId} data-answered={answered}>
      <div className="card-enter">
        <section
          aria-label={kindLabel}
          className="flex min-h-[var(--card-min-height)] flex-col rounded-lg border border-line bg-surface p-5 shadow-card dark:border-transparent sm:p-8"
        >
          <FaceHeader categoryTitle={categoryTitle} colorIndex={categoryColorIndex} kindLabel={kindLabel} starred={starred} onToggleStar={onToggleStar} />
          <div className="py-3">
            <Markdown text={front} className={`mx-auto w-full ${CENTERED_QUESTION}`} />
          </div>
          {/* Med ett rätt svar säger huvudet redan "Välj rätt alternativ"; med flera talar raden om hur många. */}
          {multi && !answered ? (
            <p className="-mt-1 mb-1 text-center text-sm text-muted" data-testid="quiz-instruction">
              {sv.quiz.pickMany(correctCount)}
            </p>
          ) : null}

          <ul role="list" className={cx("mt-3 grid gap-2.5", kind === "sant-falskt" && "grid-cols-2")}>
            {options.map((option, i) => {
              const chosen = answered ? result.chosen.includes(i) : selected.includes(i);
              const state = !answered ? (chosen ? "selected" : "idle") : option.correct ? (chosen ? "right" : "missed") : chosen ? "wrong" : "dim";
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onToggle(i)}
                    disabled={answered}
                    aria-pressed={multi ? chosen : undefined}
                    data-testid="quiz-option"
                    data-state={state}
                    className={cx(
                      "group flex w-full items-center gap-3 rounded-lg border-2 px-4 transition-[border-color,background-color,opacity,transform] duration-150 ease-out",
                      "focus-visible:outline-offset-2",
                      kind === "sant-falskt" ? "justify-center py-4 text-center text-lg font-semibold" : "py-3 text-left",
                      state === "idle" && "border-transparent bg-surface-2 hover:bg-surface-3 active:scale-[0.99]",
                      state === "selected" && "border-accent bg-accent-soft/60",
                      state === "right" && "anim-pop border-rate-5 bg-rate-5/20",
                      state === "missed" && "border-dashed border-rate-5 bg-rate-5/10",
                      state === "wrong" && "rate-shake border-rate-1 bg-rate-1/20",
                      state === "dim" && "border-transparent bg-surface-2 opacity-55",
                    )}
                  >
                    {kind === "alternativ" ? (
                      <span
                        aria-hidden="true"
                        className={cx(
                          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          state === "selected"
                            ? "bg-accent text-accent-fg"
                            : state === "right" || state === "missed"
                              ? "bg-rate-5 text-white"
                              : state === "wrong"
                                ? "bg-rate-1 text-white"
                                : "bg-surface-3 text-muted",
                        )}
                      >
                        {state === "right" || state === "missed" ? <Check size={15} strokeWidth={3} /> : state === "wrong" ? <X size={15} strokeWidth={3} /> : sv.quiz.optionLabel(i)}
                      </span>
                    ) : null}
                    <span className={cx("min-w-0", kind === "alternativ" && "flex-1")}>
                      {kind === "alternativ" ? (
                        <Markdown text={option.text} variant="body" className="[&_p]:m-0" />
                      ) : option.text === "Sant" ? (
                        sv.tenta.trueLabel
                      ) : option.text === "Falskt" ? (
                        sv.tenta.falseLabel
                      ) : (
                        option.text
                      )}
                    </span>
                    {answered && state !== "dim" && state !== "idle" ? (
                      <span className="sr-only">
                        {state === "right" ? sv.quiz.rightAnswer : state === "missed" ? sv.quiz.missed : sv.quiz.chosenWrong}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {answered ? (
            <div className="anim-fade-up mt-5 grid gap-3" data-testid="quiz-result" data-correct={result.correct}>
              <p
                className={cx(
                  "flex items-center gap-2.5 rounded-lg px-4 py-3 font-semibold",
                  result.correct ? "bg-rate-5/20 text-fg" : "bg-rate-1/20 text-fg",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full", result.correct ? "bg-rate-5 text-white" : "bg-rate-1 text-white")}
                >
                  {result.correct ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                </span>
                <span>
                  {result.correct ? sv.quiz.correct : sv.quiz.wrong}
                  <span className="block text-sm font-normal text-muted">
                    {result.correct ? sv.quiz.correctDetail(result.rating) : sv.quiz.wrongDetail}
                  </span>
                </span>
              </p>
              {showExplanation ? (
                <div className="anim-fade-in border-t border-line pt-3 text-center">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{sv.quiz.explanation}</p>
                  <Markdown text={back} variant="body" className={CENTERED_EXPLANATION} />
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
