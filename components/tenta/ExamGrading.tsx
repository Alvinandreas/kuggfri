"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { choicesForPair, type Answer, type Answers, type StudentQuestion } from "@/lib/tentor/model";
import { finishGradingAction, saveSelfGradesAction } from "@/lib/tentor/actions";
import { formatPoints, halfSteps, step } from "@/lib/tentor/session";
import { Markdown } from "@/components/markdown/Markdown";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cx } from "@/components/ui/cx";
import { ExamFigures } from "./ExamFigures";
import { inlineMarkdown } from "./markdownClasses";
import { PointsPicker } from "./PointsPicker";
import { StudentViewBar } from "./StudentView";

export type GradingQuestion = {
  /** Uppgiften som studenten såg den (utan facit). */
  question: StudentQuestion;
  part: string | null;
  /** Lösningsförslaget. */
  solution: string | null;
  noKey: boolean;
};

type Props = {
  title: string;
  attemptId: string;
  questions: GradingQuestion[];
  answers: Answers;
  /** Bedömningar som redan sparats (studenten kan gå ifrån mitt i rättningen). */
  initialGrades: Record<string, number>;
  preview: boolean;
  exitHref: string | null;
  studentViewDeck: string | null;
};

/** Studentens svar som det lämnades in, utan rätt eller fel (för uppgifter utan facit och skrivuppgifter). */
function MyAnswer({ q, answer }: { q: StudentQuestion; answer: Answer | undefined }) {
  const sv = useT();
  const none = <span className="text-muted">{sv.tenta.noAnswer}</span>;
  const box = "min-h-24 rounded-md bg-surface-2 px-4 py-3 text-[0.95rem]";
  switch (q.kind) {
    case "text":
    case "numerisk": {
      const v = answer?.kind === q.kind ? answer.value.trim() : "";
      const unit = q.kind === "numerisk" && q.unit && q.unit !== "-" ? ` ${q.unit}` : "";
      return <div className={cx(box, "whitespace-pre-wrap")}>{v ? `${v}${unit}` : none}</div>;
    }
    case "flerval":
    case "flera": {
      const chosen = answer?.kind === "flerval" ? (answer.choice === null ? [] : [answer.choice]) : answer?.kind === "flera" ? answer.choices : [];
      if (chosen.length === 0) return <div className={box}>{none}</div>;
      return (
        <ul className={cx(box, "grid gap-1.5")}>
          {chosen.map((i) => (
            <li key={i}>
              <Markdown text={q.options?.[i] ?? ""} variant="body" className={inlineMarkdown} />
            </li>
          ))}
        </ul>
      );
    }
    case "sant-falskt": {
      const values = answer?.kind === "sant-falskt" ? answer.values : [];
      return (
        <ul className={cx(box, "grid gap-2")}>
          {(q.statements ?? []).map((s, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <Markdown text={s} variant="body" className={cx("min-w-0 flex-1", inlineMarkdown)} />
              <span className="shrink-0 font-semibold">{values[i] === true ? sv.tenta.trueLabel : values[i] === false ? sv.tenta.falseLabel : "-"}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "para": {
      const values = answer?.kind === "para" ? answer.values : [];
      return (
        <ul className={cx(box, "grid gap-2")}>
          {(q.pairs ?? []).map((p, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <Markdown text={p} variant="body" className={cx("min-w-0 flex-1", inlineMarkdown)} />
              <span className="shrink-0 font-semibold">{values[i] && choicesForPair(q, i).includes(values[i]!) ? values[i] : "-"}</span>
            </li>
          ))}
        </ul>
      );
    }
  }
}

/**
 * Rättningsläget efter inlämningen: studenten bedömer sina skrivuppgifter (och uppgifter utan
 * facit) mot lösningsförslagen, en i taget och utan att se något resultat. Bedömningarna sparas
 * löpande; först när hen trycker Rätta räknar servern ut totalen och betyget och sidan visar
 * resultatet.
 */
export function ExamGrading({ title, attemptId, questions, answers, initialGrades, preview, exitHref, studentViewDeck }: Props) {
  const sv = useT();
  const router = useRouter();
  const [grades, setGrades] = useState<Record<string, number>>(initialGrades);
  const [current, setCurrent] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(grades);
  const queue = useRef<Promise<void>>(Promise.resolve());

  // Varje val sparas direkt, i tur och ordning (alltid alla bedömningar hittills), så att inget
  // försvinner om studenten går ifrån och ett äldre svar aldrig skriver över ett nyare.
  function choose(id: string, v: number) {
    const next = { ...latest.current, [id]: v };
    latest.current = next;
    setGrades(next);
    setError(null);
    queue.current = queue.current
      .then(() => saveSelfGradesAction(attemptId, next))
      .then((res) => {
        if (!res.ok) setError(res.error);
      })
      .catch(() => setError(sv.errors.generic));
  }

  async function finish() {
    setFinishing(true);
    setError(null);
    await queue.current;
    const res = await finishGradingAction(attemptId, latest.current).catch(() => null);
    if (res?.ok || res?.error === sv.tenta.alreadyGraded) {
      window.scrollTo({ top: 0 });
      router.refresh();
      return;
    }
    setFinishing(false);
    setError(res?.error ?? sv.errors.generic);
  }

  function go(index: number) {
    setCurrent(index);
    window.scrollTo({ top: 0 });
  }

  const graded = questions.filter((g) => grades[g.question.id] !== undefined).length;
  const missing = questions.length - graded;
  const item = questions[current]!;
  const q = item.question;
  const value = grades[q.id];

  return (
    <div data-testid="exam-grading" data-attempt={attemptId}>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-black/10 bg-inverse text-inverse-fg dark:border-line dark:bg-surface dark:text-fg">
        <div className="mx-auto flex h-14 max-w-[96rem] items-center gap-2 px-3 sm:gap-4 sm:px-5">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-[0.95rem] font-semibold">
            <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold dark:bg-surface-2">{sv.tenta.gradingTitle}</span>
            <span className="truncate" title={title}>
              {title}
            </span>
          </p>
          <span className="hidden text-sm font-semibold tabular-nums opacity-80 sm:inline" data-testid="grading-progress">
            {sv.tenta.gradingProgress(graded, questions.length)}
          </span>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={finishing}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60"
            data-testid="grading-finish"
          >
            <CheckCheck size={16} aria-hidden />
            {sv.tenta.gradeButton}
          </button>
        </div>
      </header>

      <div className="pb-44 pt-10 sm:pb-36">
        {studentViewDeck ? <StudentViewBar deckId={studentViewDeck} mode="oppen" className="mb-4" /> : null}
        {preview ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-line-strong bg-surface-2 px-4 py-2.5 text-sm font-medium dark:border-transparent" role="note">
            <span>{sv.tenta.previewBody}</span>
            {exitHref ? (
              <Link href={exitHref} className="font-semibold underline underline-offset-2" data-testid="exit-preview">
                {sv.tenta.exitPreview}
              </Link>
            ) : null}
          </div>
        ) : null}
        <p className="mb-4 flex items-start gap-2.5 text-[0.95rem] text-muted">
          <ClipboardCheck size={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            {sv.tenta.gradingIntro}
            <span className="ml-1 font-semibold text-fg sm:hidden">{sv.tenta.gradingProgress(graded, questions.length)}.</span>
          </span>
        </p>

        <article key={q.id} aria-labelledby={`bedom-${q.id}`} className="rounded-lg border border-line bg-surface dark:border-transparent" data-testid="grading-question" data-question={q.id}>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
            <div className="min-w-0">
              {item.part ? <p className="text-sm font-semibold text-subtle">{item.part}</p> : null}
              <h1 id={`bedom-${q.id}`} className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">
                {sv.tenta.question(q.id)}
              </h1>
            </div>
            <span className="text-sm font-semibold text-muted">{sv.tenta.totalPoints(formatPoints(q.points, sv.meta.locale))}</span>
          </div>
          <div className="px-5 py-6 sm:px-8">
            <ExamFigures images={q.images} size="md" className="mb-5" />
            <Markdown text={q.prompt} variant="body" className="text-[1.05rem]" />
          </div>
          <div className="grid gap-5 border-t border-line px-5 py-6 sm:px-8 lg:grid-cols-2">
            <section aria-label={sv.tenta.yourAnswer}>
              <h2 className="mb-2 text-sm font-bold">{sv.tenta.yourAnswer}</h2>
              <MyAnswer q={q} answer={answers[q.id]} />
            </section>
            <section aria-label={sv.tenta.gradingSolution}>
              <h2 className="mb-2 text-sm font-bold text-accent-ink">{sv.tenta.gradingSolution}</h2>
              <div className="rounded-md border border-accent/50 bg-accent-soft/40 px-4 py-3">
                {item.noKey ? <p className="mb-2 text-sm font-medium text-muted">{sv.tenta.noKeyNote}</p> : null}
                <Markdown text={item.solution ?? sv.tenta.missingSolution} variant="body" />
              </div>
            </section>
          </div>
          <div className="border-t border-line bg-surface-2/50 px-5 py-5 sm:px-8 dark:bg-surface-2/30">
            <p className="font-bold">{sv.tenta.gradingPointsTitle}</p>
            <p className="mb-3 text-sm text-muted">{sv.tenta.gradingPointsHelp}</p>
            <PointsPicker values={halfSteps(q.points)} value={value} onChange={(v) => choose(q.id, v)} label={sv.tenta.selfGradeLabel(q.id)} testId={`self-grade-${q.id}`} />
          </div>
        </article>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <nav aria-label={sv.tenta.gradingNav} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-[0_-4px_16px_rgb(0_0_0/0.05)]">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-1 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 sm:px-5 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1.5 pt-1.5" data-testid="grading-nav">
            {questions.map((g, i) => {
              const done = grades[g.question.id] !== undefined;
              return (
                <button
                  key={g.question.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={sv.tenta.gradingBox(g.question.id, done)}
                  aria-current={i === current ? "step" : undefined}
                  data-graded={done ? "true" : undefined}
                  data-testid={`grade-box-${g.question.id}`}
                  className={cx(
                    "relative inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md border px-1.5 text-sm font-semibold tabular-nums transition-colors duration-150",
                    done ? "border-inverse bg-inverse text-inverse-fg" : "border-line-strong bg-surface text-fg hover:bg-surface-2",
                    i === current && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
                  )}
                >
                  {g.question.id}
                </button>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => go(step(current, -1, questions.length))} disabled={current === 0} data-testid="grading-prev">
              <ChevronLeft size={16} aria-hidden />
              <span className="hidden sm:inline">{sv.tenta.prev}</span>
              <span className="sr-only sm:hidden">{sv.tenta.prev}</span>
            </Button>
            {current < questions.length - 1 ? (
              <Button variant="inverse" size="sm" onClick={() => go(step(current, 1, questions.length))} data-testid="grading-next">
                <span>{sv.tenta.next}</span>
                <ChevronRight size={16} aria-hidden />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={finishing} data-testid="grading-finish-last">
                <CheckCheck size={16} aria-hidden />
                {sv.tenta.gradeButton}
              </Button>
            )}
          </div>
        </div>
      </nav>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        locked={finishing}
        title={sv.tenta.gradeConfirmTitle}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={finishing}>
              {sv.tenta.gradeCancel}
            </Button>
            <Button onClick={() => void finish()} disabled={finishing} data-testid="grading-confirm">
              <CheckCheck size={16} aria-hidden />
              {finishing ? sv.tenta.grading : sv.tenta.gradeButton}
            </Button>
          </>
        }
      >
        <div className="grid gap-3" data-testid="grading-summary">
          <p className="font-medium">{missing === 0 ? sv.tenta.gradeConfirmAll : sv.tenta.gradeConfirmMissing(missing)}</p>
          {missing > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {questions
                .filter((g) => grades[g.question.id] === undefined)
                .map((g) => (
                  <button
                    key={g.question.id}
                    type="button"
                    onClick={() => {
                      setConfirmOpen(false);
                      go(questions.indexOf(g));
                    }}
                    aria-label={sv.tenta.goTo(g.question.id)}
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-line-strong px-1.5 text-sm font-semibold tabular-nums hover:bg-surface-2"
                  >
                    {g.question.id}
                  </button>
                ))}
            </div>
          ) : null}
          <p className="text-sm text-muted">{sv.tenta.gradeConfirmNote}</p>
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
