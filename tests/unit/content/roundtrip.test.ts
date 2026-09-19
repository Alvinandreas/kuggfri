import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCardFile, serializeCardFile } from "@/lib/content/markdown";
import { flattenCards } from "@/lib/content/model";
import { courseDir, listCourseKeys, loadCourse } from "@/lib/content/store";

const ROOT = process.cwd();

describe("riktigt innehåll i content/", () => {
  const keys = listCourseKeys(ROOT);

  it("det finns minst en kurs", () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  for (const key of keys) {
    describe(key, () => {
      const { course, issues } = loadCourse(ROOT, key);

      it("läses utan anmärkningar", () => {
        expect(issues).toEqual([]);
      });

      it("varje kort har nyckel, framsida och baksida, och nycklarna är unika", () => {
        const cards = flattenCards(course);
        expect(cards.length).toBeGreaterThan(0);
        const seen = new Set<string>();
        for (const { card } of cards) {
          expect(card.key, card.front).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
          expect(card.front.trim(), card.key).not.toBe("");
          expect(card.back.trim(), card.key).not.toBe("");
          expect(seen.has(card.key), `dubbel nyckel: ${card.key}`).toBe(false);
          seen.add(card.key);
        }
      });

      // Skyddar mot kortinnehåll som skulle bryta filformatet (t.ex. "## " i en baksida):
      // filen på disk måste vara identisk med det parsern och skrivaren ger tillbaka.
      it("varje kortfil är oförändrad efter en rundtur genom parsern", () => {
        for (const category of course.categories) {
          const path = join(courseDir(ROOT, key), category.file);
          const text = readFileSync(path, "utf8");
          const { file, issues: fileIssues } = parseCardFile(text);
          expect(fileIssues, category.file).toEqual([]);
          expect(serializeCardFile(file), category.file).toBe(text);
        }
      });
    });
  }
});
