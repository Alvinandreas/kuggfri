import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { listExams, openForStudents } from "@/lib/tentor/queries";
import { listMyAttempts, loadExamDeck } from "@/lib/tentor/server";
import { ExamModeHome, ExamModeLocked } from "@/components/tenta/ExamModeHome";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const sv = await getT();
  const { slug } = await params;
  const ctx = await loadExamDeck(slug);
  return { title: ctx ? sv.tenta.pageTitle(ctx.deck.title) : sv.tenta.title };
}

/**
 * Tentalägets startsida. Låst för studenterna tills examinatorn öppnar det (då visas en låsvy
 * utan lista); redaktörer ser alltid listan, med utkasten. I redaktörens studentvy visas sidan
 * som för en student (öppen, med utkasten, eller låst) med en rad överst.
 */
export default async function ExamModePage({ params }: { params: Params }) {
  const { slug } = await params;
  const ctx = await loadExamDeck(slug);
  if (!ctx) notFound();
  const { deck, access } = ctx;
  const studentsCanSee = openForStudents(access);
  const studentView = access.studentView ?? null;
  if (studentView === "last") return <ExamModeLocked deck={deck} studentView />;
  if (!access.canEdit && !studentsCanSee) return <ExamModeLocked deck={deck} />;

  const exams = await listExams(deck.id, access);
  const attempts = await listMyAttempts(exams.map((e) => e.id));
  return (
    <ExamModeHome
      deck={deck}
      exams={exams}
      attempts={attempts}
      canEdit={access.canEdit && !studentView}
      studentView={studentView === "oppen"}
      studentsCanSee={studentsCanSee}
      now={Date.now()}
    />
  );
}
