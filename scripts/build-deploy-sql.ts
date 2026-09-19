/**
 * Bygger supabase/deploy/full.sql: alla migrationer + seed i en fil, för ett NYTT
 * Supabase-projekt (SQL-editorn). Körs med `npm run deploy:sql`.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrations = join(root, "supabase", "migrations");
const out: string[] = ["-- GENERERAD: alla migrationer + seed i en fil, för ett NYTT Supabase-projekt (SQL-editorn)."];
for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
  out.push(`-- ===== supabase/migrations/${file} =====`);
  out.push(readFileSync(join(migrations, file), "utf8"));
  out.push("");
}
out.push("-- ===== supabase/seed.sql =====");
out.push(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
mkdirSync(join(root, "supabase", "deploy"), { recursive: true });
writeFileSync(join(root, "supabase", "deploy", "full.sql"), out.join("\n"), "utf8");
console.log(`Skrev supabase/deploy/full.sql (${out.length} block).`);
