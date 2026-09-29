/**
 * Rättning av en inlämnad tenta (docs/TENTOR.md). Ren modul; körs på servern så att facit
 * aldrig behöver skickas till webbläsaren före inlämning.
 */
import type { Answer, Answers, Exam, ExamQuestion, GradeLimit } from "./model";

export type QuestionResult = {
  id: string;
  /** Automatisk poäng; null för uppgifter som studenten själv bedömer. */
  points: number | null;
  max: number;
  /** "ratt" | "delvis" | "fel" | "obesvarad" | "sjalv" (självrättas). */
  outcome: "ratt" | "delvis" | "fel" | "obesvarad" | "sjalv";
};

export type ExamResult = {
  questions: QuestionResult[];
  /** Summan av de automatiska poängen. */
  autoPoints: number;
  /** Maxpoäng för de uppgifter som studenten själv bedömer. */
  selfMax: number;
  maxPoints: number;
  /**
   * Rättningsläget: inlämnad men inte rättad. Studenten bedömer sina skrivuppgifter utan att se
   * något resultat; först när hen trycker Rätta räknas totalen och betyget ut. Saknas = rättad
   * (försök från före rättningsläget).
   */
  pending?: boolean;
};

/** Försöket väntar på att studenten bedömer sina skrivuppgifter och trycker Rätta. */
export function isPendingGrading(result: unknown): boolean {
  return !!result && typeof result === "object" && (result as ExamResult).pending === true;
}

const round = (n: number) => Math.round(n * 100) / 100;

function parseStudentNumber(value: string): number | null {
  const v = value.trim().replace(/\s/g, "").replace(",", ".").replace(/[^0-9.eE+-].*$/, "");
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function gradeQuestion(q: ExamQuestion, a: Answer | undefined): QuestionResult {
  const base = { id: q.id, max: q.points };
  if (q.kind === "text" || q.noKey) return { ...base, points: null, outcome: "sjalv" };
  if (!a || a.kind !== q.kind) return { ...base, points: 0, outcome: "obesvarad" };

  const scored = (fraction: number): QuestionResult => {
    const f = Math.max(0, Math.min(1, fraction));
    return { ...base, points: round(q.points * f), outcome: f === 1 ? "ratt" : f === 0 ? "fel" : "delvis" };
  };
  // Med minuspoäng: varje rätt svar ger sin andel, varje fel svar ger avdraget, obesvarat 0.
  // Uppgiften ger aldrig under 0 eller över sin poäng. Rätt-markeringen följer svaren, inte poängen.
  const penalty = q.penalty && q.penalty > 0 ? q.penalty : null;
  const withPenalty = (rights: number, wrongs: number, each: number, allRight: boolean): QuestionResult => {
    const pts = round(Math.max(0, Math.min(q.points, rights * each - wrongs * (penalty ?? 0))));
    return { ...base, points: pts, outcome: allRight && wrongs === 0 ? "ratt" : pts === 0 && rights === 0 ? "fel" : "delvis" };
  };

  switch (a.kind) {
    case "flerval": {
      if (a.choice === null) return { ...base, points: 0, outcome: "obesvarad" };
      return scored(q.options?.[a.choice]?.correct ? 1 : 0);
    }
    case "flera": {
      const options = q.options ?? [];
      if (a.choices.length === 0) return { ...base, points: 0, outcome: "obesvarad" };
      const chosen = new Set(a.choices);
      const right = options.filter((o) => o.correct).length;
      const hits = options.filter((o, i) => o.correct && chosen.has(i)).length;
      const misses = options.filter((o, i) => !o.correct && chosen.has(i)).length;
      if (penalty !== null) return withPenalty(hits, misses, right === 0 ? 0 : q.points / right, hits === right);
      if (q.scoring === "alltelleringet") return scored(options.every((o, i) => o.correct === chosen.has(i)) ? 1 : 0);
      return scored(right === 0 ? 0 : (hits - misses) / right);
    }
    case "sant-falskt": {
      const st = q.statements ?? [];
      if (a.values.every((v) => v === null)) return { ...base, points: 0, outcome: "obesvarad" };
      const rights = st.filter((s, i) => a.values[i] === s.answer).length;
      if (penalty !== null) {
        const wrongs = st.filter((s, i) => a.values[i] !== null && a.values[i] !== undefined && a.values[i] !== s.answer).length;
        return withPenalty(rights, wrongs, st.length === 0 ? 0 : q.points / st.length, rights === st.length);
      }
      return scored(st.length === 0 ? 0 : rights / st.length);
    }
    case "para": {
      const pairs = q.pairs ?? [];
      if (a.values.every((v) => v === null)) return { ...base, points: 0, outcome: "obesvarad" };
      const rights = pairs.filter((p, i) => a.values[i] === p.answer).length;
      if (penalty !== null) {
        const wrongs = pairs.filter((p, i) => a.values[i] !== null && a.values[i] !== undefined && a.values[i] !== p.answer).length;
        return withPenalty(rights, wrongs, pairs.length === 0 ? 0 : q.points / pairs.length, rights === pairs.length);
      }
      return scored(pairs.length === 0 ? 0 : rights / pairs.length);
    }
    case "numerisk": {
      if (!a.value.trim()) return { ...base, points: 0, outcome: "obesvarad" };
      const key = q.numeric;
      const value = parseStudentNumber(a.value);
      if (!key || value === null) return scored(0);
      const tol = key.relative ? Math.abs(key.value) * key.tolerance : key.tolerance;
      // Liten marginal för flyttal: 0,1 + 0,2 ska räknas som 0,3.
      return scored(Math.abs(value - key.value) <= tol + 1e-9 * Math.max(1, Math.abs(key.value)) ? 1 : 0);
    }
    default:
      return { ...base, points: null, outcome: "sjalv" };
  }
}

/**
 * Rättar hela tentan. Finns det uppgifter som studenten själv bedömer blir resultatet `pending`
 * (rättningsläget) tills hen tryckt Rätta.
 */
export function gradeExam(exam: Exam, answers: Answers): ExamResult {
  const questions = exam.questions.map((q) => gradeQuestion(q, answers[q.id]));
  const autoPoints = round(questions.reduce((s, r) => s + (r.points ?? 0), 0));
  const selfCount = questions.filter((r) => r.outcome === "sjalv");
  const selfMax = round(selfCount.reduce((s, r) => s + r.max, 0));
  return { questions, autoPoints, selfMax, maxPoints: exam.maxPoints, pending: selfCount.length > 0 };
}

/**
 * Totalen om vissa uppgifter hade gett andra poäng ("tänk om" på resultatsidan): utgår från de
 * verkliga poängen och byter ut de som finns i `overrides` (begränsat till 0 till uppgiftens max).
 */
export function hypotheticalTotal(result: ExamResult, selfGrades: Record<string, number>, overrides: Record<string, number>): number {
  let total = 0;
  for (const r of result.questions) {
    const actual = r.outcome === "sjalv" ? (selfGrades[r.id] ?? 0) : (r.points ?? 0);
    const o = overrides[r.id];
    total += typeof o === "number" && Number.isFinite(o) ? Math.max(0, Math.min(r.max, o)) : actual;
  }
  return round(total);
}

/**
 * Totalpoäng med studentens egna bedömningar av skrivuppgifterna (id → poäng, begränsat till
 * uppgiftens max och till halva poäng).
 */
export function totalWithSelfGrades(result: ExamResult, selfGrades: Record<string, number>): number {
  let total = result.autoPoints;
  for (const r of result.questions) {
    if (r.outcome !== "sjalv") continue;
    const g = selfGrades[r.id];
    if (typeof g !== "number" || !Number.isFinite(g)) continue;
    total += Math.max(0, Math.min(r.max, Math.round(g * 2) / 2));
  }
  return round(total);
}

/** Betyget för en poängsumma: högsta gräns som nås, annars "U". */
export function gradeFor(points: number, limits: GradeLimit[]): string {
  let grade = "U";
  for (const l of [...limits].sort((a, b) => a.min - b.min)) if (points >= l.min) grade = l.grade;
  return grade;
}
