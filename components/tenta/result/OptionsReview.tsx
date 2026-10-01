import { sv } from "@/lib/i18n/sv";
import type { Answer, ExamQuestion } from "@/lib/tentor/model";
import { Markdown } from "@/components/markdown/Markdown";
import { cx } from "@/components/ui/cx";
import { inlineMarkdown } from "../markdownClasses";
import { Tag } from "./Tag";

export function OptionsReview({ q, answer }: { q: ExamQuestion; answer: Answer | undefined }) {
  const chosen = new Set(answer?.kind === "flerval" ? (answer.choice === null ? [] : [answer.choice]) : answer?.kind === "flera" ? answer.choices : []);
  const showKey = !q.noKey;
  return (
    <ul className="grid gap-2">
      {(q.options ?? []).map((o, i) => {
        const mine = chosen.has(i);
        const right = showKey && o.correct;
        const wrong = showKey && mine && !o.correct;
        return (
          <li
            key={i}
            className={cx(
              "flex flex-wrap items-start gap-x-3 gap-y-1.5 rounded-md border px-4 py-3",
              right && mine ? "border-accent bg-accent-soft/70" : right ? "border-dashed border-accent" : wrong ? "border-danger bg-danger-soft" : mine ? "border-fg/50 bg-surface-2" : "border-line",
            )}
            data-testid={`review-option-${i}`}
          >
            <span className={cx("mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center border-2", q.kind === "flerval" ? "rounded-full" : "rounded", mine ? "border-fg bg-fg" : "border-line-strong")} aria-hidden>
              {mine ? <span className={cx("h-1.5 w-1.5 bg-bg", q.kind === "flerval" ? "rounded-full" : "rounded-[1px]")} /> : null}
            </span>
            <Markdown text={o.text} variant="body" className={cx("min-w-0 flex-1", inlineMarkdown)} />
            <span className="flex basis-full flex-wrap gap-1 pl-7 empty:hidden sm:basis-auto sm:justify-end sm:pl-0">
              {mine ? <Tag tone={wrong ? "wrong" : right ? "right" : "mine"}>{sv.tenta.yourAnswer}</Tag> : null}
              {right ? <Tag tone="right">{sv.tenta.correctAnswer}</Tag> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
