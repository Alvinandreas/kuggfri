"use server";

import { revalidatePath } from "next/cache";
import { fail, isUuid, requireEditor, revalidateDeck, type ActionResult } from "@/lib/admin/action-helpers";
import { sv } from "@/lib/i18n/sv";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gradeFor, totalWithSelfGrades, type ExamResult } from "./grade";
import { attemptsAsServer, getExamRecord } from "./queries";
import { finalizeAttempt, finalizeExpired, listMyAttempts, loadAttempt, loadExamDeck } from "./server";
import { SUBMIT_GRACE_MS, attemptOverview, deadlineMs, sanitizeAnswers, sanitizeSelfGrades } from "./session";

/*
  Tentalägets serveråtgärder. Facit lämnar aldrig servern här: rättningen sker med tentan från
  lib/tentor/queries.ts och bara poäng och betyg skickas tillbaka. Sidan laddas sedan om och
  visar resultatet (med facit) först när försöket är inlämnat.
*/

function revalidateExam(slug: string, key: string) {
  revalidatePath(`/d/${slug}/tenta`);
  revalidatePath(`/d/${slug}/tenta/${key}`);
}

/** Startar ett nytt försök, eller återupptar det pågående. */
export async function startExamAttemptAction(slug: string, key: string): Promise<ActionResult<{ attemptId: string }>> {
  try {
    const ctx = await loadExamDeck(slug);
    if (!ctx) return { ok: false, error: sv.tenta.notAvailable };
    const record = await getExamRecord(ctx.deck.id, key, ctx.access);
    if (!record) return { ok: false, error: sv.tenta.notAvailable };
    const attempts = await listMyAttempts([record.id]);
    await finalizeExpired(attempts, record.exam);
    const current = attemptOverview(attempts, record.exam.durationMinutes, Date.now()).inProgress;
    if (current) return { ok: true, data: { attemptId: current.id } };
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("exam_attempts").insert({ exam_id: record.id }).select("id").single();
    if (error) return fail(error);
    revalidateExam(slug, key);
    return { ok: true, data: { attemptId: data.id } };
  } catch (e) {
    return fail(e);
  }
}

/** Sparar svaren löpande under tentan (webbläsaren skickar dem med några sekunders fördröjning). */
export async function saveExamAnswersAction(attemptId: string, answers: unknown): Promise<ActionResult> {
  try {
    const ctx = await loadAttempt(attemptId);
    if (!ctx) return { ok: false, error: sv.tenta.notAvailable };
    if (ctx.attempt.submitted_at) return { ok: false, error: sv.tenta.alreadySubmitted };
    if (Date.now() > deadlineMs(ctx.attempt.started_at, ctx.exam.durationMinutes) + SUBMIT_GRACE_MS) return { ok: false, error: sv.tenta.timeIsUp };
    const { error } = await attemptsAsServer()
      .update({ answers: sanitizeAnswers(ctx.exam.questions, answers) })
      .eq("id", attemptId)
      .eq("user_id", ctx.attempt.user_id)
      .is("submitted_at", null);
    if (error) return fail(error);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Lämnar in: rättar på servern och sparar resultatet. Kommer inlämningen långt efter att tiden
 * gått ut räknas bara de svar som hann sparas medan tiden fanns.
 */
export async function submitExamAction(attemptId: string, answers: unknown): Promise<ActionResult<{ points: number; grade: string }>> {
  try {
    const ctx = await loadAttempt(attemptId);
    if (!ctx) return { ok: false, error: sv.tenta.notAvailable };
    const { attempt, exam } = ctx;
    if (attempt.submitted_at) return { ok: true, data: { points: Number(attempt.points ?? 0), grade: attempt.grade ?? "U" } };
    const inTime = Date.now() <= deadlineMs(attempt.started_at, exam.durationMinutes) + SUBMIT_GRACE_MS;
    const final = sanitizeAnswers(exam.questions, inTime ? answers : attempt.answers);
    const done = await finalizeAttempt(attemptId, exam, final);
    revalidateExam(ctx.slug, ctx.examKey);
    if (!done) return { ok: false, error: sv.tenta.alreadySubmitted };
    return { ok: true, data: done };
  } catch (e) {
    return fail(e);
  }
}

/** Studentens egna poäng på skrivuppgifterna (och uppgifterna utan facit), efter inlämning. */
export async function saveSelfGradesAction(attemptId: string, grades: unknown): Promise<ActionResult<{ points: number; grade: string }>> {
  try {
    const ctx = await loadAttempt(attemptId);
    if (!ctx) return { ok: false, error: sv.tenta.notAvailable };
    const { attempt, exam } = ctx;
    if (!attempt.submitted_at) return { ok: false, error: sv.tenta.notSubmitted };
    const result = attempt.result as ExamResult | null;
    if (!result || !Array.isArray(result.questions)) return { ok: false, error: sv.errors.generic };
    const selfGraded = result.questions.filter((r) => r.outcome === "sjalv").map((r) => ({ id: r.id, max: r.max }));
    const self_grades = sanitizeSelfGrades(selfGraded, grades);
    const points = totalWithSelfGrades(result, self_grades);
    const grade = gradeFor(points, exam.grades);
    const { error } = await attemptsAsServer().update({ self_grades, points, grade }).eq("id", attemptId).eq("user_id", attempt.user_id);
    if (error) return fail(error);
    return { ok: true, data: { points, grade } };
  } catch (e) {
    return fail(e);
  }
}

/** Öppnar eller låser tentaläget för studenterna (admin och kursens examinatorer). */
export async function setExamModeOpenAction(deckId: string, open: boolean): Promise<ActionResult> {
  try {
    if (!isUuid(deckId) || typeof open !== "boolean") return { ok: false, error: sv.errors.generic };
    const { supabase } = await requireEditor(deckId);
    const { data, error } = await supabase.from("decks").update({ exam_mode_open: open }).eq("id", deckId).select("slug").single();
    if (error) return fail(error);
    revalidateDeck(deckId, data.slug);
    revalidatePath(`/d/${data.slug}/tenta`, "layout");
    revalidatePath(`/admin/deck/${deckId}/tentor`, "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
