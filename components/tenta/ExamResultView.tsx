"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleMinus, FlaskConical, PenLine, RotateCcw, Undo2, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Answers, Exam } from "@/lib/tentor/model";
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
import { AnswerReview } from "./result/AnswerReview";
import { GradeBadge } from "./result/GradeBadge";
import { PointsBar } from "./result/PointsBar";
import { KeepDates } from "@/components/ui/KeepDates";
import { routes } from "@/lib/routes";

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
  const sv = useT();
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
      if (res.ok) router.push(`${routes.examAttempt(slug, exam.key, { forsok: res.data.attemptId })}${attemptSuffix}`);
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
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          <KeepDates>{exam.title}</KeepDates>
        </h1>
      </header>

      {/* Tänk om: kompakt sammanfattning som följer med när man rullar. */}
      {whatIf ? (
        <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6" data-testid="whatif-bar">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2">
              <GradeBadge grade={shownGrade} size="sm" />
              <span className="text-lg font-extrabold tabular-nums" data-testid="whatif-points">
                {formatPoints(shownPoints, sv.meta.locale)} / {formatPoints(exam.maxPoints, sv.meta.locale)} p
              </span>
            </span>
            <span className="min-w-0 flex-1 basis-40 text-sm">
              <span className={cx("font-bold", hypo ? "text-accent-ink" : "text-muted")}>{hypo ? sv.tenta.whatIfBadge : sv.tenta.whatIf}</span>
              <span className="block text-muted">{hypo ? `${sv.tenta.whatIfChanged(changed.length)}. ${sv.tenta.whatIfActual(formatPoints(points, sv.meta.locale), grade)}` : sv.tenta.whatIfActual(formatPoints(points, sv.meta.locale), grade)}</span>
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
                {formatPoints(shownPoints, sv.meta.locale)}
              </span>
              <span className="text-xl font-semibold text-muted">/ {formatPoints(exam.maxPoints, sv.meta.locale)} p</span>
            </p>
            {next ? (
              <p className="mt-1.5 text-sm font-medium text-muted">{sv.tenta.toGrade(formatPoints(next.min - shownPoints, sv.meta.locale), next.grade)}</p>
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
              {sv.tenta.ofMax(formatPoints(result.autoPoints, sv.meta.locale), formatPoints(autoMax, sv.meta.locale))}
            </dd>
          </div>
          {selfQuestions.length > 0 ? (
            <div className="rounded-md bg-surface-2 px-4 py-3">
              <dt className="text-sm font-semibold text-muted">{sv.tenta.selfLabel}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums" data-testid="result-self">
                {sv.tenta.ofMax(formatPoints(selfSum, sv.meta.locale), formatPoints(result.selfMax, sv.meta.locale))}
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
                      <s className="mr-2 font-medium text-muted" aria-label={sv.tenta.whatIfWas(formatPoints(actual, sv.meta.locale))}>
                        {formatPoints(actual, sv.meta.locale)}/{formatPoints(r.max, sv.meta.locale)}
                      </s>
                    ) : null}
                    {formatPoints(differs ? override! : actual, sv.meta.locale)}/{formatPoints(r.max, sv.meta.locale)} p
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
