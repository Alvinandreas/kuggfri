import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardPen, Clock, ListChecks, Lock, LockOpen, Trophy } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { ExamSummary } from "@/lib/tentor/queries";
import { attemptOverview, formatDuration, formatExamDate, formatPoints, kindSummary, type AttemptInfo } from "@/lib/tentor/session";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

type Deck = { id: string; slug: string; title: string; course_code: string | null };

function Header({ deck }: { deck: Deck }) {
  return (
    <header className="anim-fade-up mb-8">
      <div className="flex min-w-0 items-start gap-4">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink sm:inline-flex">
          <ClipboardPen size={24} aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{sv.tenta.title}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {deck.title}
            {deck.course_code ? ` · ${deck.course_code}` : null}
          </p>
        </div>
      </div>
    </header>
  );
}

/** Låst för studenterna: lugn låsvy med vägen tillbaka till korten. Ingen lista. */
export function ExamModeLocked({ deck }: { deck: Deck }) {
  return (
    <div>
      <Header deck={deck} />
      <Card padding="lg" className="anim-fade-up mx-auto max-w-2xl text-center" data-testid="exam-mode-locked">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-fg">
          <Lock size={28} strokeWidth={1.8} aria-hidden />
        </span>
        <h2 className="mt-5 text-2xl font-bold tracking-tight">{sv.tenta.lockedTitle}</h2>
        <p className="mx-auto mt-3 max-w-lg text-muted">{sv.tenta.lockedBody}</p>
        <p className="mx-auto mt-2 max-w-lg text-muted">{sv.tenta.lockedHint}</p>
        <div className="mt-7 flex justify-center">
          <LinkButton href={`/d/${deck.slug}`}>
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

function ExamRow({ exam, attempts, slug, now }: { exam: ExamSummary; attempts: AttemptInfo[]; slug: string; now: number }) {
  const { inProgress, latest, best, submitted } = attemptOverview(attempts, exam.durationMinutes, now);
  const href = `/d/${slug}/tenta/${exam.key}`;
  const max = formatPoints(exam.maxPoints);
  const date = formatExamDate(exam.date);
  return (
    <li>
      <Card padding="none" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6" data-testid={`exam-row-${exam.key}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">
              <Link href={href} className="rounded-sm hover:underline">
                {exam.title}
              </Link>
            </h2>
            {exam.status === "utkast" ? <Badge tone="outline">{sv.tenta.draft}</Badge> : null}
            {inProgress ? <Badge tone="accent">{sv.tenta.inProgress}</Badge> : null}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            {date ? <Meta icon={CalendarDays}>{date}</Meta> : null}
            <Meta icon={Clock}>{formatDuration(exam.durationMinutes)}</Meta>
            <Meta icon={Trophy}>{sv.tenta.pointsLong(max)}</Meta>
            <Meta icon={ListChecks}>{sv.tenta.questionCount(exam.questionCount)}</Meta>
          </p>
          <p className="mt-1.5 text-sm text-subtle">{kindSummary(exam.kinds)}</p>
          {best && latest ? (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="exam-row-result">
              <span className="font-semibold">
                {sv.tenta.best}: {sv.tenta.resultShort(formatPoints(Number(best.points ?? 0)), max, best.grade ?? "U")}
              </span>
              {latest.id !== best.id ? (
                <span className="text-muted">
                  {sv.tenta.latest}: {sv.tenta.resultShort(formatPoints(Number(latest.points ?? 0)), max, latest.grade ?? "U")}
                </span>
              ) : null}
              <span className="text-subtle">{sv.tenta.attemptsCount(submitted)}</span>
              <Link href={`${href}?forsok=${latest.id}`} className="font-semibold text-accent-ink underline-offset-2 hover:underline">
                {sv.tenta.showResult}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="shrink-0">
          {inProgress ? (
            <LinkButton href={`${href}?forsok=${inProgress.id}`} className="w-full sm:w-auto">
              {sv.tenta.resume}
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
export function ExamModeHome({
  deck,
  exams,
  attempts,
  canEdit,
  studentsCanSee,
  now,
}: {
  deck: Deck;
  exams: ExamSummary[];
  attempts: AttemptInfo[];
  canEdit: boolean;
  /** Tentaläget öppet och kursen publicerad. */
  studentsCanSee: boolean;
  now: number;
}) {
  return (
    <div>
      <Header deck={deck} />
      <p className="anim-fade-up -mt-3 mb-6 max-w-3xl text-muted">{sv.tenta.intro}</p>
      {canEdit ? (
        <p
          role="status"
          className="anim-fade-up mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line-strong bg-surface-2 px-5 py-3.5 text-sm font-medium dark:border-transparent"
          data-testid="exam-mode-editor-note"
        >
          {studentsCanSee ? <LockOpen size={16} aria-hidden className="shrink-0" /> : <Lock size={16} aria-hidden className="shrink-0" />}
          <span>{studentsCanSee ? sv.tenta.editorOpen : sv.tenta.editorLocked}</span>
          <Link href={`/admin/deck/${deck.id}/installningar`} className="font-semibold underline underline-offset-2">
            {sv.tenta.toSettings}
          </Link>
        </p>
      ) : null}
      {exams.length === 0 ? (
        <Card padding="lg" className="text-muted">
          {canEdit ? sv.tenta.emptyEditor : sv.tenta.empty}
        </Card>
      ) : (
        <ul className="grid gap-3" data-testid="exam-list">
          {exams.map((exam) => (
            <ExamRow key={exam.key} exam={exam} attempts={attempts.filter((a) => a.exam_id === exam.id)} slug={deck.slug} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
