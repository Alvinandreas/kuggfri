import { sv } from "@/lib/i18n/sv";
import type { Answer, ExamQuestion } from "@/lib/tentor/model";
import type { QuestionResult } from "@/lib/tentor/grade";
import { formatPoints } from "@/lib/tentor/session";
import { cx } from "@/components/ui/cx";
import { OptionsReview } from "./OptionsReview";
import { TableReview } from "./TableReview";

/** Studentens svar mot facit för de automatiskt rättade uppgiftstyperna (skrivuppgifter visas i resultatvyn). */
export function AnswerReview({ q, answer, outcome }: { q: ExamQuestion; answer: Answer | undefined; outcome: QuestionResult["outcome"] }) {
  switch (q.kind) {
    case "flerval":
    case "flera":
      return <OptionsReview q={q} answer={answer} />;
    case "sant-falskt": {
      const values = answer?.kind === "sant-falskt" ? answer.values : [];
      const label = (v: boolean | null | undefined) => (v === true ? sv.tenta.trueLabel : v === false ? sv.tenta.falseLabel : null);
      return (
        <TableReview
          head={sv.tenta.statement}
          rows={(q.statements ?? []).map((s, i) => ({ prompt: s.text, mine: label(values[i]), right: label(s.answer) ?? "", ok: values[i] === s.answer }))}
        />
      );
    }
    case "para": {
      const values = answer?.kind === "para" ? answer.values : [];
      return <TableReview head={sv.tenta.pairHead} rows={(q.pairs ?? []).map((p, i) => ({ prompt: p.prompt, mine: values[i] ?? null, right: p.answer, ok: values[i] === p.answer }))} />;
    }
    case "numerisk": {
      const mine = answer?.kind === "numerisk" && answer.value.trim() ? answer.value.trim() : null;
      const key = q.numeric;
      const unit = key?.unit && key.unit !== "-" ? ` ${key.unit}` : "";
      const tol = key ? (key.relative ? `${formatPoints(key.tolerance * 100)} %` : formatPoints(key.tolerance)) : "";
      const ok = outcome === "ratt";
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={cx("rounded-md border px-4 py-3", mine === null ? "border-line" : ok ? "border-accent bg-accent-soft/60" : "border-danger bg-danger-soft")}>
            <p className="text-sm font-semibold text-muted">{sv.tenta.yourAnswer}</p>
            <p className={cx("mt-1 text-lg font-bold tabular-nums", mine === null && "font-medium text-muted")}>{mine ? `${mine}${unit}` : sv.tenta.noAnswer}</p>
          </div>
          {key && !q.noKey ? (
            <div className="rounded-md border border-accent px-4 py-3">
              <p className="text-sm font-semibold text-muted">{sv.tenta.correctAnswer}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-accent-ink">
                {formatPoints(key.value)}
                {unit} <span className="text-sm font-medium text-muted">{key.tolerance > 0 ? sv.tenta.tolerance(tol) : null}</span>
              </p>
            </div>
          ) : null}
        </div>
      );
    }
    case "text":
      return null;
  }
}
