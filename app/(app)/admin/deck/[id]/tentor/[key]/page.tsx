import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { withImageUrls } from "@/lib/tentor/images";
import { getExam } from "@/lib/tentor/queries";
import { formatDuration, formatExamDate, formatPoints, partOf } from "@/lib/tentor/session";
import { Markdown } from "@/components/markdown/Markdown";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { ExamFigures } from "@/components/tenta/ExamFigures";
import { ExamKey } from "@/components/tenta/ExamKey";
import { routes } from "@/lib/routes";

type Params = Promise<{ id: string; key: string }>;

// Titeln avslöjar inget om tentan: layouten spärrar sidan för andra än redaktörer, men
// metadata räknas fram oberoende av den.
export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.admin.tabExams };
}

/**
 * Facitvyn för examinatorn: varje uppgift med frågetext, facit, lösning, sida och tentans källa,
 * så att facit kan granskas snabbt mot svarsförslaget.
 */
export default async function AdminExamKeyPage({ params }: { params: Params }) {
  const sv = await getT();
  const { id, key } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const { deck } = data;
  const exam = await getExam(deck.id, key, { canEdit: true, examModeOpen: deck.exam_mode_open, deckPublished: deck.is_published });
  if (!exam) notFound();
  const parts = partOf(exam.questions);
  const questions = withImageUrls(exam.questions, deck.slug, exam.key);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6" data-testid="admin-exam-key">
      <div>
        <Link href={routes.admin.exams(deck.id)} className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-muted hover:text-fg">
          <ArrowLeft size={16} aria-hidden />
          {sv.admin.tabExams}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
              {sv.tenta.keyTitle(exam.title)}
              <Badge tone={exam.status === "publicerad" ? "accent" : "outline"}>{sv.tenta.status[exam.status]}</Badge>
            </h2>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted">
              {[formatExamDate(exam.date, sv.meta.locale), formatDuration(exam.durationMinutes, sv), sv.tenta.pointsLong(formatPoints(exam.maxPoints, sv.meta.locale)), exam.grades.map((g) => sv.tenta.gradeLimit(g.grade, formatPoints(g.min, sv.meta.locale))).join(", ")]
                .filter(Boolean)
                .map((t) => (
                  <span key={t}>{t}</span>
                ))}
            </p>
          </div>
          <LinkButton href={routes.examAttempt(deck.slug, exam.key, { fran: "admin" })} variant="outline" size="sm">
            <Eye size={15} aria-hidden />
            {sv.tenta.previewLink}
          </LinkButton>
        </div>
        <dl className="mt-4 grid gap-1 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">{sv.tenta.source}:</dt>
            <dd className="text-muted">{exam.source ?? "-"}</dd>
          </div>
          {exam.aids ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold">{sv.tenta.coverAids}:</dt>
              <dd className="text-muted">{exam.aids}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <ol className="grid gap-4">
        {questions.map((q) => (
          <li key={q.id}>
            <Card padding="none" className="overflow-hidden" data-testid={`key-${q.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 sm:px-6">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold">{sv.tenta.question(q.id)}</span>
                  {parts.get(q.id) ? <span className="text-sm text-subtle">{parts.get(q.id)}</span> : null}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-sm">
                  <Badge tone="neutral">{sv.tenta.questionKindLabel[q.kind]}</Badge>
                  {q.kind === "flera" ? <Badge tone="outline">{q.scoring === "delpoang" ? sv.tenta.scoringPartial : sv.tenta.scoringAll}</Badge> : null}
                  {q.noKey ? <Badge tone="danger">{sv.tenta.noKey}</Badge> : null}
                  {q.penalty ? <Badge tone="outline">{sv.tenta.penaltyBadge(formatPoints(q.penalty, sv.meta.locale))}</Badge> : null}
                  <Badge tone="outline">{sv.tenta.points(formatPoints(q.points, sv.meta.locale))}</Badge>
                  {q.page ? <Badge tone="outline">{sv.tenta.page(q.page)}</Badge> : null}
                </p>
              </div>
              <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-2">
                <div className="min-w-0">
                  <ExamFigures images={q.images} size="sm" className="mb-3" />
                  <Markdown text={q.prompt} variant="body" />
                </div>
                <div className="min-w-0 grid content-start gap-3">
                  <ExamKey q={q} />
                  <div className="rounded-md border border-accent/50 bg-accent-soft/40 px-4 py-3">
                    <p className="mb-1 text-sm font-bold text-accent-ink">{sv.tenta.solution}</p>
                    {q.solution ? <Markdown text={q.solution} variant="body" /> : <p className="text-sm text-muted">{sv.tenta.missingSolution}</p>}
                  </div>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
