import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type RawDb } from "./harness";

/**
 * Håller den handskrivna lib/supabase/database.types.ts i takt med migrationerna.
 *
 * Typfilen är ett löfte till TypeScript om hur tabellerna ser ut, men ingenting tvingar
 * den att stämma. Glider den isär kompilerar allt ändå, och felet märks först i drift.
 * Testet läser de riktiga kolumnerna ur en databas byggd av migrationsfilerna och jämför
 * dem med raderna i typfilen.
 */

const ROOT = join(__dirname, "..", "..", "..");
const typesFile = readFileSync(join(ROOT, "lib", "supabase", "database.types.ts"), "utf8");

/** Tabeller vars Row-typ ska spegla databasen exakt. */
const TABLES: { table: string; type: string }[] = [
  { table: "profiles", type: "ProfileRow" },
  { table: "decks", type: "DeckRow" },
  { table: "categories", type: "CategoryRow" },
  { table: "cards", type: "CardRow" },
  { table: "card_progress", type: "CardProgressRow" },
  { table: "study_sessions", type: "StudySessionRow" },
  { table: "review_log", type: "ReviewLogRow" },
  { table: "card_reports", type: "CardReportRow" },
  { table: "email_log", type: "EmailLogRow" },
];

/** Fältnamnen i en `export type X = { ... }`-deklaration. */
function typeFields(typeName: string): string[] {
  const start = typesFile.indexOf(`export type ${typeName} = {`);
  if (start === -1) throw new Error(`Hittar inte typen ${typeName} i database.types.ts`);
  const end = typesFile.indexOf("\n};", start);
  const body = typesFile.slice(start, end);
  const fields = new Set<string>();
  for (const m of body.matchAll(/^\s{2}(\w+)\??:/gm)) if (m[1]) fields.add(m[1]);
  return [...fields].sort();
}

let db: RawDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

describe("database.types.ts speglar migrationerna", () => {
  for (const { table, type } of TABLES) {
    it(`${table} <-> ${type}`, async () => {
      const rows = await db.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by column_name`,
        [table],
      );
      const inDb = rows.map((r) => r.column_name).sort();
      expect(inDb.length, `tabellen ${table} finns inte`).toBeGreaterThan(0);
      expect(typeFields(type), `${type} i database.types.ts stämmer inte med tabellen ${table}`).toEqual(inDb);
    });
  }

  it("alla tabeller i public har en typ här", async () => {
    const rows = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
    );
    const known = new Set(TABLES.map((t) => t.table));
    // Kopplingstabeller utan egen Row-typ listas här med en motivering.
    const utan = new Set(["deck_examiners", "deck_examiner_invites"]);
    const missing = rows.map((r) => r.table_name).filter((t) => !known.has(t) && !utan.has(t));
    expect(missing, "nya tabeller ska få en Row-typ i database.types.ts och läggas till i TABLES ovan").toEqual([]);
  });
});
