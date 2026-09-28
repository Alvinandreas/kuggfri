import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canEditDeck, getAdminContext } from "@/lib/admin/access";
import { CONTENT_TAG } from "@/lib/content/queries";
import { sv } from "@/lib/i18n/sv";

/**
 * Gemensamma delar för serveråtgärderna i lib/admin/actions.ts och review-actions.ts.
 * Ligger i en egen fil eftersom en "use server"-modul bara får exportera async-funktioner,
 * och eftersom de här inte ska kunna anropas från klienten.
 */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function tooLong(field: string, value: string, max: number): ActionResult<never> | null {
  return value.length > max ? { ok: false, error: sv.admin.tooLong(field, max) } : null;
}

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

export function fail(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "forbidden") return { ok: false, error: sv.common.forbiddenBody };
  return { ok: false, error: sv.errors.generic };
}

export function revalidateDeck(deckId: string, slug?: string) {
  revalidateTag(CONTENT_TAG);
  revalidatePath("/admin");
  revalidatePath("/admin/deck");
  revalidatePath(`/admin/deck/${deckId}`, "layout");
  revalidatePath("/");
  if (slug) {
    revalidatePath(`/d/${slug}`);
    revalidatePath(`/d/${slug}/plugga`);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rensar en lista id:n från klienten: bara uuid:er, inga dubbletter, högst max stycken. */
export function cleanIds(ids: unknown, max: number): string[] | null {
  if (!Array.isArray(ids)) return null;
  const valid = ids.filter((id): id is string => typeof id === "string" && UUID_RE.test(id));
  if (valid.length !== ids.length) return null;
  const out = [...new Set(valid)];
  return out.length > max ? null : out;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
