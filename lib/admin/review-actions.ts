"use server";

import { cleanIds, fail, isUuid, requireEditor, revalidateDeck, tooLong, type ActionResult } from "@/lib/admin/action-helpers";
import { normalizeKindInput } from "@/lib/admin/card-form";
import { LIMITS } from "@/lib/admin/limits";
import { approvalIssues } from "@/lib/admin/review";
import { parseOptions, type CardKind, type CardOption } from "@/lib/cards/kinds";
import { sv } from "@/lib/i18n/sv";

/*
  Granskningen av förslag (utkast). Samma åtkomst som övriga adminåtgärder: admin eller
  examinator för decket (requireEditor), och RLS (can_edit_deck) nekar dessutom oavsett.
  Varje uppdatering binds till decket med deck_id, så ett id från en annan kurs träffar inget.
*/

/**
 * Godkänner kort: review_status null, aktivt, granskat av användaren nu. Kort med fel i typ
 * eller alternativ (eller tom text) hoppas över och rapporteras, så att inget trasigt kort
 * når studenterna. Ger vilka som godkändes och vilka som hoppades över.
 */
export async function approveCardsAction(deckId: string, ids: string[]): Promise<ActionResult<{ approved: string[]; skipped: string[]; reviewedAt: string }>> {
  try {
    const { supabase, ctx } = await requireEditor(deckId);
    const clean = cleanIds(ids, LIMITS.bulkCards);
    if (!clean) return { ok: false, error: sv.errors.generic };
    const reviewedAt = new Date().toISOString();
    if (clean.length === 0) return { ok: true, data: { approved: [], skipped: [], reviewedAt } };

    const { data: rows, error: readError } = await supabase.from("cards").select("id, front, back, kind, options").eq("deck_id", deckId).in("id", clean);
    if (readError) return fail(readError);
    const approved: string[] = [];
    const skipped: string[] = [];
    for (const row of rows ?? []) {
      const issues = approvalIssues({ front: row.front, back: row.back, kind: row.kind, options: parseOptions(row.options) });
      (issues.length === 0 ? approved : skipped).push(row.id);
    }
    if (approved.length > 0) {
      const { error } = await supabase
        .from("cards")
        .update({ review_status: null, is_active: true, reviewed_by: ctx.userId, reviewed_at: reviewedAt })
        .eq("deck_id", deckId)
        .in("id", approved);
      if (error) return fail(error);
      revalidateDeck(deckId);
    }
    return { ok: true, data: { approved, skipped, reviewedAt } };
  } catch (e) {
    return fail(e);
  }
}

/** Avvisar ett förslag med en valfri kommentar. Kortet blir (och förblir) inaktivt. */
export async function rejectCardAction(deckId: string, id: string, note: string): Promise<ActionResult<{ reviewedAt: string }>> {
  try {
    const { supabase, ctx } = await requireEditor(deckId);
    if (!isUuid(id)) return { ok: false, error: sv.errors.generic };
    const text = note.trim();
    const long = tooLong(sv.admin.reviewRejectNote, text, LIMITS.reviewNote);
    if (long) return long;
    const reviewedAt = new Date().toISOString();
    const { error } = await supabase
      .from("cards")
      .update({ review_status: "avvisad", review_note: text || null, is_active: false, reviewed_by: ctx.userId, reviewed_at: reviewedAt })
      .eq("deck_id", deckId)
      .eq("id", id);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: { reviewedAt } };
  } catch (e) {
    return fail(e);
  }
}

/** Ett korts granskningsläge före ett beslut, för Ångra. */
export type ReviewSnapshot = {
  id: string;
  review_status: "utkast" | "avvisad" | null;
  review_note: string | null;
  is_active: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

/**
 * Ångra: återställer korten till läget före beslutet. Värdena kommer från klienten och
 * rensas: bara kända statusar, ett kort med status är alltid inaktivt, och granskaren kan
 * bara återställas till ett uuid (eller null).
 */
export async function restoreReviewAction(deckId: string, snapshots: ReviewSnapshot[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireEditor(deckId);
    if (!Array.isArray(snapshots) || snapshots.length > LIMITS.bulkCards) return { ok: false, error: sv.errors.generic };
    // Kort med samma läge (typiskt många utkast efter ett massgodkännande) återställs i ett anrop.
    const groups = new Map<string, { values: Omit<ReviewSnapshot, "id">; ids: string[] }>();
    for (const s of snapshots) {
      if (!s || !isUuid(s.id)) return { ok: false, error: sv.errors.generic };
      const status = s.review_status === "utkast" || s.review_status === "avvisad" ? s.review_status : null;
      const values: Omit<ReviewSnapshot, "id"> = {
        review_status: status,
        review_note: typeof s.review_note === "string" ? s.review_note.slice(0, LIMITS.reviewNote) : null,
        is_active: status === null ? s.is_active === true : false,
        reviewed_by: isUuid(s.reviewed_by) ? s.reviewed_by : null,
        reviewed_at: typeof s.reviewed_at === "string" && Number.isFinite(Date.parse(s.reviewed_at)) ? s.reviewed_at : null,
      };
      const key = JSON.stringify(values);
      const group = groups.get(key) ?? { values, ids: [] };
      group.ids.push(s.id);
      groups.set(key, group);
    }
    for (const { values, ids } of groups.values()) {
      const { error } = await supabase.from("cards").update(values).eq("deck_id", deckId).in("id", ids);
      if (error) return fail(error);
    }
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Byter uppgiftstyp. Till ett vändkort blir options null; till en automaträttad typ krävs
 * giltiga alternativ (annars får granskaren fylla i dem i redigeraren).
 */
export async function setCardKindAction(deckId: string, id: string, kind: CardKind, options: CardOption[] | null): Promise<ActionResult<{ kind: CardKind; options: CardOption[] | null }>> {
  try {
    const { supabase } = await requireEditor(deckId);
    if (!isUuid(id)) return { ok: false, error: sv.errors.generic };
    const normalized = normalizeKindInput(kind, options);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    const { error } = await supabase.from("cards").update({ kind: normalized.kind, options: normalized.options }).eq("deck_id", deckId).eq("id", id);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: { kind: normalized.kind, options: normalized.options } };
  } catch (e) {
    return fail(e);
  }
}
