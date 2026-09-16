import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CardReportRow, CardRow, CategoryRow, DeckRow } from "@/lib/supabase/database.types";
import { sortCardsByCategory } from "@/lib/content/queries";

export type AdminDeckSummary = DeckRow & { cardCount: number };

/** Alla deck, även opublicerade (RLS släpper igenom för admin). */
export async function getAllDecksForAdmin(): Promise<AdminDeckSummary[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: decks, error }, { data: cards }] = await Promise.all([
    supabase.from("decks").select("*").order("sort_order").order("title"),
    supabase.from("cards").select("deck_id"),
  ]);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const c of cards ?? []) counts.set(c.deck_id, (counts.get(c.deck_id) ?? 0) + 1);
  return (decks ?? []).map((d) => ({ ...d, cardCount: counts.get(d.id) ?? 0 }));
}

export type AdminDeck = { deck: DeckRow; categories: CategoryRow[]; cards: CardRow[] };

export async function getDeckForAdmin(id: string): Promise<AdminDeck | null> {
  const supabase = await createSupabaseServerClient();
  const { data: deck } = await supabase.from("decks").select("*").eq("id", id).maybeSingle();
  if (!deck) return null;
  const [{ data: categories }, { data: cards }] = await Promise.all([
    supabase.from("categories").select("*").eq("deck_id", id).order("sort_order").order("title"),
    supabase.from("cards").select("*").eq("deck_id", id).order("sort_order").order("created_at"),
  ]);
  return { deck, categories: categories ?? [], cards: sortCardsByCategory(cards ?? [], categories ?? []) };
}

export async function getCardForAdmin(id: string): Promise<CardRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("cards").select("*").eq("id", id).maybeSingle();
  return data;
}

export type DeckStats = {
  uniqueUsers: number;
  totalReviews: number;
  avgRating: number | null;
  cards: { card_id: string; front: string; rating_count: number; avg_rating: number | null; total_reps: number }[];
};

export async function getDeckStats(deckId: string): Promise<DeckStats> {
  const supabase = await createSupabaseServerClient();
  const [{ data: summary, error: e1 }, { data: cards, error: e2 }] = await Promise.all([
    supabase.rpc("deck_stats_summary", { p_deck_id: deckId }),
    supabase.rpc("deck_stats_cards", { p_deck_id: deckId }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const s = summary?.[0];
  return {
    uniqueUsers: Number(s?.unique_users ?? 0),
    totalReviews: Number(s?.total_reviews ?? 0),
    avgRating: s?.avg_rating === null || s?.avg_rating === undefined ? null : Number(s.avg_rating),
    cards: (cards ?? []).map((c) => ({
      card_id: c.card_id,
      front: c.front,
      rating_count: Number(c.rating_count),
      avg_rating: c.avg_rating === null ? null : Number(c.avg_rating),
      total_reps: Number(c.total_reps),
    })),
  };
}

export type AdminReport = CardReportRow & { card: { id: string; front: string } | null };

/** Alla felrapporter för kort i decket, nyast först. */
export async function getDeckReports(deckId: string): Promise<AdminReport[]> {
  const supabase = await createSupabaseServerClient();
  const { data: cards } = await supabase.from("cards").select("id, front").eq("deck_id", deckId);
  const byId = new Map((cards ?? []).map((c) => [c.id, c] as const));
  if (byId.size === 0) return [];
  const { data, error } = await supabase
    .from("card_reports")
    .select("*")
    .in("card_id", [...byId.keys()])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, card: byId.get(r.card_id) ?? null }));
}

/** Antal öppna felrapporter i decket (för länken på deckets adminsida). */
export async function countOpenReports(deckId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data: cards } = await supabase.from("cards").select("id").eq("deck_id", deckId);
  const ids = (cards ?? []).map((c) => c.id);
  if (ids.length === 0) return 0;
  const { count } = await supabase.from("card_reports").select("id", { count: "exact", head: true }).in("card_id", ids).eq("status", "open");
  return count ?? 0;
}
