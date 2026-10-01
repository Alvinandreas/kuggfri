import "server-only";
import { canEditDeck, getAdminContext } from "@/lib/admin/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail, type ActionResult } from "./result";

/**
 * Åtkomstkontrollen och felhanteringen som alla serveråtgärder delar. Ett kastat fel (även
 * "forbidden" från kontrollen) blir ett ActionResult via fail; åtgärden kastar aldrig själv.
 */

/**
 * Hämtar en klient och verifierar server-side att användaren är global admin
 * (skapa/ta bort deck, hantera examinatorer). Kastar om inte. RLS nekar dessutom oavsett.
 */
export async function requireAdmin() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) throw new Error("forbidden");
  const supabase = await createSupabaseServerClient();
  return { supabase, ctx };
}

/** Admin eller examinator för just det här decket. */
export async function requireEditor(deckId: string) {
  const ctx = await getAdminContext();
  if (!ctx || !canEditDeck(ctx, deckId)) throw new Error("forbidden");
  const supabase = await createSupabaseServerClient();
  return { supabase, ctx };
}

export type Access = Awaited<ReturnType<typeof requireEditor>>;

/** Kör åtgärden; ett kastat fel blir fail(e). */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    return fail(e);
  }
}

/** Kräver admin eller examinator för decket och kör sedan åtgärden (allt inom runAction). */
export function editorAction<T>(deckId: string, fn: (access: Access) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return runAction(async () => fn(await requireEditor(deckId)));
}

/** Kräver global admin och kör sedan åtgärden (allt inom runAction). */
export function adminAction<T>(fn: (access: Access) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return runAction(async () => fn(await requireAdmin()));
}
