/**
 * Vy-modeller: de fält ur databasraderna som studentvyerna får. Ren modul.
 *
 * Bara det vyn använder skickas till klienten, så att redaktörernas fält (källa, granskning,
 * flaggor) aldrig följer med. Kortens typ är not null i databasen. Originalmarkeringen hör
 * till redaktörerna (valet Bara originalkorten togs bort 1 okt 2026) och följer inte heller med.
 */
import { parseOptions } from "@/lib/cards/kinds";
import type { CardRow, CategoryRow, DeckRow } from "@/lib/supabase/database.types";
import type { StudyCard } from "@/components/study/types";
import type { HomeDeck } from "@/components/home/HomeDashboard";

export type CategoryOption = { id: string; title: string };

/** Ett kort på kursens översikt (DeckOverview): urval, statistik och passets inställningar. */
export type OverviewCard = Pick<CardRow, "id" | "category_id" | "sort_order" | "front" | "kind"> & { hasHint: boolean };

export function toCategoryOption(c: Pick<CategoryRow, "id" | "title">): CategoryOption {
  return { id: c.id, title: c.title };
}

export function toOverviewCard(c: Pick<CardRow, "id" | "category_id" | "sort_order" | "front" | "kind" | "hint">): OverviewCard {
  return {
    id: c.id,
    category_id: c.category_id,
    sort_order: c.sort_order,
    front: c.front,
    // Passets inställningar: Uppgiftstyper filtrerar på typen, ledtrådsvalet visas bara om kort har ledtråd.
    kind: c.kind,
    hasHint: !!c.hint,
  };
}

export function toStudyCard(c: Pick<CardRow, "id" | "category_id" | "front" | "back" | "hint" | "sort_order" | "kind" | "options">): StudyCard {
  return {
    id: c.id,
    category_id: c.category_id,
    front: c.front,
    back: c.back,
    hint: c.hint,
    sort_order: c.sort_order,
    kind: c.kind,
    options: parseOptions(c.options),
  };
}

/** Ett deck på hemsidan: planen och områdena räknas fram i webbläsaren ur kortens ordning. */
export function toHomeDeck(d: {
  deck: Pick<DeckRow, "id" | "slug" | "title" | "course_code" | "exam_date">;
  categories: Pick<CategoryRow, "id" | "title">[];
  cards: Pick<CardRow, "id" | "category_id" | "sort_order">[];
}): HomeDeck {
  return {
    id: d.deck.id,
    slug: d.deck.slug,
    title: d.deck.title,
    course_code: d.deck.course_code,
    exam_date: d.deck.exam_date,
    categories: d.categories.map(toCategoryOption),
    cards: d.cards.map((c) => ({ id: c.id, category_id: c.category_id, sort_order: c.sort_order })),
  };
}
