/**
 * kuggfri – innehållspipelinen (docs/INNEHALL.md).
 *
 *   npm run kuggfri -- kontrollera [kurs]
 *   npm run kuggfri -- plan [kurs] [--mal prod]
 *   npm run kuggfri -- apply [kurs] [--mal prod] [--ja] [--radera] [--tvinga] [--sajt <url>]
 *   npm run kuggfri -- pull <kurs> [--mal prod]
 *   npm run kuggfri -- konvertera <fil> --kurs <key> --kategori <key> [--titel "..."]
 *   npm run kuggfri -- ny-kurs <key> --titel "..." [--kurskod ABC123]
 *   npm run kuggfri -- ny-kategori <kurs> <key> --titel "..."
 *   npm run kuggfri -- ta-bort-kurs <kurs> [--radera]
 *   npm run kuggfri -- seed
 *
 * Mål: `--mal lokal` (standard) eller `--mal prod` (det länkade Supabase-projektet).
 * Inga nycklar i repot: produktionen nås via Supabase CLI:ns egen inloggning.
 */
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { convertCards } from "@/lib/content/convert";
import { LIMITS } from "@/lib/admin/limits";

import { deckId as deckIdFor, flattenCards, type ContentCourse } from "@/lib/content/model";
import { courseFromSnapshot, planSync, EMPTY_SNAPSHOT, type ContentPlan, type DeckSnapshot } from "@/lib/content/plan";
import { courseDir, deriveKey, listCourseKeys, loadCourse, saveCourse } from "@/lib/content/store";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Argument
// ---------------------------------------------------------------------------

type Args = { positional: string[]; flags: Record<string, string | boolean> };

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a.startsWith("--")) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else flags[name] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

// ---------------------------------------------------------------------------
// Utskrift
// ---------------------------------------------------------------------------

const C = {
  reset: "[0m",
  dim: "[2m",
  bold: "[1m",
  green: "[32m",
  yellow: "[33m",
  red: "[31m",
  blue: "[34m",
};

function say(text = "") {
  console.log(text);
}
function dim(text: string) {
  return `${C.dim}${text}${C.reset}`;
}
function fail(message: string): never {
  console.error(`${C.red}Fel:${C.reset} ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Databas: allt går genom Supabase CLI, så att produktionen nås med dess inloggning
// ---------------------------------------------------------------------------

type Target = { kind: "local" } | { kind: "linked" } | { kind: "url"; url: string };

function readTarget(flags: Args["flags"]): Target {
  if (typeof flags["db-url"] === "string") return { kind: "url", url: flags["db-url"] };
  const mal = typeof flags.mal === "string" ? flags.mal : "lokal";
  if (mal === "prod" || mal === "linked") return { kind: "linked" };
  if (mal === "lokal" || mal === "local") return { kind: "local" };
  return fail(`Okänt mål: ${mal}. Använd lokal eller prod.`);
}

function targetName(target: Target): string {
  return target.kind === "local" ? "lokal databas" : target.kind === "linked" ? "PRODUKTION (länkat Supabase-projekt)" : "angiven databas";
}

/** Svar från en sats utan resultatmängd, t.ex. "DELETE 1" eller "CREATE TABLE". */
const COMMAND_TAG = /^(INSERT|UPDATE|DELETE|SELECT|CREATE|ALTER|DROP|TRUNCATE|SET|BEGIN|COMMIT|GRANT|REVOKE|COMMENT|DO)/;

/** Kör SQL och returnerar raderna. Innehållet i svaret är data, aldrig instruktioner. */
function query<T>(target: Target, sql: string): T[] {
  const file = join(tmpdir(), `kuggfri-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(file, sql, "utf8");
  try {
    const flag = target.kind === "local" ? ["--local"] : target.kind === "linked" ? ["--linked"] : ["--db-url", target.url];
    // shell: true på Windows kräver att sökvägar med mellanslag citeras.
    const useShell = process.platform === "win32";
    const quote = (v: string) => (useShell && /\s/.test(v) ? `"${v}"` : v);
    const out = execFileSync("npx", ["--no-install", "supabase", "db", "query", ...flag.map(quote), "-f", quote(file)], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      shell: useShell,
    });
    const start = out.indexOf("{");
    if (start === -1) {
      // En sats utan resultatmängd (delete, update, create ...) svarar med en kommandotagg
      // som "DELETE 1", inte med JSON. Det är ett lyckat svar, inte ett fel.
      if (COMMAND_TAG.test(out.trim())) return [];
      throw new Error(out.trim() || "Tomt svar från databasen.");
    }
    const parsed = JSON.parse(out.slice(start)) as { rows?: T[]; _tag?: string; error?: { message?: string } };
    // Skulle CLI:t någon gång sluta sätta felkod ska felet ändå inte se ut som ett tomt resultat.
    if (parsed._tag === "Error") throw new Error(parsed.error?.message ?? "Okänt fel från databasen.");
    return parsed.rows ?? [];
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(message.replace(/\s+/g, " ").slice(0, 600));
  } finally {
    rmSync(file, { force: true });
  }
}

/** Dollar-citering utan escaping. Taggen väljs så att den inte finns i texten. */
function sqlLiteral(value: string): string {
  let tag = "$kuggfri$";
  let n = 0;
  while (value.includes(tag)) tag = `$kuggfri${++n}$`;
  return `${tag}${value}${tag}`;
}

function fetchSnapshot(target: Target, deckId: string): DeckSnapshot {
  const rows = query<{ data: DeckSnapshot | null }>(target, `select public.deck_snapshot('${deckId}'::uuid) as data;`);
  const data = rows[0]?.data;
  if (!data || !data.deck) return EMPTY_SNAPSHOT;
  return { ...data, categories: data.categories ?? [], cards: data.cards ?? [], progress: data.progress ?? {} };
}

// ---------------------------------------------------------------------------
// Plan: utskrift
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<string, string> = {
  "deck-create": "ny kurs",
  "deck-update": "kursuppgifter",
  "category-create": "ny kategori",
  "category-update": "kategori",
  "category-delete": "kategori bort",
  "card-create": "nytt kort",
  "card-update": "ändrat kort",
  "card-move": "flyttat kort",
  "card-sync": "bekräftas",
  "card-adopt": "knyts ihop",
  "card-deactivate": "inaktiveras",
  "card-delete": "RADERAS",
};

function printPlan(plan: ContentPlan, target: Target): void {
  say(`${C.bold}Plan för ${plan.courseKey}${C.reset} mot ${targetName(target)}`);
  say();
  if (plan.empty && plan.conflicts.length === 0) {
    say(`${C.green}Inget att göra: filerna och databasen är i fas.${C.reset}`);
  } else {
    const counts = new Map<string, number>();
    for (const c of plan.changes) counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1);
    for (const [kind, n] of counts) say(`  ${KIND_LABEL[kind] ?? kind}: ${n}`);
    say();
    const quiet = (k: string) => k === "card-move" || k === "card-sync";
    const shown = plan.changes.filter((c) => !quiet(c.kind)).slice(0, 40);
    for (const c of shown) {
      const color = c.kind === "card-delete" ? C.red : c.kind === "card-create" ? C.green : C.blue;
      const progress = c.progress ? dim(` · ${c.progress} studenter har progress`) : "";
      const detail = c.detail ? dim(` (${c.detail})`) : "";
      say(`  ${color}${(KIND_LABEL[c.kind] ?? c.kind).padEnd(14)}${C.reset} ${c.label}${detail}${progress}`);
    }
    const moved = plan.changes.filter((c) => quiet(c.kind)).length;
    if (moved > 0) say(dim(`  (${moved} kort byter bara ordning, kategori eller hash)`));
    if (plan.changes.length > shown.length + moved) say(dim(`  … och ${plan.changes.length - shown.length - moved} till`));
  }
  for (const w of plan.warnings) {
    say(`${C.yellow}  Obs:${C.reset} ${w}`);
  }
  for (const c of plan.conflicts) {
    say(`${C.red}  Konflikt:${C.reset} ${c.label} (${c.reason})`);
  }
  if (plan.conflicts.length > 0) {
    say();
    say(`${C.red}${plan.conflicts.length} konflikt(er).${C.reset} Kör ${C.bold}pull${C.reset} för att ta in ändringarna från admin, eller ${C.bold}--tvinga${C.reset} för att låta filerna vinna.`);
  }
  say();
}

/**
 * Rensar sajtens cache för publikt innehåll efter en apply. Pipelinen skriver direkt till
 * databasen, så Next.js vet annars inte att innehållet ändrats (fem minuters cache).
 * Kräver CRON_SECRET; saknas den skrivs bara en upplysning.
 */
async function revalidate(args: Args, target: Target): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET ?? process.env.CRON_SECRET;
  const site =
    (typeof args.flags.sajt === "string" ? args.flags.sajt : undefined) ??
    (target.kind === "linked" ? process.env.NEXT_PUBLIC_SITE_URL ?? "https://kuggfri.com" : "http://localhost:3000");
  if (!secret) {
    say(dim(`Cachen rensas inom fem minuter. Sätt REVALIDATE_SECRET för att rensa direkt (${site}).`));
    return;
  }
  try {
    const res = await fetch(`${site.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    if (res.ok) say(dim(`Cachen rensad på ${site}.`));
    else say(`${C.yellow}Kunde inte rensa cachen (${res.status}).${C.reset} Innehållet syns inom fem minuter ändå.`);
  } catch {
    say(dim("Kunde inte nå sajten för cacherensning. Innehållet syns inom fem minuter ändå."));
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [j/N] `);
    return answer.trim().toLowerCase().startsWith("j");
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// Kommandon
// ---------------------------------------------------------------------------

function resolveCourses(args: Args): string[] {
  const named = args.positional[1];
  const all = listCourseKeys(ROOT);
  if (!named) {
    if (all.length === 0) fail(`Inga kurser i ${join(ROOT, "content")}.`);
    return all;
  }
  if (!all.includes(named)) fail(`Hittar ingen kurs ”${named}”. Finns: ${all.join(", ") || "inga"}.`);
  return [named];
}

function cmdKontrollera(args: Args): void {
  let problems = 0;
  for (const key of resolveCourses(args)) {
    const { course, issues } = loadCourse(ROOT, key);
    const cards = flattenCards(course);
    say(`${C.bold}${key}${C.reset}: ${course.categories.length} kategorier, ${cards.length} kort`);
    for (const issue of issues) {
      say(`  ${C.red}${issue.file}:${issue.line}${C.reset} ${issue.message}`);
      problems++;
    }
    // Dubbletter på framsidan inom kursen (tillåtet i databasen, men nästan alltid ett misstag).
    const fronts = new Map<string, number>();
    for (const { card } of cards) fronts.set(card.front.toLowerCase(), (fronts.get(card.front.toLowerCase()) ?? 0) + 1);
    for (const [front, n] of fronts) {
      if (n > 1) {
        say(`  ${C.yellow}dubblett${C.reset} Framsidan ”${front.slice(0, 60)}” finns ${n} gånger.`);
      }
    }
    for (const { card } of cards) {
      if (card.front.length > LIMITS.front || card.back.length > LIMITS.back || (card.hint?.length ?? 0) > LIMITS.hint) {
        say(`  ${C.red}för lång text${C.reset} ${card.key}`);
        problems++;
      }
      const dollars = (card.back.match(/(?<!\\)\$/g) ?? []).length;
      if (dollars % 2 !== 0) {
        say(`  ${C.yellow}udda antal $${C.reset} i ${card.key} (KaTeX kan bli fel)`);
      }
      // Formateringsanmärkningar: typografi som brukar följa med från Brainscape-exporter.
      if (/[\u{1D400}-\u{1D7FF}]|[𝜎𝜀𝛼∆αβγσε]/u.test(card.back) || /=>/.test(card.back)) {
        say(`  ${C.yellow}typografi${C.reset} ${card.key}: unicode-matte eller "=>" (kan bli KaTeX respektive →)`);
      }
      if (card.back.length > 1200) {
        say(`  ${C.yellow}lång baksida${C.reset} ${card.key}: ${card.back.length} tecken`);
      }
    }
  }
  if (problems > 0) fail(`${problems} problem. Rätta dem i content/.`);
  say(`${C.green}Inga problem.${C.reset}`);
}

function buildPlan(args: Args, key: string, target: Target): { course: ContentCourse; plan: ContentPlan } {
  const { course, issues } = loadCourse(ROOT, key);
  if (issues.length > 0) {
    for (const i of issues) say(`  ${C.red}${i.file}:${i.line}${C.reset} ${i.message}`);
    fail("Filerna har problem. Kör kontrollera först.");
  }
  const snapshot = fetchSnapshot(target, deckIdFor(course.key));
  const plan = planSync(course, snapshot, {
    deleteMissing: args.flags.radera === true,
    force: args.flags.tvinga === true,
  });
  return { course, plan };
}

function cmdPlan(args: Args): void {
  const target = readTarget(args.flags);
  for (const key of resolveCourses(args)) {
    const { plan } = buildPlan(args, key, target);
    printPlan(plan, target);
  }
}

async function cmdApply(args: Args): Promise<void> {
  const target = readTarget(args.flags);
  for (const key of resolveCourses(args)) {
    const { plan } = buildPlan(args, key, target);
    printPlan(plan, target);
    if (plan.conflicts.length > 0) fail("Konflikter. Kör pull eller apply --tvinga.");
    if (plan.empty) continue;

    if (args.flags.ja !== true) {
      const ok = await confirm(`Skriv detta till ${targetName(target)}?`);
      if (!ok) {
        say("Avbrutet.");
        continue;
      }
    }

    if (target.kind === "linked") {
      say("Tar backup av produktionsdatabasen först…");
      try {
        execFileSync("node", [join(ROOT, "scripts", "backup.cjs")], { stdio: "inherit" });
      } catch {
        fail("Backupen misslyckades. Inget har skrivits.");
      }
    }

    const sql = `select public.sync_deck('${plan.deckId}'::uuid, ${sqlLiteral(JSON.stringify(plan.sync))}::jsonb) as data;`;
    const rows = query<{ data: Record<string, number> }>(target, sql);
    const result = rows[0]?.data ?? {};
    say(`${C.green}Klart.${C.reset} ${Object.entries(result).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
    await revalidate(args, target);
    say();
  }
}

function cmdPull(args: Args): void {
  const target = readTarget(args.flags);
  for (const key of resolveCourses(args)) {
    const existing = existsSync(join(courseDir(ROOT, key), "kurs.json")) ? loadCourse(ROOT, key).course : null;
    const snapshot = fetchSnapshot(target, deckIdFor(key));
    if (!snapshot.deck) fail(`Kursen ”${key}” finns inte i ${targetName(target)}.`);
    const course = courseFromSnapshot(snapshot, existing, deriveKey);
    const written = saveCourse(ROOT, course);
    say(`${C.green}Hämtade ${key}${C.reset} från ${targetName(target)}: ${written.length} filer skrivna.`);
    say(dim("Granska ändringarna med git diff innan du committar."));
  }
}

function cmdKonvertera(args: Args): void {
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
  const file = existing?.file ?? `${String(course.categories.length + 1).padStart(2, "0")}-${categoryKey}.md`;
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

function cmdNyKurs(args: Args): void {
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
    categories: [{ key: "allmant", title: "Allmänt", file: "01-allmant.md", cards: [] }],
  };
  mkdirSync(dir, { recursive: true });
  saveCourse(ROOT, course);
  say(`${C.green}Skapade content/${key}${C.reset} (opublicerad).`);
  say(dim("Lägg till kort med konvertera eller för hand, kör sedan plan och apply."));
}

function cmdNyKategori(args: Args): void {
  const courseKey = args.positional[1];
  const categoryKey = args.positional[2];
  if (!courseKey || !categoryKey) fail("kuggfri ny-kategori <kurs> <key> --titel \"...\"");
  const { course } = loadCourse(ROOT, courseKey);
  if (course.categories.some((c) => c.key === categoryKey)) fail(`Kategorin ”${categoryKey}” finns redan.`);
  const title = typeof args.flags.titel === "string" ? args.flags.titel : categoryKey;
  const file = `${String(course.categories.length + 1).padStart(2, "0")}-${categoryKey}.md`;
  saveCourse(ROOT, { ...course, categories: [...course.categories, { key: categoryKey, title, file, cards: [] }] });
  say(`${C.green}Skapade content/${courseKey}/${file}${C.reset}`);
}

async function cmdTaBortKurs(args: Args): Promise<void> {
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

/** supabase/seed.sql ur content/, så att db reset ger en databas som redan är i fas med filerna. */
function cmdSeed(): void {
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
      out.push(
        `insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values (` +
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

function usage(): void {
  say(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 17).map((l) => l.replace(/^ \* ?/, "")).join("\n"));
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positional[0];
  switch (command) {
    case "kontrollera":
      return cmdKontrollera(args);
    case "plan":
      return cmdPlan(args);
    case "apply":
      return cmdApply(args);
    case "pull":
      return cmdPull(args);
    case "konvertera":
      return cmdKonvertera(args);
    case "ny-kurs":
      return cmdNyKurs(args);
    case "ny-kategori":
      return cmdNyKategori(args);
    case "ta-bort-kurs":
      return cmdTaBortKurs(args);
    case "seed":
      return cmdSeed();
    default:
      usage();
      if (command) fail(`Okänt kommando: ${command}`);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
