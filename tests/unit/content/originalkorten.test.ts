import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCardFile } from "@/lib/content/markdown";
import { loadCourse } from "@/lib/content/store";

/*
  Originalkorten (Alvins Brainscape-set, 144 kort) är frysta i arkiv/originalkorten/ precis som de
  såg ut före omarbetningen 28 sep. Testet ser till att arkivet aldrig ändras och att inget
  originalkort försvinner ur kursen (det får inaktiveras eller rättas, men nyckeln och
  original: ja ska finnas kvar). Se arkiv/originalkorten/README.md.
*/

const ROOT = join(__dirname, "..", "..", "..");
const ARKIV = join(ROOT, "arkiv", "originalkorten", "materialteknik");
const FRYST = "a345e9aa1ec2b5a228cc14c58613d9fda7acdfea79d034cdb13304619db3781c";

const arkivfiler = () => readdirSync(ARKIV).filter((f) => f !== "README.md").sort();

function arkiveradeKort() {
  return arkivfiler()
    .filter((f) => f.endsWith(".md"))
    .flatMap((f) => parseCardFile(readFileSync(join(ARKIV, f), "utf8")).file.cards);
}

describe("originalkorten", () => {
  it("arkivet är oförändrat", () => {
    const hash = createHash("sha256");
    for (const f of arkivfiler()) {
      hash.update(`${f}\n`);
      hash.update(readFileSync(join(ARKIV, f), "utf8").replace(/\r\n/g, "\n"));
    }
    expect(hash.digest("hex")).toBe(FRYST);
  });

  it("arkivet har alla 144 kort med nycklar", () => {
    const kort = arkiveradeKort();
    expect(kort).toHaveLength(144);
    expect(new Set(kort.map((k) => k.key)).size).toBe(144);
  });

  /**
   * Nio dubbletter som inaktiverades 28 sep (andra kort täcker samma sak) raderades ur kursen
   * 1 okt 2026 på Alvins beslut; de finns kvar i arkivet. Inga andra originalkort får försvinna.
   */
  const RADERADE_DUBBLETTER = [
    "keram",
    "vad-har-lastfall-for-inverkan-pa",
    "brottseghet",
    "beskriv-vad-ett-materials-specifika",
    "vad-ar-krypning-vad-finns-det-for-olika",
    "krypning-metaller",
    "vad-ar-ett-ttt-diagram-och-vad-anvands",
    "namn-minst-tva-produktionsmassiga",
    "co-foot-print",
  ];

  it("varje originalkort finns kvar i kursen och är märkt original (utom de raderade dubbletterna)", () => {
    const { course } = loadCourse(ROOT, "materialteknik");
    const idag = new Map(course.categories.flatMap((c) => c.cards).map((k) => [k.key, k] as const));
    const saknas = arkiveradeKort()
      .filter((k) => !idag.has(k.key) && !RADERADE_DUBBLETTER.includes(k.key!))
      .map((k) => k.key);
    const omärkta = arkiveradeKort().filter((k) => idag.has(k.key) && !idag.get(k.key)!.original).map((k) => k.key);
    expect(saknas).toEqual([]);
    expect(omärkta).toEqual([]);
  });
});
