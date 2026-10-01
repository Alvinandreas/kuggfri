/** Seeden: supabase/seed.sql ur content/. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { planSync, EMPTY_SNAPSHOT } from "@/lib/content/plan";
import { listCourseKeys, loadCourse } from "@/lib/content/store";
import { ROOT } from "../cli/args";
import { sqlLiteral } from "../cli/db";
import { C, fail, say } from "../cli/output";

/** supabase/seed.sql ur content/, så att db reset ger en databas som redan är i fas med filerna. */
export function cmdSeed(): void {
  const out: string[] = [
    "-- GENERERAD FIL. Ändra inte här; ändra i content/ och kör `npm run kuggfri -- seed`.",
    "-- Innehållet och dess kreditering står i content/<kurs>/kurs.json.",
    "",
    "begin;",
  ];
  let decks = 0;
  let cards = 0;
  for (const key of listCourseKeys(ROOT)) {
    const { course, issues } = loadCourse(ROOT, key);
    if (issues.length > 0) {
      for (const i of issues) say(`  ${C.red}${i.file}:${i.line}${C.reset} ${i.message}`);
      fail(`Kursen ${key} har problem. Kör kontrollera.`);
    }
    const plan = planSync(course, EMPTY_SNAPSHOT);
    const d = plan.sync.deck;
    if (!d) continue;
    out.push(`-- Kurs: ${course.title}`);
    out.push(
      `insert into public.decks (id, slug, title, description, course_code, source_credit, exam_date, is_published, sort_order, source_hash) values (` +
        [
          `'${plan.deckId}'`,
          sqlLiteral(d.slug),
          sqlLiteral(d.title),
          d.description === null ? "null" : sqlLiteral(d.description),
          d.course_code === null ? "null" : sqlLiteral(d.course_code),
          d.source_credit === null ? "null" : sqlLiteral(d.source_credit),
          d.exam_date === null ? "null" : `'${d.exam_date}'`,
          String(d.is_published),
          String(d.sort_order),
          sqlLiteral(d.source_hash),
        ].join(", ") +
        `);`,
    );
    for (const c of plan.sync.categories.create) {
      out.push(
        `insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('${c.id}', '${plan.deckId}', ${sqlLiteral(c.key)}, ${sqlLiteral(c.title)}, ${c.sort_order}, ${sqlLiteral(c.source_hash)});`,
      );
    }
    for (const c of plan.sync.cards.create) {
      // Flaggan (Kuggfris källgranskning) bara när den finns, så att seeden för oflaggade kort
      // ser ut som förut.
      const flagged = c.flag_note !== null;
      out.push(
        `insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original${flagged ? ", flag_note, flagged_at" : ""}) values (` +
          [
            `'${c.id}'`,
            `'${plan.deckId}'`,
            c.category_id ? `'${c.category_id}'` : "null",
            sqlLiteral(c.key),
            sqlLiteral(c.front),
            sqlLiteral(c.back),
            c.hint === null ? "null" : sqlLiteral(c.hint),
            String(c.sort_order),
            String(c.is_active),
            sqlLiteral(c.source_hash),
            sqlLiteral(c.kind),
            c.options === null ? "null" : `${sqlLiteral(JSON.stringify(c.options))}::jsonb`,
            c.review_status === null ? "null" : sqlLiteral(c.review_status),
            c.source === null ? "null" : sqlLiteral(c.source),
            String(c.original),
            ...(c.flag_note !== null ? [sqlLiteral(c.flag_note), "now()"] : []),
          ].join(", ") +
          `);`,
      );
      cards++;
    }
    out.push("");
    decks++;
  }
  out.push("commit;", "");
  writeFileSync(join(ROOT, "supabase", "seed.sql"), out.join("\n"), "utf8");
  say(`${C.green}Skrev supabase/seed.sql${C.reset}: ${decks} kurser, ${cards} kort.`);
}
