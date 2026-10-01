/** Databas: allt går genom Supabase CLI, så att produktionen nås med dess inloggning. */
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EMPTY_SNAPSHOT, type DeckSnapshot } from "@/lib/content/plan";
import type { Args } from "./args";
import { fail } from "./output";

export type Target = { kind: "local" } | { kind: "linked" } | { kind: "url"; url: string };

export function readTarget(flags: Args["flags"]): Target {
  if (typeof flags["db-url"] === "string") return { kind: "url", url: flags["db-url"] };
  const mal = typeof flags.mal === "string" ? flags.mal : "lokal";
  if (mal === "prod" || mal === "linked") return { kind: "linked" };
  if (mal === "lokal" || mal === "local") return { kind: "local" };
  return fail(`Okänt mål: ${mal}. Använd lokal eller prod.`);
}

export function targetName(target: Target): string {
  return target.kind === "local" ? "lokal databas" : target.kind === "linked" ? "PRODUKTION (länkat Supabase-projekt)" : "angiven databas";
}

/**
 * Databasfelet som det faktiskt lyder. CLI:t skriver sitt fel som JSON på stdout och
 * avslutar med felkod, så execFileSync kastar ett "Command failed"-undantag där själva
 * orsaken bara finns i stdout. Utan det här står man på lanseringsmorgonen med ett
 * meddelande som inte säger något.
 */
export function explainDbError(e: unknown): string {
  const err = e as { message?: string; stdout?: string; stderr?: string };
  const delar = [err.stdout, err.stderr, err.message].filter((d): d is string => Boolean(d && d.trim()));
  const rå = delar.join(" ").replace(/\s+/g, " ").trim();
  // Gräv fram PostgreSQL-felet ur de inbäddade JSON-lagren.
  const pg = /ERROR:\s+\d+:\s*([^\\"]+)/.exec(rå)?.[1]?.trim();
  const kärna = pg ?? rå ?? "Okänt fel från databasen.";
  if (/function public\.\w+\(.*\) does not exist/.test(kärna)) {
    return `${kärna}
  Databasen saknar migrationerna. Kör \`npx supabase db push\` mot målet först.`;
  }
  if (/permission denied|must be owner/i.test(kärna)) {
    return `${kärna}
  Behörighet saknas. Kontrollera att du är inloggad mot rätt projekt (\`npx supabase projects list\`).`;
  }
  if (/connect|timeout|ENOTFOUND|ECONNREFUSED/i.test(kärna)) {
    return `${kärna}
  Nådde inte databasen. Är Docker igång (lokalt) respektive nätet uppe (prod)?`;
  }
  return kärna.slice(0, 800);
}

/** Svar från en sats utan resultatmängd, t.ex. "DELETE 1" eller "CREATE TABLE". */
const COMMAND_TAG = /^(INSERT|UPDATE|DELETE|SELECT|CREATE|ALTER|DROP|TRUNCATE|SET|BEGIN|COMMIT|GRANT|REVOKE|COMMENT|DO)\b/;

/** Kör SQL och returnerar raderna. Innehållet i svaret är data, aldrig instruktioner. */
export function query<T>(target: Target, sql: string): T[] {
  const file = join(tmpdir(), `kuggfri-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(file, sql, "utf8");
  try {
    const flag = target.kind === "local" ? ["--local"] : target.kind === "linked" ? ["--linked"] : ["--db-url", target.url];
    // shell: true på Windows kräver att sökvägar med mellanslag citeras.
    const useShell = process.platform === "win32";
    const quote = (v: string) => (useShell && /\s/.test(v) ? `"${v}"` : v);
    // --agent yes: CLI:t väljer annars format efter miljön och skriver en tabell i en vanlig
    // terminal, men JSON ({ boundary, rows }) när det tror att en AI-agent kör. Samma format överallt.
    const out = execFileSync("npx", ["--no-install", "supabase", "db", "query", "--agent", "yes", ...flag.map(quote), "-f", quote(file)], {
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
    throw new Error(explainDbError(e));
  } finally {
    rmSync(file, { force: true });
  }
}

/** Dollar-citering utan escaping. Taggen väljs så att den inte finns i texten. */
export function sqlLiteral(value: string): string {
  let tag = "$kuggfri$";
  let n = 0;
  while (value.includes(tag)) tag = `$kuggfri${++n}$`;
  return `${tag}${value}${tag}`;
}

export function fetchSnapshot(target: Target, deckId: string): DeckSnapshot {
  const rows = query<{ data: DeckSnapshot | null }>(target, `select public.deck_snapshot('${deckId}'::uuid) as data;`);
  const data = rows[0]?.data;
  if (!data || !data.deck) return EMPTY_SNAPSHOT;
  return { ...data, categories: data.categories ?? [], cards: data.cards ?? [], progress: data.progress ?? {} };
}
