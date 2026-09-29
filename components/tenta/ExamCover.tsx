"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Flag, Lock, PenLine, Save } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { GradeLimit, QuestionKind } from "@/lib/tentor/model";
import { startExamAttemptAction } from "@/lib/tentor/actions";
import { deadlineMs, formatClock, formatDuration, formatPoints, kindSummary, timeLeftMs } from "@/lib/tentor/session";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StudentViewBar } from "./StudentView";

export type CoverExam = {
  key: string;
  title: string;
  /** Formaterat på servern (samma text i server- och klientrenderingen). */
  dateLabel: string | null;
  durationMinutes: number;
  maxPoints: number;
  grades: GradeLimit[];
  aids: string | null;
  instructions: string | null;
  questionCount: number;
  kinds: { kind: QuestionKind; count: number }[];
};

type Props = {
  deck: { slug: string; title: string; course_code: string | null };
  exam: CoverExam;
  inProgress: { id: string; startedAt: string } | null;
  /** Inlämnat men inte rättat (rättningsläget). */
  grading: { id: string } | null;
  /** Rättade försök, nyaste först; when är formaterat på servern. */
  submitted: { id: string; when: string; points: number; grade: string }[];
  serverNow: number;
  preview: boolean;
  /** Vägen tillbaka: tentalägets lista, eller Tentor i admin när förhandsgranskningen startades där. */
  back: { href: string; label: string };
  /** Läggs till försökslänkarna ("&fran=admin" från admin). */
  attemptSuffix: string;
  /** Redaktörens studentvy: kursens id för raden överst. */
  studentViewDeck: string | null;
};

const HOW_ICONS = [Clock, Save, Lock, PenLine];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line py-3 first:border-t-0 sm:grid sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium sm:mt-0">{children}</dd>
    </div>
  );
}

/** Tentans försättsblad: allt man får veta innan man vänder på pappret, och Starta tentan. */
export function ExamCover({ deck, exam, inProgress, grading, submitted, serverNow, preview, back, attemptSuffix, studentViewDeck }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const base = `/d/${deck.slug}/tenta/${exam.key}`;

  useEffect(() => {
    if (!inProgress) return;
    const offset = serverNow - Date.now();
    const deadline = deadlineMs(inProgress.startedAt, exam.durationMinutes);
    const tick = () => setLeft(timeLeftMs(deadline, Date.now() + offset));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [inProgress, serverNow, exam.durationMinutes]);

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await startExamAttemptAction(deck.slug, exam.key);
      if (res.ok) router.push(`${base}?forsok=${res.data.attemptId}${attemptSuffix}`);
      else setError(res.error);
    });
  }

  const date = exam.dateLabel;
  return (
    <div className="mx-auto max-w-3xl" data-testid="exam-cover">
      {studentViewDeck ? <StudentViewBar deckId={studentViewDeck} mode="oppen" /> : null}
      <Link href={back.href} className="mb-5 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-muted hover:text-fg" data-testid="exam-back">
        <ArrowLeft size={16} aria-hidden />
        {back.label}
      </Link>
      {preview ? (
        <p className="mb-4 rounded-lg border border-line-strong bg-surface-2 px-4 py-3 text-sm font-medium dark:border-transparent" role="note">
          <span className="font-bold">{sv.tenta.preview}.</span> {sv.tenta.previewBody}
        </p>
      ) : null}
      <Card padding="none" className="anim-fade-up overflow-hidden">
        <div className="border-b border-line bg-surface-2/60 px-6 py-6 sm:px-9 sm:py-8 dark:bg-surface-2/40">
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm font-semibold text-muted">
            <span>{sv.tenta.coverKicker}</span>
            <span className="font-medium">
              {deck.title}
              {deck.course_code ? ` ${deck.course_code}` : ""}
            </span>
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{exam.title}</h1>
        </div>
        <div className="px-6 pb-7 pt-3 sm:px-9">
          <dl>
            {date ? <Row label={sv.tenta.coverDate}>{date}</Row> : null}
            <Row label={sv.tenta.coverDuration}>{formatDuration(exam.durationMinutes)}</Row>
            <Row label={sv.tenta.coverMaxPoints}>{sv.tenta.pointsLong(formatPoints(exam.maxPoints))}</Row>
            {exam.grades.length > 0 ? (
              <Row label={sv.tenta.coverGrades}>
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  {exam.grades.map((g) => (
                    <span key={g.grade} className="tabular-nums">
                      {sv.tenta.gradeLimit(g.grade, formatPoints(g.min))}
                    </span>
                  ))}
                </span>
              </Row>
            ) : null}
            <Row label={sv.tenta.coverAids}>{exam.aids ?? sv.tenta.noAids}</Row>
            <Row label={sv.tenta.coverQuestions}>
              {sv.tenta.questionCount(exam.questionCount)}
              <span className="mt-0.5 block text-sm font-normal text-muted">{kindSummary(exam.kinds)}</span>
            </Row>
            {exam.instructions ? <Row label={sv.tenta.coverInstructions}>{exam.instructions}</Row> : null}
          </dl>

          <div className="mt-6 rounded-lg bg-surface-2 p-5 dark:bg-surface-2/70">
            <h2 className="font-bold">{sv.tenta.howTitle}</h2>
            <ul className="mt-3 grid gap-2.5 text-sm">
              {sv.tenta.how.map((line, i) => {
                const Icon = HOW_ICONS[i] ?? Flag;
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <Icon size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
                    <span>{line}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            {inProgress ? (
              <p className="text-sm font-medium text-muted" data-testid="resume-hint">
                {left !== null ? sv.tenta.resumeHint(formatClock(left)) : null}
              </p>
            ) : grading ? (
              <p className="text-sm font-medium text-muted" data-testid="grading-hint">
                {sv.tenta.gradingHint}
              </p>
            ) : (
              <span />
            )}
            {inProgress ? (
              <Button size="lg" onClick={() => router.push(`${base}?forsok=${inProgress.id}${attemptSuffix}`)} data-testid="exam-resume">
                {sv.tenta.resumeExam}
                <ArrowRight size={18} aria-hidden />
              </Button>
            ) : grading ? (
              <Button size="lg" onClick={() => router.push(`${base}?forsok=${grading.id}${attemptSuffix}`)} data-testid="exam-continue-grading">
                {sv.tenta.gradingContinue}
                <ArrowRight size={18} aria-hidden />
              </Button>
            ) : (
              <Button size="lg" onClick={start} disabled={pending} data-testid="exam-start">
                {pending ? sv.tenta.starting : sv.tenta.startExam}
                <ArrowRight size={18} aria-hidden />
              </Button>
            )}
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </Card>

      {submitted.length > 0 ? (
        <section aria-labelledby="dina-forsok" className="mt-8">
          <h2 id="dina-forsok" className="mb-3 text-lg font-bold tracking-tight">
            {sv.tenta.previousAttempts}
          </h2>
          <ul className="grid gap-2">
            {submitted.map((a) => (
              <li key={a.id}>
                <Link
                  href={`${base}?forsok=${a.id}${attemptSuffix}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-5 py-3.5 transition-colors hover:bg-surface-2 dark:border-transparent"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-muted">
                    <CheckCircle2 size={16} aria-hidden className="text-accent" />
                    {sv.tenta.attemptRow(a.when)}
                  </span>
                  <span className="inline-flex items-center gap-3 text-sm">
                    <span className="font-semibold tabular-nums">{sv.tenta.resultShort(formatPoints(a.points), formatPoints(exam.maxPoints), a.grade)}</span>
                    <span className="font-semibold text-accent-ink">{sv.tenta.showResult}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
