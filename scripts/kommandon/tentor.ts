/** Tentabanken (docs/TENTOR.md): material/<kurs>/tentor/*.md → tabellen exams. */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { deckId as deckIdFor } from "@/lib/content/model";
import { parseExamFile, type ExamIssue } from "@/lib/tentor/format";
import type { Exam } from "@/lib/tentor/model";
import { ROOT, type Args } from "../cli/args";
import { query, readTarget, sqlLiteral, targetName } from "../cli/db";
import { C, dim, fail, say } from "../cli/output";

const BILD_TYPER: Record<string, string> = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };

type LoadedExam = { file: string; exam: Exam; issues: ExamIssue[]; hash: string };

/** Läser alla tentor för kursen och bäddar in bilderna som data-URI:er. */
function loadExams(key: string): LoadedExam[] {
  const dir = join(ROOT, "material", key, "tentor");
  if (!existsSync(dir)) fail(`Hittar ingen tentabank: material/${key}/tentor/ (se docs/TENTOR.md).`);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => {
      const examKey = file.replace(/\.md$/, "");
      const { exam, issues } = parseExamFile(readFileSync(join(dir, file), "utf8"), examKey);
      if (!/^\d{4}-\d{2}-\d{2}(-[a-z0-9]+)?$/.test(examKey)) issues.push({ line: 1, message: `Filnamnet ska vara tentans datum, ÅÅÅÅ-MM-DD.md (är ${file}).` });
      for (const q of exam.questions) {
        q.images = q.images.map((image) => {
          const path = join(dir, image);
          const type = BILD_TYPER[extname(image).toLowerCase()];
          if (!type) issues.push({ line: 1, message: `Uppgift ${q.id}: bildformatet stöds inte (${image}).` });
          else if (!existsSync(path)) issues.push({ line: 1, message: `Uppgift ${q.id}: bilden ${image} finns inte.` });
          else return `data:${type};base64,${readFileSync(path).toString("base64")}`;
          return image;
        });
      }
      const hash = createHash("sha256").update(JSON.stringify(exam)).digest("hex").slice(0, 12);
      return { file, exam, issues, hash };
    });
}

export function cmdTentor(args: Args): void {
  const sub = args.positional[1];
  const key = args.positional[2];
  if (!sub || !key) fail("kuggfri tentor kontrollera|plan|apply <kurs> [--mal prod] [--ja]");
  const exams = loadExams(key);
  let problems = 0;
  for (const e of exams) {
    const kinds = new Map<string, number>();
    for (const q of e.exam.questions) kinds.set(q.kind, (kinds.get(q.kind) ?? 0) + 1);
    const summary = [...kinds].map(([k, n]) => `${n} ${k}`).join(", ");
    say(`${C.bold}${e.exam.key}${C.reset} ${e.exam.title}: ${e.exam.questions.length} uppgifter, ${e.exam.maxPoints} p (${summary}) ${dim(e.exam.status)}`);
    for (const i of e.issues) {
      say(`  ${C.red}${e.file}:${i.line}${C.reset} ${i.message}`);
      problems++;
    }
  }
  if (problems > 0) fail(`${problems} problem i tentabanken.`);
  if (sub === "kontrollera") {
    say(`${C.green}Inga problem.${C.reset} ${exams.length} tentor.`);
    return;
  }

  const target = readTarget(args.flags);
  const deckId = deckIdFor(key);
  const existing = new Map(
    query<{ key: string; source_hash: string | null; status: string }>(target, `select key, source_hash, status from public.exams where deck_id = '${deckId}'::uuid;`).map((r) => [r.key, r] as const),
  );
  const changed = exams.filter((e) => existing.get(e.exam.key)?.source_hash !== e.hash);
  const onlyInDb = [...existing.keys()].filter((k) => !exams.some((e) => e.exam.key === k));
  say(`${C.bold}Tentor för ${key}${C.reset} mot ${targetName(target)}: ${changed.length} att skriva, ${exams.length - changed.length} oförändrade.`);
  for (const e of changed) say(`  ${existing.has(e.exam.key) ? "ändrad" : "ny     "} ${e.exam.key} ${e.exam.title} (${e.exam.status})`);
  for (const k of onlyInDb) say(`  ${C.yellow}finns bara i databasen${C.reset} ${k} (lämnas orörd)`);
  if (sub === "plan" || changed.length === 0) return;
  if (sub !== "apply") fail(`Okänt kommando: tentor ${sub}`);
  if (args.flags.ja !== true) fail("Lägg till --ja för att skriva (tentorna innehåller facit; kontrollera planen först).");

  const rows = changed.map((e) => {
    const x = e.exam;
    const lit = (v: string | null) => (v === null ? "null" : sqlLiteral(v));
    return `(${[
      `'${deckId}'::uuid`,
      sqlLiteral(x.key),
      sqlLiteral(x.title),
      x.date ? `'${x.date}'::date` : "null",
      String(x.durationMinutes),
      String(x.maxPoints),
      `${sqlLiteral(JSON.stringify(x.grades))}::jsonb`,
      lit(x.aids),
      lit(x.instructions),
      lit(x.source),
      sqlLiteral(x.status),
      `${sqlLiteral(JSON.stringify(x.questions))}::jsonb`,
      sqlLiteral(e.hash),
    ].join(", ")})`;
  });
  // En tenta per fråga: figurerna ligger inbäddade, och produktionens API tar inte emot hela
  // tentabanken i en förfrågan (413).
  rows.forEach((row, i) => {
    query(
      target,
      `insert into public.exams (deck_id, key, title, exam_date, duration_minutes, max_points, grade_limits, aids, instructions, source, status, questions, source_hash) values
${row}
on conflict (deck_id, key) do update set
  title = excluded.title, exam_date = excluded.exam_date, duration_minutes = excluded.duration_minutes,
  max_points = excluded.max_points, grade_limits = excluded.grade_limits, aids = excluded.aids,
  instructions = excluded.instructions, source = excluded.source, status = excluded.status,
  questions = excluded.questions, source_hash = excluded.source_hash;`,
    );
    say(`  ${dim(`skrev ${changed[i]?.exam.key ?? ""}`)}`);
  });
  say(`${C.green}Klart.${C.reset} ${changed.length} tentor skrivna.`);
}
