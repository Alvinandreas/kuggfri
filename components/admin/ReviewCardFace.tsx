"use client";

import { Check, Lightbulb } from "lucide-react";
import { isAutoGraded, trueFalseAnswer, type CardKind, type CardOption } from "@/lib/cards/kinds";
import { Markdown } from "@/components/markdown/Markdown";
import { cx } from "@/components/ui/cx";
import { useReviewT, type ReviewText } from "./review/ReviewLanguage";

type Props = {
  front: string;
  back: string;
  hint: string | null;
  kind: CardKind;
  options: readonly CardOption[] | null;
  /** Mindre text (förhandsvisningen bredvid redigeraren). */
  compact?: boolean;
};

/** Rubriken på kortets första del, efter uppgiftstyp. */
export function questionLabel(kind: CardKind, t: ReviewText): string {
  return kind === "sant-falskt" ? t.g.statement : kind === "begrepp" ? t.g.concept : t.g.question;
}

/**
 * Kortet i granskningen, så som studenten ser det men med båda delarna framme: Fråga (med
 * alternativen och det rätta markerat, och ledtråden) och Svar (förklaringen för automaträttade
 * typer). Samma markdown- och KaTeX-renderare som studievyn, så formler och bilder syns som för
 * studenten. Delarna står bredvid varandra när ytan är bred nog (containerfråga), annars under
 * varandra.
 */
export function ReviewCardFace({ front, back, hint, kind, options, compact = false }: Props) {
  const t = useReviewT();
  const g = t.g;
  const auto = isAutoGraded(kind);
  const answer = kind === "sant-falskt" ? trueFalseAnswer(options) : null;
  return (
    <div className={cx("grid grid-cols-[minmax(0,1fr)] gap-4", !compact && "@4xl:grid-cols-2 @4xl:items-stretch")} data-testid="review-card-face">
      <section
        aria-label={questionLabel(kind, t)}
        className="flex min-w-0 flex-col rounded-lg border border-line bg-surface shadow-card dark:border-transparent"
        data-testid="review-question"
      >
        <SideLabel>{questionLabel(kind, t)}</SideLabel>
        <div className={cx("grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6", compact && "[&_.prose-card]:text-[1.05rem]!")}>
          <Markdown text={front || "…"} className="w-full" />
          {auto ? <OptionList kind={kind} options={options ?? []} /> : null}
          {kind === "sant-falskt" && answer !== null ? <p className="sr-only">{g.trueFalseAnswer(answer ? t.admin.trueWord : t.admin.falseWord)}</p> : null}
          {hint?.trim() ? (
            <p className="flex gap-2 rounded-md bg-surface-2 px-3.5 py-2.5 text-sm">
              <Lightbulb size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
              <span className="min-w-0 break-words">
                <span className="font-semibold">{g.hint}: </span>
                {hint}
              </span>
            </p>
          ) : null}
        </div>
      </section>
      <section
        aria-label={auto ? g.explanation : g.answer}
        className="flex min-w-0 flex-col rounded-lg border border-accent/40 bg-surface shadow-card"
        data-testid="review-answer"
      >
        <SideLabel help={auto ? g.explanationHelp : undefined}>{auto ? g.explanation : g.answer}</SideLabel>
        <div className={cx("px-5 pb-5 sm:px-6 sm:pb-6", compact && "[&_.prose-card]:text-[1.05rem]!")}>
          <Markdown text={back || "…"} className="w-full" />
        </div>
      </section>
    </div>
  );
}

function SideLabel({ children, help }: { children: string; help?: string }) {
  return (
    <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 pb-2 pt-4 sm:px-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{children}</h3>
      {help ? <p className="text-xs text-subtle">{help}</p> : null}
    </header>
  );
}

/** Alternativen som studenten ser dem, med det rätta markerat (Sant/Falskt bredvid varandra). */
function OptionList({ kind, options }: { kind: CardKind; options: readonly CardOption[] }) {
  const t = useReviewT();
  const g = t.g;
  if (options.length === 0) return <p className="text-sm font-medium text-danger">{t.admin.alternativesHelp}</p>;
  const tf = kind === "sant-falskt";
  return (
    <ul className={cx("grid gap-2", tf && "grid-cols-2")} aria-label={g.options}>
      {options.map((o, i) => (
        <li
          key={`${i}-${o.text}`}
          className={cx(
            "flex items-start gap-3 rounded-md border-2 px-3.5 py-2.5",
            tf && "items-center justify-center text-center font-semibold",
            o.correct ? "border-accent bg-accent-soft/60" : "border-transparent bg-surface-2",
          )}
          data-correct={o.correct}
        >
          {tf ? null : (
            <span
              aria-hidden
              className={cx(
                "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                o.correct ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted",
              )}
            >
              {o.correct ? <Check size={14} strokeWidth={3} /> : String.fromCharCode(65 + i)}
            </span>
          )}
          {tf && o.correct ? <Check size={16} strokeWidth={3} aria-hidden className="shrink-0 text-accent-ink" /> : null}
          <span className={cx("min-w-0", !tf && "flex-1")}>{tf ? o.text : <Markdown text={o.text || "…"} variant="body" className="[&_p]:m-0" />}</span>
          <span className="sr-only">{o.correct ? g.correctOption : g.wrongOption}</span>
        </li>
      ))}
    </ul>
  );
}
