import "server-only";
import { MIN_STUDENTS } from "@/lib/admin/thresholds";
import { parseOverviewStats } from "@/lib/admin/parse-overview";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CardRow, CategoryRow, DeckOverviewStats, DeckReportRow, DeckRow } from "@/lib/supabase/database.types";
import { sortCardsByCategory } from "@/lib/content/queries";
import { canEditDeck, getAdminContext } from "./access";

export type AdminDeckSummary = DeckRow & { cardCount: number };

/**
 * Deck som den inloggade får redigera: admin ser alla (även opublicerade, RLS
 * släpper igenom), en examinator bara sina.
 */
export async function getAllDecksForAdmin(): Promise<AdminDeckSummary[]> {
  const ctx = await getAdminContext();
  if (!ctx) return [];
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("decks").select("*").order("sort_order").order("title");
  if (!ctx.isAdmin) query = query.in("id", ctx.examinerDeckIds);
  const [{ data: decks, error }, { data: cards }] = await Promise.all([query, supabase.from("cards").select("deck_id")]);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const c of cards ?? []) counts.set(c.deck_id, (counts.get(c.deck_id) ?? 0) + 1);
  return (decks ?? []).map((d) => ({ ...d, cardCount: counts.get(d.id) ?? 0 }));
}

export type AdminDeck = { deck: DeckRow; categories: CategoryRow[]; cards: CardRow[] };

/**
 * Decket med kategorier och kort, eller null om det inte finns eller inte får redigeras.
 * Memoiserad per request: layouten och sidan under den delar ett anrop.
 */
export const getDeckForAdmin = cache(async (id: string): Promise<AdminDeck | null> => {
  const ctx = await getAdminContext();
  if (!canEditDeck(ctx, id)) return null;
  const supabase = await createSupabaseServerClient();
  const [{ data: deck }, { data: categories }, { data: cards }] = await Promise.all([
    supabase.from("decks").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("*").eq("deck_id", id).order("sort_order").order("title"),
    supabase.from("cards").select("*").eq("deck_id", id).order("sort_order").order("created_at"),
  ]);
  if (!deck) return null;
  return { deck, categories: categories ?? [], cards: sortCardsByCategory(cards ?? [], categories ?? []) };
});

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
    supabase.rpc("deck_stats_cards", { p_deck_id: deckId, p_min_students: MIN_STUDENTS }),
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

export type AdminReport = DeckReportRow;

/** Alla felrapporter för kort i decket, nyast först (deck_reports). */
export async function getDeckReports(deckId: string): Promise<AdminReport[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("deck_reports", { p_deck_id: deckId });
  if (error) throw error;
  return data ?? [];
}

/** Antal öppna felrapporter i decket. Memoiserad per request (flikraden och översikten). */
export const countOpenReports = cache(async (deckId: string): Promise<number> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("deck_open_report_count", { p_deck_id: deckId });
  if (error) throw error;
  return Number(data ?? 0);
});

/** Kursöversikten: aggregerad, anonym statistik i ett anrop (deck_stats_overview). */
export async function getDeckOverviewStats(deckId: string): Promise<DeckOverviewStats> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("deck_stats_overview", { p_deck_id: deckId, p_weeks: 8, p_min_students: MIN_STUDENTS });
  if (error) throw error;
  return parseOverviewStats(data, MIN_STUDENTS);
}

/** pending = väntar på att personen registrerar sig (user_id är då null). */
export type DeckExaminer = { user_id: string | null; email: string; display_name: string | null; created_at: string; pending: boolean };

/** Examinatorer för decket (bara admin får anropa funktionen; andra får tom lista). */
export async function getDeckExaminers(deckId: string): Promise<DeckExaminer[]> {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_deck_examiners", { p_deck_id: deckId });
  if (error) throw error;
  return data ?? [];
}
