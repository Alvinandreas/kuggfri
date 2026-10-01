"use server";

import { cookies } from "next/headers";
import { editorAction, runAction } from "@/lib/actions/guard";
import { fail, isUuid, type ActionResult } from "@/lib/actions/result";
import { revalidateExam, revalidateExamMode, revalidateExamPages } from "@/lib/cache/revalidate";
import { getT } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gradeFor, isPendingGrading, totalWithSelfGrades, type ExamResult } from "./grade";
import { attemptsAsServer, getExamRecord } from "./queries";
import { STUDENT_VIEW_COOKIE, finalizeAttempt, finalizeExpired, listMyAttempts, loadAttempt, loadExamDeck } from "./server";
import { SUBMIT_GRACE_MS, attemptOverview, deadlineMs, sanitizeAnswers, sanitizeSelfGrades } from "./session";

/*
  Tentalägets serveråtgärder. Facit lämnar aldrig servern här: rättningen sker med tentan från
  lib/tentor/queries.ts och bara poäng och betyg skickas tillbaka. Sidan laddas sedan om och
  visar resultatet (med facit) först när försöket är inlämnat.
*/

/** Startar ett nytt försök, eller återupptar det pågående. */
export async function startExamAttemptAction(slug: string, key: string): Promise<ActionResult<{ attemptId: string }>> {
  return runAction(async () => {
    const sv = await getT();
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
  });
}

/** Sparar svaren löpande under tentan (webbläsaren skickar dem med några sekunders fördröjning). */
export async function saveExamAnswersAction(attemptId: string, answers: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const sv = await getT();
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
  });
}

/**
 * Lämnar in: rättar på servern och sparar resultatet. Kommer inlämningen långt efter att tiden
 * gått ut räknas bara de svar som hann sparas medan tiden fanns.
 */
export async function submitExamAction(attemptId: string, answers: unknown): Promise<ActionResult<{ points: number | null; grade: string | null }>> {
  return runAction(async () => {
    const sv = await getT();
    const ctx = await loadAttempt(attemptId);
    if (!ctx) return { ok: false, error: sv.tenta.notAvailable };
    const { attempt, exam } = ctx;
    if (attempt.submitted_at) return { ok: true, data: { points: attempt.points === null ? null : Number(attempt.points), grade: attempt.grade } };
    const inTime = Date.now() <= deadlineMs(attempt.started_at, exam.durationMinutes) + SUBMIT_GRACE_MS;
    const final = sanitizeAnswers(exam.questions, inTime ? answers : attempt.answers);
    const done = await finalizeAttempt(attemptId, exam, final);
    revalidateExam(ctx.slug, ctx.examKey);
    if (!done) return { ok: false, error: sv.tenta.alreadySubmitted };
    return { ok: true, data: done };
  });
}

/** Ett inlämnat försök i rättningsläget, med de självbedömda uppgifterna. */
async function pendingAttempt(attemptId: string) {
  const sv = await getT();
  const ctx = await loadAttempt(attemptId);
  if (!ctx) return { error: sv.tenta.notAvailable } as const;
  if (!ctx.attempt.submitted_at) return { error: sv.tenta.notSubmitted } as const;
  const result = ctx.attempt.result as ExamResult | null;
  if (!result || !Array.isArray(result.questions)) return { error: sv.errors.generic } as const;
  if (!isPendingGrading(result)) return { error: sv.tenta.alreadyGraded } as const;
  const selfGraded = result.questions.filter((r) => r.outcome === "sjalv").map((r) => ({ id: r.id, max: r.max }));
  return { ctx, result, selfGraded } as const;
}

/**
 * Rättningsläget: sparar studentens egna poäng löpande (så att hen kan gå ifrån och komma
 * tillbaka). Inget resultat räknas eller skickas tillbaka förrän hen trycker Rätta.
 */
export async function saveSelfGradesAction(attemptId: string, grades: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = await pendingAttempt(attemptId);
    if ("error" in p) return { ok: false, error: p.error! };
    const self_grades = sanitizeSelfGrades(p.selfGraded, grades);
    const { error } = await attemptsAsServer().update({ self_grades }).eq("id", attemptId).eq("user_id", p.ctx.attempt.user_id).is("points", null);
    if (error) return fail(error);
    return { ok: true, data: undefined };
  });
}

/**
 * Rätta: sparar de egna poängen slutgiltigt (obedömda räknas som 0) och räknar ut totalen och
 * betyget på servern. Därefter visar sidan resultatet; bedömningen kan inte ändras.
 */
export async function finishGradingAction(attemptId: string, grades: unknown): Promise<ActionResult<{ points: number; grade: string }>> {
  return runAction(async () => {
    const sv = await getT();
    const p = await pendingAttempt(attemptId);
    if ("error" in p) return { ok: false, error: p.error! };
    const { ctx, result, selfGraded } = p;
    const self_grades = sanitizeSelfGrades(selfGraded, grades);
    const points = totalWithSelfGrades(result, self_grades);
    const grade = gradeFor(points, ctx.exam.grades);
    const { data, error } = await attemptsAsServer()
      .update({ self_grades, points, grade, result: { ...result, pending: false } })
      .eq("id", attemptId)
      .eq("user_id", ctx.attempt.user_id)
      .is("points", null)
      .select("id");
    if (error) return fail(error);
    if (!data || data.length === 0) return { ok: false, error: sv.tenta.alreadyGraded };
    revalidateExam(ctx.slug, ctx.examKey);
    return { ok: true, data: { points, grade } };
  });
}

/**
 * Redaktörens studentvy (admin och kursens examinatorer): "oppen" visar tentaläget som en
 * student ser det när det är öppet (med utkasten), "last" som när det är låst, null avslutar.
 * Kakan gäller bara den här kursen och respekteras bara för redaktörer (lib/tentor/server.ts);
 * den ändrar ingenting för studenterna.
 */
export async function setStudentViewAction(deckId: string, mode: "oppen" | "last" | null): Promise<ActionResult> {
  const sv = await getT();
  if (!isUuid(deckId) || (mode !== null && mode !== "oppen" && mode !== "last")) return { ok: false, error: sv.errors.generic };
  return editorAction(deckId, async ({ supabase }) => {
    const { data } = await supabase.from("decks").select("slug").eq("id", deckId).maybeSingle();
    const jar = await cookies();
    if (mode === null) jar.delete(STUDENT_VIEW_COOKIE);
    else jar.set(STUDENT_VIEW_COOKIE, `${deckId}:${mode}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
    if (data?.slug) revalidateExamPages(data.slug);
    return { ok: true, data: undefined };
  });
}

/** Öppnar eller låser tentaläget för studenterna (admin och kursens examinatorer). */
export async function setExamModeOpenAction(deckId: string, open: boolean): Promise<ActionResult> {
  const sv = await getT();
  if (!isUuid(deckId) || typeof open !== "boolean") return { ok: false, error: sv.errors.generic };
  return editorAction(deckId, async ({ supabase }) => {
    const { data, error } = await supabase.from("decks").update({ exam_mode_open: open }).eq("id", deckId).select("slug").single();
    if (error) return fail(error);
    revalidateExamMode(deckId, data.slug);
    return { ok: true, data: undefined };
  });
}
