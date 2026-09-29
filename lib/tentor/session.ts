/**
 * Tentalägets tillstånd under en tenta: tid kvar, navigeringsraden, inlämningens sammanfattning
 * och kontroll av svar som kommer från webbläsaren. Ren modul (ingen React, ingen databas), så
 * att den kan testas och användas både i klienten och i serveråtgärderna.
 */
import { QUESTION_KINDS, isAnswered, type Answer, type Answers, type QuestionKind } from "./model";

// ---------------------------------------------------------------------------
// Tid
// ---------------------------------------------------------------------------

/** Varningar när så här många minuter återstår (som på en riktig tenta). */
export const TIME_WARNINGS_MINUTES = [15, 5] as const;

/** Svar som kommer in så här länge efter skrivtidens slut räknas ändå (nätet kan vara segt). */
export const SUBMIT_GRACE_MS = 3 * 60_000;

/** När skrivtiden tar slut, i millisekunder sedan epoken. */
export function deadlineMs(startedAt: string, durationMinutes: number): number {
  return new Date(startedAt).getTime() + durationMinutes * 60_000;
}

/** Tid kvar i millisekunder, aldrig negativ. */
export function timeLeftMs(deadline: number, now: number): number {
  return Math.max(0, deadline - now);
}

/** Klockan i toppbalken: "3:59:12" med timmar, annars "59:12". Avrundas uppåt till hel sekund. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Skrivtiden i ord: 240 → "4 timmar", 90 → "1 timme 30 minuter", 45 → "45 minuter". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? "1 timme" : `${h} timmar`;
  const mins = m === 1 ? "1 minut" : `${m} minuter`;
  if (h === 0) return mins;
  return m === 0 ? hours : `${hours} ${mins}`;
}

/**
 * Vilken varning ska visas nu? Alla gränser som passerats markeras som visade; den mest
 * brådskande av de nya returneras (öppnar man tentan med 4 minuter kvar visas bara 5-minuters-
 * varningen, inte båda).
 */
export function dueWarning(msLeft: number, shown: readonly number[]): { warn: number | null; shown: number[] } {
  const crossed = TIME_WARNINGS_MINUTES.filter((t) => msLeft > 0 && msLeft <= t * 60_000 && !shown.includes(t));
  if (crossed.length === 0) return { warn: null, shown: [...shown] };
  return { warn: Math.min(...crossed), shown: [...shown, ...crossed] };
}

// ---------------------------------------------------------------------------
// Navigeringsraden
// ---------------------------------------------------------------------------

export type NavGroup = { part: string | null; items: { id: string; index: number }[] };

/**
 * Uppgifterna grupperade per del i tentans ordning. `del` står bara på delens första uppgift i
 * filen, så en uppgift utan del hör till samma del som uppgiften före.
 */
export function groupByPart(questions: readonly { id: string; part: string | null }[]): NavGroup[] {
  const groups: NavGroup[] = [];
  let part: string | null = null;
  questions.forEach((q, index) => {
    if (q.part && q.part !== part) part = q.part;
    const last = groups[groups.length - 1];
    if (last && last.part === part) last.items.push({ id: q.id, index });
    else groups.push({ part, items: [{ id: q.id, index }] });
  });
  return groups;
}

/** Delen som varje uppgift hör till (samma regel som groupByPart). */
export function partOf(questions: readonly { id: string; part: string | null }[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const g of groupByPart(questions)) for (const it of g.items) out.set(it.id, g.part);
  return out;
}

export type BoxState = { id: string; index: number; answered: boolean; current: boolean; flagged: boolean };

/** Rutornas tillstånd i navigeringsraden. */
export function navBoxes(questions: readonly { id: string; part: string | null }[], answers: Answers, flags: readonly string[], current: number): { part: string | null; boxes: BoxState[] }[] {
  const flagged = new Set(flags);
  return groupByPart(questions).map((g) => ({
    part: g.part,
    boxes: g.items.map((it) => ({ id: it.id, index: it.index, answered: isAnswered(answers[it.id]), current: it.index === current, flagged: flagged.has(it.id) })),
  }));
}

/** Nästa/föregående index inom tentan (stannar vid kanterna). */
export function step(current: number, delta: number, count: number): number {
  return Math.max(0, Math.min(count - 1, current + delta));
}

/** Växlar flaggan för en uppgift. */
export function toggleFlag(flags: readonly string[], id: string): string[] {
  return flags.includes(id) ? flags.filter((f) => f !== id) : [...flags, id];
}

/** Underlaget för inlämningsdialogen. */
export function submitSummary(questions: readonly { id: string }[], answers: Answers, flags: readonly string[]): { unanswered: string[]; flagged: string[]; answered: number } {
  const unanswered = questions.filter((q) => !isAnswered(answers[q.id])).map((q) => q.id);
  const flagged = questions.filter((q) => flags.includes(q.id)).map((q) => q.id);
  return { unanswered, flagged, answered: questions.length - unanswered.length };
}

// ---------------------------------------------------------------------------
// Listor och siffror
// ---------------------------------------------------------------------------

/** Antal uppgifter per typ, i typernas ordning. */
export function kindCounts(questions: readonly { kind: QuestionKind }[]): { kind: QuestionKind; count: number }[] {
  return QUESTION_KINDS.map((kind) => ({ kind, count: questions.filter((q) => q.kind === kind).length })).filter((k) => k.count > 0);
}

/** Typerna i löptext, i singular och plural. */
const KIND_NOUN: Record<QuestionKind, [string, string]> = {
  flerval: ["flervalsfråga", "flervalsfrågor"],
  flera: ["fråga med flera svar", "frågor med flera svar"],
  "sant-falskt": ["sant/falskt-fråga", "sant/falskt-frågor"],
  para: ["para ihop-uppgift", "para ihop-uppgifter"],
  numerisk: ["räkneuppgift med svar", "räkneuppgifter med svar"],
  text: ["skrivuppgift", "skrivuppgifter"],
};

/** "6 flervalsfrågor, 2 sant/falskt-frågor, 1 skrivuppgift" */
export function kindSummary(counts: readonly { kind: QuestionKind; count: number }[]): string {
  return counts.map(({ kind, count }) => `${count} ${KIND_NOUN[kind][count === 1 ? 0 : 1]}`).join(", ");
}

/** Poäng med decimalkomma och högst två decimaler: 1.5 → "1,5". */
export function formatPoints(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace(".", ",");
}

/** Tentans datum: "2024-10-31" → "31 oktober 2024". */
export function formatExamDate(date: string | null): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Stockholm" });
}

/** Ett försöks tidpunkt i svensk tid: "29 sep. 2026 14:32". */
export function formatAttemptTime(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" });
}

/** Ord i en text (ordräknaren under skrivuppgifter). */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Stegen i självbedömningen: 0, 0,5, 1 … upp till uppgiftens max. */
export function halfSteps(max: number): number[] {
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += 0.5) out.push(Math.round(v * 2) / 2);
  return out;
}

export type AttemptInfo = { id: string; exam_id: string; started_at: string; submitted_at: string | null; points: number | null; grade: string | null };

/**
 * En tentas försök i listan: pågående (ej inlämnat och tiden inte ute), inlämnat men inte rättat
 * (rättningsläget: poängen är null tills studenten tryckt Rätta), senaste och bästa rättade.
 * Försöken i valfri ordning.
 */
export function attemptOverview<A extends AttemptInfo>(
  attempts: readonly A[],
  durationMinutes: number,
  now: number,
): { inProgress: A | null; grading: A | null; latest: A | null; best: A | null; submitted: number } {
  const byStart = [...attempts].sort((a, b) => b.started_at.localeCompare(a.started_at));
  // Senaste = senast inlämnade (ett försök som samlats in när tiden tog slut kan ha startat tidigare).
  const done = byStart.filter((a) => a.submitted_at !== null).sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
  const graded = done.filter((a) => a.points !== null);
  const inProgress = byStart.find((a) => a.submitted_at === null && now <= deadlineMs(a.started_at, durationMinutes) + SUBMIT_GRACE_MS) ?? null;
  const best = graded.reduce<A | null>((b, a) => (b === null || Number(a.points ?? 0) > Number(b.points ?? 0) ? a : b), null);
  return { inProgress, grading: done.find((a) => a.points === null) ?? null, latest: graded[0] ?? null, best, submitted: graded.length };
}

/** Ett ej inlämnat försök vars tid (med marginal) är slut: servern lämnar in det med de sparade svaren. */
export function isExpired(a: Pick<AttemptInfo, "started_at" | "submitted_at">, durationMinutes: number, now: number): boolean {
  return a.submitted_at === null && now > deadlineMs(a.started_at, durationMinutes) + SUBMIT_GRACE_MS;
}

/** Nyckeln i webbläsarens lagring för ett försöks svar och flaggor. */
export function storageKey(attemptId: string): string {
  return `kuggfri:tenta:${attemptId}`;
}

export type StoredAttempt = { answers: Answers; flags: string[]; savedAt: number };

/** Läser det sparade i webbläsaren; null om det saknas eller är trasigt. */
export function parseStored(raw: string | null): StoredAttempt | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredAttempt>;
    if (!v || typeof v !== "object" || typeof v.answers !== "object" || v.answers === null) return null;
    return { answers: v.answers as Answers, flags: Array.isArray(v.flags) ? v.flags.filter((f): f is string => typeof f === "string") : [], savedAt: typeof v.savedAt === "number" ? v.savedAt : 0 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Svar från webbläsaren
// ---------------------------------------------------------------------------

/** Det som behövs för att kontrollera ett svar; både ExamQuestion och StudentQuestion passar. */
type QuestionShape = {
  id: string;
  kind: QuestionKind;
  options: readonly unknown[] | null;
  statements: readonly unknown[] | null;
  pairs: readonly unknown[] | null;
  choices: readonly string[] | null;
  /** StudentQuestion: varje leds egen lista. ExamQuestion har listan i ledet (pairs[i].choices). */
  pairChoices?: readonly (readonly string[] | null)[] | null;
};

/** Giltiga svar för led i: ledets egen lista, annars uppgiftens gemensamma. */
function pairChoicesAt(q: QuestionShape, i: number): readonly string[] {
  const own = q.pairChoices?.[i];
  if (own) return own;
  const pair = q.pairs?.[i] as { choices?: readonly string[] | null } | string | undefined;
  if (pair && typeof pair === "object" && Array.isArray(pair.choices) && pair.choices.length > 0) return pair.choices;
  return q.choices ?? [];
}

export const MAX_TEXT_ANSWER = 20_000;
const MAX_NUMERIC_ANSWER = 60;

const isIndex = (v: unknown, n: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < n;

function cleanAnswer(q: QuestionShape, raw: unknown): Answer | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (a.kind !== q.kind) return null;
  switch (q.kind) {
    case "flerval": {
      const n = q.options?.length ?? 0;
      return { kind: "flerval", choice: isIndex(a.choice, n) ? a.choice : null };
    }
    case "flera": {
      const n = q.options?.length ?? 0;
      const list = Array.isArray(a.choices) ? a.choices.filter((c): c is number => isIndex(c, n)) : [];
      return { kind: "flera", choices: [...new Set(list)].sort((x, y) => x - y) };
    }
    case "sant-falskt": {
      const n = q.statements?.length ?? 0;
      const vals = Array.isArray(a.values) ? a.values : [];
      return { kind: "sant-falskt", values: Array.from({ length: n }, (_, i) => (typeof vals[i] === "boolean" ? (vals[i] as boolean) : null)) };
    }
    case "para": {
      const n = q.pairs?.length ?? 0;
      const vals = Array.isArray(a.values) ? a.values : [];
      return { kind: "para", values: Array.from({ length: n }, (_, i) => (typeof vals[i] === "string" && pairChoicesAt(q, i).includes(vals[i] as string) ? (vals[i] as string) : null)) };
    }
    case "numerisk":
      return { kind: "numerisk", value: typeof a.value === "string" ? a.value.slice(0, MAX_NUMERIC_ANSWER) : "" };
    case "text":
      return { kind: "text", value: typeof a.value === "string" ? a.value.slice(0, MAX_TEXT_ANSWER) : "" };
  }
}

/**
 * Svar från webbläsaren, kontrollerade mot tentans uppgifter: bara kända uppgifter, rätt typ,
 * index inom alternativen och begränsad textlängd. Allt annat kastas.
 */
export function sanitizeAnswers(questions: readonly QuestionShape[], raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const source = raw as Record<string, unknown>;
  for (const q of questions) {
    if (!Object.prototype.hasOwnProperty.call(source, q.id)) continue;
    const a = cleanAnswer(q, source[q.id]);
    if (a) out[q.id] = a;
  }
  return out;
}

/** Egna poäng för självbedömda uppgifter: bara kända id:n, 0 till max i halva poäng. */
export function sanitizeSelfGrades(selfGraded: readonly { id: string; max: number }[], raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const source = raw as Record<string, unknown>;
  for (const q of selfGraded) {
    const v = source[q.id];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out[q.id] = Math.max(0, Math.min(q.max, Math.round(v * 2) / 2));
  }
  return out;
}
