import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { CardRow, CategoryRow, Database, DeckRow } from "@/lib/supabase/database.types";

/**
 * Publikt innehåll (publicerade deck, kategorier, aktiva kort) cachas på servern i fem minuter
 * och ogiltigförklaras direkt när admin ändrar något (taggen CONTENT_TAG i lib/admin/actions.ts).
 * Hämtningen görs med en klient utan session, så bara det anon får se hamnar i cachen:
 * ett opublicerat deck kan aldrig läcka via cachen till en gäst.
 */
export const CONTENT_TAG = "content";
const CONTENT_TTL_SECONDS = 300;

function publicClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type DeckSummary = DeckRow & { cardCount: number };

export type DeckWithContent = {
  deck: DeckRow;
  categories: CategoryRow[];
  cards: CardRow[];
};

/** Publicerade deck med antal aktiva kort. Cachat; RLS ser till att opublicerade aldrig läcker. */
export const getPublishedDecks = unstable_cache(
  async (): Promise<DeckSummary[]> => {
    const supabase = publicClient();
    const [{ data: decks, error }, { data: cards }] = await Promise.all([
      supabase.from("decks").select("*").eq("is_published", true).order("sort_order").order("title"),
      supabase.from("cards").select("deck_id").eq("is_active", true),
    ]);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const c of cards ?? []) counts.set(c.deck_id, (counts.get(c.deck_id) ?? 0) + 1);
    return (decks ?? []).map((d) => ({ ...d, cardCount: counts.get(d.id) ?? 0 }));
  },
  ["published-decks"],
  { tags: [CONTENT_TAG], revalidate: CONTENT_TTL_SECONDS },
);

type DeckClient = ReturnType<typeof publicClient> | Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function loadDeckBySlug(supabase: DeckClient, slug: string): Promise<DeckWithContent | null> {
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
  return { deck, categories: categories ?? [], cards: sortCardsByCategory(cards ?? [], categories ?? []) };
}

const getPublishedDeckBySlug = unstable_cache(async (slug: string) => loadDeckBySlug(publicClient(), slug), ["published-deck"], {
  tags: [CONTENT_TAG],
  revalidate: CONTENT_TTL_SECONDS,
});

/**
 * Ett deck via slug med kategorier och aktiva kort i sorteringsordning. Publicerade deck kommer ur
 * cachen; ett opublicerat deck hämtas med besökarens session (bara redaktörer får se det).
 * Null om det inte finns eller inte får visas.
 */
export async function getDeckBySlug(slug: string): Promise<DeckWithContent | null> {
  const published = await getPublishedDeckBySlug(slug);
  if (published) return published;
  const supabase = await createSupabaseServerClient();
  return loadDeckBySlug(supabase, slug);
}

/**
 * Deckets ordning = kategoriernas ordning, sedan kortens ordning inom kategorin.
 * Kort utan kategori sist. Så kan admin ordna om inom en kategori utan att röra de andra.
 */
export function sortCardsByCategory<C extends { category_id: string | null; sort_order: number; created_at: string }>(
  cards: C[],
  categories: { id: string }[],
): C[] {
  const rank = new Map(categories.map((c, i) => [c.id, i] as const));
  const pos = (c: C) => (c.category_id ? (rank.get(c.category_id) ?? categories.length) : categories.length + 1);
  return [...cards].sort((a, b) => pos(a) - pos(b) || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

/** Publicerade deck för /om-sidan. Cachat. */
export const getDecksForAbout = unstable_cache(
  async (): Promise<Pick<DeckRow, "id" | "title" | "course_code" | "source_credit" | "slug">[]> => {
    const { data } = await publicClient()
      .from("decks")
      .select("id, title, course_code, source_credit, slug")
      .eq("is_published", true)
      .order("sort_order")
      .order("title");
    return data ?? [];
  },
  ["decks-for-about"],
  { tags: [CONTENT_TAG], revalidate: CONTENT_TTL_SECONDS },
);
