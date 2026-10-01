import "server-only";
import { cache } from "react";
import { getT } from "@/lib/i18n/server";
import { createSupabaseServerClient, getCurrentProfile } from "@/lib/supabase/server";
import type { CardVersionRow } from "@/lib/supabase/database.types";
import { versionFromRow, type CardVersion } from "./history";
import { getDeckExaminers } from "./queries";

/*
  Läser kortens historik (card_versions). RLS släpper bara igenom redaktörer för decket
  (can_edit_deck), så en fråga från någon annan ger tomt. Alla frågor binds dessutom till
  decket med deck_id.
*/

/** Så många id:n per .in()-fråga, så att adressen till PostgREST håller sig kort. */
const ID_CHUNK = 100;
/** PostgREST ger högst så många rader per fråga (max_rows i supabase/config.toml). */
const PAGE = 1000;
/** Tak för en hel sida, om historiken någon gång skulle växa sig mycket stor. */
const MAX_ROWS = 20_000;

function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Namnen på dem som ersatt versioner. Profiler är bara läsbara för sin ägare, så: den inloggade
 * får sitt visningsnamn, admin ser examinatorernas namn, och övriga redaktörer visas som
 * "En redaktör". Ingen replaced_by betyder innehållsverktyget.
 */
const authorResolver = cache(async (deckId: string): Promise<(id: string | null) => string> => {
  const [session, sv] = await Promise.all([getCurrentProfile(), getT()]);
  const names = new Map<string, string>();
  const examiners = await getDeckExaminers(deckId).catch(() => []);
  for (const x of examiners) if (x.user_id) names.set(x.user_id, x.display_name || x.email);
  if (session) names.set(session.user.id, session.profile?.display_name || sv.admin.historyYou);
  return (id) => (id === null ? sv.admin.historyTool : (names.get(id) ?? sv.admin.historyEditor));
});

/** Alla versioner av ett kort, nyast först. */
export async function getCardHistory(deckId: string, cardId: string): Promise<CardVersion[]> {
  const supabase = await createSupabaseServerClient();
  const [author, { data, error }] = await Promise.all([
    authorResolver(deckId),
    supabase
      .from("card_versions")
      .select("*")
      .eq("deck_id", deckId)
      .eq("card_id", cardId)
      .order("replaced_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE),
  ]);
  if (error) throw error;
  return (data ?? []).map((row) => versionFromRow(row, author(row.replaced_by)));
}

export type HistoryMeta = {
  /** Antal versioner per kort (kort utan historik saknas). */
  counts: Record<string, number>;
  /** Senast publicerade version per kort, för kort som någon gång varit publicerade. */
  published: Record<string, CardVersion>;
};

/**
 * Historiken i sammandrag för granskningen: antal versioner per kort och den senast
 * publicerade versionen (för att visa rättelser mot det studenterna såg).
 */
export async function getHistoryMeta(deckId: string, cardIds: readonly string[]): Promise<HistoryMeta> {
  const counts: Record<string, number> = {};
  const published: Record<string, CardVersion> = {};
  if (cardIds.length === 0) return { counts, published };
  const supabase = await createSupabaseServerClient();
  const author = await authorResolver(deckId);

  // Först ett lätt svep (utan texterna) för antal och vilken version som senast var publicerad.
  type Light = Pick<CardVersionRow, "id" | "card_id" | "replaced_at" | "review_status" | "is_active">;
  const rows: Light[] = [];
  await Promise.all(
    chunks(cardIds, ID_CHUNK).map(async (ids) => {
      for (let from = 0; from < MAX_ROWS; from += PAGE) {
        const { data, error } = await supabase
          .from("card_versions")
          .select("id, card_id, replaced_at, review_status, is_active")
          .eq("deck_id", deckId)
          .in("card_id", ids)
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
    }),
  );

  // Nyast först: senast ersatt, och vid lika tid det högsta id:t.
  rows.sort((a, b) => b.replaced_at.localeCompare(a.replaced_at) || Number(b.id) - Number(a.id));
  const publishedIds = new Map<string, number>();
  for (const row of rows) {
    counts[row.card_id] = (counts[row.card_id] ?? 0) + 1;
    if (!publishedIds.has(row.card_id) && row.review_status === null && row.is_active) publishedIds.set(row.card_id, Number(row.id));
  }

  // Sedan hela innehållet för just de publicerade versionerna.
  await Promise.all(
    chunks([...publishedIds.values()], ID_CHUNK).map(async (ids) => {
      const { data, error } = await supabase.from("card_versions").select("*").eq("deck_id", deckId).in("id", ids);
      if (error) throw error;
      for (const row of data ?? []) published[row.card_id] = versionFromRow(row, author(row.replaced_by));
    }),
  );
  return { counts, published };
}
