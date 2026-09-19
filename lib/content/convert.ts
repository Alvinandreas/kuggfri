/**
 * Konvertering av inmatningsformat (Brainscape-CSV, CSV, JSON) till kortfiler.
 * Samma normalisering som seed-bygget använde, så att befintligt innehåll blir
 * teckenidentiskt och kan knytas ihop med raderna i databasen.
 */
import { parseImport } from "@/lib/import/parse-import";
import { applyTypography, duplicateKey, normalizeBrainscapeMarkdown } from "@/lib/import/normalize";
import type { ContentCard, ContentCategory } from "./model";
import { slugifyKey, uniqueKey } from "./model";

export type ConvertIssue = { row: number; message: string };

export type ConvertResult = {
  cards: ContentCard[];
  issues: ConvertIssue[];
  /** Kort som hoppades över för att ett tidigare kort har samma baksida. */
  duplicates: number;
};

export type ConvertOptions = {
  /** Nycklar som redan används i kursen. Uppdateras. */
  takenKeys: Set<string>;
  /** Baksidor som redan finns i kursen (duplicateKey). Uppdateras. */
  seenBacks?: Set<string>;
  /** Hoppa över kort vars baksida redan finns (seed-bygget gjorde det). */
  skipDuplicates?: boolean;
  format?: "auto" | "csv" | "json";
};

/** Text (CSV eller JSON) → kort, normaliserade och med härledda nycklar. */
export function convertCards(text: string, options: ConvertOptions): ConvertResult {
  const parsed = parseImport(text, options.format ?? "auto");
  const issues: ConvertIssue[] = parsed.errors.map((e) => ({ row: e.row, message: e.message }));
  const seenBacks = options.seenBacks ?? new Set<string>();
  const skipDuplicates = options.skipDuplicates ?? true;
  const cards: ContentCard[] = [];
  let duplicates = 0;

  for (const raw of parsed.cards) {
    const front = applyTypography(normalizeBrainscapeMarkdown(raw.front));
    const back = applyTypography(normalizeBrainscapeMarkdown(raw.back));
    const dupKey = duplicateKey(back);
    if (seenBacks.has(dupKey)) {
      duplicates++;
      if (skipDuplicates) {
        issues.push({ row: raw.row, message: `Hoppar över dubblett: ”${front.slice(0, 50)}”` });
        continue;
      }
    }
    seenBacks.add(dupKey);
    cards.push({
      key: uniqueKey(slugifyKey(front), options.takenKeys),
      front,
      back,
      hint: raw.hint ? applyTypography(raw.hint) : null,
      active: true,
    });
  }

  return { cards, issues, duplicates };
}

/** Bygger en hel kategori (kortfil) ur en källfil. */
export function convertCategory(
  text: string,
  input: { key: string; title: string; file: string },
  options: ConvertOptions,
): { category: ContentCategory; result: ConvertResult } {
  const result = convertCards(text, options);
  return { category: { key: input.key, title: input.title, file: input.file, cards: result.cards }, result };
}
