import "server-only";
import { cache } from "react";
import { createSupabaseServerClient, getCurrentProfile } from "@/lib/supabase/server";

export type AdminContext = {
  userId: string;
  /** Global admin: ser alla deck, kan skapa och ta bort deck, hanterar examinatorer. */
  isAdmin: boolean;
  /** Deck som användaren är examinator för (tomt för admin, som ändå får allt). */
  examinerDeckIds: string[];
};

/**
 * Vem är inloggad i adminvyn och vad får hen redigera? Memoiserad per request.
 * null = utloggad eller varken admin eller examinator.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const session = await getCurrentProfile();
  if (!session) return null;
  const isAdmin = session.profile?.is_admin === true;
  if (isAdmin) return { userId: session.user.id, isAdmin: true, examinerDeckIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("deck_examiners").select("deck_id").eq("user_id", session.user.id);
  const examinerDeckIds = (data ?? []).map((r) => r.deck_id);
  if (examinerDeckIds.length === 0) return null;
  return { userId: session.user.id, isAdmin: false, examinerDeckIds };
});

export function canEditDeck(ctx: AdminContext | null, deckId: string): boolean {
  if (!ctx) return false;
  return ctx.isAdmin || ctx.examinerDeckIds.includes(deckId);
}
