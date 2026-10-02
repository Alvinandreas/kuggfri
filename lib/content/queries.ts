import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { CardRow, CategoryRow, DeckRow } from "@/lib/supabase/database.types";
import { getLang } from "@/lib/i18n/server";
import { getViewableDeckIds } from "@/lib/enrollment/access";
import { localizeCard, localizeCategory, localizeDeckRow } from "./localize";

/**
 * Publicerat innehåll (publicerade deck, kategorier, aktiva granskade kort) cachas på servern i fem
 * minuter och ogiltigförklaras direkt när admin ändrar något (taggen CONTENT_TAG töms i
 * lib/cache/revalidate.ts).
 *
 * Cachen hämtas med serverns nyckel (service role), eftersom korten bara får läsas av kursens
 * deltagare och cachen delas av alla. Filtren nedan är därför det som håller opublicerade kurser,
 * utkast och inaktiva kort borta, och sidorna kontrollerar åtkomsten per kurs innan något visas
 * (lib/enrollment/access.ts): getMyDecks för listorna, canViewDeck för kurssidorna.
 */
export const CONTENT_TAG = "content";
const CONTENT_TTL_SECONDS = 300;

function contentClient() {
  const client = createServiceRoleClient();
  if (!client) throw new Error("SUPABASE_SERVICE_ROLE_KEY saknas (krävs för kursinnehållet).");
  return client;
}

export type DeckSummary = DeckRow & { cardCount: number };

export type DeckWithContent = {
  deck: DeckRow;
  categories: CategoryRow[];
  cards: CardRow[];
};

/** Publicerade deck med antal aktiva kort. Cachat. */
const getPublishedDecksCached = unstable_cache(
  async (): Promise<DeckSummary[]> => {
    const supabase = contentClient();
    const [{ data: decks, error }, { data: counts }] = await Promise.all([
      supabase.from("decks").select("*").eq("is_published", true).order("sort_order").order("title"),
      supabase.rpc("deck_card_counts"),
    ]);
    if (error) throw error;
    const byDeck = new Map((counts ?? []).map((c) => [c.deck_id, Number(c.active_cards)] as const));
    return (decks ?? []).map((d) => ({ ...d, cardCount: byDeck.get(d.id) ?? 0 }));
  },
  ["published-decks"],
  { tags: [CONTENT_TAG], revalidate: CONTENT_TTL_SECONDS },
);

/**
 * De publicerade kurser den inloggade får läsa (står på deltagarlistan eller redigerar kursen),
 * med beskrivningen på engelska för den som slagit på English.
 */
export async function getMyDecks(): Promise<DeckSummary[]> {
  const [decks, mine, lang] = await Promise.all([getPublishedDecksCached(), getViewableDeckIds(), getLang()]);
  return decks.filter((d) => mine.has(d.id)).map((d) => localizeDeckRow(d, lang));
}

type DeckClient = ReturnType<typeof contentClient> | Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Kursen med kategorier och aktiva kort. `published`: bara en publicerad kurs och bara granskade
 * kort (cachen, som läses med service role); annars avgör besökarens session (RLS) vad som syns.
 */
async function loadDeckBySlug(supabase: DeckClient, slug: string, published: boolean): Promise<DeckWithContent | null> {
  let deckQuery = supabase.from("decks").select("*").eq("slug", slug);
  if (published) deckQuery = deckQuery.eq("is_published", true);
  const { data: deck } = await deckQuery.maybeSingle();
  if (!deck) return null;
  let cardQuery = supabase.from("cards").select("*").eq("deck_id", deck.id).eq("is_active", true);
  if (published) cardQuery = cardQuery.is("review_status", null);
  const [{ data: categories }, { data: cards }] = await Promise.all([
    supabase.from("categories").select("*").eq("deck_id", deck.id).order("sort_order").order("title"),
    cardQuery.order("sort_order").order("created_at"),
  ]);
  // Granskningens flaggor är redaktörernas anteckningar och hör inte hemma i studentvyerna.
  const studentCards = (cards ?? []).map((c) => ({ ...c, flag_note: null, flagged_at: null, flagged_by: null }));
  return { deck, categories: categories ?? [], cards: sortCardsByCategory(studentCards, categories ?? []) };
}

const getPublishedDeckBySlug = unstable_cache(async (slug: string) => loadDeckBySlug(contentClient(), slug, true), ["published-deck"], {
  tags: [CONTENT_TAG],
  revalidate: CONTENT_TTL_SECONDS,
});

/**
 * Ett deck via slug med kategorier och aktiva kort i sorteringsordning. Publicerade deck kommer ur
 * cachen; ett opublicerat deck hämtas med besökarens session (bara redaktörer får se det).
 * Null om det inte finns eller inte får visas. Åtkomsten till en publicerad kurs kontrollerar
 * sidan med canViewDeck innan korten visas.
 */
export async function getDeckBySlug(slug: string): Promise<DeckWithContent | null> {
  const [published, lang] = await Promise.all([getPublishedDeckBySlug(slug), getLang()]);
  if (published) return localize(published, lang);
  const supabase = await createSupabaseServerClient();
  const data = await loadDeckBySlug(supabase, slug, false);
  return data ? localize(data, lang) : null;
}

/** Innehållet på engelska för den som slagit på English (lib/content/localize.ts). */
function localize(data: DeckWithContent, lang: Awaited<ReturnType<typeof getLang>>): DeckWithContent {
  if (lang === "sv") return data;
  return {
    deck: localizeDeckRow(data.deck, lang),
    categories: data.categories.map((c) => localizeCategory(c, lang)),
    cards: data.cards.map((c) => localizeCard(c, lang)),
  };
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
    const { data } = await contentClient()
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
