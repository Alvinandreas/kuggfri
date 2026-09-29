import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import type { ExamResult } from "@/lib/tentor/grade";
import { forStudent } from "@/lib/tentor/model";
import { getExamRecord } from "@/lib/tentor/queries";
import { finalizeExpired, listMyAttempts, loadAttempt, loadExamDeck } from "@/lib/tentor/server";
import { attemptOverview, formatAttemptTime, formatExamDate, kindCounts, sanitizeAnswers } from "@/lib/tentor/session";
import { ExamCover } from "@/components/tenta/ExamCover";
import { ExamRunner } from "@/components/tenta/ExamRunner";
import { ExamResultView } from "@/components/tenta/ExamResultView";

type Params = Promise<{ slug: string; key: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, key } = await params;
  const ctx = await loadExamDeck(slug);
  const record = ctx ? await getExamRecord(ctx.deck.id, key, ctx.access).catch(() => null) : null;
  return { title: record ? `${record.exam.title} · ${sv.tenta.title}` : sv.tenta.title };
}

/**
 * En tenta i fokuslayouten (ingen sidomeny). Utan ?forsok: försättsbladet. Med ?forsok=<id>:
 * tentan under skrivtiden (utan facit), eller resultatet med facit när försöket är inlämnat.
 */
export default async function ExamPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ slug, key }, query] = await Promise.all([params, searchParams]);
  const ctx = await loadExamDeck(slug);
  if (!ctx) notFound();
  const { deck, access } = ctx;
  // Låst för studenten: tillbaka till tentalägets startsida, som visar låsvyn.
  if (!access.canEdit && !(access.deckPublished && access.examModeOpen)) redirect(`/d/${slug}/tenta`);
  const record = await getExamRecord(deck.id, key, access);
  if (!record) notFound();
  const { exam } = record;
  const preview = access.canEdit;

  // Försök vars tid tagit slut utan inlämning samlas in, som på en riktig tenta.
  let attempts = await listMyAttempts([record.id]);
  if (await finalizeExpired(attempts, exam)) attempts = await listMyAttempts([record.id]);

  const attemptId = Array.isArray(query.forsok) ? query.forsok[0] : query.forsok;
  if (attemptId) {
    const a = await loadAttempt(attemptId);
    if (!a || a.deckId !== deck.id || a.examKey !== key) notFound();
    const { attempt } = a;
    if (!attempt.submitted_at) {
      return (
        <ExamRunner
          key={attempt.id}
          exam={forStudent(exam)}
          attemptId={attempt.id}
          startedAt={attempt.started_at}
          serverNow={Date.now()}
          initialAnswers={sanitizeAnswers(exam.questions, attempt.answers)}
          preview={preview}
        />
      );
    }
    // Inlämnat: facit får skickas nu. Källa och status är redaktörernas och följer inte med.
    const { key: examKey, title, date, durationMinutes, maxPoints, grades, aids, instructions, questions } = exam;
    const withKey = { key: examKey, title, date, durationMinutes, maxPoints, grades, aids, instructions, questions };
    return (
      <ExamResultView
        slug={slug}
        exam={withKey}
        attemptId={attempt.id}
        result={attempt.result as ExamResult}
        answers={sanitizeAnswers(exam.questions, attempt.answers)}
        selfGrades={attempt.self_grades ?? {}}
        points={Number(attempt.points ?? 0)}
        grade={attempt.grade ?? "U"}
        submittedWhen={formatAttemptTime(attempt.submitted_at)}
        preview={preview}
      />
    );
  }

  const overview = attemptOverview(attempts, exam.durationMinutes, Date.now());
  return (
    <ExamCover
      deck={{ slug: deck.slug, title: deck.title, course_code: deck.course_code }}
      exam={{
        key: exam.key,
        title: exam.title,
        dateLabel: formatExamDate(exam.date),
        durationMinutes: exam.durationMinutes,
        maxPoints: exam.maxPoints,
        grades: exam.grades,
        aids: exam.aids,
        instructions: exam.instructions,
        questionCount: exam.questions.length,
        kinds: kindCounts(exam.questions),
      }}
      inProgress={overview.inProgress ? { id: overview.inProgress.id, startedAt: overview.inProgress.started_at } : null}
      submitted={attempts
        .filter((a) => a.submitted_at)
        .map((a) => ({ id: a.id, when: formatAttemptTime(a.submitted_at!), points: Number(a.points ?? 0), grade: a.grade ?? "U" }))}
      serverNow={Date.now()}
      preview={preview}
    />
  );
}
