/**
 * Tentabanken (docs/TENTOR.md): typer för tentor, uppgifter, svar och resultat. Ren modul.
 *
 * En tenta synkas från material/<kurs>/tentor/*.md till tabellen exams (utanför git). Facit
 * ligger i uppgifterna; studenterna får en version utan facit (`forStudent`) och facit först
 * när de lämnat in.
 */

export const QUESTION_KINDS = ["flerval", "flera", "sant-falskt", "para", "numerisk", "text"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const QUESTION_KIND_LABEL: Record<QuestionKind, string> = {
  flerval: "Flerval",
  flera: "Flera rätta",
  "sant-falskt": "Sant/Falskt",
  para: "Para ihop",
  numerisk: "Numeriskt svar",
  text: "Skrivuppgift",
};

export type Option = { text: string; correct: boolean };
export type Statement = { text: string; answer: boolean };
export type Pair = { prompt: string; answer: string };
export type NumericKey = { value: number; tolerance: number; relative: boolean; unit: string | null };

export type ExamQuestion = {
  /** Numret som på tentan: "1a", "2", "3b". Unikt inom tentan. */
  id: string;
  kind: QuestionKind;
  points: number;
  /** Tentans del, t.ex. Metaller eller Polymerer. */
  part: string | null;
  /** Sida i källan. */
  page: string | null;
  /** Figurer över frågan, i ordning: sökvägar i filerna (bilder/…) eller, efter synken, data-URI:er. */
  images: string[];
  prompt: string;
  /** Svarsförslag eller förklaring, visas efter inlämning. Obligatoriskt för text. */
  solution: string | null;
  /** flera: alltelleringet (standard) eller delpoäng. */
  scoring: "alltelleringet" | "delpoang";
  /** Facit saknas eller går inte att läsa (status: saknar-facit): självrättas som en skrivuppgift. */
  noKey: boolean;
  options: Option[] | null;
  statements: Statement[] | null;
  pairs: Pair[] | null;
  choices: string[] | null;
  numeric: NumericKey | null;
};

export type GradeLimit = { grade: string; min: number };

export type Exam = {
  key: string;
  title: string;
  /** ÅÅÅÅ-MM-DD */
  date: string | null;
  durationMinutes: number;
  maxPoints: number;
  /** Stigande, t.ex. 3 ≥ 20, 4 ≥ 30, 5 ≥ 40. */
  grades: GradeLimit[];
  aids: string | null;
  instructions: string | null;
  source: string | null;
  status: "utkast" | "publicerad";
  questions: ExamQuestion[];
};

// ---------------------------------------------------------------------------
// Studentens version: inget facit
// ---------------------------------------------------------------------------

export type StudentQuestion = {
  id: string;
  kind: QuestionKind;
  points: number;
  part: string | null;
  images: string[];
  prompt: string;
  /** flerval/flera: alternativen utan rätt-markering. */
  options: string[] | null;
  /** flera: hur många som är rätt (Inspera visar "välj N"). */
  correctCount: number | null;
  /** Självrättas mot lösningen (skrivuppgifter och uppgifter utan facit). */
  selfGraded: boolean;
  statements: string[] | null;
  pairs: string[] | null;
  choices: string[] | null;
  unit: string | null;
};

export type StudentExam = Omit<Exam, "questions" | "source" | "status"> & { questions: StudentQuestion[] };

export function forStudent(exam: Exam): StudentExam {
  // Källa och status är redaktörernas; frågorna skickas utan facit.
  const { key, title, date, durationMinutes, maxPoints, grades, aids, instructions, questions } = exam;
  return {
    key,
    title,
    date,
    durationMinutes,
    maxPoints,
    grades,
    aids,
    instructions,
    questions: questions.map((q) => ({
      id: q.id,
      kind: q.kind,
      points: q.points,
      part: q.part,
      images: q.images,
      prompt: q.prompt,
      options: q.options ? q.options.map((o) => o.text) : null,
      correctCount: q.kind === "flera" && q.options && !q.noKey ? q.options.filter((o) => o.correct).length : null,
      selfGraded: q.kind === "text" || q.noKey,
      statements: q.statements ? q.statements.map((s) => s.text) : null,
      pairs: q.pairs ? q.pairs.map((p) => p.prompt) : null,
      choices: q.choices,
      unit: q.numeric?.unit ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Svar
// ---------------------------------------------------------------------------

/** Studentens svar per uppgift (id → svar). Formen beror på typen. */
export type Answer =
  | { kind: "flerval"; choice: number | null }
  | { kind: "flera"; choices: number[] }
  | { kind: "sant-falskt"; values: (boolean | null)[] }
  | { kind: "para"; values: (string | null)[] }
  | { kind: "numerisk"; value: string }
  | { kind: "text"; value: string };

export type Answers = Record<string, Answer>;

export function isAnswered(a: Answer | undefined): boolean {
  if (!a) return false;
  switch (a.kind) {
    case "flerval":
      return a.choice !== null;
    case "flera":
      return a.choices.length > 0;
    case "sant-falskt":
      return a.values.some((v) => v !== null);
    case "para":
      return a.values.some((v) => v !== null);
    case "numerisk":
    case "text":
      return a.value.trim() !== "";
  }
}
