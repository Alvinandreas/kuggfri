import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCardFile, serializeCardFile } from "@/lib/content/markdown";
import { deckHashOf, flattenCards } from "@/lib/content/model";
import { courseCanvas, courseDir, listCourseKeys, loadCourse, saveCourse } from "@/lib/content/store";

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

      // pull, apply-utgåvor och områdesverktygen skriver hela kursen med saveCourse. Fält som
      // bara finns i kurs.json (canvas) får inte försvinna på vägen.
      it("kurs.json och kortfilerna är oförändrade efter läsning och skrivning", () => {
        const tmp = mkdtempSync(join(tmpdir(), "kuggfri-rundtur-"));
        try {
          cpSync(courseDir(ROOT, key), courseDir(tmp, key), { recursive: true });
          saveCourse(tmp, loadCourse(tmp, key).course);
          for (const file of ["kurs.json", ...course.categories.map((c) => c.file)]) {
            expect(readFileSync(join(courseDir(tmp, key), file), "utf8"), file).toBe(readFileSync(join(courseDir(ROOT, key), file), "utf8"));
          }
        } finally {
          rmSync(tmp, { recursive: true, force: true });
        }
      });
    });
  }
});

describe("canvas i kurs.json", () => {
  const base = { key: "kurs", title: "Kurs", description: null, course_code: null, source_credit: null, exam_date: null, published: false, sort_order: 0 };
  const course = { ...base, categories: [{ key: "a", title: "A", file: "01-a.md", cards: [] }] };

  function withTmp(fn: (root: string) => void): void {
    const root = mkdtempSync(join(tmpdir(), "kuggfri-canvas-"));
    try {
      fn(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it("bevaras när kursen skrivs om med nya uppgifter (som vid pull)", () => {
    withTmp((root) => {
      saveCourse(root, course);
      const path = join(courseDir(root, "kurs"), "kurs.json");
      const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      writeFileSync(path, JSON.stringify({ ...manifest, canvas: { base: "https://canvas.example", courseId: 7 } }, null, 2));
      saveCourse(root, { ...course, title: "Nytt namn" });
      const after = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      expect(after.title).toBe("Nytt namn");
      expect(after.canvas).toEqual({ base: "https://canvas.example", courseId: 7 });
      expect(Object.keys(after)).toEqual(["key", "title", "description", "course_code", "source_credit", "exam_date", "published", "sort_order", "canvas", "categories"]);
      expect(courseCanvas(root, "kurs")).toEqual({ base: "https://canvas.example", courseId: 7 });
    });
  });

  it("läggs inte till på en kurs utan, och då får kursen inte hämtas", () => {
    withTmp((root) => {
      saveCourse(root, course);
      expect(JSON.parse(readFileSync(join(courseDir(root, "kurs"), "kurs.json"), "utf8"))).not.toHaveProperty("canvas");
      expect(courseCanvas(root, "kurs")).toBeNull();
      expect(courseCanvas(root, "finns-inte")).toBeNull();
    });
  });

  it("ett felaktigt canvas-fält stoppar hämtningen", () => {
    withTmp((root) => {
      saveCourse(root, course);
      const path = join(courseDir(root, "kurs"), "kurs.json");
      const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      writeFileSync(path, JSON.stringify({ ...manifest, canvas: { base: "https://canvas.example/api", courseId: "7" } }));
      expect(() => courseCanvas(root, "kurs")).toThrow(/Ogiltigt fält canvas/);
    });
  });

  it("ingår inte i kursen och påverkar därför inte kurshashen", () => {
    withTmp((root) => {
      saveCourse(root, course);
      const before = deckHashOf(loadCourse(root, "kurs").course);
      const path = join(courseDir(root, "kurs"), "kurs.json");
      const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      writeFileSync(path, JSON.stringify({ ...manifest, canvas: { base: "https://canvas.example", courseId: 7 } }, null, 2));
      const loaded = loadCourse(root, "kurs").course;
      expect(loaded).not.toHaveProperty("canvas");
      expect(deckHashOf(loaded)).toBe(before);
    });
  });
});
