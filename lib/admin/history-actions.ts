"use server";

import { fail, isUuid, requireEditor, revalidateDeck, tooLong, type ActionResult } from "@/lib/admin/action-helpers";
import { changedFields, contentOf, isPublished, restoreValues, versionFromRow, type VersionContent } from "@/lib/admin/history";
import { LIMITS } from "@/lib/admin/limits";
import { parseOptions } from "@/lib/cards/kinds";
import { sv } from "@/lib/i18n/sv";

/*
  Återställning av kortversioner. Samma åtkomst som övriga adminåtgärder: admin eller
  examinator för decket (requireEditor), och RLS (can_edit_deck) nekar dessutom oavsett.
  Allt binds till decket med deck_id. Triggern record_card_version sparar versionen som
  ersätts, så en återställning går i sin tur att ångra (undoVersionId).
*/

type Supabase = Awaited<ReturnType<typeof requireEditor>>["supabase"];

export type RestoreResult = {
  /** Kortets innehåll efter återställningen. */
  content: VersionContent;
  /** Versionen som triggern sparade av det som ersattes (för Ångra); null om inget ändrades. */
  undoVersionId: number | null;
};

function isVersionId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Läser versionen och kortets nuvarande innehåll, eller null om något inte hör till decket. */
async function load(supabase: Supabase, deckId: string, cardId: string, versionId: number) {
  const [{ data: version, error: e1 }, { data: card, error: e2 }] = await Promise.all([
    supabase.from("card_versions").select("*").eq("id", versionId).eq("card_id", cardId).eq("deck_id", deckId).maybeSingle(),
    supabase
      .from("cards")
      .select("category_id, front, back, hint, kind, options, is_active, review_status, source")
      .eq("id", cardId)
      .eq("deck_id", deckId)
      .maybeSingle(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!version || !card) return null;
  const target = restoreValues(versionFromRow(version, ""));
  // Området kan ha tagits bort sedan dess; då hamnar kortet utan område.
  if (target.category_id) {
    const { data: area } = await supabase.from("categories").select("id").eq("id", target.category_id).eq("deck_id", deckId).maybeSingle();
    if (!area) target.category_id = null;
  }
  const current: VersionContent = contentOf({ ...card, options: parseOptions(card.options) });
  return { target, current };
}

/** Id:t på den version triggern nyss sparade för kortet. */
async function newestVersionId(supabase: Supabase, deckId: string, cardId: string): Promise<number | null> {
  const { data } = await supabase.from("card_versions").select("id").eq("card_id", cardId).eq("deck_id", deckId).order("id", { ascending: false }).limit(1);
  const id = data?.[0]?.id;
  return id === undefined ? null : Number(id);
}

/**
 * Återställer kortet till en tidigare version: framsida, baksida, ledtråd, typ, alternativ,
 * område, aktiv, granskningsstatus och källa (inte original-flaggan). Ett kort med
 * granskningsstatus blir alltid inaktivt.
 */
export async function restoreCardVersionAction(deckId: string, cardId: string, versionId: number): Promise<ActionResult<RestoreResult>> {
  try {
    const { supabase } = await requireEditor(deckId);
    if (!isUuid(cardId) || !isVersionId(versionId)) return { ok: false, error: sv.errors.generic };
    const loaded = await load(supabase, deckId, cardId, versionId);
    if (!loaded) return { ok: false, error: sv.admin.historyNotFound };
    const { target, current } = loaded;
    if (changedFields(current, target).length === 0) return { ok: true, data: { content: current, undoVersionId: null } };

    const { data, error } = await supabase.from("cards").update(target).eq("deck_id", deckId).eq("id", cardId).select("id");
    if (error) return fail(error);
    if (!data || data.length === 0) return { ok: false, error: sv.errors.generic };
    const undoVersionId = await newestVersionId(supabase, deckId, cardId);
    revalidateDeck(deckId);
    return { ok: true, data: { content: target, undoVersionId } };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Avvisar en föreslagen ändring av ett publicerat kort: kortet återställs till den publicerade
 * versionen (och syns för studenterna igen), med granskarens kommentar. Förslaget finns kvar i
 * historiken och kan tas tillbaka därifrån.
 */
export async function rejectCorrectionAction(
  deckId: string,
  cardId: string,
  versionId: number,
  note: string,
): Promise<ActionResult<RestoreResult & { reviewedAt: string }>> {
  try {
    const { supabase, ctx } = await requireEditor(deckId);
    if (!isUuid(cardId) || !isVersionId(versionId) || typeof note !== "string") return { ok: false, error: sv.errors.generic };
    const text = note.trim();
    const long = tooLong(sv.admin.reviewRejectNote, text, LIMITS.reviewNote);
    if (long) return long;
    const loaded = await load(supabase, deckId, cardId, versionId);
    if (!loaded) return { ok: false, error: sv.admin.historyNotFound };
    const { target, current } = loaded;
    if (!isPublished(target) || current.review_status !== "utkast") return { ok: false, error: sv.admin.correctionNotApplicable };

    const reviewedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("cards")
      .update({ ...target, review_note: text || null, reviewed_by: ctx.userId, reviewed_at: reviewedAt })
      .eq("deck_id", deckId)
      .eq("id", cardId)
      .select("id");
    if (error) return fail(error);
    if (!data || data.length === 0) return { ok: false, error: sv.errors.generic };
    const undoVersionId = await newestVersionId(supabase, deckId, cardId);
    revalidateDeck(deckId);
    return { ok: true, data: { content: target, undoVersionId, reviewedAt } };
  } catch (e) {
    return fail(e);
  }
}
