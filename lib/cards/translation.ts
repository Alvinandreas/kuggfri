/**
 * Engelska översättningar av korten, för granskningen i admin (Alvins beslut 1 okt 2026:
 * polymerexaminatorn läser inte svenska). Översättningen är ett hjälpmedel; det som godkänns och
 * det studenterna ser är alltid den svenska texten.
 *
 * Översättningarna ligger i content/<kurs>/engelska.json och synkas till cards.translation_en med
 * `npm run kuggfri -- engelska`. Fingeravtrycket (sv) är den svenska texten som översattes, så att
 * granskningen kan säga till när kortet ändrats efteråt. Samma funktion körs i CLI:t och på
 * servern; den är ren JavaScript utan beroenden.
 */
import type { CardOption } from "@/lib/cards/kinds";
import type { CardTranslation } from "@/lib/supabase/database.types";

type SwedishText = { front: string; back: string; hint: string | null; options: readonly CardOption[] | null };

/** cyrb53: snabb, stabil 53-bitars hash. Räcker gott för att se om en text ändrats. */
function cyrb53(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Fingeravtrycket av ett korts svenska text: fråga, svar, ledtråd och alternativ med rätt/fel. */
export function swedishFingerprint(card: SwedishText): string {
  const options = (card.options ?? []).map((o) => `${o.correct ? "+" : "-"}${o.text.trim()}`).join("\n");
  return cyrb53([card.front.trim(), card.back.trim(), (card.hint ?? "").trim(), options].join("\u0001"));
}

export type TranslationState = "missing" | "current" | "stale";

export function translationState(card: SwedishText & { translation_en?: CardTranslation | null }): TranslationState {
  if (!card.translation_en) return "missing";
  return card.translation_en.sv === swedishFingerprint(card) ? "current" : "stale";
}

/** Kortets innehåll på engelska, med de svenska alternativens rätt/fel. Null utan översättning. */
export function englishFace(card: SwedishText & { translation_en?: CardTranslation | null }): SwedishText | null {
  const t = card.translation_en;
  if (!t) return null;
  const svOptions = card.options ?? null;
  const options =
    svOptions && t.options && t.options.length === svOptions.length ? svOptions.map((o, i) => ({ text: t.options![i]!, correct: o.correct })) : svOptions;
  return { front: t.front, back: t.back, hint: t.hint ?? null, options };
}

/** En rad i content/<kurs>/engelska.json. */
export type TranslationEntry = { front: string; back: string; hint?: string | null; options?: string[] | null; sv: string };

/** Filens form: områdenas namn per områdesnyckel och korten per kortnyckel. */
export type TranslationFile = { areas: Record<string, string>; cards: Record<string, TranslationEntry> };

/** Ett kort ur filen som det lagras i databasen. */
export function toStored(entry: TranslationEntry): CardTranslation {
  return { front: entry.front, back: entry.back, hint: entry.hint ?? null, options: entry.options ?? null, sv: entry.sv };
}
