import "server-only";
import { cache } from "react";
import { canEditDeck, getAdminContext } from "@/lib/admin/access";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import type { ExamAttemptRow } from "@/lib/supabase/database.types";
import { gradeExam, gradeFor, type ExamResult } from "./grade";
import type { Answers, Exam } from "./model";
import { attemptsAsServer, getExamById, mayView, type ExamAccess } from "./queries";
import { isExpired, sanitizeAnswers, type AttemptInfo } from "./session";

/**
 * Tentalägets serverdel för sidorna och serveråtgärderna: kursen med besökarens åtkomst och
 * studentens egna försök. Försöken läses och startas med användarens egen klient (RLS: egna rader)
 * och skrivs sedan av servern (attemptsAsServer) efter ägarkontrollen;
 * tentorna med facit kommer från lib/tentor/queries.ts (service role).
 */

export type ExamDeck = { id: string; slug: string; title: string; course_code: string | null; is_published: boolean; exam_mode_open: boolean };

/** Kursen via adressen och vad besökaren får se i tentaläget. Null om kursen inte finns (eller inte får ses). */
export const loadExamDeck = cache(async (slug: string): Promise<{ deck: ExamDeck; access: ExamAccess } | null> => {
  const supabase = await createSupabaseServerClient();
  // Utan cache: tentalägets lås ska gälla direkt när examinatorn ändrar det.
  const { data: deck } = await supabase.from("decks").select("id, slug, title, course_code, is_published, exam_mode_open").eq("slug", slug).maybeSingle();
  if (!deck) return null;
  const ctx = await getAdminContext();
  return { deck, access: { canEdit: canEditDeck(ctx, deck.id), examModeOpen: deck.exam_mode_open, deckPublished: deck.is_published } };
});

async function deckAccess(deckId: string): Promise<{ slug: string; access: ExamAccess } | null> {
  const supabase = await createSupabaseServerClient();
  const { data: deck } = await supabase.from("decks").select("id, slug, is_published, exam_mode_open").eq("id", deckId).maybeSingle();
  if (!deck) return null;
  const ctx = await getAdminContext();
  return { slug: deck.slug, access: { canEdit: canEditDeck(ctx, deck.id), examModeOpen: deck.exam_mode_open, deckPublished: deck.is_published } };
}

const ATTEMPT_LIST = "id, exam_id, started_at, submitted_at, points, grade";

/** Den inloggades försök på de här tentorna. */
export async function listMyAttempts(examIds: string[]): Promise<AttemptInfo[]> {
  if (examIds.length === 0) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("exam_attempts").select(ATTEMPT_LIST).eq("user_id", user.id).in("exam_id", examIds).order("started_at", { ascending: false });
  return (data ?? []).map((a) => ({ ...a, points: a.points === null ? null : Number(a.points) }));
}

export type AttemptContext = { attempt: ExamAttemptRow; exam: Exam; examKey: string; deckId: string; slug: string; access: ExamAccess };

/**
 * Ett av den inloggades försök med tentan (med facit) och åtkomsten. Null om försöket inte är
 * användarens (RLS) eller tentan inte längre får ses (t.ex. när tentaläget låsts igen).
 */
export async function loadAttempt(attemptId: string): Promise<AttemptContext | null> {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return null;
  const supabase = await createSupabaseServerClient();
  const { data: attempt } = await supabase.from("exam_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (!attempt) return null;
  const record = await getExamById(attempt.exam_id);
  if (!record) return null;
  const deck = await deckAccess(record.deckId);
  if (!deck || !mayView(record.exam, deck.access)) return null;
  return {
    attempt: { ...attempt, points: attempt.points === null ? null : Number(attempt.points) },
    exam: record.exam,
    examKey: record.key,
    deckId: record.deckId,
    slug: deck.slug,
    access: deck.access,
  };
}

/**
 * Rättar och lämnar in ett försök med de givna svaren. Ett redan inlämnat försök lämnas orört.
 * Anroparen har kontrollerat att försöket är besökarens (loadAttempt eller listMyAttempts).
 */
export async function finalizeAttempt(attemptId: string, exam: Exam, answers: Answers): Promise<{ points: number; grade: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const result: ExamResult = gradeExam(exam, answers);
  const points = result.autoPoints;
  const grade = gradeFor(points, exam.grades);
  const { data, error } = await attemptsAsServer()
    .update({ answers, result, points, grade, self_grades: {}, submitted_at: new Date().toISOString() })
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .is("submitted_at", null)
    .select("id");
  if (error) throw error;
  return data && data.length > 0 ? { points, grade } : null;
}

/**
 * Försök vars skrivtid (med marginal) är slut utan inlämning lämnas in av servern med de svar
 * som hann sparas, precis som en riktig tenta samlas in när tiden är ute.
 */
export async function finalizeExpired(attempts: AttemptInfo[], exam: Exam, now = Date.now()): Promise<boolean> {
  const expired = attempts.filter((a) => isExpired(a, exam.durationMinutes, now));
  if (expired.length === 0) return false;
  const supabase = await createSupabaseServerClient();
  for (const a of expired) {
    const { data } = await supabase.from("exam_attempts").select("answers").eq("id", a.id).maybeSingle();
    await finalizeAttempt(a.id, exam, sanitizeAnswers(exam.questions, data?.answers));
  }
  return true;
}
