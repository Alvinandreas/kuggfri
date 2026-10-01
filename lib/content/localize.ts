/**
 * Kursinnehållet på engelska för den som slagit på reglaget English: kursbeskrivningen, områdenas
 * namn och korten (fråga, svar, ledtråd och alternativ, med de svenska alternativens rätt och fel).
 * Kursnamnet översätts aldrig. Saknas en översättning visas svenskan. Kortens id och allt annat
 * är orört, så progressen är densamma på båda språken.
 */
import { englishFace } from "@/lib/cards/translation";
import type { Lang } from "@/lib/i18n/types";
import type { CardRow, CategoryRow, DeckRow } from "@/lib/supabase/database.types";

export function localizeDeckRow<D extends Pick<DeckRow, "description"> & { description_en?: string | null }>(deck: D, lang: Lang): D {
  return lang === "en" && deck.description_en ? { ...deck, description: deck.description_en } : deck;
}

export function localizeCategory<C extends Pick<CategoryRow, "title" | "title_en">>(category: C, lang: Lang): C {
  return lang === "en" && category.title_en ? { ...category, title: category.title_en } : category;
}

export function localizeCard<C extends Pick<CardRow, "front" | "back" | "hint" | "options" | "translation_en">>(card: C, lang: Lang): C {
  if (lang !== "en") return card;
  const face = englishFace(card);
  return face ? { ...card, front: face.front, back: face.back, hint: face.hint, options: face.options ? [...face.options] : null } : card;
}
