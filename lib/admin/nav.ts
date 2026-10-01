import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminContext } from "./access";
import { pickActiveAdminCourse } from "./active-course";
import { countOpenReports, getEditableDecks } from "./queries";

/** Kursen som sidomenyns adminsektion gäller, med räknarna (att granska, öppna felrapporter). */
export type AdminNavDeck = { id: string; title: string; pendingDrafts: number; openReports: number };

export type AdminNav = {
  /** Global admin: ser alla kurser, "Alla kurser" och designsystemet. */
  isAdmin: boolean;
  /** Id för kurserna användaren får redigera. Tom lista = ingen adminsektion. */
  deckIds: string[];
  /**
   * Kursen adminposterna leder till: alltid Materialteknik när användaren får redigera den
   * (lib/admin/active-course.ts), oavsett sida och oavsett andra kurser i databasen.
   */
  activeDeck: AdminNavDeck | null;
};

/**
 * Underlaget för sidomenyns genvägar till adminflikarna. Memoiserad per request.
 * Räknarna hämtas bara för den låsta kursen: antal utkast via en huvudräkning och öppna
 * felrapporter via samma memoiserade anrop som översikten. Går något fel visas menyn utan räknare.
 */
export const getAdminNav = cache(async (): Promise<AdminNav | null> => {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  // Går uppslaget fel visas adminsektionen inte (som när användaren inte får redigera något).
  const decks = await getEditableDecks().catch(() => []);
  const active = pickActiveAdminCourse(decks, "forsta");
  if (!active) return { isAdmin: ctx.isAdmin, deckIds: [], activeDeck: null };
  const supabase = await createSupabaseServerClient();
  const [drafts, openReports] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("deck_id", active.id).eq("review_status", "utkast").is("flag_note", null),
    countOpenReports(active.id).catch(() => 0),
  ]);
  return {
    isAdmin: ctx.isAdmin,
    deckIds: decks.map((d) => d.id),
    activeDeck: { id: active.id, title: active.title, pendingDrafts: drafts.count ?? 0, openReports },
  };
});
