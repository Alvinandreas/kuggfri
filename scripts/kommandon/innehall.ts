/** Innehållspipelinen: kontrollera, plan, apply och pull (docs/INNEHALL.md). */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LIMITS } from "@/lib/admin/limits";
import { deckId as deckIdFor, flattenCards, type ContentCourse } from "@/lib/content/model";
import { courseFromSnapshot, planSync, type ContentPlan, type DeckSnapshot } from "@/lib/content/plan";
import { courseDir, deriveKey, listCourseKeys, loadCourse, saveCourse } from "@/lib/content/store";
import { imageFilePath, imageProblems, imageRefs } from "@/lib/content/images";
import { ROOT, type Args } from "../cli/args";
import { fetchSnapshot, query, readTarget, sqlLiteral, targetName, type Target } from "../cli/db";
import { gitHead } from "../cli/git";
import { C, confirm, dim, fail, say } from "../cli/output";
import { revalidate } from "../cli/revalidate";
import { countCourse, saveUtgava, utgavaId, type Utgava } from "../utgavor";

// ---------------------------------------------------------------------------
// Plan: utskrift
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<string, string> = {
  "deck-create": "ny kurs",
  "deck-update": "kursuppgifter",
  "category-create": "nytt område",
  "category-update": "område",
  "category-delete": "område bort",
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
      const progress = c.progress ? dim(`, ${c.progress} studenter har progress`) : "";
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

/** Markdownfiler i kursmappen som kurs.json inte pekar ut. */
function orphanFiles(key: string, course: ContentCourse): string[] {
  const mapp = join(ROOT, "content", key);
  const kanda = new Set(course.categories.map((c) => c.file));
  try {
    return readdirSync(mapp)
      .filter((f) => f.endsWith(".md") && !kanda.has(f))
      .sort();
  } catch {
    return [];
  }
}

export function cmdKontrollera(args: Args): void {
  let problems = 0;
  for (const key of resolveCourses(args)) {
    const { course, issues } = loadCourse(ROOT, key);
    const cards = flattenCards(course);
    say(`${C.bold}${key}${C.reset}: ${course.categories.length} områden, ${cards.length} kort`);
    for (const issue of issues) {
      say(`  ${C.red}${issue.file}:${issue.line}${C.reset} ${issue.message}`);
      problems++;
    }
    // Kortfiler som kurs.json inte nämner. De ser ut att vara innehåll men når aldrig
    // en enda student, och inget annat i kedjan säger ifrån.
    for (const fil of orphanFiles(key, course)) {
      say(`  ${C.yellow}oanvänd fil${C.reset} ${fil} saknas i kurs.json och når inga studenter.`);
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
      // Bilder: rätt mapp, filen finns, beskrivande alt-text (lib/content/images.ts).
      for (const ref of [...imageRefs(card.front), ...imageRefs(card.back)]) {
        const imgProblems = imageProblems(ref, key);
        if (imgProblems.length === 0 && !existsSync(join(ROOT, imageFilePath(ref.src)))) imgProblems.push(`Bildfilen ${imageFilePath(ref.src)} finns inte.`);
        for (const p of imgProblems) {
          say(`  ${C.red}bild${C.reset} ${card.key}: ${p}`);
          problems++;
        }
      }
      if (card.back.length > 1200) {
        say(`  ${C.yellow}lång baksida${C.reset} ${card.key}: ${card.back.length} tecken`);
      }
    }
  }
  if (problems > 0) fail(`${problems} problem. Rätta dem i content/.`);
  say(`${C.green}Inga problem.${C.reset}`);
}

function buildPlan(args: Args, key: string, target: Target): { course: ContentCourse; plan: ContentPlan; snapshot: DeckSnapshot } {
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
  return { course, plan, snapshot };
}

export function cmdPlan(args: Args): void {
  const target = readTarget(args.flags);
  for (const key of resolveCourses(args)) {
    const { plan } = buildPlan(args, key, target);
    printPlan(plan, target);
  }
}

export async function cmdApply(args: Args): Promise<void> {
  const target = readTarget(args.flags);
  for (const key of resolveCourses(args)) {
    const { plan, snapshot } = buildPlan(args, key, target);
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

    // Utgåva av läget som skrivs över, så att det alltid går att gå tillbaka (produktionen alltid,
    // lokalt med --utgava). Den fångar även sådant som ändrats i admin sedan förra synken.
    if (target.kind !== "local" || args.flags.utgava === true) {
      const u = utgavaFromDatabase(key, target, snapshot, `Före apply (${gitHead() ?? "okänd commit"})`);
      if (u) say(dim(`Sparade utgåvan ${u.id} (läget före ändringen): ${saveUtgava(ROOT, u).replace(ROOT, ".")}`));
    }

    const sql = `select public.sync_deck('${plan.deckId}'::uuid, ${sqlLiteral(JSON.stringify(plan.sync))}::jsonb) as data;`;
    const rows = query<{ data: Record<string, number> }>(target, sql);
    const result = rows[0]?.data ?? {};
    say(`${C.green}Klart.${C.reset} ${Object.entries(result).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
    await revalidate(args, target);
    say();
  }
}

export function cmdPull(args: Args): void {
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

// ---------------------------------------------------------------------------
// Utgåvan av databasens läge (apply sparar en före varje skrivning, se kommandon/utgavor.ts)
// ---------------------------------------------------------------------------

function kallaFor(target: Target): Utgava["kalla"] {
  return target.kind === "local" ? "lokal" : "prod";
}

/** Kursen så som databasen ser ut just nu, som en utgåva (filnamn och nycklar från filerna). */
export function utgavaFromDatabase(key: string, target: Target, snapshot: DeckSnapshot, notering: string | null): Utgava | null {
  if (!snapshot.deck) return null;
  const current = existsSync(join(courseDir(ROOT, key), "kurs.json")) ? loadCourse(ROOT, key).course : null;
  const course = courseFromSnapshot(snapshot, current, deriveKey);
  const now = new Date();
  return { id: utgavaId(now, kallaFor(target)), kurs: key, skapad: now.toISOString(), kalla: kallaFor(target), commit: gitHead(), notering, antal: countCourse(course), course };
}
