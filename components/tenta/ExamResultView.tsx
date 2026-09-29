"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleMinus, PenLine, RotateCcw, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { Answer, Answers, Exam, ExamQuestion } from "@/lib/tentor/model";
import type { ExamResult, QuestionResult } from "@/lib/tentor/grade";
import { saveSelfGradesAction, startExamAttemptAction } from "@/lib/tentor/actions";
import { formatPoints, halfSteps, partOf } from "@/lib/tentor/session";
import { Markdown } from "@/components/markdown/Markdown";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { cx } from "@/components/ui/cx";
import { ExamFigures } from "./ExamFigures";

/** Tentan som den skickas till webbläsaren efter inlämning: med facit men utan källa och status. */
export type ResultExam = Omit<Exam, "source" | "status">;

type Props = {
  slug: string;
  exam: ResultExam;
  attemptId: string;
  result: ExamResult;
  answers: Answers;
  selfGrades: Record<string, number>;
  points: number;
  grade: string;
  /** Formaterat på servern. */
  submittedWhen: string;
  preview: boolean;
};

type Filter = "alla" | "fel" | "sjalv";

const inline = "[&_p]:m-0 [&_.katex-display]:my-1";

const OUTCOME_STYLE: Record<QuestionResult["outcome"], string> = {
  ratt: "bg-accent-soft text-accent-ink",
  delvis: "bg-chart-3/15 text-fg",
  fel: "bg-danger-soft text-danger",
  obesvarad: "border border-line-strong text-muted",
  sjalv: "bg-inverse text-inverse-fg",
};

function OutcomeIcon({ outcome }: { outcome: QuestionResult["outcome"] }) {
  if (outcome === "ratt") return <Check size={14} strokeWidth={2.6} aria-hidden />;
  if (outcome === "fel") return <X size={14} strokeWidth={2.6} aria-hidden />;
  if (outcome === "sjalv") return <PenLine size={13} aria-hidden />;
  return <CircleMinus size={14} aria-hidden />;
}

/** Stapel med poängen och betygsgränserna som streck. */
function PointsBar({ points, max, grades }: { points: number; max: number; grades: Exam["grades"] }) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  return (
    <div className="mt-5" aria-hidden>
      <div className="relative h-3 rounded-full bg-surface-3">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500" style={{ width: pct(points) }} />
        {grades.map((g) => (
          <span key={g.grade} className="absolute -bottom-1 -top-1 w-0.5 rounded bg-fg/70" style={{ left: pct(g.min) }} />
        ))}
      </div>
      <div className="relative mt-1.5 h-4 text-xs font-semibold text-muted">
        {grades.map((g) => (
          <span key={g.grade} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(g.min) }}>
            {g.grade}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tag({ tone, children }: { tone: "right" | "wrong" | "mine"; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
        tone === "right" ? "bg-accent text-accent-fg" : tone === "wrong" ? "bg-danger text-white dark:text-bg" : "bg-surface-3 text-fg",
      )}
    >
      {children}
    </span>
  );
}

function OptionsReview({ q, answer }: { q: ExamQuestion; answer: Answer | undefined }) {
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
              right && mine ? "border-accent bg-accent-soft/70" : right ? "border-accent border-dashed" : wrong ? "border-danger bg-danger-soft" : mine ? "border-fg/50 bg-surface-2" : "border-line",
            )}
            data-testid={`review-option-${i}`}
          >
            <span className={cx("mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center border-2", q.kind === "flerval" ? "rounded-full" : "rounded", mine ? "border-fg bg-fg" : "border-line-strong")} aria-hidden>
              {mine ? <span className={cx("h-1.5 w-1.5 bg-bg", q.kind === "flerval" ? "rounded-full" : "rounded-[1px]")} /> : null}
            </span>
            <Markdown text={o.text} variant="body" className={cx("min-w-0 flex-1", inline)} />
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

function Mark({ ok }: { ok: boolean }) {
  return ok ? <Check size={16} strokeWidth={2.6} aria-label={sv.tenta.outcome.ratt} className="text-accent" /> : <X size={16} strokeWidth={2.6} aria-label={sv.tenta.outcome.fel} className="text-danger" />;
}

function TableReview({ rows, head }: { rows: { prompt: string; mine: string | null; right: string; ok: boolean }[]; head: string }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-left text-[0.95rem]">
        <thead>
          <tr className="text-sm text-muted">
            <th scope="col" className="pb-2 pr-3 font-semibold">
              {head}
            </th>
            <th scope="col" className="pb-2 pr-3 font-semibold">
              {sv.tenta.yourAnswer}
            </th>
            <th scope="col" className="pb-2 pr-3 font-semibold">
              {sv.tenta.correctAnswer}
            </th>
            <th scope="col" className="w-8 pb-2">
              <span className="sr-only">{sv.tenta.resultTitle}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cx("border-t border-line align-top", !r.ok && "bg-danger-soft/40")}>
              <td className="py-2.5 pr-3">
                <Markdown text={r.prompt} variant="body" className={inline} />
              </td>
              <td className={cx("py-2.5 pr-3 font-medium", r.mine === null && "text-muted", !r.ok && r.mine !== null && "text-danger")}>{r.mine ?? sv.tenta.noAnswer}</td>
              <td className="py-2.5 pr-3 font-medium text-accent-ink">{r.right}</td>
              <td className="py-2.5">
                <Mark ok={r.ok} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnswerReview({ q, answer, outcome }: { q: ExamQuestion; answer: Answer | undefined; outcome: QuestionResult["outcome"] }) {
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

function SelfGrade({ id, max, value, onChange, busy }: { id: string; max: number; value: number | undefined; onChange: (v: number) => void; busy: boolean }) {
  const steps = halfSteps(max);
  const label = sv.tenta.selfGradeLabel(id);
  return (
    <div className="mt-5 rounded-lg border-2 border-dashed border-line-strong p-4 sm:p-5" data-testid={`self-grade-${id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 font-bold">
          <PenLine size={16} aria-hidden />
          {sv.tenta.selfGradeTitle}
        </p>
        <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-bold", value === undefined ? "bg-surface-3 text-muted" : "bg-inverse text-inverse-fg")}>
          {value === undefined ? sv.tenta.notSelfGraded : `${sv.tenta.selfGraded}: ${formatPoints(value)}/${formatPoints(max)} p`}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{sv.tenta.selfGradeHelp}</p>
      {steps.length <= 13 ? (
        <div role="radiogroup" aria-label={label} className="mt-3 flex flex-wrap gap-1.5">
          {steps.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              disabled={busy}
              onClick={() => onChange(v)}
              className={cx(
                "inline-flex h-10 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-semibold tabular-nums transition-colors disabled:opacity-60",
                value === v ? "border-inverse bg-inverse text-inverse-fg" : "border-line-strong hover:bg-surface-2",
              )}
              data-testid={`self-grade-${id}-${v}`}
            >
              {formatPoints(v)}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 max-w-[12rem]">
          <Select
            value={value === undefined ? "" : String(v2(value))}
            onChange={(s) => s !== "" && onChange(Number(s))}
            options={[{ value: "", label: "-" }, ...steps.map((v) => ({ value: String(v), label: formatPoints(v) }))]}
            label={label}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}

const v2 = (n: number) => Math.round(n * 2) / 2;

/**
 * Resultatet efter inlämning: poäng och betyg, och varje uppgift med studentens svar mot facit,
 * lösningen och (för skrivuppgifter) studentens egen bedömning.
 */
export function ExamResultView({ slug, exam, attemptId, result, answers, selfGrades: initialSelf, points: initialPoints, grade: initialGrade, submittedWhen, preview }: Props) {
  const router = useRouter();
  const [selfGrades, setSelfGrades] = useState(initialSelf);
  const [total, setTotal] = useState({ points: initialPoints, grade: initialGrade });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("alla");
  const [retaking, startRetake] = useTransition();
  const parts = useMemo(() => partOf(exam.questions), [exam.questions]);
  const byId = useMemo(() => new Map(result.questions.map((r) => [r.id, r] as const)), [result.questions]);

  const selfQuestions = result.questions.filter((r) => r.outcome === "sjalv");
  const selfSum = selfQuestions.reduce((s, r) => s + (selfGrades[r.id] ?? 0), 0);
  const unassessed = selfQuestions.filter((r) => selfGrades[r.id] === undefined).length;

  async function grade(id: string, v: number) {
    const next = { ...selfGrades, [id]: v };
    setSelfGrades(next);
    setBusy(true);
    setError(null);
    const res = await saveSelfGradesAction(attemptId, next).catch(() => null);
    setBusy(false);
    if (res?.ok) setTotal(res.data);
    else setError(res?.error ?? sv.errors.generic);
  }

  function retake() {
    startRetake(async () => {
      const res = await startExamAttemptAction(slug, exam.key);
      if (res.ok) router.push(`/d/${slug}/tenta/${exam.key}?forsok=${res.data.attemptId}`);
      else setError(res.error);
    });
  }

  const visible = exam.questions.filter((q) => {
    const r = byId.get(q.id);
    if (filter === "fel") return r?.outcome === "fel" || r?.outcome === "delvis" || r?.outcome === "obesvarad";
    if (filter === "sjalv") return r?.outcome === "sjalv";
    return true;
  });

  return (
    <div data-testid="exam-result">
      <Link href={`/d/${slug}/tenta`} className="mb-5 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft size={16} aria-hidden />
        {sv.tenta.toList}
      </Link>
      <header className="anim-fade-up mb-6">
        <p className="text-sm font-semibold text-muted">
          {preview ? `${sv.tenta.preview} · ` : ""}
          {sv.tenta.resultTitle} · {sv.tenta.attemptRow(submittedWhen)}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{exam.title}</h1>
      </header>

      <Card padding="lg" className="anim-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-muted">{sv.tenta.pointsOf(formatPoints(total.points), formatPoints(exam.maxPoints))}</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tabular-nums tracking-tight" data-testid="result-points">
                {formatPoints(total.points)}
              </span>
              <span className="text-xl font-semibold text-muted">/ {formatPoints(exam.maxPoints)}</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              {sv.tenta.autoPart(formatPoints(result.autoPoints))}
              {selfQuestions.length > 0 ? ` · ${sv.tenta.selfPart(formatPoints(selfSum), formatPoints(result.selfMax))}` : null}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-semibold text-muted">{sv.tenta.gradeLabel}</span>
            <span
              className={cx("mt-1 inline-flex h-16 min-w-16 items-center justify-center rounded-full px-4 text-3xl font-extrabold", total.grade === "U" ? "bg-surface-3 text-fg" : "bg-accent text-accent-fg")}
              data-testid="result-grade"
            >
              {total.grade}
            </span>
          </div>
        </div>
        {exam.grades.length > 0 ? <PointsBar points={total.points} max={exam.maxPoints} grades={exam.grades} /> : null}
        {unassessed > 0 ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm font-medium">
            <PenLine size={15} aria-hidden />
            {sv.tenta.selfPending}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button onClick={retake} disabled={retaking} data-testid="exam-retake">
            <RotateCcw size={16} aria-hidden />
            {retaking ? sv.tenta.starting : sv.tenta.retakeExam}
          </Button>
          <LinkButton href={`/d/${slug}/tenta`} variant="outline">
            {sv.tenta.toList}
          </LinkButton>
        </div>
      </Card>

      <div className="mb-4 mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">{sv.tenta.navLabel}</h2>
        <SegmentedControl
          label={sv.tenta.filterLabel}
          size="sm"
          value={filter}
          onChange={setFilter}
          segments={[
            { value: "alla", label: sv.tenta.filterAll },
            { value: "fel", label: sv.tenta.filterWrong },
            ...(selfQuestions.length > 0 ? [{ value: "sjalv" as const, label: sv.tenta.filterSelf }] : []),
          ]}
        />
      </div>

      <div className="grid gap-4">
        {visible.map((q) => {
          const r = byId.get(q.id);
          if (!r) return null;
          const self = r.outcome === "sjalv";
          const mine = answers[q.id];
          const got = self ? selfGrades[q.id] : r.points;
          return (
            <Card key={q.id} padding="none" className="overflow-hidden" data-testid={`result-${q.id}`} data-outcome={r.outcome}>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 pb-3.5 pt-4 sm:px-7">
                <div className="min-w-0">
                  {parts.get(q.id) ? <p className="text-sm font-semibold text-subtle">{parts.get(q.id)}</p> : null}
                  <h3 className="text-lg font-bold tracking-tight">{sv.tenta.question(q.id)}</h3>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", OUTCOME_STYLE[r.outcome])}>
                    <OutcomeIcon outcome={r.outcome} />
                    {self && got !== undefined ? sv.tenta.selfGraded : sv.tenta.outcome[r.outcome]}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {got === undefined || got === null ? "-" : formatPoints(got)}/{formatPoints(r.max)} p
                  </span>
                </div>
              </div>
              <div className="px-5 py-5 sm:px-7">
                <ExamFigures images={q.images} size="md" className="mb-4" />
                <Markdown text={q.prompt} variant="body" />
                <div className="mt-5">
                  {q.noKey ? <p className="mb-3 text-sm font-medium text-muted">{sv.tenta.noKeyNote}</p> : null}
                  {q.kind === "text" ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="mb-1.5 text-sm font-semibold text-muted">{sv.tenta.yourAnswer}</p>
                        <div className="min-h-24 whitespace-pre-wrap rounded-md bg-surface-2 px-4 py-3 text-[0.95rem]">
                          {mine?.kind === "text" && mine.value.trim() ? mine.value : <span className="text-muted">{sv.tenta.noAnswer}</span>}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-sm font-semibold text-muted">{sv.tenta.solution}</p>
                        <div className="rounded-md border border-accent/50 bg-accent-soft/40 px-4 py-3">
                          <Markdown text={q.solution ?? sv.tenta.missingSolution} variant="body" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <AnswerReview q={q} answer={mine} outcome={r.outcome} />
                  )}
                </div>
                {q.kind !== "text" && q.solution ? (
                  <div className="mt-4 rounded-md border border-accent/50 bg-accent-soft/40 px-4 py-3">
                    <p className="mb-1 text-sm font-bold text-accent-ink">{sv.tenta.solution}</p>
                    <Markdown text={q.solution} variant="body" />
                  </div>
                ) : null}
                {self ? <SelfGrade id={q.id} max={r.max} value={selfGrades[q.id]} onChange={(v) => void grade(q.id, v)} busy={busy} /> : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
