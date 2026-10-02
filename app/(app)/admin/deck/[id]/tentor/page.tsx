import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, KeyRound, Lock, LockOpen } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { listExams } from "@/lib/tentor/queries";
import { formatDuration, formatExamDate, formatPoints, kindSummary } from "@/lib/tentor/session";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { StudentViewButton } from "@/components/tenta/StudentView";
import { KeepDates } from "@/components/ui/KeepDates";
import { routes } from "@/lib/routes";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const sv = await getT();
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  return { title: data ? `${sv.admin.tabExams}: ${data.deck.title}` : sv.admin.tabExams };
}

/**
 * Tentabanken för kursen (layouten har redan kontrollerat att besökaren är redaktör): alla tentor,
 * även utkast, med länkar till förhandsgranskningen och facitvyn.
 */
export default async function AdminExamsPage({ params }: { params: Params }) {
  const sv = await getT();
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const { deck } = data;
  const exams = await listExams(deck.id, { canEdit: true, enrolled: true, examModeOpen: deck.exam_mode_open, deckPublished: deck.is_published });
  const open = deck.exam_mode_open && deck.is_published;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{sv.admin.tabExams}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{sv.tenta.adminHelp}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line-strong bg-surface-2 px-5 py-3.5 text-sm font-medium dark:border-transparent" data-testid="admin-exam-mode-status">
        {open ? <LockOpen size={16} aria-hidden className="shrink-0" /> : <Lock size={16} aria-hidden className="shrink-0" />}
        <span className="min-w-0 flex-1 basis-60">
          {open ? sv.tenta.editorOpen : sv.tenta.modeLocked}{" "}
          <Link href={routes.admin.settings(deck.id)} className="font-semibold underline underline-offset-2">
            {sv.tenta.toSettings}
          </Link>
          <span className="mt-0.5 block font-normal text-muted">{sv.tenta.studentViewHelp}</span>
        </span>
        <StudentViewButton deckId={deck.id} slug={deck.slug} />
      </div>
      {exams.length === 0 ? (
        <Card className="text-muted">{sv.tenta.emptyEditor}</Card>
      ) : (
        <ul className="grid gap-3" data-testid="admin-exam-list">
          {exams.map((e) => (
            <li key={e.key}>
              <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold tracking-tight">
                      <KeepDates>{e.title}</KeepDates>
                    </h3>
                    <Badge tone={e.status === "publicerad" ? "accent" : "outline"}>{sv.tenta.status[e.status]}</Badge>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted">
                    {[formatExamDate(e.date, sv.meta.locale), formatDuration(e.durationMinutes, sv), sv.tenta.pointsLong(formatPoints(e.maxPoints, sv.meta.locale)), sv.tenta.questionCount(e.questionCount)]
                      .filter(Boolean)
                      .map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                  </p>
                  <p className="mt-0.5 text-sm text-subtle">{kindSummary(e.kinds, sv)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <LinkButton href={routes.examAttempt(deck.slug, e.key, { fran: "admin" })} variant="outline" size="sm">
                    <Eye size={15} aria-hidden />
                    {sv.tenta.previewLink}
                  </LinkButton>
                  <LinkButton href={routes.admin.examKey(deck.id, e.key)} variant="secondary" size="sm">
                    <KeyRound size={15} aria-hidden />
                    {sv.tenta.keyLink}
                  </LinkButton>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
