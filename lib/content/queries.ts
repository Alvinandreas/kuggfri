import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CardRow, CategoryRow, DeckRow } from "@/lib/supabase/database.types";

export type DeckSummary = DeckRow & { cardCount: number };

export type DeckWithContent = {
  deck: DeckRow;
  categories: CategoryRow[];
  cards: CardRow[];
};

/** Publicerade deck med antal aktiva kort. RLS ser till att opublicerade aldrig läcker. */
export async function getPublishedDecks(): Promise<DeckSummary[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: decks, error }, { data: cards }] = await Promise.all([
    supabase.from("decks").select("*").eq("is_published", true).order("sort_order").order("title"),
    supabase.from("cards").select("deck_id").eq("is_active", true),
  ]);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const c of cards ?? []) counts.set(c.deck_id, (counts.get(c.deck_id) ?? 0) + 1);
  return (decks ?? []).map((d) => ({ ...d, cardCount: counts.get(d.id) ?? 0 }));
}

/** Ett deck via slug med kategorier och aktiva kort i sorteringsordning. Null om det inte finns eller inte är publicerat. */
export async function getDeckBySlug(slug: string): Promise<DeckWithContent | null> {
  const supabase = await createSupabaseServerClient();
  const { data: deck } = await supabase.from("decks").select("*").eq("slug", slug).maybeSingle();
  if (!deck) return null;
  const [{ data: categories }, { data: cards }] = await Promise.all([
    supabase.from("categories").select("*").eq("deck_id", deck.id).order("sort_order").order("title"),
    supabase
      .from("cards")
      .select("*")
      .eq("deck_id", deck.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
  ]);
  return { deck, categories: categories ?? [], cards: cards ?? [] };
}

/** Alla deck (även opublicerade) för /om-sidan. RLS filtrerar bort opublicerade för icke-admin. */
export async function getDecksForAbout(): Promise<Pick<DeckRow, "id" | "title" | "course_code" | "source_credit" | "slug">[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("decks")
    .select("id, title, course_code, source_credit, slug")
    .eq("is_published", true)
    .order("sort_order")
    .order("title");
  return data ?? [];
}
