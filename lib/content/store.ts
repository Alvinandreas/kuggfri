/**
 * Läser och skriver kursmappar under content/. Node-modul (filsystem), används av CLI:t
 * och testerna, aldrig av appen.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCardFile, serializeCardFile, type ParseIssue } from "./markdown";
import { isValidKey, slugifyKey, uniqueKey, type ContentCourse } from "./model";

export const CONTENT_DIR = "content";

export type CourseManifest = {
  key: string;
  title: string;
  description?: string | null;
  course_code?: string | null;
  source_credit?: string | null;
  exam_date?: string | null;
  published?: boolean;
  sort_order?: number;
  categories: { key: string; file: string }[];
};

export type LoadIssue = { file: string; line: number; message: string };

export type LoadedCourse = { course: ContentCourse; issues: LoadIssue[] };

export function courseDir(root: string, key: string): string {
  return join(root, CONTENT_DIR, key);
}

export function listCourseKeys(root: string): string[] {
  const dir = join(root, CONTENT_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "kurs.json")))
    .map((e) => e.name)
    .sort();
}

/** Läser en kurs från filerna. Fel rapporteras, aldrig kastas (utom när kursen saknas). */
export function loadCourse(root: string, key: string): LoadedCourse {
  const dir = courseDir(root, key);
  const manifestPath = join(dir, "kurs.json");
  if (!existsSync(manifestPath)) throw new Error(`Hittar ingen kurs: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CourseManifest;
  const issues: LoadIssue[] = [];

  if (manifest.key !== key) {
    issues.push({ file: "kurs.json", line: 1, message: `key (”${manifest.key}”) stämmer inte med mappnamnet (”${key}”).` });
  }
  if (!isValidKey(manifest.key)) {
    issues.push({ file: "kurs.json", line: 1, message: `Ogiltig kursnyckel ”${manifest.key}”.` });
  }

  const takenCardKeys = new Set<string>();
  const takenCategoryKeys = new Set<string>();
  const categories = manifest.categories.map((entry) => {
    const path = join(dir, entry.file);
    if (!existsSync(path)) {
      issues.push({ file: entry.file, line: 1, message: "Filen saknas." });
      return { key: entry.key, title: entry.key, file: entry.file, cards: [] };
    }
    const parsed = parseCardFile(readFileSync(path, "utf8"));
    for (const issue of parsed.issues) issues.push({ file: entry.file, line: issue.line, message: issue.message });
    if (!isValidKey(entry.key)) issues.push({ file: "kurs.json", line: 1, message: `Ogiltig kategorinyckel ”${entry.key}”.` });
    if (takenCategoryKeys.has(entry.key)) issues.push({ file: "kurs.json", line: 1, message: `Kategorinyckeln ”${entry.key}” används flera gånger.` });
    takenCategoryKeys.add(entry.key);

    for (const card of parsed.file.cards) {
      if (!card.key) {
        issues.push({ file: entry.file, line: 1, message: `Kortet ”${card.front.slice(0, 50)}” saknar key.` });
        continue;
      }
      if (takenCardKeys.has(card.key)) {
        issues.push({ file: entry.file, line: 1, message: `Nyckeln ”${card.key}” används av flera kort i kursen.` });
      }
      takenCardKeys.add(card.key);
    }
    return { key: entry.key, title: parsed.file.title || entry.key, file: entry.file, cards: parsed.file.cards };
  });

  const course: ContentCourse = {
    key: manifest.key,
    title: manifest.title,
    description: manifest.description ?? null,
    course_code: manifest.course_code ?? null,
    source_credit: manifest.source_credit ?? null,
    exam_date: manifest.exam_date ?? null,
    published: manifest.published ?? false,
    sort_order: manifest.sort_order ?? 0,
    categories,
  };
  return { course, issues };
}

/** Skriver hela kursen: kurs.json och en fil per kategori. Filer som inte längre hör till kursen tas bort. */
export function saveCourse(root: string, course: ContentCourse): string[] {
  const dir = courseDir(root, course.key);
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];

  const manifest: CourseManifest = {
    key: course.key,
    title: course.title,
    description: course.description,
    course_code: course.course_code,
    source_credit: course.source_credit,
    exam_date: course.exam_date,
    published: course.published,
    sort_order: course.sort_order,
    categories: course.categories.map((c) => ({ key: c.key, file: c.file })),
  };
  writeFileSync(join(dir, "kurs.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  written.push("kurs.json");

  const keep = new Set(["kurs.json"]);
  for (const category of course.categories) {
    writeFileSync(join(dir, category.file), serializeCardFile({ title: category.title, cards: category.cards }), "utf8");
    keep.add(category.file);
    written.push(category.file);
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md") && !keep.has(entry.name)) {
      rmSync(join(dir, entry.name));
    }
  }
  return written;
}

/** Nyckelhärledning som pull och konvertering använder. */
export function deriveKey(text: string, taken: Set<string>): string {
  return uniqueKey(slugifyKey(text), taken);
}

export type { ParseIssue };
