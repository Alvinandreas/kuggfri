import "server-only";
import type { ExamRow } from "@/lib/supabase/database.types";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Exam, ExamQuestion, QuestionKind } from "./model";
import { kindCounts } from "./session";

/**
 * Serverns läsning av tentabanken. Tabellen exams är stängd för studenter (facit ligger i den),
 * så servern läser den med service role och avgör själv vem som får se vad:
 *
 * - redaktörer (admin, kursens examinatorer) ser alla tentor, även utkast, alltid;
 * - studenter ser publicerade tentor, och bara när kursen är publicerad och tentaläget öppet.
 *
 * Facit lämnar aldrig servern före inlämning: sidorna skickar `forStudent(exam)` till webbläsaren.
 */
function serviceClient() {
  const client = createServiceRoleClient();
  if (!client) throw new Error("SUPABASE_SERVICE_ROLE_KEY saknas (krävs för tentaläget).");
  return client;
}

export function examFromRow(row: ExamRow): Exam {
  return {
    key: row.key,
    title: row.title,
    date: row.exam_date,
    durationMinutes: row.duration_minutes,
    maxPoints: Number(row.max_points),
    grades: row.grade_limits ?? [],
    aids: row.aids,
    instructions: row.instructions,
    source: row.source,
    status: row.status,
    questions: (row.questions ?? []) as ExamQuestion[],
  };
}

/**
 * Vad besökaren får se. `studentView` sätts bara för redaktörer som valt "Visa som student"
 * (lib/tentor/server.ts kontrollerar behörigheten): sidorna visas då som för en student, med
 * utkasten medtagna. Åtkomsten (canEdit) ändras inte av studentvyn. `enrolled`: besökaren står
 * på kursens deltagarlista (lib/enrollment); bara deltagare ser tentorna när läget är öppet.
 */
export type ExamAccess = { canEdit: boolean; enrolled: boolean; examModeOpen: boolean; deckPublished: boolean; studentView?: StudentView | null };

/** Redaktörens studentvy: tentaläget som studenterna ser det när det är öppet, eller låst. */
export type StudentView = "oppen" | "last";

/** En tenta i listan, utan uppgifter (och därmed utan facit). */
export type ExamSummary = Omit<Exam, "questions"> & {
  /** Databas-id (för studentens försök). */
  id: string;
  questionCount: number;
  /** Antal uppgifter per typ, i typernas ordning. */
  kinds: { kind: QuestionKind; count: number }[];
};

/** Får den här besökaren se tentan? */
export function mayView(exam: Pick<Exam, "status">, access: ExamAccess): boolean {
  if (access.canEdit) return true;
  return access.enrolled && access.deckPublished && access.examModeOpen && exam.status === "publicerad";
}

/** Studenterna ser tentaläget (kursen publicerad och läget öppet). */
export function openForStudents(access: ExamAccess): boolean {
  return access.deckPublished && access.examModeOpen;
}

/** Alla tentor för kursen som besökaren får se, nyaste först (utan uppgifter). */
export async function listExams(deckId: string, access: ExamAccess): Promise<ExamSummary[]> {
  if (!access.canEdit && !(access.enrolled && access.deckPublished && access.examModeOpen)) return [];
  const { data, error } = await serviceClient().from("exams").select("*").eq("deck_id", deckId).order("exam_date", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row) => ({ id: row.id, exam: examFromRow(row) }))
    .filter(({ exam }) => mayView(exam, access))
    .map(({ id, exam: { questions, ...rest } }) => ({ ...rest, id, questionCount: questions.length, kinds: kindCounts(questions) }));
}

/** En tenta med facit, för rättning och resultat på servern. Null om den inte finns eller inte får ses. */
export async function getExam(deckId: string, key: string, access: ExamAccess): Promise<Exam | null> {
  return (await getExamRecord(deckId, key, access))?.exam ?? null;
}

/** En tenta med facit och databas-id, för sidorna som också hanterar försöken. */
export async function getExamRecord(deckId: string, key: string, access: ExamAccess): Promise<{ id: string; exam: Exam } | null> {
  const { data, error } = await serviceClient().from("exams").select("*").eq("deck_id", deckId).eq("key", key).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const exam = examFromRow(data);
  return mayView(exam, access) ? { id: data.id, exam } : null;
}

/**
 * Försökstabellen med service role. Studenterna får bara läsa och starta sina försök (RLS); svar,
 * inlämning och egna bedömningar skrivs härifrån, efter att servern kontrollerat att försöket är
 * besökarens (loadAttempt läser det med besökarens egen klient). Filtrera alltid på user_id.
 */
export function attemptsAsServer() {
  return serviceClient().from("exam_attempts");
}

/** En tenta med facit via databas-id (försökets exam_id). Åtkomsten avgör anroparen med mayView. */
export async function getExamById(examId: string): Promise<{ deckId: string; key: string; exam: Exam } | null> {
  const { data, error } = await serviceClient().from("exams").select("*").eq("id", examId).maybeSingle();
  if (error) throw error;
  return data ? { deckId: data.deck_id, key: data.key, exam: examFromRow(data) } : null;
}
