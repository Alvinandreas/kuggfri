"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canEditDeck, getAdminContext } from "@/lib/admin/access";
import { LIMITS } from "@/lib/admin/limits";
import { CONTENT_TAG } from "@/lib/content/queries";
import { sv } from "@/lib/i18n/sv";
import { diffImport } from "@/lib/import/diff";
import type { ImportCard } from "@/lib/import/parse-import";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function tooLong(field: string, value: string, max: number): ActionResult<never> | null {
  return value.length > max ? { ok: false, error: sv.admin.tooLong(field, max) } : null;
}

/**
 * Hämtar en klient och verifierar server-side att användaren är global admin
 * (skapa/ta bort deck, hantera examinatorer). Kastar om inte. RLS nekar dessutom oavsett.
 */
async function requireAdmin() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) throw new Error("forbidden");
  const supabase = await createSupabaseServerClient();
  return { supabase, ctx };
}

/** Admin eller examinator för just det här decket. */
async function requireEditor(deckId: string) {
  const ctx = await getAdminContext();
  if (!ctx || !canEditDeck(ctx, deckId)) throw new Error("forbidden");
  const supabase = await createSupabaseServerClient();
  return { supabase, ctx };
}

function fail(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "forbidden") return { ok: false, error: sv.common.forbiddenBody };
  return { ok: false, error: sv.errors.generic };
}

function revalidateDeck(deckId: string, slug?: string) {
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

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

export type DeckInput = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  course_code: string;
  source_credit: string;
};

export async function saveDeckAction(input: DeckInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = input.id ? await requireEditor(input.id) : await requireAdmin();
    const slug = input.slug.trim().toLowerCase();
    const long =
      tooLong(sv.admin.deckTitle, input.title.trim(), LIMITS.title) ??
      tooLong(sv.admin.description, input.description, LIMITS.description) ??
      tooLong(sv.admin.courseCode, input.course_code, LIMITS.courseCode) ??
      tooLong(sv.admin.sourceCredit, input.source_credit, LIMITS.sourceCredit);
    if (long) return long;
    const title = input.title.trim();
    if (!SLUG_RE.test(slug)) return { ok: false, error: sv.admin.invalidSlug };
    if (!title) return { ok: false, error: sv.common.required };

    const values = {
      slug,
      title,
      description: input.description.trim() || null,
      course_code: input.course_code.trim() || null,
      source_credit: input.source_credit.trim() || null,
    };

    if (input.id) {
      const { error } = await supabase.from("decks").update(values).eq("id", input.id);
      if (error) return error.code === "23505" ? { ok: false, error: sv.admin.slugTaken } : fail(error);
      revalidateDeck(input.id, slug);
      return { ok: true, data: { id: input.id } };
    }

    const { data, error } = await supabase.from("decks").insert(values).select("id").single();
    if (error) return error.code === "23505" ? { ok: false, error: sv.admin.slugTaken } : fail(error);
    revalidateDeck(data.id, slug);
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function setDeckPublishedAction(id: string, published: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(id);
    const { data, error } = await supabase.from("decks").update({ is_published: published }).eq("id", id).select("slug").single();
    if (error) return fail(error);
    revalidateDeck(id, data.slug);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDeckAction(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("decks").delete().eq("id", id);
    if (error) return fail(error);
    revalidateTag(CONTENT_TAG);
    revalidatePath("/admin");
    revalidatePath("/admin/deck");
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Kategorier
// ---------------------------------------------------------------------------

export async function createCategoryAction(deckId: string, title: string): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireEditor(deckId);
    const t = title.trim();
    if (!t) return { ok: false, error: sv.common.required };
    const long = tooLong(sv.admin.categoryTitle, t, LIMITS.categoryTitle);
    if (long) return long;
    const { data: existing } = await supabase.from("categories").select("sort_order").eq("deck_id", deckId).order("sort_order", { ascending: false }).limit(1);
    const sort_order = (existing?.[0]?.sort_order ?? -1) + 1;
    const { data, error } = await supabase.from("categories").insert({ deck_id: deckId, title: t, sort_order }).select("id").single();
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateCategoryAction(id: string, deckId: string, title: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(deckId);
    const t = title.trim();
    if (!t) return { ok: false, error: sv.common.required };
    const long = tooLong(sv.admin.categoryTitle, t, LIMITS.categoryTitle);
    if (long) return long;
    const { error } = await supabase.from("categories").update({ title: t }).eq("id", id);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCategoryAction(id: string, deckId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(deckId);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderCategoriesAction(deckId: string, orderedIds: string[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(deckId);
    const { error } = await supabase.rpc("reorder_categories", { p_deck_id: deckId, p_ids: orderedIds });
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Kort
// ---------------------------------------------------------------------------

export type CardInput = {
  id?: string;
  deck_id: string;
  category_id: string | null;
  front: string;
  back: string;
  hint: string;
  is_active: boolean;
};

export async function saveCardAction(input: CardInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireEditor(input.deck_id);
    const front = input.front.trim();
    const back = input.back.trim();
    if (!front || !back) return { ok: false, error: sv.common.required };
    const long = tooLong(sv.admin.front, front, LIMITS.front) ?? tooLong(sv.admin.back, back, LIMITS.back) ?? tooLong(sv.admin.hint, input.hint.trim(), LIMITS.hint);
    if (long) return long;
    const values = {
      category_id: input.category_id || null,
      front,
      back,
      hint: input.hint.trim() || null,
      is_active: input.is_active,
    };
    if (input.id) {
      const { error } = await supabase.from("cards").update(values).eq("id", input.id);
      if (error) return fail(error);
      revalidateDeck(input.deck_id);
      return { ok: true, data: { id: input.id } };
    }
    const { data: existing } = await supabase.from("cards").select("sort_order").eq("deck_id", input.deck_id).order("sort_order", { ascending: false }).limit(1);
    const sort_order = (existing?.[0]?.sort_order ?? -1) + 1;
    const { data, error } = await supabase
      .from("cards")
      .insert({ ...values, deck_id: input.deck_id, sort_order })
      .select("id")
      .single();
    if (error) return fail(error);
    revalidateDeck(input.deck_id);
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCardAction(id: string, deckId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(deckId);
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderCardsAction(deckId: string, orderedIds: string[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(deckId);
    const { error } = await supabase.rpc("reorder_cards", { p_deck_id: deckId, p_ids: orderedIds });
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportResult = { created: number; updated: number; newCategories: number; skipped: number };

/**
 * Importerar kort. Diffen räknas om på servern utifrån de tolkade korten, så
 * klientens förhandsvisning är bara en visning av samma logik.
 */
export async function importCardsAction(deckId: string, cards: ImportCard[]): Promise<ActionResult<ImportResult>> {
  try {
    const { supabase } = await requireEditor(deckId);
    const [{ data: existingCards }, { data: existingCategories }] = await Promise.all([
      supabase.from("cards").select("id, front, back, hint, category_id, sort_order").eq("deck_id", deckId),
      supabase.from("categories").select("id, title, sort_order").eq("deck_id", deckId),
    ]);
    const categories = existingCategories ?? [];
    const diff = diffImport(cards, existingCards ?? [], categories);

    // Allt skrivs i en transaktion i databasen (import_cards). RLS avgör rättigheten.
    const { data: result, error } = await supabase.rpc("import_cards", {
      p_deck_id: deckId,
      p_new_categories: diff.newCategories,
      p_create: diff.create.map((c) => ({ front: c.front, back: c.back, hint: c.hint, category: c.category, sort_order: c.sort_order })),
      p_update: diff.update.map((u) => ({ id: u.id, back: u.after.back, hint: u.after.hint, category: u.after.category, sort_order: u.after.sort_order })),
    });
    if (error) {
      console.error("[import]", error.message);
      return { ok: false, error: error.message === "forbidden" ? sv.common.forbiddenBody : sv.admin.importFailed };
    }
    void result;

    revalidateDeck(deckId);
    return {
      ok: true,
      data: {
        created: diff.create.length,
        updated: diff.update.length,
        newCategories: diff.newCategories.length,
        skipped: diff.errors.length,
      },
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Felrapporter
// ---------------------------------------------------------------------------

function revalidateReports(deckId: string) {
  revalidatePath(`/admin/deck/${deckId}`);
  revalidatePath(`/admin/deck/${deckId}/rapporter`);
}

export async function setReportStatusAction(id: string, deckId: string, status: "open" | "resolved"): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(deckId);
    const { error } = await supabase
      .from("card_reports")
      .update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) throw error;
    revalidateReports(deckId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteReportAction(id: string, deckId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(deckId);
    const { error } = await supabase.from("card_reports").delete().eq("id", id);
    if (error) throw error;
    revalidateReports(deckId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Examinatorer (bara admin)
// ---------------------------------------------------------------------------

export async function addExaminerAction(deckId: string, email: string): Promise<ActionResult<{ status: "added" | "exists" | "invited" }>> {
  try {
    const { supabase } = await requireAdmin();
    const e = email.trim();
    if (!e) return { ok: false, error: sv.common.required };
    const { data, error } = await supabase.rpc("add_deck_examiner", { p_deck_id: deckId, p_email: e });
    if (error) return fail(error);
    revalidatePath(`/admin/deck/${deckId}/installningar`);
    return { ok: true, data: { status: data } };
  } catch (e) {
    return fail(e);
  }
}

/** Tar bort ett kopplat konto (userId) eller en väntande inbjudan (email). */
export async function removeExaminerAction(deckId: string, target: { userId: string } | { email: string }): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } =
      "userId" in target
        ? await supabase.rpc("remove_deck_examiner", { p_deck_id: deckId, p_user_id: target.userId })
        : await supabase.rpc("remove_deck_examiner_invite", { p_deck_id: deckId, p_email: target.email });
    if (error) return fail(error);
    revalidatePath(`/admin/deck/${deckId}/installningar`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
