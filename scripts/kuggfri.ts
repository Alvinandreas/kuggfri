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
 *   npm run kuggfri -- canvas <inventera|hamta|text> <kurs>   (se scripts/canvas.ts)
 *   npm run kuggfri -- omraden|nytt-omrade|byt-namn-omrade|flytta|byt-typ|mappa|ordna-omraden ...   (se scripts/omraden.ts)
 *   npm run kuggfri -- utgava <kurs> [--mal prod] [--commit <sha>] [--notering "..."]   spara ett läge
 *   npm run kuggfri -- utgavor <kurs>                                              lista sparade lägen
 *   npm run kuggfri -- aterga <kurs> <utgåva> [--kort k1,k2] [--mal prod] [--ja]   gå tillbaka (se scripts/utgavor.ts)
 *   npm run kuggfri -- tentor kontrollera|plan|apply <kurs> [--mal prod] [--ja]      tentabanken (docs/TENTOR.md)
 *
 * Mål: `--mal lokal` (standard) eller `--mal prod` (det länkade Supabase-projektet).
 * Inga nycklar i repot: produktionen nås via Supabase CLI:ns egen inloggning.
 */
import { readFileSync } from "node:fs";
import { runCanvas } from "./canvas";
import { OMRADE_COMMANDS, runOmraden } from "./omraden";
import { parseArgs } from "./cli/args";
import { fail, say } from "./cli/output";
import { cmdApply, cmdKontrollera, cmdPlan, cmdPull } from "./kommandon/innehall";
import { cmdKonvertera, cmdNyKategori, cmdNyKurs, cmdTaBortKurs } from "./kommandon/kurs";
import { cmdSeed } from "./kommandon/seed";
import { cmdTentor } from "./kommandon/tentor";
import { cmdAterga, cmdUtgava, cmdUtgavor } from "./kommandon/utgavor";

// Hjälptexten är filens egen inledande kommentar, läst fram till dess avslutande rad.
function usage(): void {
  const rader = readFileSync(new URL(import.meta.url), "utf8").split("\n");
  const slut = rader.findIndex((rad) => rad.trim() === "*/");
  say(
    rader
      .slice(1, slut === -1 ? 16 : slut)
      .map((rad) => rad.replace(/^ \* ?/, ""))
      .join("\n"),
  );
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
    case "canvas":
      return runCanvas(args.positional);
    case "utgava":
      return cmdUtgava(args);
    case "tentor":
      return cmdTentor(args);
    case "utgavor":
      return cmdUtgavor(args);
    case "aterga":
    case "återgå":
      return cmdAterga(args);
    case "hjalp":
    case "hjälp":
    case "--help":
    case "-h":
      return usage();
    default:
      if (command && OMRADE_COMMANDS.includes(command)) return runOmraden(command, args);
      usage();
      if (command) fail(`Okänt kommando: ${command}`);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
