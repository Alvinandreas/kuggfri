import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Mittpunkten "·" används inte någonstans i Kuggfri (Alvins beslut 30 sep 2026, gäller hela
 * webbplatsen och all framtid). Skilj uppgifter åt med layout (mellanrum, egna element),
 * radbrytning eller komma, inte med tankstreck. Testet söker igenom koden och kursinnehållet.
 */
const ROOT = process.cwd();
const DIRS = ["app", "components", "lib", "content"];
const TEXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".md", ".mdx", ".json", ".txt", ".html", ".svg"]);

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else if (TEXT.has(extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

describe("mittpunkten", () => {
  it("förekommer inte i app/, components/, lib/ eller content/", () => {
    const hits: string[] = [];
    for (const dir of DIRS) {
      for (const file of files(join(ROOT, dir))) {
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (line.includes("·")) hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
          });
      }
    }
    expect(hits, "ersätt mittpunkten med layout, radbrytning eller komma").toEqual([]);
  });
});
