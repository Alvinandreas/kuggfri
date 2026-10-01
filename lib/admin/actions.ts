"use server";

import { MAX_IMPORT_CARDS, LIMITS } from "@/lib/admin/limits";
import { adminAction, editorAction, requireAdmin, requireEditor, runAction } from "@/lib/actions/guard";
import { cleanIds, fail, isUuid, tooLong, type ActionResult } from "@/lib/actions/result";
import { normalizeKindInput } from "@/lib/admin/card-form";
import { revalidateDeck, revalidateDeckRemoved, revalidateExaminers, revalidateReports } from "@/lib/cache/revalidate";
import { getT } from "@/lib/i18n/server";
import { diffImport } from "@/lib/import/diff";
import type { ImportCard } from "@/lib/import/parse-import";
import type { CardKind, CardOption } from "@/lib/cards/kinds";

export type { ActionResult } from "@/lib/actions/result";

/*
  Adminvyns serveråtgärder: deck, kategorier, kort, import, felrapporter och examinatorer.
  Åtkomsten och felhanteringen sköts av lib/actions/guard.ts (editorAction: admin eller
  examinator för decket; adminAction: bara global admin), cachen av lib/cache/revalidate.ts.

  Filen delas inte upp per domän: en "use server"-fil får inte vidareexportera åtgärder från
  andra filer (export { … } from ger samma byggfel som en exporterad konstant), så en uppdelning
  skulle tvinga varje komponent att byta import.
*/

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

export type DeckInput = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  course_code: string;
  /** YYYY-MM-DD eller tom sträng. */
  exam_date?: string;
  source_credit: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveDeckAction(input: DeckInput): Promise<ActionResult<{ id: string }>> {
  const sv = await getT();
  return runAction(async () => {
    const { supabase, ctx } = input.id ? await requireEditor(input.id) : await requireAdmin();
    // Kursens adress ändras bara av global admin (Alvins beslut 29 sep); databasen spärrar
    // dessutom (migration 20260929000000). En examinators formulär skickar ingen adress.
    const slugLocked = !ctx.isAdmin;
    const slug = input.slug.trim().toLowerCase();
    const long =
      tooLong(sv, sv.admin.deckTitle, input.title.trim(), LIMITS.title) ??
      tooLong(sv, sv.admin.description, input.description, LIMITS.description) ??
      tooLong(sv, sv.admin.courseCode, input.course_code, LIMITS.courseCode) ??
      tooLong(sv, sv.admin.sourceCredit, input.source_credit, LIMITS.sourceCredit);
    if (long) return long;
    const title = input.title.trim();
    if (!slugLocked && !SLUG_RE.test(slug)) return { ok: false, error: sv.admin.invalidSlug };
    if (!title) return { ok: false, error: sv.common.required };
    const examDate = (input.exam_date ?? "").trim();
    if (examDate && !DATE_RE.test(examDate)) return { ok: false, error: sv.admin.invalidDate };

    const values = {
      ...(slugLocked ? {} : { slug }),
      title,
      description: input.description.trim() || null,
      course_code: input.course_code.trim() || null,
      exam_date: examDate || null,
      source_credit: input.source_credit.trim() || null,
    };

    if (input.id) {
      const { data: saved, error } = await supabase.from("decks").update(values).eq("id", input.id).select("slug").single();
      if (error) return error.code === "23505" ? { ok: false, error: sv.admin.slugTaken } : fail(error);
      revalidateDeck(input.id, saved.slug);
      return { ok: true, data: { id: input.id } };
    }

    const { data, error } = await supabase.from("decks").insert({ ...values, slug }).select("id").single();
    if (error) return error.code === "23505" ? { ok: false, error: sv.admin.slugTaken } : fail(error);
    revalidateDeck(data.id, slug);
    return { ok: true, data: { id: data.id } };
  });
}

export async function setDeckPublishedAction(id: string, published: boolean): Promise<ActionResult> {
  // Publicering är global admins beslut, inte examinatorns (Alvins beslut 29 sep).
  return adminAction(async ({ supabase }) => {
    const { data, error } = await supabase.from("decks").update({ is_published: published }).eq("id", id).select("slug").single();
    if (error) return fail(error);
    revalidateDeck(id, data.slug);
    return { ok: true, data: undefined };
  });
}

export async function deleteDeckAction(id: string): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const { error } = await supabase.from("decks").delete().eq("id", id);
    if (error) return fail(error);
    revalidateDeckRemoved();
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// Kategorier
// ---------------------------------------------------------------------------

export async function createCategoryAction(deckId: string, title: string): Promise<ActionResult<{ id: string }>> {
  const sv = await getT();
  return editorAction(deckId, async ({ supabase }) => {
    const t = title.trim();
    if (!t) return { ok: false, error: sv.common.required };
    const long = tooLong(sv, sv.admin.categoryTitle, t, LIMITS.categoryTitle);
    if (long) return long;
    const { data: existing } = await supabase.from("categories").select("sort_order").eq("deck_id", deckId).order("sort_order", { ascending: false }).limit(1);
    const sort_order = (existing?.[0]?.sort_order ?? -1) + 1;
    const { data, error } = await supabase.from("categories").insert({ deck_id: deckId, title: t, sort_order }).select("id").single();
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: { id: data.id } };
  });
}

export async function updateCategoryAction(id: string, deckId: string, title: string): Promise<ActionResult> {
  const sv = await getT();
  return editorAction(deckId, async ({ supabase }) => {
    const t = title.trim();
    if (!t) return { ok: false, error: sv.common.required };
    const long = tooLong(sv, sv.admin.categoryTitle, t, LIMITS.categoryTitle);
    if (long) return long;
    // Bind id:t till decket: RLS stoppar det redan, men frågan ska inte ens kunna träffa
    // en rad i en annan kurs om en policy någon gång skulle ändras.
    const { error } = await supabase.from("categories").update({ title: t }).eq("id", id).eq("deck_id", deckId);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  });
}

export async function deleteCategoryAction(id: string, deckId: string): Promise<ActionResult> {
  return editorAction(deckId, async ({ supabase }) => {
    const { error } = await supabase.from("categories").delete().eq("id", id).eq("deck_id", deckId);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  });
}

export async function reorderCategoriesAction(deckId: string, orderedIds: string[]): Promise<ActionResult> {
  return editorAction(deckId, async ({ supabase }) => {
    const { error } = await supabase.rpc("reorder_categories", { p_deck_id: deckId, p_ids: orderedIds });
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  });
}

/**
 * Flyttar kort till ett område (categoryId null = utan område). Området måste höra till
 * samma deck; korten binds också till decket i själva uppdateringen.
 */
export async function moveCardsToCategoryAction(deckId: string, ids: string[], categoryId: string | null): Promise<ActionResult<{ moved: number }>> {
  const sv = await getT();
  return editorAction(deckId, async ({ supabase }) => {
    const clean = cleanIds(ids, LIMITS.bulkCards);
    if (!clean) return { ok: false, error: sv.errors.generic };
    if (clean.length === 0) return { ok: true, data: { moved: 0 } };
    if (categoryId !== null) {
      if (!isUuid(categoryId)) return { ok: false, error: sv.errors.generic };
      const { data: category } = await supabase.from("categories").select("id").eq("id", categoryId).eq("deck_id", deckId).maybeSingle();
      if (!category) return { ok: false, error: sv.errors.generic };
    }
    const { data, error } = await supabase.from("cards").update({ category_id: categoryId }).eq("deck_id", deckId).in("id", clean).select("id");
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: { moved: data?.length ?? 0 } };
  });
}

/**
 * Slår ihop två områden: alla kort i fromId flyttas till intoId och det tomma området tas
 * bort. Två steg utan transaktion; misslyckas borttagningen ligger korten redan rätt och
 * området står tomt kvar, så inget går förlorat.
 */
export async function mergeCategoryAction(deckId: string, fromId: string, intoId: string): Promise<ActionResult<{ moved: number }>> {
  const sv = await getT();
  return editorAction(deckId, async ({ supabase }) => {
    if (!isUuid(fromId) || !isUuid(intoId) || fromId === intoId) return { ok: false, error: sv.errors.generic };
    const { data: found } = await supabase.from("categories").select("id").eq("deck_id", deckId).in("id", [fromId, intoId]);
    if ((found ?? []).length !== 2) return { ok: false, error: sv.errors.generic };
    const { data: moved, error: moveError } = await supabase.from("cards").update({ category_id: intoId }).eq("deck_id", deckId).eq("category_id", fromId).select("id");
    if (moveError) return fail(moveError);
    const { error } = await supabase.from("categories").delete().eq("id", fromId).eq("deck_id", deckId);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: { moved: moved?.length ?? 0 } };
  });
}

// ---------------------------------------------------------------------------
// Kort
// ---------------------------------------------------------------------------

export type CardInput = {
  id?: string;
  deck_id: string;
  category_id: string | null;
  front: string;
  /** Baksidan, eller förklaringen för automaträttade typer. */
  back: string;
  hint: string;
  is_active: boolean;
  /** Utelämnat = oförändrat (nytt kort: självskattning). */
  kind?: CardKind;
  options?: CardOption[] | null;
  source?: string;
};

/**
 * Sparar ett kort. Typ och alternativ kontrolleras med samma regler som redigeraren visar
 * (validateKind); servern är sanningen. Ett nytt kort blir ett utkast som väntar på granskning.
 * Ett utkast eller avvisat förslag förblir inaktivt tills det godkänns under Granskning, oavsett
 * vad formuläret skickar.
 */
export async function saveCardAction(input: CardInput): Promise<ActionResult<{ id: string }>> {
  const sv = await getT();
  return runAction(async () => {
    const { supabase } = await requireEditor(input.deck_id);
    const front = input.front.trim();
    const back = input.back.trim();
    const source = (input.source ?? "").trim();
    const long =
      tooLong(sv, sv.admin.front, front, LIMITS.front) ??
      tooLong(sv, sv.admin.back, back, LIMITS.back) ??
      tooLong(sv, sv.admin.hint, input.hint.trim(), LIMITS.hint) ??
      tooLong(sv, sv.admin.sourceShort, source, LIMITS.source);
    if (long) return long;

    let existing: { kind: CardKind; options: CardOption[] | null; review_status: string | null } | null = null;
    if (input.id) {
      const { data, error } = await supabase.from("cards").select("kind, options, review_status").eq("id", input.id).eq("deck_id", input.deck_id).maybeSingle();
      if (error) return fail(error);
      if (!data) return { ok: false, error: sv.errors.generic };
      existing = data;
    }

    const kindInput = input.kind ?? existing?.kind ?? "sjalvskattning";
    const optionsInput = input.kind === undefined ? (existing?.options ?? null) : (input.options ?? null);
    const normalized = normalizeKindInput(kindInput, optionsInput);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    if (!front || !back) return { ok: false, error: sv.common.required };

    const inReview = existing?.review_status != null;
    const values = {
      category_id: input.category_id || null,
      front,
      back,
      hint: input.hint.trim() || null,
      is_active: inReview ? false : input.is_active,
      kind: normalized.kind,
      options: normalized.options,
      ...(input.source !== undefined ? { source: source || null } : {}),
    };
    if (input.id) {
      const { error } = await supabase.from("cards").update(values).eq("id", input.id).eq("deck_id", input.deck_id);
      if (error) return fail(error);
      revalidateDeck(input.deck_id);
      return { ok: true, data: { id: input.id } };
    }
    const { data: last } = await supabase.from("cards").select("sort_order").eq("deck_id", input.deck_id).order("sort_order", { ascending: false }).limit(1);
    const sort_order = (last?.[0]?.sort_order ?? -1) + 1;
    // Ett nytt kort väntar alltid på granskning (Granskning, Att granska) innan studenterna ser
    // det, oavsett vem som skapat det (Alvins beslut 30 sep).
    const { data, error } = await supabase
      .from("cards")
      .insert({ ...values, is_active: false, review_status: "utkast", deck_id: input.deck_id, sort_order })
      .select("id")
      .single();
    if (error) return fail(error);
    revalidateDeck(input.deck_id);
    return { ok: true, data: { id: data.id } };
  });
}

export async function deleteCardAction(id: string, deckId: string): Promise<ActionResult> {
  return editorAction(deckId, async ({ supabase }) => {
    const { error } = await supabase.from("cards").delete().eq("id", id).eq("deck_id", deckId);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  });
}

export async function reorderCardsAction(deckId: string, orderedIds: string[]): Promise<ActionResult> {
  return editorAction(deckId, async ({ supabase }) => {
    const { error } = await supabase.rpc("reorder_cards", { p_deck_id: deckId, p_ids: orderedIds });
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  });
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
  const sv = await getT();
  return runAction(async () => {
    // Antalet kontrolleras före åtkomsten.
    if (cards.length > MAX_IMPORT_CARDS) return { ok: false, error: sv.admin.importTooMany(MAX_IMPORT_CARDS) };
    const { supabase } = await requireEditor(deckId);
    const [{ data: existingCards }, { data: existingCategories }] = await Promise.all([
      supabase.from("cards").select("id, front, back, hint, category_id, sort_order").eq("deck_id", deckId),
      supabase.from("categories").select("id, title, sort_order").eq("deck_id", deckId),
    ]);
    const categories = existingCategories ?? [];
    const diff = diffImport(cards, existingCards ?? [], categories);

    // Allt skrivs i en transaktion i databasen (import_cards). RLS avgör rättigheten.
    const { error } = await supabase.rpc("import_cards", {
      p_deck_id: deckId,
      p_new_categories: diff.newCategories,
      p_create: diff.create.map((c) => ({ front: c.front, back: c.back, hint: c.hint, category: c.category, sort_order: c.sort_order })),
      p_update: diff.update.map((u) => ({ id: u.id, back: u.after.back, hint: u.after.hint, category: u.after.category, sort_order: u.after.sort_order })),
    });
    if (error) {
      console.error("[import]", error.message);
      return { ok: false, error: error.message === "forbidden" ? sv.common.forbiddenBody : sv.admin.importFailed };
    }

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
  });
}

// ---------------------------------------------------------------------------
// Felrapporter
// ---------------------------------------------------------------------------

export async function setReportStatusAction(id: string, deckId: string, status: "open" | "resolved"): Promise<ActionResult> {
  return editorAction(deckId, async ({ supabase }) => {
    const { error } = await supabase
      .from("card_reports")
      .update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return fail(error);
    revalidateReports(deckId);
    return { ok: true, data: undefined };
  });
}

export async function deleteReportAction(id: string, deckId: string): Promise<ActionResult> {
  return editorAction(deckId, async ({ supabase }) => {
    const { error } = await supabase.from("card_reports").delete().eq("id", id);
    if (error) return fail(error);
    revalidateReports(deckId);
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// Examinatorer (bara admin)
// ---------------------------------------------------------------------------

export async function addExaminerAction(deckId: string, email: string): Promise<ActionResult<{ status: "added" | "exists" | "invited" }>> {
  const sv = await getT();
  return adminAction(async ({ supabase }) => {
    const e = email.trim();
    if (!e) return { ok: false, error: sv.common.required };
    const { data, error } = await supabase.rpc("add_deck_examiner", { p_deck_id: deckId, p_email: e });
    if (error) return fail(error);
    revalidateExaminers(deckId);
    return { ok: true, data: { status: data } };
  });
}

/** Tar bort ett kopplat konto (userId) eller en väntande inbjudan (email). */
export async function removeExaminerAction(deckId: string, target: { userId: string } | { email: string }): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const { error } =
      "userId" in target
        ? await supabase.rpc("remove_deck_examiner", { p_deck_id: deckId, p_user_id: target.userId })
        : await supabase.rpc("remove_deck_examiner_invite", { p_deck_id: deckId, p_email: target.email });
    if (error) return fail(error);
    revalidateExaminers(deckId);
    return { ok: true, data: undefined };
  });
}
