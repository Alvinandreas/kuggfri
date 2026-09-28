import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminContext } from "./access";
import { countOpenReports } from "./queries";

/** En kurs i sidomenyns adminsektion, med räknarna som flikarna visar. */
export type AdminNavDeck = { id: string; title: string; pendingDrafts: number; openReports: number };

export type AdminNav = {
  /** Global admin: ser alla kurser, "Alla kurser" och designsystemet. */
  isAdmin: boolean;
  /** Kurser användaren får redigera, i samma ordning som adminstartsidan. Tom lista = ingen adminsektion. */
  decks: AdminNavDeck[];
};

/**
 * Underlaget för sidomenyns genvägar till adminflikarna. Memoiserad per request.
 * Räknarna är billiga: antal utkast via en huvudräkning och öppna felrapporter via
 * samma memoiserade anrop som flikraden. Går något fel visas menyn utan räknare.
 */
export const getAdminNav = cache(async (): Promise<AdminNav | null> => {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("decks").select("id, title").order("sort_order").order("title");
  if (!ctx.isAdmin) query = query.in("id", ctx.examinerDeckIds);
  const { data } = await query;
  const decks = await Promise.all(
    (data ?? []).map(async (d) => {
      const [drafts, openReports] = await Promise.all([
        supabase.from("cards").select("id", { count: "exact", head: true }).eq("deck_id", d.id).eq("review_status", "utkast"),
        countOpenReports(d.id).catch(() => 0),
      ]);
      return { id: d.id, title: d.title, pendingDrafts: drafts.count ?? 0, openReports };
    }),
  );
  return { isAdmin: ctx.isAdmin, decks };
});
