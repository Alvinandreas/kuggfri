"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Cloud, CloudOff, Eye, EyeOff, Flag, Send, Timer } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Answer, Answers, StudentExam } from "@/lib/tentor/model";
import { saveExamAnswersAction, submitExamAction } from "@/lib/tentor/actions";
import {
  deadlineMs,
  dueWarning,
  formatClock,
  formatPoints,
  navBoxes,
  parseStored,
  partOf,
  sanitizeAnswers,
  step,
  storageKey,
  submitSummary,
  timeLeftMs,
  toggleFlag,
} from "@/lib/tentor/session";
import { Markdown } from "@/components/markdown/Markdown";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cx } from "@/components/ui/cx";
import { AnswerInput } from "./AnswerInput";
import { ExamFigures } from "./ExamFigures";
import { StudentViewBar } from "./StudentView";

type Props = {
  exam: StudentExam;
  attemptId: string;
  startedAt: string;
  /** Serverns klocka när sidan renderades: klockan räknar mot servertid, inte enhetens. */
  serverNow: number;
  initialAnswers: Answers;
  preview: boolean;
  /** Förhandsgranskning: vägen ut (Tentor i admin eller tentalägets lista). Studenter har ingen. */
  exitHref: string | null;
  /** Redaktörens studentvy: kursens id för raden överst. */
  studentViewDeck: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "local" | "error";

const SAVE_DELAY_MS = 3000;

/**
 * Tentan under skrivtiden, i Insperas form: fast toppbalk med tentans namn, klocka och Lämna in,
 * en uppgift i taget och en fast navigeringsrad längst ner med en ruta per uppgift. Svaren
 * sparas direkt i webbläsaren och några sekunder senare på servern. Inget facit här.
 */
export function ExamRunner({ exam, attemptId, startedAt, serverNow, initialAnswers, preview, exitHref, studentViewDeck }: Props) {
  const sv = useT();
  const router = useRouter();
  const questions = exam.questions;
  const deadline = useMemo(() => deadlineMs(startedAt, exam.durationMinutes), [startedAt, exam.durationMinutes]);
  const parts = useMemo(() => partOf(questions), [questions]);

  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [flags, setFlags] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [clockHidden, setClockHidden] = useState(false);
  const [warning, setWarning] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const answersRef = useRef(answers);
  const dirty = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const warned = useRef<number[]>([]);
  const submitted = useRef(false);

  // Klockan: skillnaden mot serverns klocka mäts en gång, sedan tickar den varje sekund.
  useEffect(() => {
    const offset = serverNow - Date.now();
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [serverNow]);

  // Det som sparats i webbläsaren (samma försök) går före serverns kopia: det skrivs först.
  useEffect(() => {
    try {
      const stored = parseStored(localStorage.getItem(storageKey(attemptId)));
      if (stored) {
        setAnswers({ ...initialAnswers, ...sanitizeAnswers(questions, stored.answers) });
        setFlags(stored.flags.filter((f) => questions.some((q) => q.id === f)));
        const raw = localStorage.getItem(`${storageKey(attemptId)}:uppgift`);
        const idx = raw ? Number(raw) : 0;
        if (Number.isInteger(idx) && idx >= 0 && idx < questions.length) setCurrent(idx);
      }
    } catch {
      // Blockerad lagring: svaren sparas bara på servern.
    }
    setLoaded(true);
  }, [attemptId, initialAnswers, questions]);

  const saveNow = useCallback(async () => {
    if (!dirty.current || submitted.current) return;
    dirty.current = false;
    setSaveState("saving");
    const res = await saveExamAnswersAction(attemptId, answersRef.current).catch(() => null);
    if (submitted.current) return;
    if (res?.ok) setSaveState(dirty.current ? "local" : "saved");
    else {
      dirty.current = true;
      setSaveState("error");
    }
  }, [attemptId]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Varje ändring: direkt i webbläsaren, till servern efter några sekunders lugn.
  useEffect(() => {
    if (!loaded || submitted.current) return;
    try {
      localStorage.setItem(storageKey(attemptId), JSON.stringify({ answers, flags, savedAt: Date.now() }));
      localStorage.setItem(`${storageKey(attemptId)}:uppgift`, String(current));
    } catch {
      // Ignoreras: servern får svaren strax.
    }
  }, [answers, flags, current, loaded, attemptId]);

  function change(id: string, a: Answer | undefined) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (a) next[id] = a;
      else delete next[id];
      return next;
    });
    dirty.current = true;
    setSaveState("local");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveNow(), SAVE_DELAY_MS);
  }

  // Misslyckad sparning försöks igen; och när sidan lämnas skickas det som inte hunnit sparas.
  useEffect(() => {
    if (saveState !== "error") return;
    const t = window.setTimeout(() => void saveNow(), 10_000);
    return () => window.clearTimeout(t);
  }, [saveState, saveNow]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") void saveNow();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [saveNow]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    setSubmitError(null);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const res = await submitExamAction(attemptId, answersRef.current).catch(() => null);
    if (res?.ok || res?.error === sv.tenta.alreadySubmitted) {
      try {
        localStorage.removeItem(storageKey(attemptId));
        localStorage.removeItem(`${storageKey(attemptId)}:uppgift`);
      } catch {
        // Ingenting att städa.
      }
      window.scrollTo({ top: 0 });
      router.refresh();
      return;
    }
    submitted.current = false;
    setSubmitting(false);
    setSubmitError(res?.error ?? sv.errors.generic);
  }, [attemptId, router, sv]);

  const left = now === null ? null : timeLeftMs(deadline, now);

  // Varningar vid 15 och 5 minuter, och inlämning när tiden är ute.
  useEffect(() => {
    if (left === null) return;
    const { warn, shown } = dueWarning(left, warned.current);
    warned.current = shown;
    if (warn !== null) setWarning(warn);
    if (left === 0 && !submitted.current) {
      setTimeUp(true);
      setConfirmOpen(false);
      void submit();
    }
  }, [left, submit]);

  function go(index: number) {
    setCurrent(index);
    window.scrollTo({ top: 0 });
  }

  const q = questions[current]!;
  const flagged = flags.includes(q.id);
  const groups = navBoxes(questions, answers, flags, current);
  const summary = submitSummary(questions, answers, flags);
  const clock = left === null ? "-:--:--" : formatClock(left);
  const urgent = left !== null && left <= 5 * 60_000;

  return (
    <div data-testid="exam-runner" data-attempt={attemptId}>
      {/* Toppbalken, fast som i Inspera */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-black/10 bg-inverse text-inverse-fg dark:border-line dark:bg-surface dark:text-fg">
        <div className="mx-auto flex h-14 max-w-[96rem] items-center gap-2 px-3 sm:gap-4 sm:px-5">
          <p className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold" title={exam.title}>
            {preview ? <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg">{sv.tenta.preview}</span> : null}
            {exam.title}
          </p>
          <span className="hidden items-center gap-1.5 text-sm opacity-75 md:inline-flex" aria-live="polite" data-testid="save-state">
            {saveState === "error" ? <CloudOff size={15} aria-hidden /> : saveState === "idle" ? null : <Cloud size={15} aria-hidden />}
            {saveState === "saving" ? sv.tenta.saving : saveState === "saved" ? sv.tenta.saved : saveState === "local" ? sv.tenta.savedLocal : saveState === "error" ? sv.tenta.savedLocal : null}
          </span>
          <div className={cx("flex items-center gap-1 rounded-full pl-3 pr-1", urgent && !clockHidden ? "bg-danger text-white dark:text-bg" : "bg-white/10 dark:bg-surface-2")}>
            <Timer size={16} aria-hidden className="shrink-0" />
            <span
              role="timer"
              aria-label={clockHidden ? sv.tenta.clockHidden : `${sv.tenta.timeLeft}: ${clock}`}
              className={cx("min-w-[4.2rem] text-center font-semibold tabular-nums", clockHidden && "text-sm font-medium opacity-70")}
              data-testid="exam-clock"
            >
              {clockHidden ? <span className="sr-only sm:not-sr-only">{sv.tenta.clockHidden}</span> : clock}
            </span>
            <button
              type="button"
              onClick={() => setClockHidden((h) => !h)}
              aria-label={clockHidden ? sv.tenta.showClock : sv.tenta.hideClock}
              title={clockHidden ? sv.tenta.showClock : sv.tenta.hideClock}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 dark:hover:bg-surface-3"
            >
              {clockHidden ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={submitting}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60"
            data-testid="exam-submit"
          >
            <Send size={15} aria-hidden />
            {sv.tenta.submit}
          </button>
        </div>
      </header>

      <div className="pb-48 pt-10 sm:pb-40">
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
        {warning !== null ? (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger" data-testid="time-warning">
            <span className="inline-flex items-center gap-2">
              <AlertTriangle size={17} aria-hidden className="shrink-0" />
              {sv.tenta.warning(warning)}
            </span>
            <button type="button" onClick={() => setWarning(null)} className="rounded-full px-2 py-0.5 hover:bg-danger/10">
              {sv.common.close}
            </button>
          </div>
        ) : null}

        <article key={q.id} aria-labelledby={`uppgift-${q.id}`} className="rounded-lg border border-line bg-surface dark:border-transparent" data-testid="exam-question" data-question={q.id}>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
            <div className="min-w-0">
              {parts.get(q.id) ? <p className="text-sm font-semibold text-subtle">{parts.get(q.id)}</p> : null}
              <h1 id={`uppgift-${q.id}`} className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">
                {sv.tenta.question(q.id)}
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {flagged ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-chart-3">
                  <Flag size={14} aria-hidden className="fill-current" />
                  {sv.tenta.flaggedNote}
                </span>
              ) : null}
              <span className="font-semibold text-muted">{sv.tenta.totalPoints(formatPoints(q.points, sv.meta.locale))}</span>
            </div>
          </div>
          <div className="px-5 py-6 sm:px-8">
            <ExamFigures images={q.images} size="lg" className="mb-5" />
            <Markdown text={q.prompt} variant="body" className="text-[1.05rem]" />
          </div>
          <div className="border-t border-line px-5 py-6 sm:px-8">
            <AnswerInput q={q} answer={answers[q.id]} onChange={(a) => change(q.id, a)} />
          </div>
        </article>
      </div>

      {/* Navigeringsraden, fast längst ner som i Inspera */}
      <nav aria-label={sv.tenta.navLabel} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-[0_-4px_16px_rgb(0_0_0/0.05)]">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-1 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 sm:px-5 lg:flex-row lg:items-center lg:gap-6">
          <ol className="flex min-w-0 flex-1 items-end gap-5 overflow-x-auto px-1 pb-1.5 pt-1" data-testid="exam-nav">
            {groups.map((g, gi) => (
              <li key={`${g.part ?? "del"}-${gi}`} className="shrink-0">
                {g.part ? <p className="mb-1 text-xs font-semibold text-subtle">{g.part}</p> : null}
                <div className="flex gap-1.5">
                  {g.boxes.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => go(b.index)}
                      aria-label={sv.tenta.boxLabel(b.id, b.answered, b.flagged)}
                      aria-current={b.current ? "step" : undefined}
                      data-answered={b.answered ? "true" : undefined}
                      data-flagged={b.flagged ? "true" : undefined}
                      data-testid={`nav-box-${b.id}`}
                      className={cx(
                        "relative inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-1.5 text-sm font-semibold tabular-nums transition-colors duration-150",
                        b.answered ? "border-inverse bg-inverse text-inverse-fg" : "border-line-strong bg-surface text-fg hover:bg-surface-2",
                        b.current && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
                      )}
                    >
                      {b.id}
                      {b.flagged ? <span aria-hidden className="absolute -right-px -top-px h-[1.05rem] w-[1.05rem] rounded-tr-md bg-chart-3 [clip-path:polygon(0_0,100%_0,100%_100%)]" /> : null}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <div className="flex shrink-0 items-center justify-between gap-2">
            <Button
              variant={flagged ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFlags((f) => toggleFlag(f, q.id))}
              aria-pressed={flagged}
              data-testid="flag-toggle"
            >
              <Flag size={15} aria-hidden className={cx(flagged && "fill-current text-chart-3")} />
              {flagged ? sv.tenta.unflag : sv.tenta.flag}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => go(step(current, -1, questions.length))} disabled={current === 0} data-testid="exam-prev">
                <ChevronLeft size={16} aria-hidden />
                <span className="hidden sm:inline">{sv.tenta.prev}</span>
                <span className="sr-only sm:hidden">{sv.tenta.prev}</span>
              </Button>
              <Button variant="inverse" size="sm" onClick={() => go(step(current, 1, questions.length))} disabled={current === questions.length - 1} data-testid="exam-next">
                <span>{sv.tenta.next}</span>
                <ChevronRight size={16} aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <Modal
        open={confirmOpen || timeUp}
        onClose={() => setConfirmOpen(false)}
        locked={submitting || timeUp}
        title={timeUp ? sv.tenta.timeUpTitle : sv.tenta.submitTitle}
        size="md"
        footer={
          timeUp ? null : (
            <>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                {sv.tenta.submitCancel}
              </Button>
              <Button onClick={() => void submit()} disabled={submitting} data-testid="exam-submit-confirm">
                <Send size={16} aria-hidden />
                {submitting ? sv.tenta.submitting : sv.tenta.submitConfirm}
              </Button>
            </>
          )
        }
      >
        {timeUp ? (
          <p className="text-muted" role="status">
            {sv.tenta.timeUpBody} {submitting ? sv.tenta.submitting : null}
          </p>
        ) : (
          <div className="grid gap-4" data-testid="submit-summary">
            {summary.unanswered.length === 0 ? <p className="font-medium">{sv.tenta.submitAllAnswered}</p> : null}
            {summary.unanswered.length > 0 ? (
              <div>
                <p className="font-semibold">{sv.tenta.submitUnanswered(summary.unanswered.length)}</p>
                <JumpList ids={summary.unanswered} onJump={(id) => { setConfirmOpen(false); go(questions.findIndex((x) => x.id === id)); }} />
              </div>
            ) : null}
            {summary.flagged.length > 0 ? (
              <div>
                <p className="inline-flex items-center gap-1.5 font-semibold">
                  <Flag size={15} aria-hidden className="fill-current text-chart-3" />
                  {sv.tenta.submitFlagged(summary.flagged.length)}
                </p>
                <JumpList ids={summary.flagged} onJump={(id) => { setConfirmOpen(false); go(questions.findIndex((x) => x.id === id)); }} />
              </div>
            ) : null}
            <p className="text-sm text-muted">{sv.tenta.submitNote}</p>
            {submitError ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {submitError}
              </p>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}

function JumpList({ ids, onJump }: { ids: string[]; onJump: (id: string) => void }) {
  const sv = useT();
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onJump(id)}
          aria-label={sv.tenta.goTo(id)}
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-line-strong px-1.5 text-sm font-semibold tabular-nums hover:bg-surface-2"
        >
          {id}
        </button>
      ))}
    </div>
  );
}
