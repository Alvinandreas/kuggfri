import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * En "use server"-modul får bara exportera async-funktioner: allt annat blir ett
 * Build Error, men bara i `next build`. Varken tsc eller eslint säger något, så en
 * exporterad konstant kan ligga kvar i veckor och först stoppa en deploy.
 *
 * Det hände oss: MAX_IMPORT_CARDS i lib/admin/actions.ts gjorde produktionsbygget
 * omöjligt medan dev-servern och alla tester var gröna. Konstanter hör hemma i
 * lib/admin/limits.ts.
 */
const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".next-prod", ".git", "test-results", "playwright-report", "content", "supabase"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Exportrader som inte är `export async function` eller ren typexport. */
function badExports(source: string): string[] {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("export "))
    .filter((line) => {
      if (line.startsWith("export async function")) return false;
      // Typer och interface försvinner vid kompilering och räknas inte.
      if (/^export (type|interface) /.test(line)) return false;
      if (/^export \{[^}]*\} from /.test(line) || /^export type \{/.test(line)) return false;
      return true;
    });
}

describe('"use server"-moduler', () => {
  const serverModules = sourceFiles(ROOT).filter((file) => {
    const head = readFileSync(file, "utf8").slice(0, 200);
    return /^\s*(\/\*[\s\S]*?\*\/\s*)?["']use server["']/.test(head);
  });

  it("finns och hittas av testet", () => {
    expect(serverModules.length).toBeGreaterThan(0);
  });

  it("exporterar bara async-funktioner", () => {
    const problems = serverModules.flatMap((file) =>
      badExports(readFileSync(file, "utf8")).map((line) => `${relative(ROOT, file)}: ${line}`),
    );
    expect(problems).toEqual([]);
  });
});
