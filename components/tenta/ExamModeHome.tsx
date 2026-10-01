import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardPen, Clock, ListChecks, Lock, LockOpen, Trophy } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { ExamSummary } from "@/lib/tentor/queries";
import { attemptOverview, formatDuration, formatExamDate, formatPoints, kindSummary, type AttemptInfo } from "@/lib/tentor/session";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { StudentViewBar, StudentViewButton } from "./StudentView";
import { KeepDates } from "@/components/ui/KeepDates";
import { routes } from "@/lib/routes";

type Deck = { id: string; slug: string; title: string; course_code: string | null };

async function Header({ deck }: { deck: Deck }) {
  const sv = await getT();
  return (
    <header className="anim-fade-up mb-8">
      <div className="flex min-w-0 items-start gap-4">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink sm:inline-flex">
          <ClipboardPen size={24} aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{sv.tenta.title}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span>{deck.title}</span>
            {deck.course_code ? <Badge tone="outline">{deck.course_code}</Badge> : null}
          </p>
        </div>
      </div>
    </header>
  );
}

/** Låst för studenterna: lugn låsvy med vägen tillbaka till korten. Ingen lista. */
export async function ExamModeLocked({ deck, studentView = false }: { deck: Deck; studentView?: boolean }) {
  const sv = await getT();
  return (
    <div>
      {studentView ? <StudentViewBar deckId={deck.id} mode="last" /> : null}
      <Header deck={deck} />
      <Card padding="lg" className="anim-fade-up mx-auto max-w-2xl text-center" data-testid="exam-mode-locked">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-fg">
          <Lock size={28} strokeWidth={1.8} aria-hidden />
        </span>
        <h2 className="mt-5 text-2xl font-bold tracking-tight">{sv.tenta.lockedTitle}</h2>
        <p className="mx-auto mt-3 max-w-lg text-muted">{sv.tenta.lockedBody}</p>
        <p className="mx-auto mt-2 max-w-lg text-muted">{sv.tenta.lockedHint}</p>
        <div className="mt-7 flex justify-center">
          <LinkButton href={routes.deck(deck.slug)}>
            {sv.tenta.toCoursePage}
            <ArrowRight size={17} aria-hidden />
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}

function Meta({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={15} aria-hidden className="shrink-0 text-subtle" />
      {children}
    </span>
  );
}

async function ExamRow({ exam, attempts, slug, now, showDraft }: { exam: ExamSummary; attempts: AttemptInfo[]; slug: string; now: number; showDraft: boolean }) {
  const sv = await getT();
  const { inProgress, grading, latest, best, submitted } = attemptOverview(attempts, exam.durationMinutes, now);
  const href = routes.examAttempt(slug, exam.key);
  const max = formatPoints(exam.maxPoints, sv.meta.locale);
  const date = formatExamDate(exam.date, sv.meta.locale);
  return (
    <li>
      <Card padding="none" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6" data-testid={`exam-row-${exam.key}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">
              <Link href={href} className="rounded-sm hover:underline">
                <KeepDates>{exam.title}</KeepDates>
              </Link>
            </h2>
            {showDraft && exam.status === "utkast" ? <Badge tone="outline">{sv.tenta.draft}</Badge> : null}
            {inProgress ? <Badge tone="accent">{sv.tenta.inProgress}</Badge> : grading ? <Badge tone="strong">{sv.tenta.gradingPending}</Badge> : null}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            {date ? <Meta icon={CalendarDays}>{date}</Meta> : null}
            <Meta icon={Clock}>{formatDuration(exam.durationMinutes, sv)}</Meta>
            <Meta icon={Trophy}>{sv.tenta.pointsLong(max)}</Meta>
            <Meta icon={ListChecks}>{sv.tenta.questionCount(exam.questionCount)}</Meta>
          </p>
          <p className="mt-1.5 text-sm text-subtle">{kindSummary(exam.kinds, sv)}</p>
          {best && latest ? (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="exam-row-result">
              <span className="font-semibold">
                {sv.tenta.best}: {sv.tenta.resultShort(formatPoints(Number(best.points ?? 0), sv.meta.locale), max, best.grade ?? "U")}
              </span>
              {latest.id !== best.id ? (
                <span className="text-muted">
                  {sv.tenta.latest}: {sv.tenta.resultShort(formatPoints(Number(latest.points ?? 0), sv.meta.locale), max, latest.grade ?? "U")}
                </span>
              ) : null}
              <span className="text-subtle">{sv.tenta.attemptsCount(submitted)}</span>
              <Link href={routes.examAttempt(slug, exam.key, { forsok: latest.id })} className="font-semibold text-accent-ink underline-offset-2 hover:underline">
                {sv.tenta.showResult}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="shrink-0">
          {inProgress ? (
            <LinkButton href={routes.examAttempt(slug, exam.key, { forsok: inProgress.id })} className="w-full sm:w-auto">
              {sv.tenta.resume}
              <ArrowRight size={17} aria-hidden />
            </LinkButton>
          ) : grading ? (
            <LinkButton href={routes.examAttempt(slug, exam.key, { forsok: grading.id })} className="w-full sm:w-auto" data-testid="exam-row-grade">
              {sv.tenta.gradingContinue}
              <ArrowRight size={17} aria-hidden />
            </LinkButton>
          ) : (
            <LinkButton href={href} variant={latest ? "outline" : "primary"} className="w-full sm:w-auto">
              {sv.tenta.start}
              <ArrowRight size={17} aria-hidden />
            </LinkButton>
          )}
        </div>
      </Card>
    </li>
  );
}

/** Tentalägets startsida: tentorna, nyaste först, med studentens resultat. */
export async function ExamModeHome({
  deck,
  exams,
  attempts,
  canEdit,
  studentView = false,
  studentsCanSee,
  now,
}: {
  deck: Deck;
  exams: ExamSummary[];
  attempts: AttemptInfo[];
  /** Redaktör i redaktörens vy: statusraden, utkastmärkningen och Visa som student. */
  canEdit: boolean;
  /** Redaktör i studentvyn: som för en student, med raden överst. */
  studentView?: boolean;
  /** Tentaläget öppet och kursen publicerad. */
  studentsCanSee: boolean;
  now: number;
}) {
  const sv = await getT();
  return (
    <div>
      {studentView ? <StudentViewBar deckId={deck.id} mode="oppen" /> : null}
      <Header deck={deck} />
      <p className="anim-fade-up -mt-3 mb-6 max-w-3xl text-muted">{sv.tenta.intro}</p>
      {canEdit ? (
        <div
          role="status"
          className="anim-fade-up mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line-strong bg-surface-2 px-5 py-3.5 text-sm font-medium dark:border-transparent"
          data-testid="exam-mode-editor-note"
        >
          {studentsCanSee ? <LockOpen size={16} aria-hidden className="shrink-0" /> : <Lock size={16} aria-hidden className="shrink-0" />}
          <span className="min-w-0 flex-1 basis-60">
            {studentsCanSee ? sv.tenta.editorOpen : sv.tenta.editorLocked}{" "}
            <Link href={routes.admin.settings(deck.id)} className="font-semibold underline underline-offset-2">
              {sv.tenta.toSettings}
            </Link>
          </span>
          <StudentViewButton deckId={deck.id} slug={deck.slug} />
        </div>
      ) : null}
      {exams.length === 0 ? (
        <Card padding="lg" className="text-muted">
          {canEdit ? sv.tenta.emptyEditor : sv.tenta.empty}
        </Card>
      ) : (
        <ul className="grid gap-3" data-testid="exam-list">
          {exams.map((exam) => (
            <ExamRow key={exam.key} exam={exam} attempts={attempts.filter((a) => a.exam_id === exam.id)} slug={deck.slug} now={now} showDraft={canEdit} />
          ))}
        </ul>
      )}
    </div>
  );
}
