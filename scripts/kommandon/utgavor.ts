/** Utgåvor (scripts/utgavor.ts): spara ett läge och gå tillbaka till det. */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deckId as deckIdFor } from "@/lib/content/model";
import { loadCourse, saveCourse } from "@/lib/content/store";
import { ROOT, type Args } from "../cli/args";
import { fetchSnapshot, readTarget, targetName } from "../cli/db";
import { gitLines } from "../cli/git";
import { C, confirm, dim, fail, say } from "../cli/output";
import { countCourse, diffCourses, findUtgava, listUtgavor, restoreCards, restoreCourse, saveUtgava, utgavaId, type Utgava } from "../utgavor";
import { cmdApply, utgavaFromDatabase } from "./innehall";

/** Kursen så som filerna såg ut i en commit. */
function utgavaFromCommit(key: string, commit: string, notering: string | null): Utgava {
  const tmp = join(tmpdir(), `kuggfri-utgava-${Date.now()}`);
  const dir = join(tmp, "content", key);
  mkdirSync(dir, { recursive: true });
  const files = gitLines(["ls-tree", "--name-only", commit, `content/${key}/`]).filter(Boolean);
  if (files.length === 0) fail(`Kursen ${key} finns inte i ${commit}.`);
  for (const f of files) {
    writeFileSync(join(tmp, f), execFileSync("git", ["show", `${commit}:${f}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }), "utf8");
  }
  try {
    const { course } = loadCourse(tmp, key);
    const now = new Date();
    const sha = execFileSync("git", ["rev-parse", "--short", commit], { encoding: "utf8" }).trim();
    return { id: utgavaId(now, "commit"), kurs: key, skapad: now.toISOString(), kalla: "commit", commit: sha, notering, antal: countCourse(course), course };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function describeUtgava(u: Utgava): string {
  const a = u.antal;
  return `${C.bold}${u.id}${C.reset}  ${a.aktiva} aktiva, ${a.utkast} utkast, ${a.inaktiva} inaktiva, ${a.original} original${u.commit ? dim(`  (${u.commit})`) : ""}${u.notering ? `\n    ${u.notering}` : ""}`;
}

export function cmdUtgava(args: Args): void {
  const key = args.positional[1];
  if (!key) fail('kuggfri utgava <kurs> [--mal prod] [--commit <sha>] [--notering "..."]');
  const notering = typeof args.flags.notering === "string" ? args.flags.notering : null;
  let u: Utgava | null;
  if (typeof args.flags.commit === "string") {
    u = utgavaFromCommit(key, args.flags.commit, notering);
  } else {
    const target = readTarget(args.flags);
    u = utgavaFromDatabase(key, target, fetchSnapshot(target, deckIdFor(key)), notering);
    if (!u) fail(`Kursen ${key} finns inte i ${targetName(target)}.`);
  }
  const path = saveUtgava(ROOT, u);
  say(`${C.green}Sparade utgåvan${C.reset} ${describeUtgava(u)}`);
  say(dim(`${path.replace(ROOT, ".")}  (committa mappen utgavor/ så att den finns på GitHub)`));
}

export function cmdUtgavor(args: Args): void {
  const key = args.positional[1];
  if (!key) fail("kuggfri utgavor <kurs>");
  const all = listUtgavor(ROOT, key);
  if (all.length === 0) {
    say("Inga utgåvor än. Skapa en med kuggfri utgava <kurs>.");
    return;
  }
  for (const u of all) say(describeUtgava(u));
}

export async function cmdAterga(args: Args): Promise<void> {
  const key = args.positional[1];
  const id = args.positional[2];
  if (!key || !id) fail("kuggfri aterga <kurs> <utgåva> [--kort k1,k2] [--mal prod] [--ja]");
  const u = findUtgava(listUtgavor(ROOT, key), id);
  const { course: current, issues } = loadCourse(ROOT, key);
  if (issues.length > 0) fail("Filerna har problem. Kör kontrollera först.");
  const keys = typeof args.flags.kort === "string" ? args.flags.kort.split(",").map((k) => k.trim()).filter(Boolean) : null;
  const next = keys ? restoreCards(current, u.course, keys) : restoreCourse(current, u.course);
  const d = diffCourses(current, next);
  say(`${C.bold}Återgå till ${u.id}${C.reset}${keys ? ` (${keys.length} kort)` : " (hela kursen)"}`);
  say(`  ${d.andrade.length} kort får utgåvans innehåll eller område${d.baraI.length ? `, ${d.baraI.length} saknas i utgåvan och blir inaktiva` : ""}.`);
  const nextActive = next.categories.flatMap((c) => c.cards).filter((c) => c.active).length;
  say(`  Efteråt: ${nextActive} aktiva kort (i dag ${countCourse(current).aktiva}).`);
  if (d.andrade.length === 0 && d.baraI.length === 0) {
    say("Filerna stämmer redan med utgåvan. Kör apply om databasen inte gör det.");
    return;
  }
  if (args.flags.ja !== true && !(await confirm("Skriva utgåvans kort till filerna och synka?"))) {
    say("Avbrutet. Inget ändrat.");
    return;
  }
  saveCourse(ROOT, next);
  say(dim("Filerna är uppdaterade. Synkar (filerna vinner även över ändringar i admin)…"));
  // --tvinga: att gå tillbaka är ett uttryckligt beslut som ska gälla även kort som redigerats i admin.
  await cmdApply({ positional: ["apply", key], flags: { ...args.flags, tvinga: true } });
}
