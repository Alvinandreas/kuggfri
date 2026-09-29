import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Eye, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { QUESTION_KIND_LABEL, type ExamQuestion } from "@/lib/tentor/model";
import { withImageUrls } from "@/lib/tentor/images";
import { getExam } from "@/lib/tentor/queries";
import { formatDuration, formatExamDate, formatPoints, partOf } from "@/lib/tentor/session";
import { Markdown } from "@/components/markdown/Markdown";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { ExamFigures } from "@/components/tenta/ExamFigures";

type Params = Promise<{ id: string; key: string }>;

// Titeln avslöjar inget om tentan: layouten spärrar sidan för andra än redaktörer, men
// metadata räknas fram oberoende av den.
export const metadata: Metadata = { title: sv.admin.tabExams };

const inline = "[&_p]:m-0";

function Key({ q }: { q: ExamQuestion }) {
  if (q.noKey) return <p className="text-sm font-semibold text-danger">{sv.tenta.noKey}</p>;
  switch (q.kind) {
    case "flerval":
    case "flera":
      return (
        <ul className="grid gap-1.5">
          {(q.options ?? []).map((o, i) => (
            <li key={i} className={cx("flex items-start gap-2.5 rounded-md border px-3 py-2", o.correct ? "border-accent bg-accent-soft/60" : "border-line")}>
              {o.correct ? <Check size={16} strokeWidth={2.6} aria-label={sv.tenta.correctAnswer} className="mt-1 shrink-0 text-accent" /> : <X size={16} aria-hidden className="mt-1 shrink-0 text-subtle" />}
              <Markdown text={o.text} variant="body" className={cx("min-w-0 flex-1", inline)} />
            </li>
          ))}
        </ul>
      );
    case "sant-falskt":
      return (
        <ul className="grid gap-1.5">
          {(q.statements ?? []).map((s, i) => (
            <li key={i} className="flex items-start gap-3 rounded-md border border-line px-3 py-2">
              <Badge tone={s.answer ? "accent" : "danger"} className="mt-0.5 shrink-0">
                {s.answer ? sv.tenta.trueLabel : sv.tenta.falseLabel}
              </Badge>
              <Markdown text={s.text} variant="body" className={cx("min-w-0 flex-1", inline)} />
            </li>
          ))}
        </ul>
      );
    case "para":
      return (
        <div className="grid gap-2">
          {q.choices?.length ? <p className="text-sm text-muted">{q.choices.join(" | ")}</p> : <p className="text-sm text-muted">{sv.tenta.ownLists}</p>}
          <ul className="grid gap-1.5">
            {(q.pairs ?? []).map((p, i) => (
              <li key={i} className="grid gap-1 rounded-md border border-line px-3 py-2 sm:grid-cols-[minmax(0,1fr)_14rem] sm:gap-4">
                <div className="min-w-0">
                  <Markdown text={p.prompt} variant="body" className={inline} />
                  {p.choices?.length ? <p className="mt-0.5 text-sm text-muted">{p.choices.join(" | ")}</p> : null}
                </div>
                <span className="font-semibold text-accent-ink">{p.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "numerisk": {
      const k = q.numeric;
      if (!k) return null;
      const tol = k.relative ? `${formatPoints(k.tolerance * 100)} %` : formatPoints(k.tolerance);
      return (
        <p className="text-lg font-bold tabular-nums text-accent-ink">
          {formatPoints(k.value)}
          {k.unit && k.unit !== "-" ? ` ${k.unit}` : ""} <span className="text-sm font-medium text-muted">{sv.tenta.tolerance(tol)}</span>
        </p>
      );
    }
    case "text":
      return null;
  }
}

/**
 * Facitvyn för examinatorn: varje uppgift med frågetext, facit, lösning, sida och tentans källa,
 * så att facit kan granskas snabbt mot svarsförslaget.
 */
export default async function AdminExamKeyPage({ params }: { params: Params }) {
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
        <Link href={`/admin/deck/${deck.id}/tentor`} className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-muted hover:text-fg">
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
              {[formatExamDate(exam.date), formatDuration(exam.durationMinutes), sv.tenta.pointsLong(formatPoints(exam.maxPoints)), exam.grades.map((g) => sv.tenta.gradeLimit(g.grade, formatPoints(g.min))).join(", ")]
                .filter(Boolean)
                .map((t) => (
                  <span key={t}>{t}</span>
                ))}
            </p>
          </div>
          <LinkButton href={`/d/${deck.slug}/tenta/${exam.key}?fran=admin`} variant="outline" size="sm">
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
                  <Badge tone="neutral">{QUESTION_KIND_LABEL[q.kind]}</Badge>
                  {q.kind === "flera" ? <Badge tone="outline">{q.scoring === "delpoang" ? sv.tenta.scoringPartial : sv.tenta.scoringAll}</Badge> : null}
                  {q.noKey ? <Badge tone="danger">{sv.tenta.noKey}</Badge> : null}
                  {q.penalty ? <Badge tone="outline">{sv.tenta.penaltyBadge(formatPoints(q.penalty))}</Badge> : null}
                  <Badge tone="outline">{sv.tenta.points(formatPoints(q.points))}</Badge>
                  {q.page ? <Badge tone="outline">{sv.tenta.page(q.page)}</Badge> : null}
                </p>
              </div>
              <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-2">
                <div className="min-w-0">
                  <ExamFigures images={q.images} size="sm" className="mb-3" />
                  <Markdown text={q.prompt} variant="body" />
                </div>
                <div className="min-w-0 grid content-start gap-3">
                  <Key q={q} />
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
