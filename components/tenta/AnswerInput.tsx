"use client";

import { useId } from "react";
import { RotateCcw } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { Answer, StudentQuestion } from "@/lib/tentor/model";
import { choicesForPair, isAnswered } from "@/lib/tentor/model";
import { formatPoints, wordCount } from "@/lib/tentor/session";
import { Markdown } from "@/components/markdown/Markdown";
import { Badge } from "@/components/ui/Badge";
import { Checkbox, Radio } from "@/components/ui/Choice";
import { Select } from "@/components/ui/Select";
import { inputClass } from "@/components/ui/TextField";
import { textareaClass } from "@/components/ui/TextArea";
import { cx } from "@/components/ui/cx";
import { inlineMarkdown } from "./markdownClasses";

type Props = { q: StudentQuestion; answer: Answer | undefined; onChange: (a: Answer | undefined) => void };

/** Ett alternativ i en lista (flerval och flera): hela raden är klickbar, som i Inspera. */
function OptionRow({ checked, children, control }: { checked: boolean; children: React.ReactNode; control: React.ReactNode }) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors duration-150",
        checked ? "border-accent bg-accent-soft/60 dark:bg-accent-soft/50" : "border-line-strong/70 hover:bg-surface-2 dark:border-line-strong",
        "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/20",
      )}
    >
      <span className="mt-[0.2rem] shrink-0">{control}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

/** Rubriken över svarsdelen (Insperas "Välj ett alternativ:") och Rensa svaret. */
function AnswerHead({ id, label, extra, onClear }: { id: string; label: string; extra?: React.ReactNode; onClear?: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p id={id} className="flex items-center gap-2 text-[0.95rem] font-semibold">
        {label}
        {extra}
      </p>
      {onClear ? (
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
          <RotateCcw size={14} aria-hidden />
          {sv.tenta.clearAnswer}
        </button>
      ) : null}
    </div>
  );
}

/** Poängregeln när uppgiften har minuspoäng, som i originalet: rätt ger sin andel, fel ger avdrag. */
function PenaltyRule({ q }: { q: StudentQuestion }) {
  if (!q.penalty) return null;
  const parts = q.kind === "sant-falskt" ? (q.statements?.length ?? 0) : q.kind === "para" ? (q.pairs?.length ?? 0) : (q.correctCount ?? 0);
  if (parts === 0) return null;
  return (
    <p className="mb-3 rounded-md bg-surface-2 px-3 py-2 text-sm text-muted" data-testid="penalty-rule">
      {sv.tenta.penaltyRule(formatPoints(q.points / parts), formatPoints(q.penalty))}
    </p>
  );
}

/**
 * Svarsdelen för en uppgift, med Insperas etiketter. Ingen återkoppling: rätt eller fel syns
 * först i resultatet efter inlämningen.
 */
export function AnswerInput({ q, answer, onChange }: Props) {
  const headId = useId();
  const clear = isAnswered(answer) ? () => onChange(undefined) : undefined;

  switch (q.kind) {
    case "flerval": {
      const choice = answer?.kind === "flerval" ? answer.choice : null;
      return (
        <div role="radiogroup" aria-labelledby={headId}>
          <AnswerHead id={headId} label={sv.tenta.chooseOne} onClear={clear} />
          <div className="grid gap-2">
            {(q.options ?? []).map((o, i) => (
              <OptionRow
                key={i}
                checked={choice === i}
                control={<Radio name={`q-${q.id}`} checked={choice === i} onChange={() => onChange({ kind: "flerval", choice: i })} data-testid={`option-${i}`} />}
              >
                <Markdown text={o} variant="body" className={inlineMarkdown} />
              </OptionRow>
            ))}
          </div>
        </div>
      );
    }
    case "flera": {
      const chosen = answer?.kind === "flera" ? answer.choices : [];
      const toggle = (i: number) => {
        const next = chosen.includes(i) ? chosen.filter((c) => c !== i) : [...chosen, i].sort((a, b) => a - b);
        onChange(next.length ? { kind: "flera", choices: next } : undefined);
      };
      return (
        <div role="group" aria-labelledby={headId}>
          <AnswerHead id={headId} label={sv.tenta.chooseMany} extra={q.correctCount && !q.penalty ? <Badge tone="outline">{sv.tenta.chooseN(q.correctCount)}</Badge> : null} onClear={clear} />
          <PenaltyRule q={q} />
          <div className="grid gap-2">
            {(q.options ?? []).map((o, i) => (
              <OptionRow key={i} checked={chosen.includes(i)} control={<Checkbox checked={chosen.includes(i)} onChange={() => toggle(i)} data-testid={`option-${i}`} />}>
                <Markdown text={o} variant="body" className={inlineMarkdown} />
              </OptionRow>
            ))}
          </div>
        </div>
      );
    }
    case "sant-falskt": {
      const statements = q.statements ?? [];
      const values = answer?.kind === "sant-falskt" ? answer.values : statements.map(() => null);
      const set = (i: number, v: boolean) => {
        const next = statements.map((_, j) => (j === i ? v : (values[j] ?? null)));
        onChange({ kind: "sant-falskt", values: next });
      };
      return (
        <div>
          <AnswerHead id={headId} label={sv.tenta.trueFalse} onClear={clear} />
          <PenaltyRule q={q} />
          <table className="w-full border-collapse text-left" aria-labelledby={headId}>
            <thead>
              <tr className="text-sm text-muted">
                <th scope="col" className="pb-2 pr-3 font-semibold">
                  {sv.tenta.statement}
                </th>
                <th scope="col" className="w-16 pb-2 text-center font-semibold sm:w-20">
                  {sv.tenta.trueLabel}
                </th>
                <th scope="col" className="w-16 pb-2 text-center font-semibold sm:w-20">
                  {sv.tenta.falseLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="py-3 pr-3">
                    <Markdown text={s} variant="body" className={inlineMarkdown} />
                  </td>
                  {[true, false].map((v) => (
                    <td key={String(v)} className="py-3 text-center">
                      <label className="inline-flex h-8 w-10 cursor-pointer items-center justify-center rounded-md hover:bg-surface-2">
                        <Radio
                          name={`q-${q.id}-${i}`}
                          checked={values[i] === v}
                          onChange={() => set(i, v)}
                          aria-label={`${v ? sv.tenta.trueLabel : sv.tenta.falseLabel}, ${sv.tenta.statement.toLowerCase()} ${i + 1}`}
                          data-testid={`statement-${i}-${v ? "sant" : "falskt"}`}
                        />
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "para": {
      const pairs = q.pairs ?? [];
      const values = answer?.kind === "para" ? answer.values : pairs.map(() => null);
      const optionsFor = (i: number) => [{ value: "", label: sv.tenta.choose }, ...choicesForPair(q, i).map((c) => ({ value: c, label: c }))];
      const set = (i: number, v: string) => {
        const next = pairs.map((_, j) => (j === i ? v || null : (values[j] ?? null)));
        onChange(next.some((x) => x !== null) ? { kind: "para", values: next } : undefined);
      };
      return (
        <div role="group" aria-labelledby={headId}>
          <AnswerHead id={headId} label={sv.tenta.pairs} onClear={clear} />
          <PenaltyRule q={q} />
          <div className="grid gap-2">
            {pairs.map((p, i) => (
              <div key={i} className="grid items-center gap-2 border-t border-line pt-2 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_17rem] sm:gap-4">
                <div className="min-w-0 font-medium">
                  <Markdown text={p} variant="body" className={inlineMarkdown} />
                </div>
                <Select value={values[i] ?? ""} onChange={(v) => set(i, v)} options={optionsFor(i)} label={`${sv.tenta.choose}: ${p}`} data-testid={`pair-${i}`} />
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "numerisk": {
      const value = answer?.kind === "numerisk" ? answer.value : "";
      const unit = q.unit && q.unit !== "-" ? q.unit : null;
      return (
        <div>
          <AnswerHead id={headId} label={sv.tenta.numeric} onClear={clear} />
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              aria-labelledby={headId}
              aria-describedby={`${headId}-hint`}
              value={value}
              maxLength={60}
              onChange={(e) => onChange(e.target.value ? { kind: "numerisk", value: e.target.value } : undefined)}
              className={cx(inputClass, "h-12 w-full max-w-[14rem] text-lg tabular-nums")}
              data-testid="numeric-answer"
            />
            {unit ? <span className="text-lg font-medium">{unit}</span> : null}
          </div>
          <p id={`${headId}-hint`} className="mt-2 text-sm text-muted">
            {sv.tenta.numericHint}
          </p>
        </div>
      );
    }
    case "text": {
      const value = answer?.kind === "text" ? answer.value : "";
      return (
        <div>
          <AnswerHead id={headId} label={sv.tenta.text} />
          <textarea
            aria-labelledby={headId}
            value={value}
            rows={10}
            spellCheck={false}
            maxLength={20000}
            onChange={(e) => onChange(e.target.value ? { kind: "text", value: e.target.value } : undefined)}
            className={cx(textareaClass, "min-h-56")}
            data-testid="text-answer"
          />
          <p className="mt-1.5 text-right text-sm tabular-nums text-muted" aria-live="off">
            {sv.tenta.words(wordCount(value))}
          </p>
        </div>
      );
    }
  }
}
