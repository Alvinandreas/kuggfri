/** Kurser och kategorier i filerna: konvertera, ny-kurs, ny-kategori och ta-bort-kurs. */
import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { convertCards } from "@/lib/content/convert";
import { deckId as deckIdFor, flattenCards, type ContentCourse } from "@/lib/content/model";
import { categoryFileName, courseDir, loadCourse, saveCourse } from "@/lib/content/store";
import { ROOT, type Args } from "../cli/args";
import { fetchSnapshot, query, readTarget, targetName } from "../cli/db";
import { C, dim, fail, say } from "../cli/output";

export function cmdKonvertera(args: Args): void {
  const source = args.positional[1];
  if (!source) fail("Ange källfilen: kuggfri konvertera <fil> --kurs <key> --kategori <key>");
  const courseKey = String(args.flags.kurs ?? "");
  const categoryKey = String(args.flags.kategori ?? "");
  if (!courseKey || !categoryKey) fail("--kurs och --kategori krävs.");

  const { course } = loadCourse(ROOT, courseKey);
  const taken = new Set<string>();
  const seenBacks = new Set<string>();
  for (const { card } of flattenCards(course)) taken.add(card.key);

  const text = readFileSync(source, "utf8");
  const result = convertCards(text, { takenKeys: taken, seenBacks });
  if (result.cards.length === 0) fail("Inga kort kunde läsas ur filen.");

  const title = typeof args.flags.titel === "string" ? args.flags.titel : categoryKey;
  const existing = course.categories.find((c) => c.key === categoryKey);
  const file = existing?.file ?? categoryFileName(course.categories.length + 1, categoryKey);
  const cards = existing ? [...existing.cards, ...result.cards] : result.cards;
  const category = { key: categoryKey, title: existing?.title ?? title, file, cards };
  const next: ContentCourse = {
    ...course,
    categories: existing ? course.categories.map((c) => (c.key === categoryKey ? category : c)) : [...course.categories, category],
  };
  saveCourse(ROOT, next);

  for (const issue of result.issues) say(`  ${C.yellow}rad ${issue.row}${C.reset} ${issue.message}`);
  say(`${C.green}Skrev ${result.cards.length} kort${C.reset} till content/${courseKey}/${file}.`);
  say(dim("Granska filen, kör kontrollera och sedan plan."));
}

export function cmdNyKurs(args: Args): void {
  const key = args.positional[1];
  if (!key) fail("Ange kursens nyckel: kuggfri ny-kurs <key> --titel \"...\"");
  const dir = courseDir(ROOT, key);
  if (existsSync(dir)) fail(`content/${key} finns redan.`);
  const title = typeof args.flags.titel === "string" ? args.flags.titel : key;
  const course: ContentCourse = {
    key,
    title,
    description: null,
    course_code: typeof args.flags.kurskod === "string" ? args.flags.kurskod : null,
    source_credit: null,
    exam_date: null,
    published: false,
    sort_order: 0,
    categories: [{ key: "allmant", title: "Allmänt", file: categoryFileName(1, "allmant"), cards: [] }],
  };
  mkdirSync(dir, { recursive: true });
  saveCourse(ROOT, course);
  say(`${C.green}Skapade content/${key}${C.reset} (opublicerad).`);
  say(dim("Lägg till kort med konvertera eller för hand, kör sedan plan och apply."));
}

export function cmdNyKategori(args: Args): void {
  const courseKey = args.positional[1];
  const categoryKey = args.positional[2];
  if (!courseKey || !categoryKey) fail("kuggfri ny-kategori <kurs> <key> --titel \"...\"");
  const { course } = loadCourse(ROOT, courseKey);
  if (course.categories.some((c) => c.key === categoryKey)) fail(`Kategorin ”${categoryKey}” finns redan.`);
  const title = typeof args.flags.titel === "string" ? args.flags.titel : categoryKey;
  const file = categoryFileName(course.categories.length + 1, categoryKey);
  saveCourse(ROOT, { ...course, categories: [...course.categories, { key: categoryKey, title, file, cards: [] }] });
  say(`${C.green}Skapade content/${courseKey}/${file}${C.reset}`);
}

export async function cmdTaBortKurs(args: Args): Promise<void> {
  const key = args.positional[1];
  if (!key) fail("kuggfri ta-bort-kurs <kurs> [--radera]");
  const target = readTarget(args.flags);
  const hard = args.flags.radera === true;
  const snapshot = fetchSnapshot(target, deckIdFor(key));
  if (!snapshot.deck) fail(`Kursen finns inte i ${targetName(target)}.`);
  const students = Object.keys(snapshot.progress).length;

  say(`${C.bold}${hard ? "RADERA" : "Avpublicera"} ${snapshot.deck.title}${C.reset} i ${targetName(target)}`);
  say(`  ${snapshot.cards.length} kort, progress på ${students} kort`);
  if (hard) say(`${C.red}  All progress och historik för kursen försvinner. Det går inte att ångra.${C.reset}`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Skriv kursens nyckel (${key}) för att bekräfta: `);
  rl.close();
  if (answer.trim() !== key) fail("Avbrutet.");

  if (hard) {
    query(target, `delete from public.decks where id = '${snapshot.deck.id}'::uuid;`);
    rmSync(courseDir(ROOT, key), { recursive: true, force: true });
    say(`${C.green}Kursen är raderad och content/${key} borttagen.${C.reset}`);
  } else {
    query(target, `update public.decks set is_published = false where id = '${snapshot.deck.id}'::uuid;`);
    say(`${C.green}Kursen är avpublicerad. Innehåll och progress finns kvar.${C.reset}`);
  }
}
