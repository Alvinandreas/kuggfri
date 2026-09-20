import type { ImportCard, ImportError } from "./parse-import";
import { matchKey } from "@/lib/text/first-line";

export type ExistingCard = {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  category_id: string | null;
  sort_order: number;
};

export type ExistingCategory = { id: string; title: string };

export type CardUpdate = {
  id: string;
  before: { front: string; back: string; hint: string | null; category: string | null; sort_order: number };
  after: { front: string; back: string; hint: string | null; category: string | null; sort_order: number };
  changedFields: Array<"back" | "hint" | "category" | "sort_order">;
};

export type ImportDiff = {
  create: ImportCard[];
  update: CardUpdate[];
  unchanged: ImportCard[];
  newCategories: string[];
  errors: ImportError[];
};

export { matchKey };

/**
 * Jämför importerade kort med befintliga. Kort matchas på framsidans text.
 * - Finns ingen match: nytt kort.
 * - Finns match och något skiljer i back/hint/kategori/sort_order: uppdatering.
 * - Annars oförändrat.
 * Dubbletter på framsidan i importen rapporteras som fel (första vinner).
 */
export function diffImport(
  imported: ImportCard[],
  existingCards: ExistingCard[],
  existingCategories: ExistingCategory[],
): ImportDiff {
  const errors: ImportError[] = [];
  const categoryTitleById = new Map(existingCategories.map((c) => [c.id, c.title] as const));
  const categoryByKey = new Map(existingCategories.map((c) => [matchKey(c.title), c.title] as const));
  const existingByFront = new Map<string, ExistingCard>();
  for (const c of existingCards) {
    const key = matchKey(c.front);
    if (!existingByFront.has(key)) existingByFront.set(key, c);
  }

  const seen = new Set<string>();
  const create: ImportCard[] = [];
  const update: CardUpdate[] = [];
  const unchanged: ImportCard[] = [];
  /** Nya kategorier, nyckel = normaliserad titel, värde = första stavningen. */
  const newCategories = new Map<string, string>();

  for (const card of imported) {
    const key = matchKey(card.front);
    if (seen.has(key)) {
      errors.push({ row: card.row, message: "Framsidan finns redan tidigare i importen. Raden hoppas över." });
      continue;
    }
    seen.add(key);

    let categoryTitle: string | null = null;
    if (card.category) {
      const catKey = matchKey(card.category);
      const existingTitle = categoryByKey.get(catKey) ?? newCategories.get(catKey);
      if (existingTitle) categoryTitle = existingTitle;
      else {
        categoryTitle = card.category.trim();
        newCategories.set(catKey, categoryTitle);
      }
    }

    const existing = existingByFront.get(key);
    if (!existing) {
      create.push({ ...card, category: categoryTitle });
      continue;
    }

    const beforeCategory = existing.category_id ? (categoryTitleById.get(existing.category_id) ?? null) : null;
    const afterCategory = card.category === null ? beforeCategory : categoryTitle;
    const afterHint = card.hint === null ? existing.hint : card.hint;
    const afterSort = card.sort_order === null ? existing.sort_order : card.sort_order;

    const changedFields: CardUpdate["changedFields"] = [];
    if (card.back !== existing.back) changedFields.push("back");
    if ((afterHint ?? null) !== (existing.hint ?? null)) changedFields.push("hint");
    if (matchKey(afterCategory ?? "") !== matchKey(beforeCategory ?? "")) changedFields.push("category");
    if (afterSort !== existing.sort_order) changedFields.push("sort_order");

    if (changedFields.length === 0) {
      unchanged.push(card);
      continue;
    }
    update.push({
      id: existing.id,
      before: {
        front: existing.front,
        back: existing.back,
        hint: existing.hint,
        category: beforeCategory,
        sort_order: existing.sort_order,
      },
      after: {
        front: existing.front,
        back: card.back,
        hint: afterHint,
        category: afterCategory,
        sort_order: afterSort,
      },
      changedFields,
    });
  }

  return { create, update, unchanged, newCategories: [...newCategories.values()], errors };
}
