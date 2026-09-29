/**
 * Tentafiler (docs/TENTOR.md): markdown in, Exam ut, med problem och radnummer. Ren modul.
 */
import { QUESTION_KINDS, type Exam, type ExamQuestion, type GradeLimit, type NumericKey, type Pair, type QuestionKind } from "./model";

export type ExamIssue = { line: number; message: string };
export type ExamParse = { exam: Exam; issues: ExamIssue[] };

const ATTR = /^([a-zåäöA-ZÅÄÖ-]+)\s*:\s*(.*)$/;
const OPTION = /^- \[( |x|X)\] (.+)$/;
const STATEMENT = /^- \[(sant|falskt)\] (.+)$/i;
const PAIR = /^- (.+?)\s*=>\s*(.+)$/;

/**
 * Ett led i para ihop. `Led => Svar` använder uppgiftens gemensamma lista (alternativ:). Med en
 * egen lista per led (lucktexter i Inspera) står alternativen i ledet, i visningsordning,
 * avskilda med | och det rätta markerat med [x]: `Led => 0,02 % | [x] 0,77 % | 2,1 %`.
 */
export function parsePair(prompt: string, rest: string): Pair {
  if (!rest.includes("|")) return { prompt, answer: rest };
  const items = rest.split("|").map((c) => c.trim()).filter(Boolean);
  const marked = items.filter((c) => /^\[x\]\s*/i.test(c));
  const list = items.map((c) => c.replace(/^\[x\]\s*/i, "").trim());
  const answer = marked.length === 1 ? marked[0]!.replace(/^\[x\]\s*/i, "").trim() : "";
  return { prompt, answer, choices: list };
}

/** "1,5" eller "1.5" → 1.5; annat → null. */
export function parseNumber(value: string): number | null {
  const v = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** "3=20, 4=30, 5=40" → stigande gränser. */
export function parseGrades(value: string): GradeLimit[] | null {
  const parts = value.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const out: GradeLimit[] = [];
  for (const p of parts) {
    const m = /^([^=]+)=\s*(.+)$/.exec(p);
    const min = m ? parseNumber(m[2] ?? "") : null;
    if (!m || min === null) return null;
    out.push({ grade: (m[1] ?? "").trim(), min });
  }
  return out.sort((a, b) => a.min - b.min);
}

function norm(key: string): string {
  return key
    .toLowerCase()
    .replace(/å|ä/g, "a")
    .replace(/ö/g, "o");
}

type Block = { line: number; attrs: Map<string, { value: string; line: number }>; body: string[]; bodyStart: number; solution: string[] | null };

function readAttrs(lines: string[], start: number): { attrs: Block["attrs"]; next: number } {
  const attrs: Block["attrs"] = new Map();
  let i = start;
  for (; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    if (!raw.trim()) break;
    const m = ATTR.exec(raw.trim());
    if (!m) break;
    attrs.set(norm(m[1] ?? ""), { value: (m[2] ?? "").trim(), line: i + 1 });
  }
  return { attrs, next: i };
}

export function parseExamFile(text: string, key: string): ExamParse {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const issues: ExamIssue[] = [];
  const at = (line: number, message: string) => issues.push({ line, message });

  // Titel och tentans egenskaper
  let i = 0;
  while (i < lines.length && !(lines[i] ?? "").trim()) i++;
  const titleLine = lines[i] ?? "";
  if (!titleLine.startsWith("# ")) at(i + 1, "Filen ska börja med # Tentans titel.");
  const title = titleLine.replace(/^#\s*/, "").trim();
  const head = readAttrs(lines, i + 1);
  const h = (name: string) => head.attrs.get(name)?.value ?? null;

  const date = h("datum");
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) at(head.attrs.get("datum")!.line, `Datumet ”${date}” ska vara ÅÅÅÅ-MM-DD.`);
  const duration = parseNumber(h("tid") ?? "");
  if (duration === null || duration <= 0) at(i + 1, "tid: saknas eller är inte ett antal minuter.");
  const maxPoints = parseNumber(h("poang") ?? "");
  if (maxPoints === null || maxPoints <= 0) at(i + 1, "poäng: (tentans maxpoäng) saknas eller är fel.");
  const grades = parseGrades(h("betyg") ?? "");
  if (!grades || grades.length === 0) at(i + 1, "betyg: saknas eller har fel form (t.ex. 3=20, 4=30, 5=40).");
  const status = h("status") ?? "utkast";
  if (status !== "utkast" && status !== "publicerad") at(i + 1, `Okänd status ”${status}” (utkast eller publicerad).`);

  // Uppgifter: ## <id> … fram till nästa ##
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (let j = head.next; j < lines.length; j++) {
    const raw = lines[j] ?? "";
    if (raw.startsWith("## ")) {
      const id = raw.slice(3).trim();
      const a = readAttrs(lines, j + 1);
      current = { line: j + 1, attrs: new Map([["__id", { value: id, line: j + 1 }], ...a.attrs]), body: [], bodyStart: a.next + 1, solution: null };
      blocks.push(current);
      j = a.next;
      continue;
    }
    if (!current) {
      if (raw.trim()) at(j + 1, "Text före första uppgiften (## …).");
      continue;
    }
    if (/^###\s+lösning\s*$/i.test(raw.trim())) {
      current.solution = [];
      continue;
    }
    if (current.solution) current.solution.push(raw);
    else current.body.push(raw);
  }

  const seen = new Set<string>();
  const questions: ExamQuestion[] = [];
  for (const b of blocks) {
    const a = (name: string) => b.attrs.get(name)?.value ?? null;
    const id = a("__id") ?? "";
    const where = (msg: string) => at(b.line, `Uppgift ${id}: ${msg}`);
    if (!id) where("saknar nummer.");
    if (seen.has(id)) where("numret finns två gånger.");
    seen.add(id);

    const kindRaw = (a("typ") ?? "").toLowerCase();
    const kind = (QUESTION_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as QuestionKind) : null;
    if (!kind) where(`okänd eller saknad typ ”${kindRaw}” (${QUESTION_KINDS.join(", ")}).`);
    const points = parseNumber(a("poang") ?? "");
    if (points === null || points <= 0) where("poäng: saknas eller är fel.");
    const noKey = (a("status") ?? "").toLowerCase() === "saknar-facit";
    const scoringRaw = norm(a("poangsattning") ?? "alltelleringet");
    const scoring = scoringRaw === "delpoang" ? "delpoang" : "alltelleringet";

    // Svarsdelen plockas ur brödtexten; resten är frågetexten.
    const promptLines: string[] = [];
    const options: { text: string; correct: boolean }[] = [];
    const statements: { text: string; answer: boolean }[] = [];
    const pairs: Pair[] = [];
    for (const raw of b.body) {
      const t = raw.trim();
      let m: RegExpExecArray | null;
      if ((kind === "flerval" || kind === "flera") && (m = OPTION.exec(t))) options.push({ text: (m[2] ?? "").trim(), correct: m[1] !== " " });
      else if (kind === "sant-falskt" && (m = STATEMENT.exec(t))) statements.push({ text: (m[2] ?? "").trim(), answer: (m[1] ?? "").toLowerCase() === "sant" });
      else if (kind === "para" && (m = PAIR.exec(t))) pairs.push(parsePair((m[1] ?? "").trim(), (m[2] ?? "").trim()));
      else promptLines.push(raw);
    }
    const prompt = promptLines.join("\n").trim();
    const solution = b.solution ? b.solution.join("\n").trim() || null : null;
    if (!prompt) where("saknar frågetext.");

    let choices: string[] | null = null;
    let numeric: NumericKey | null = null;
    if (kind === "flerval" || kind === "flera") {
      const right = options.filter((o) => o.correct).length;
      if (options.length < 2) where("behöver minst två alternativ (- [ ] / - [x]).");
      if (!noKey && kind === "flerval" && right !== 1) where(`flerval ska ha exakt ett rätt alternativ (har ${right}).`);
      if (!noKey && kind === "flera" && right < 1) where("flera ska ha minst ett rätt alternativ.");
    }
    if (kind === "sant-falskt" && statements.length < 1) where("behöver minst ett påstående (- [sant] … / - [falskt] …).");
    if (kind === "para") {
      choices = (a("alternativ") ?? "").split("|").map((c) => c.trim()).filter(Boolean);
      const ownLists = pairs.some((p) => p.choices);
      if (!ownLists && choices.length < 2) where("alternativ: behöver minst två val, avskilda med |.");
      if (ownLists && choices.length === 0) choices = null;
      if (pairs.length < 1) where("behöver minst ett led (- Led => Svar).");
      for (const p of pairs) {
        const list = p.choices ?? choices ?? [];
        if (p.choices === undefined && !choices) where(`ledet ”${p.prompt}” har ingen lista (alternativ: saknas).`);
        if (p.choices && p.choices.length < 2) where(`ledet ”${p.prompt}” behöver minst två val.`);
        if (p.choices && p.choices.filter((c) => c === p.answer).length !== 1) where(`ledet ”${p.prompt}” ska ha exakt ett [x] och inga dubbletter av svaret.`);
        if (!noKey && !list.includes(p.answer)) where(`svaret ”${p.answer}” finns inte bland alternativen.`);
      }
    }
    const penaltyRaw = a("minuspoang");
    const penalty = penaltyRaw === null ? null : parseNumber(penaltyRaw);
    if (penaltyRaw !== null) {
      if (penalty === null || penalty <= 0) where("minuspoäng: ska vara ett positivt tal (avdraget per fel svar, t.ex. 0,25).");
      else if (kind !== "sant-falskt" && kind !== "flera" && kind !== "para") where("minuspoäng: gäller bara sant-falskt, flera och para.");
    }
    if (kind === "numerisk" && !noKey) {
      const value = parseNumber(a("svar") ?? "");
      const tolRaw = (a("tolerans") ?? "0").trim();
      const relative = tolRaw.endsWith("%");
      const tolerance = parseNumber(tolRaw.replace("%", ""));
      if (value === null) where("svar: saknas eller är inte ett tal.");
      if (tolerance === null || tolerance < 0) where("tolerans: är inte ett tal.");
      numeric = { value: value ?? 0, tolerance: relative ? (tolerance ?? 0) / 100 : (tolerance ?? 0), relative, unit: a("enhet") || null };
    } else if (kind === "numerisk") {
      numeric = { value: 0, tolerance: 0, relative: false, unit: a("enhet") || null };
    }
    if ((kind === "text" || noKey) && !solution) where("### Lösning krävs för skrivuppgifter och uppgifter utan facit.");

    questions.push({
      id,
      kind: kind ?? "text",
      points: points ?? 0,
      part: a("del"),
      page: a("sida"),
      images: (a("bild") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      prompt,
      solution,
      scoring,
      noKey,
      penalty: penalty !== null && penalty > 0 && (kind === "sant-falskt" || kind === "flera" || kind === "para") ? penalty : null,
      options: kind === "flerval" || kind === "flera" ? options : null,
      statements: kind === "sant-falskt" ? statements : null,
      pairs: kind === "para" ? pairs : null,
      choices,
      numeric,
    });
  }
  if (questions.length === 0) at(1, "Tentan har inga uppgifter.");

  const sum = Math.round(questions.reduce((s, q) => s + q.points, 0) * 100) / 100;
  if (maxPoints !== null && sum !== maxPoints) at(i + 1, `Uppgifternas poäng summerar till ${sum}, men tentans maxpoäng är ${maxPoints}.`);

  return {
    exam: {
      key,
      title,
      date,
      durationMinutes: duration ?? 240,
      maxPoints: maxPoints ?? sum,
      grades: grades ?? [],
      aids: h("hjalpmedel"),
      instructions: h("anvisning"),
      source: h("kalla"),
      status: status === "publicerad" ? "publicerad" : "utkast",
      questions,
    },
    issues,
  };
}
