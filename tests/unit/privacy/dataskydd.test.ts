import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vakthundar för dataskyddet. De fäller när koden och löftena glider isär, så att
 * integritetspolicyn, dataexporten och raderingen hålls fullständiga när appen växer.
 * Rutinen står i docs/PERSONUPPGIFTER.md.
 */

const ROOT = join(__dirname, "..", "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

const migrations = readdirSync(join(ROOT, "supabase", "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => read("supabase", "migrations", f))
  .join("\n");

const exportRoute = read("app", "api", "konto", "export", "route.ts");
const privacyPage = read("app", "integritet", "page.tsx");

/** Tabeller som knyter rader till ett konto: allt sådant är personuppgifter. */
function tablesWithUserId(sql: string): string[] {
  const found = new Set<string>();
  const createRe = /create table public\.(\w+)\s*\(([\s\S]*?)\n\);/g;
  for (const m of sql.matchAll(createRe)) {
    const [, name, body] = m;
    if (name && body && /user_id\s+uuid[^,]*references auth\.users/.test(body)) found.add(name);
  }
  return [...found].sort();
}

describe("dataexporten är fullständig", () => {
  const tables = tablesWithUserId(migrations);

  it("hittar de tabeller som knyter data till ett konto", () => {
    // Om den här listan ändras: uppdatera exporten, policyn och docs/PERSONUPPGIFTER.md.
    expect(tables).toEqual(["card_progress", "card_reports", "deck_examiners", "email_log", "review_log", "study_sessions"]);
  });

  for (const table of tables) {
    it(`${table} ingår i "ladda ner mina data"`, () => {
      expect(exportRoute, `${table} saknas i app/api/konto/export/route.ts`).toContain(`"${table}"`);
    });
  }

  it("profilen ingår också", () => {
    expect(exportRoute).toContain('"profiles"');
  });

  it("varje sådan tabell försvinner eller kopplas bort vid kontoradering", () => {
    // delete_my_account() raderar raden i auth.users; allt annat måste följa med.
    // Undantaget är card_reports: texten handlar om kortet och behålls för kursen, men
    // raden kopplas bort (user_id blir null) och kontaktadressen rensas.
    for (const table of tables) {
      const block = new RegExp(`create table public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`).exec(migrations)?.[1] ?? "";
      if (table === "card_reports") {
        expect(block).toMatch(/references auth\.users\s*\(id\)\s*on delete set null/);
        expect(migrations, "delete_my_account() måste rensa kontaktfältet").toMatch(
          /update public\.card_reports set contact = null where user_id = auth\.uid\(\)/,
        );
      } else {
        expect(block, `${table} saknar on delete cascade mot auth.users`).toMatch(/references auth\.users\s*\(id\)\s*on delete cascade/);
      }
    }
  });
});

describe("integritetspolicyn beskriver det appen faktiskt gör", () => {
  /** Nycklar i localStorage som koden använder. */
  function storageKeys(): string[] {
    const keys = new Set<string>();
    const dirs = ["lib", "components", "app"];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const next = join(dir, entry.name);
        if (entry.isDirectory()) walk(next);
        else if (/\.tsx?$/.test(entry.name)) {
          for (const m of read(next).matchAll(/"(kuggfri:[a-z0-9:]+)"/g)) if (m[1]) keys.add(m[1]);
        }
      }
    };
    for (const d of dirs) walk(d);
    return [...keys].sort();
  }

  const keys = storageKeys();

  it("hittar nycklarna som används", () => {
    expect(keys.length).toBeGreaterThan(3);
  });

  for (const key of keys) {
    it(`${key} är beskriven i policyn`, () => {
      expect(privacyPage, `${key} saknas i app/integritet/page.tsx`).toContain(key);
    });
  }

  it("policyn nämner biträdena och rättigheterna", () => {
    for (const word of ["Supabase", "Vercel", "Hostinger", "Integritetsskyddsmyndigheten", "dataportabilitet"]) {
      expect(privacyPage).toContain(word);
    }
  });

  it("det interna registret finns och listar tabellerna", () => {
    const doc = read("docs", "PERSONUPPGIFTER.md");
    for (const table of tablesWithUserId(migrations)) {
      expect(doc, `${table} saknas i docs/PERSONUPPGIFTER.md`).toContain(table);
    }
  });
});

describe("säkerhetskopior kan aldrig committas", () => {
  it("backups/ är gitignorerad", () => {
    const ignore = read(".gitignore");
    expect(ignore).toMatch(/^\/?backups\/?$/m);
  });
});
