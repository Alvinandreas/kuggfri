import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createTestDb, type RawDb } from "./harness";

let db: RawDb;

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

afterAll(async () => {
  await db?.close();
});

describe("seed", () => {
  it("laddar Materialteknik-decket med alla kategorier och kort", async () => {
    const [deck] = await db.query<{ id: string; is_published: boolean }>(`select id, is_published from public.decks where slug = 'materialteknik'`);
    expect(deck?.is_published).toBe(true);
    const [cats] = await db.query<{ n: number }>(`select count(*)::int as n from public.categories where deck_id = $1`, [deck!.id]);
    expect(cats?.n).toBe(11);
    const [cards] = await db.query<{ n: number }>(`select count(*)::int as n from public.cards where deck_id = $1`, [deck!.id]);
    expect(cards?.n).toBe(151);
  });

  it("gäster (anon) kan läsa hela det publicerade decket", async () => {
    const cards = await anon(db).query(`select id from public.cards`);
    expect(cards).toHaveLength(151);
    const cats = await anon(db).query(`select id from public.categories`);
    expect(cats).toHaveLength(11);
  });

  it("varje kort har en kategori och icke-tom fram- och baksida", async () => {
    const [bad] = await db.query<{ n: number }>(
      `select count(*)::int as n from public.cards where category_id is null or length(trim(front)) = 0 or length(trim(back)) = 0`,
    );
    expect(bad?.n).toBe(0);
  });
});
