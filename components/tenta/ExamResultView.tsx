"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleMinus, FlaskConical, PenLine, RotateCcw, Undo2, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { Answer, Answers, Exam, ExamQuestion } from "@/lib/tentor/model";
import { gradeFor, hypotheticalTotal, type ExamResult, type QuestionResult } from "@/lib/tentor/grade";
import { startExamAttemptAction } from "@/lib/tentor/actions";
import { formatPoints, halfSteps, partOf } from "@/lib/tentor/session";
import { Markdown } from "@/components/markdown/Markdown";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cx } from "@/components/ui/cx";
import { ExamFigures } from "./ExamFigures";
import { PointsPicker } from "./PointsPicker";
import { StudentViewBar } from "./StudentView";

/** Tentan som den skickas till webbläsaren efter rättningen: med facit men utan källa och status. */
export type ResultExam = Omit<Exam, "source" | "status">;

type Props = {
  slug: string;
  exam: ResultExam;
  result: ExamResult;
  answers: Answers;
  selfGrades: Record<string, number>;
  points: number;
  grade: string;
  /** Formaterat på servern. */
  submittedWhen: string;
  preview: boolean;
  back: { href: string; label: string };
  attemptSuffix: string;
  studentViewDeck: string | null;
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

/** Stapel med poängen och betygsgränserna som streck; `ghost` visar det verkliga resultatet under det tänkta. */
function PointsBar({ points, ghost, max, grades, compact = false }: { points: number; ghost?: number | null; max: number; grades: Exam["grades"]; compact?: boolean }) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  return (
    <div className={compact ? "" : "mt-6"} aria-hidden>
      <div className={cx("relative rounded-full bg-surface-3", compact ? "h-2" : "h-3")}>
        {ghost !== undefined && ghost !== null ? <div className="absolute inset-y-0 left-0 rounded-full bg-fg/25" style={{ width: pct(ghost) }} /> : null}
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500" style={{ width: pct(points) }} />
        {grades.map((g) => (
          <span key={g.grade} className="absolute -bottom-1 -top-1 w-0.5 rounded bg-fg/70" style={{ left: pct(g.min) }} />
        ))}
      </div>
      {compact ? null : (
        <div className="relative mt-1.5 h-9 text-xs font-semibold text-muted">
          {grades.map((g) => (
            <span key={g.grade} className="absolute flex -translate-x-1/2 flex-col items-center tabular-nums leading-tight" style={{ left: pct(g.min) }}>
              <span className="text-fg">{g.grade}</span>
              <span className="font-medium">{formatPoints(g.min)} p</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function GradeBadge({ grade, size = "lg", testId }: { grade: string; size?: "lg" | "sm"; testId?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-full font-extrabold",
        size === "lg" ? "h-20 min-w-20 px-5 text-4xl" : "h-9 min-w-9 px-2.5 text-lg",
        grade === "U" ? "bg-surface-3 text-fg" : "bg-accent text-accent-fg",
      )}
      data-testid={testId}
    >
      {grade}
    </span>
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
              right && mine ? "border-accent bg-accent-soft/70" : right ? "border-dashed border-accent" : wrong ? "border-danger bg-danger-soft" : mine ? "border-fg/50 bg-surface-2" : "border-line",
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

function Mark({ ok, blank }: { ok: boolean; blank?: boolean }) {
  if (blank) return <CircleMinus size={16} aria-label={sv.tenta.outcome.obesvarad} className="text-muted" />;
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
            <tr key={i} className={cx("border-t border-line align-top", !r.ok && r.mine !== null && "bg-danger-soft/40")}>
              <td className="py-2.5 pr-3">
                <Markdown text={r.prompt} variant="body" className={inline} />
              </td>
              <td className={cx("py-2.5 pr-3 font-medium", r.mine === null && "text-muted", !r.ok && r.mine !== null && "text-danger")}>{r.mine ?? sv.tenta.noAnswer}</td>
              <td className="py-2.5 pr-3 font-medium text-accent-ink">{r.right}</td>
              <td className="py-2.5">
                <Mark ok={r.ok} blank={r.mine === null} />
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

/** Stegen i Tänk om: halva poäng upp till max, plus uppgiftens verkliga poäng (t.ex. 0,75). */
function whatIfSteps(max: number, actual: number): number[] {
  return [...new Set([...halfSteps(max), Math.round(actual * 100) / 100])].sort((a, b) => a - b);
}

/**
 * Resultatet efter rättningen: poäng, betyg och betygsgränserna överst, sedan varje uppgift med
 * studentens svar mot facit och lösningen. Tänk om låter studenten pröva andra poäng på valfria
 * uppgifter och se hur totalen och betyget hade ändrats; inget sparas.
 */
export function ExamResultView({ slug, exam, result, answers, selfGrades, points, grade, submittedWhen, preview, back, attemptSuffix, studentViewDeck }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("alla");
  const [whatIf, setWhatIf] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [retaking, startRetake] = useTransition();
  const parts = useMemo(() => partOf(exam.questions), [exam.questions]);
  const byId = useMemo(() => new Map(result.questions.map((r) => [r.id, r] as const)), [result.questions]);

  const selfQuestions = result.questions.filter((r) => r.outcome === "sjalv");
  const selfSum = selfQuestions.reduce((s, r) => s + Math.max(0, Math.min(r.max, selfGrades[r.id] ?? 0)), 0);
  const autoMax = result.maxPoints - result.selfMax;
  const actualOf = (r: QuestionResult) => (r.outcome === "sjalv" ? (selfGrades[r.id] ?? 0) : (r.points ?? 0));

  const changed = Object.keys(overrides).filter((id) => {
    const r = byId.get(id);
    return r && overrides[id] !== actualOf(r);
  });
  const hypo = whatIf && changed.length > 0;
  const shownPoints = hypo ? hypotheticalTotal(result, selfGrades, overrides) : points;
  const shownGrade = hypo ? gradeFor(shownPoints, exam.grades) : grade;
  const next = [...exam.grades].sort((a, b) => a.min - b.min).find((g) => g.min > shownPoints);

  function retake() {
    startRetake(async () => {
      const res = await startExamAttemptAction(slug, exam.key);
      if (res.ok) router.push(`/d/${slug}/tenta/${exam.key}?forsok=${res.data.attemptId}${attemptSuffix}`);
      else setError(res.error);
    });
  }

  function setOverride(id: string, v: number) {
    setOverrides((o) => ({ ...o, [id]: v }));
  }

  const visible = exam.questions.filter((q) => {
    const r = byId.get(q.id);
    if (filter === "fel") return r?.outcome === "fel" || r?.outcome === "delvis" || r?.outcome === "obesvarad";
    if (filter === "sjalv") return r?.outcome === "sjalv";
    return true;
  });

  return (
    <div data-testid="exam-result">
      {studentViewDeck ? <StudentViewBar deckId={studentViewDeck} mode="oppen" /> : null}
      <Link href={back.href} className="mb-5 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-muted hover:text-fg" data-testid="exam-back">
        <ArrowLeft size={16} aria-hidden />
        {back.label}
      </Link>
      <header className="anim-fade-up mb-5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-muted">
          {preview ? <Badge tone="strong">{sv.tenta.preview}</Badge> : null}
          <span>{sv.tenta.resultTitle}</span>
          <span className="font-medium">{sv.tenta.attemptRow(submittedWhen)}</span>
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{exam.title}</h1>
      </header>

      {/* Tänk om: kompakt sammanfattning som följer med när man rullar. */}
      {whatIf ? (
        <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6" data-testid="whatif-bar">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2">
              <GradeBadge grade={shownGrade} size="sm" />
              <span className="text-lg font-extrabold tabular-nums" data-testid="whatif-points">
                {formatPoints(shownPoints)} / {formatPoints(exam.maxPoints)} p
              </span>
            </span>
            <span className="min-w-0 flex-1 basis-40 text-sm">
              <span className={cx("font-bold", hypo ? "text-accent-ink" : "text-muted")}>{hypo ? sv.tenta.whatIfBadge : sv.tenta.whatIf}</span>
              <span className="block text-muted">{hypo ? `${sv.tenta.whatIfChanged(changed.length)}. ${sv.tenta.whatIfActual(formatPoints(points), grade)}` : sv.tenta.whatIfActual(formatPoints(points), grade)}</span>
            </span>
            <span className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setOverrides({})} disabled={!hypo} data-testid="whatif-reset">
                <Undo2 size={15} aria-hidden />
                {sv.tenta.whatIfReset}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setWhatIf(false); setOverrides({}); }} data-testid="whatif-exit">
                <X size={15} aria-hidden />
                <span className="hidden sm:inline">{sv.tenta.whatIfExit}</span>
                <span className="sr-only sm:hidden">{sv.tenta.whatIfExit}</span>
              </Button>
            </span>
          </div>
          <div className="mt-2">
            <PointsBar points={shownPoints} ghost={hypo ? points : null} max={exam.maxPoints} grades={exam.grades} compact />
          </div>
        </div>
      ) : null}

      <Card padding="lg" className={cx("anim-fade-up", hypo && "ring-2 ring-accent/50")} data-testid="result-summary">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">{hypo ? sv.tenta.whatIfBadge : sv.tenta.totalLabel}</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl" data-testid="result-points">
                {formatPoints(shownPoints)}
              </span>
              <span className="text-xl font-semibold text-muted">/ {formatPoints(exam.maxPoints)} p</span>
            </p>
            {next ? (
              <p className="mt-1.5 text-sm font-medium text-muted">{sv.tenta.toGrade(formatPoints(next.min - shownPoints), next.grade)}</p>
            ) : exam.grades.length > 0 ? (
              <p className="mt-1.5 text-sm font-medium text-accent-ink">{sv.tenta.topGrade}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-semibold text-muted">{sv.tenta.gradeLabel}</span>
            <GradeBadge grade={shownGrade} testId="result-grade" />
          </div>
        </div>
        {exam.grades.length > 0 ? <PointsBar points={shownPoints} ghost={hypo ? points : null} max={exam.maxPoints} grades={exam.grades} /> : null}
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-surface-2 px-4 py-3">
            <dt className="text-sm font-semibold text-muted">{sv.tenta.autoLabel}</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums" data-testid="result-auto">
              {sv.tenta.ofMax(formatPoints(result.autoPoints), formatPoints(autoMax))}
            </dd>
          </div>
          {selfQuestions.length > 0 ? (
            <div className="rounded-md bg-surface-2 px-4 py-3">
              <dt className="text-sm font-semibold text-muted">{sv.tenta.selfLabel}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums" data-testid="result-self">
                {sv.tenta.ofMax(formatPoints(selfSum), formatPoints(result.selfMax))}
              </dd>
            </div>
          ) : null}
        </dl>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {whatIf ? null : (
            <Button variant="inverse" onClick={() => setWhatIf(true)} data-testid="whatif-start">
              <FlaskConical size={16} aria-hidden />
              {sv.tenta.whatIf}
            </Button>
          )}
          <Button variant="outline" onClick={retake} disabled={retaking} data-testid="exam-retake">
            <RotateCcw size={16} aria-hidden />
            {retaking ? sv.tenta.starting : sv.tenta.retakeExam}
          </Button>
          <LinkButton href={back.href} variant="ghost">
            {back.label}
          </LinkButton>
        </div>
        {whatIf ? <p className="mt-3 text-sm text-muted">{sv.tenta.whatIfHelp}</p> : null}
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
          const actual = actualOf(r);
          const override = whatIf ? overrides[q.id] : undefined;
          const differs = override !== undefined && override !== actual;
          return (
            <Card key={q.id} padding="none" className={cx("overflow-hidden", differs && "ring-2 ring-accent/50")} data-testid={`result-${q.id}`} data-outcome={r.outcome}>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 pb-3.5 pt-4 sm:px-7">
                <div className="min-w-0">
                  {parts.get(q.id) ? <p className="text-sm font-semibold text-subtle">{parts.get(q.id)}</p> : null}
                  <h3 className="text-lg font-bold tracking-tight">{sv.tenta.question(q.id)}</h3>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", OUTCOME_STYLE[r.outcome])}>
                    <OutcomeIcon outcome={r.outcome} />
                    {self ? sv.tenta.selfGraded : sv.tenta.outcome[r.outcome]}
                  </span>
                  <span className="text-sm font-semibold tabular-nums" data-testid={`result-${q.id}-points`}>
                    {differs ? (
                      <s className="mr-2 font-medium text-muted" aria-label={sv.tenta.whatIfWas(formatPoints(actual))}>
                        {formatPoints(actual)}/{formatPoints(r.max)}
                      </s>
                    ) : null}
                    {formatPoints(differs ? override! : actual)}/{formatPoints(r.max)} p
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
                        <p className="mb-1.5 text-sm font-semibold text-muted">{sv.tenta.gradingSolution}</p>
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
              </div>
              {whatIf ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-accent/60 bg-accent-soft/30 px-5 py-3.5 sm:px-7" data-testid={`whatif-${q.id}`}>
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-ink">
                    <FlaskConical size={15} aria-hidden />
                    {sv.tenta.whatIfTag}
                  </span>
                  <PointsPicker
                    values={whatIfSteps(r.max, actual)}
                    value={override ?? actual}
                    onChange={(v) => setOverride(q.id, v)}
                    label={sv.tenta.whatIfPoints(q.id)}
                    testId={`whatif-${q.id}-points`}
                    size="sm"
                  />
                  {actual < r.max && (override ?? actual) < r.max ? (
                    <Button variant="ghost" size="sm" onClick={() => setOverride(q.id, r.max)} data-testid={`whatif-${q.id}-full`}>
                      {sv.tenta.whatIfFull}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
