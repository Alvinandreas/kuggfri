import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { isPendingGrading, type ExamResult } from "@/lib/tentor/grade";
import { withImageUrls } from "@/lib/tentor/images";
import { forStudent } from "@/lib/tentor/model";
import { getExamRecord, openForStudents } from "@/lib/tentor/queries";
import { finalizeExpired, listMyAttempts, loadAttempt, loadExamDeck } from "@/lib/tentor/server";
import { attemptOverview, formatAttemptTime, formatExamDate, kindCounts, partOf, sanitizeAnswers } from "@/lib/tentor/session";
import { ExamCover } from "@/components/tenta/ExamCover";
import { ExamGrading } from "@/components/tenta/ExamGrading";
import { ExamRunner } from "@/components/tenta/ExamRunner";
import { ExamResultView } from "@/components/tenta/ExamResultView";

type Params = Promise<{ slug: string; key: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, key } = await params;
  const ctx = await loadExamDeck(slug);
  const record = ctx ? await getExamRecord(ctx.deck.id, key, ctx.access).catch(() => null) : null;
  return { title: record ? record.exam.title : sv.tenta.title };
}

/**
 * En tenta i fokuslayouten (ingen sidomeny). Utan ?forsok: försättsbladet. Med ?forsok=<id>:
 * tentan under skrivtiden (utan facit), rättningsläget när försöket är inlämnat men inte rättat
 * (bara de självbedömda uppgifterna, inget resultat), och resultatet med facit när det är rättat.
 *
 * ?fran=admin: förhandsgranskningen startades från admin, så vägarna ut leder tillbaka dit.
 * Gäller bara redaktörer. I redaktörens studentvy visas allt som för en student.
 */
export default async function ExamPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ slug, key }, query] = await Promise.all([params, searchParams]);
  const ctx = await loadExamDeck(slug);
  if (!ctx) notFound();
  const { deck, access } = ctx;
  const studentView = access.studentView ?? null;
  // Låst för studenten (och i studentvyns låsta läge): tillbaka till startsidan, som visar låsvyn.
  if (studentView === "last" || (!access.canEdit && !openForStudents(access))) redirect(`/d/${slug}/tenta`);
  const record = await getExamRecord(deck.id, key, access);
  if (!record) notFound();
  const { exam } = record;
  const preview = access.canEdit && !studentView;
  const fromAdmin = preview && first(query.fran) === "admin";
  const back = fromAdmin ? { href: `/admin/deck/${deck.id}/tentor`, label: sv.tenta.toAdminExams } : { href: `/d/${slug}/tenta`, label: sv.tenta.toList };
  const suffix = fromAdmin ? "&fran=admin" : "";
  const studentViewDeck = studentView ? deck.id : null;
  const questions = withImageUrls(exam.questions, slug, exam.key);

  // Försök vars tid tagit slut utan inlämning samlas in, som på en riktig tenta.
  let attempts = await listMyAttempts([record.id]);
  if (await finalizeExpired(attempts, exam)) attempts = await listMyAttempts([record.id]);

  const attemptId = first(query.forsok);
  if (attemptId) {
    const a = await loadAttempt(attemptId);
    if (!a || a.deckId !== deck.id || a.examKey !== key) notFound();
    const { attempt } = a;
    const answers = sanitizeAnswers(exam.questions, attempt.answers);
    if (!attempt.submitted_at) {
      return (
        <ExamRunner
          key={attempt.id}
          exam={forStudent({ ...exam, questions })}
          attemptId={attempt.id}
          startedAt={attempt.started_at}
          serverNow={Date.now()}
          initialAnswers={answers}
          preview={preview}
          exitHref={preview ? back.href : null}
          studentViewDeck={studentViewDeck}
        />
      );
    }
    const result = attempt.result as ExamResult;
    if (isPendingGrading(result)) {
      // Rättningsläget: bara de självbedömda uppgifterna med lösningsförslaget. Inga poäng, inget
      // betyg och ingen rättning av de andra uppgifterna skickas förrän studenten tryckt Rätta.
      const selfIds = new Set(result.questions.filter((r) => r.outcome === "sjalv").map((r) => r.id));
      const parts = partOf(exam.questions);
      const student = forStudent({ ...exam, questions }).questions;
      return (
        <ExamGrading
          key={attempt.id}
          title={exam.title}
          attemptId={attempt.id}
          questions={questions
            .filter((q) => selfIds.has(q.id))
            .map((q) => ({ question: student.find((s) => s.id === q.id)!, part: parts.get(q.id) ?? null, solution: q.solution, noKey: q.noKey }))}
          answers={answers}
          initialGrades={attempt.self_grades ?? {}}
          preview={preview}
          exitHref={preview ? back.href : null}
          studentViewDeck={studentViewDeck}
        />
      );
    }
    // Rättat: facit får skickas nu. Källa och status är redaktörernas och följer inte med.
    const { key: examKey, title, date, durationMinutes, maxPoints, grades, aids, instructions } = exam;
    return (
      <ExamResultView
        slug={slug}
        exam={{ key: examKey, title, date, durationMinutes, maxPoints, grades, aids, instructions, questions }}
        result={result}
        answers={answers}
        selfGrades={attempt.self_grades ?? {}}
        points={Number(attempt.points ?? 0)}
        grade={attempt.grade ?? "U"}
        submittedWhen={formatAttemptTime(attempt.submitted_at)}
        preview={preview}
        back={back}
        attemptSuffix={suffix}
        studentViewDeck={studentViewDeck}
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
      grading={overview.grading ? { id: overview.grading.id } : null}
      submitted={attempts
        .filter((a) => a.submitted_at && a.points !== null)
        .map((a) => ({ id: a.id, when: formatAttemptTime(a.submitted_at!), points: Number(a.points ?? 0), grade: a.grade ?? "U" }))}
      serverNow={Date.now()}
      preview={preview}
      back={back}
      attemptSuffix={suffix}
      studentViewDeck={studentViewDeck}
    />
  );
}
