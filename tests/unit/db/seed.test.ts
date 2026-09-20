import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createTestDb, type RawDb } from "./harness";
import { listCourseKeys, loadCourse } from "@/lib/content/store";
import { flattenCards } from "@/lib/content/model";

/**
 * Seeden ska spegla content/ exakt. Siffrorna läses därför ur filerna i stället för att
 * hårdkodas: ett tillagt kort ska inte få testerna att falla, men ett kort som *saknas*
 * i seeden ska det.
 */
const ROOT = join(__dirname, "..", "..", "..");
const courses = listCourseKeys(ROOT).map((key) => loadCourse(ROOT, key).course);
const expectedCards = courses.reduce((n, c) => n + flattenCards(c).length, 0);
const expectedCategories = courses.reduce((n, c) => n + c.categories.length, 0);

let db: RawDb;

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

afterAll(async () => {
  await db?.close();
});

describe("seed", () => {
  it("laddar varje kurs i content/ med alla kategorier och kort", async () => {
    expect(courses.length).toBeGreaterThan(0);
    for (const course of courses) {
      const [deck] = await db.query<{ id: string; is_published: boolean }>(`select id, is_published from public.decks where slug = $1`, [course.key]);
      expect(deck, `decket ${course.key} saknas i seeden`).toBeTruthy();
      expect(deck?.is_published).toBe(course.published);
      const [cats] = await db.query<{ n: number }>(`select count(*)::int as n from public.categories where deck_id = $1`, [deck!.id]);
      expect(cats?.n).toBe(course.categories.length);
      const [cards] = await db.query<{ n: number }>(`select count(*)::int as n from public.cards where deck_id = $1`, [deck!.id]);
      expect(cards?.n).toBe(flattenCards(course).length);
    }
  });

  it("varje kort i filerna finns i seeden med samma nyckel och text", async () => {
    for (const course of courses) {
      const rows = await db.query<{ key: string; front: string }>(
        `select c.key, c.front from public.cards c join public.decks d on d.id = c.deck_id where d.slug = $1`,
        [course.key],
      );
      const inDb = new Map(rows.map((r) => [r.key, r.front] as const));
      for (const { card } of flattenCards(course)) {
        expect(inDb.get(card.key), `kortet ${card.key} saknas i seeden`).toBe(card.front);
      }
    }
  });

  it("gäster (anon) kan läsa hela det publicerade innehållet", async () => {
    const cards = await anon(db).query(`select id from public.cards`);
    expect(cards).toHaveLength(expectedCards);
    const cats = await anon(db).query(`select id from public.categories`);
    expect(cats).toHaveLength(expectedCategories);
  });

  it("varje kort har en kategori och icke-tom fram- och baksida", async () => {
    const [bad] = await db.query<{ n: number }>(
      `select count(*)::int as n from public.cards where category_id is null or length(trim(front)) = 0 or length(trim(back)) = 0`,
    );
    expect(bad?.n).toBe(0);
  });
});
