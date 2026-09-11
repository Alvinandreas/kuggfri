/**
 * Bygger supabase/seed.sql från seed/<deck>/deck.json + CSV-filer.
 *
 * Körs med `npm run seed:build`. Id:n är deterministiska (UUID v5 av slug och
 * kategori/framsida) så att seeden blir stabil mellan körningar och gästers
 * localStorage-progress överlever en `db reset`.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseImportCsv } from "../lib/import/parse-import";
import { normalizeBrainscapeMarkdown } from "../lib/import/normalize";

type Manifest = {
  slug: string;
  title: string;
  description?: string;
  course_code?: string;
  source_credit?: string;
  is_published?: boolean;
  sort_order?: number;
  categories: { file: string; title: string }[];
};

// Fast namnrymd för UUID v5. Byt aldrig; då byter alla seedade kort id.
const NAMESPACE = "6b9d1c1e-2f2a-4a3e-9d1e-8f3c2a1b7d4e";

function uuidV5(name: string): string {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  // Dollar-citering undviker all escaping. Taggen får inte förekomma i texten.
  const tag = "$seed$";
  if (value.includes(tag)) throw new Error("Texten innehåller seed-taggen.");
  return `${tag}${value}${tag}`;
}

function buildDeck(dir: string, manifest: Manifest, out: string[]): number {
  const deckId = uuidV5(`deck:${manifest.slug}`);
  out.push(`-- Deck: ${manifest.title}`);
  out.push(
    `insert into public.decks (id, slug, title, description, course_code, source_credit, is_published, sort_order) values (` +
      [
        `'${deckId}'`,
        sqlString(manifest.slug),
        sqlString(manifest.title),
        sqlString(manifest.description ?? null),
        sqlString(manifest.course_code ?? null),
        sqlString(manifest.source_credit ?? null),
        manifest.is_published === false ? "false" : "true",
        String(manifest.sort_order ?? 0),
      ].join(", ") +
      `);`,
  );

  let cardCount = 0;
  manifest.categories.forEach((cat, catIndex) => {
    const categoryId = uuidV5(`category:${manifest.slug}:${cat.title}`);
    out.push(
      `insert into public.categories (id, deck_id, title, sort_order) values ('${categoryId}', '${deckId}', ${sqlString(cat.title)}, ${catIndex});`,
    );
    const csvText = readFileSync(join(dir, cat.file), "utf8");
    const parsed = parseImportCsv(csvText);
    if (parsed.errors.length > 0) {
      for (const e of parsed.errors) console.warn(`  ${cat.file} rad ${e.row}: ${e.message}`);
    }
    const seenFronts = new Set<string>();
    parsed.cards.forEach((card, cardIndex) => {
      const front = normalizeBrainscapeMarkdown(card.front);
      const back = normalizeBrainscapeMarkdown(card.back);
      // Samma framsida kan förekomma i flera kategorier (repetitionskort); id:t tar hänsyn till kategori.
      let key = `card:${manifest.slug}:${cat.title}:${front}`;
      while (seenFronts.has(key)) key += ":dup";
      seenFronts.add(key);
      const cardId = uuidV5(key);
      out.push(
        `insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values (` +
          [
            `'${cardId}'`,
            `'${deckId}'`,
            `'${categoryId}'`,
            sqlString(front),
            sqlString(back),
            sqlString(card.hint),
            String(card.sort_order ?? cardIndex),
          ].join(", ") +
          `);`,
      );
      cardCount++;
    });
  });
  return cardCount;
}

export function buildSeedSql(seedRoot: string): { sql: string; decks: number; cards: number } {
  const out: string[] = [
    "-- GENERERAD FIL. Ändra inte här; ändra i seed/ och kör `npm run seed:build`.",
    "-- Innehållet kommer från riktiga Brainscape-exporter (se seed/*/deck.json för kreditering).",
    "",
    "begin;",
  ];
  let decks = 0;
  let cards = 0;
  for (const entry of readdirSync(seedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(seedRoot, entry.name, "deck.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    cards += buildDeck(join(seedRoot, entry.name), manifest, out);
    decks++;
    out.push("");
  }
  out.push("commit;", "");
  return { sql: out.join("\n"), decks, cards };
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/build-seed.ts");
if (isMain) {
  const root = process.cwd();
  const { sql, decks, cards } = buildSeedSql(join(root, "seed"));
  writeFileSync(join(root, "supabase", "seed.sql"), sql, "utf8");
  console.log(`Skrev supabase/seed.sql: ${decks} deck, ${cards} kort.`);
}
