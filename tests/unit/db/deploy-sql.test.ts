/**
 * supabase/deploy/full.sql (alla migrationer + seed i en fil, för SQL-editorn i ett nytt
 * molnprojekt) måste gå att köra i ett svep på en ren databas och ge samma resultat som
 * migrationsfilerna. Testet hindrar att filen glider ifrån källorna.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, type RawDb } from "./harness";

let db: RawDb;

beforeAll(async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  const wrap = (t: { exec: (s: string) => Promise<unknown>; query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }) => ({
    exec: async (sql: string) => {
      await t.exec(sql);
    },
    query: async <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => (await t.query(sql, params)).rows as T[],
  });
  const base = wrap(pg);
  db = { ...base, transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))), close: () => pg.close() };
  await db.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
  await db.exec(readFileSync(join(__dirname, "..", "..", "..", "supabase", "deploy", "full.sql"), "utf8"));
});

afterAll(async () => {
  await db?.close();
});

describe("supabase/deploy/full.sql", () => {
  it("skapar schemat och laddar decket i ett svep", async () => {
    const tables = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    expect(tables.map((t) => t.table_name)).toEqual(["card_progress", "card_reports", "cards", "categories", "deck_examiner_invites", "deck_examiners", "decks", "email_log", "profiles", "review_log", "study_sessions"]);
    const cards = await anon(db).query(`select id from public.cards`);
    expect(cards).toHaveLength(144);
  });

  it("innehåller samma migrationer som supabase/migrations", async () => {
    const full = readFileSync(join(__dirname, "..", "..", "..", "supabase", "deploy", "full.sql"), "utf8");
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(join(__dirname, "..", "..", "..", "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) expect(full).toContain(`supabase/migrations/${f}`);
  });
});
