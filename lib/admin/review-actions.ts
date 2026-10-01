"use server";

import { editorAction } from "@/lib/actions/guard";
import { cleanIds, fail, isUuid, tooLong, type ActionResult } from "@/lib/actions/result";
import { saveCardAction } from "@/lib/admin/actions";
import { normalizeKindInput } from "@/lib/admin/card-form";
import { LIMITS } from "@/lib/admin/limits";
import { NO_FLAG, approvalIssues, approvedPatch, cleanFlagNote, rejectedPatch } from "@/lib/admin/review";
import { parseOptions, type CardKind, type CardOption } from "@/lib/cards/kinds";
import { revalidateDeck } from "@/lib/cache/revalidate";
import { getT } from "@/lib/i18n/server";

/*
  Granskningen: godkänn, flagga, åtgärda en flagga, avvisa och redigera. Samma åtkomst som
  övriga adminåtgärder: admin eller examinator för decket (requireEditor), och RLS
  (can_edit_deck) nekar dessutom oavsett. Varje uppdatering binds till decket med deck_id, så
  ett id från en annan kurs träffar inget.

  Flaggan är inte innehåll: triggern record_card_version sparar ingen ny version när bara
  flaggan ändras.
*/

/**
 * Godkänner kort: review_status null, aktivt, granskat av användaren nu, och en eventuell
 * flagga tas bort. Kortet går in i rotation. Kort med fel i typ eller alternativ (eller tom
 * text) hoppas över och rapporteras, så att inget trasigt kort når studenterna.
 */
export async function approveCardsAction(deckId: string, ids: string[]): Promise<ActionResult<{ approved: string[]; skipped: string[]; reviewedAt: string }>> {
  const sv = await getT();
  return editorAction(deckId, async ({ supabase, ctx }) => {
    const clean = cleanIds(ids, LIMITS.bulkCards);
    if (!clean) return { ok: false, error: sv.errors.generic };
    const reviewedAt = new Date().toISOString();
    if (clean.length === 0) return { ok: true, data: { approved: [], skipped: [], reviewedAt } };

    const { data: rows, error: readError } = await supabase.from("cards").select("id, front, back, kind, options").eq("deck_id", deckId).in("id", clean);
    if (readError) return fail(readError);
    const approved: string[] = [];
    const skipped: string[] = [];
    for (const row of rows ?? []) {
      const issues = approvalIssues({ front: row.front, back: row.back, kind: row.kind, options: parseOptions(row.options) }, sv);
      (issues.length === 0 ? approved : skipped).push(row.id);
    }
    if (approved.length > 0) {
      const { error } = await supabase
        .from("cards")
        .update(approvedPatch(ctx.userId, reviewedAt))
        .eq("deck_id", deckId)
        .in("id", approved);
      if (error) return fail(error);
      revalidateDeck(deckId);
    }
    return { ok: true, data: { approved, skipped, reviewedAt } };
  });
}

/**
 * Flaggar ett kort (eller ändrar anteckningen på en flagga): vad som behöver åtgärdas. Kortet
 * samlas under Flaggade tills flaggan åtgärdats. Anteckningen krävs och blir en rad.
 */
export async function flagCardAction(deckId: string, id: string, note: string): Promise<ActionResult<{ flagNote: string; flaggedAt: string }>> {
  const sv = await getT();
  return editorAction(deckId, async ({ supabase, ctx }) => {
    if (!isUuid(id) || typeof note !== "string") return { ok: false, error: sv.errors.generic };
    const text = cleanFlagNote(note);
    if (!text) return { ok: false, error: sv.granskning.flagNoteRequired };
    const long = tooLong(sv, sv.granskning.flagNote, text, LIMITS.flagNote);
    if (long) return long;
    const flaggedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("cards")
      .update({ flag_note: text, flagged_at: flaggedAt, flagged_by: ctx.userId })
      .eq("deck_id", deckId)
      .eq("id", id)
      .select("id");
    if (error) return fail(error);
    if (!data || data.length === 0) return { ok: false, error: sv.errors.generic };
    revalidateDeck(deckId);
    return { ok: true, data: { flagNote: text, flaggedAt } };
  });
}

/** Åtgärdad: tar bort flaggan. Kortet går tillbaka till sin flik (Att granska eller Granskade). */
export async function resolveFlagAction(deckId: string, id: string): Promise<ActionResult> {
  const sv = await getT();
  return editorAction(deckId, async ({ supabase }) => {
    if (!isUuid(id)) return { ok: false, error: sv.errors.generic };
    const { error } = await supabase.from("cards").update(NO_FLAG).eq("deck_id", deckId).eq("id", id);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: undefined };
  });
}

/**
 * Avvisar ett kort med en valfri kommentar. Kortet blir (och förblir) inaktivt och en flagga
 * tas bort. (En föreslagen ändring av ett publicerat kort avvisas i stället med
 * rejectCorrectionAction, som återställer den publicerade versionen.)
 */
export async function rejectCardAction(deckId: string, id: string, note: string): Promise<ActionResult<{ reviewedAt: string }>> {
  const sv = await getT();
  return editorAction(deckId, async ({ supabase, ctx }) => {
    if (!isUuid(id) || typeof note !== "string") return { ok: false, error: sv.errors.generic };
    const text = note.trim();
    const long = tooLong(sv, sv.admin.reviewRejectNote, text, LIMITS.reviewNote);
    if (long) return long;
    const reviewedAt = new Date().toISOString();
    const { error } = await supabase
      .from("cards")
      .update(rejectedPatch(ctx.userId, reviewedAt, text))
      .eq("deck_id", deckId)
      .eq("id", id);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: { reviewedAt } };
  });
}

/** Det granskaren kan ändra på ett kort direkt i granskningen. */
export type ReviewEditInput = {
  id: string;
  category_id: string | null;
  front: string;
  back: string;
  hint: string;
  kind: CardKind;
  options: CardOption[] | null;
};

type ReviewSaved = { reviewedAt: string | null; kind: CardKind; options: CardOption[] | null };

/**
 * Sparar en redigering gjord i granskningen, och godkänner kortet om approve (Spara och
 * godkänn). Källan och kortets status rörs inte av själva sparandet; ett kort som väntar på
 * granskning förblir inaktivt tills det godkänns. Godkännandet tar bort en eventuell flagga.
 */
export async function saveReviewCardAction(deckId: string, input: ReviewEditInput, approve: boolean): Promise<ActionResult<ReviewSaved>> {
  const sv = await getT();
  return editorAction<ReviewSaved>(deckId, async ({ supabase, ctx }) => {
    if (!input || !isUuid(input.id) || (input.category_id !== null && !isUuid(input.category_id))) return { ok: false, error: sv.errors.generic };
    const { data: row, error: readError } = await supabase.from("cards").select("is_active").eq("deck_id", deckId).eq("id", input.id).maybeSingle();
    if (readError) return fail(readError);
    if (!row) return { ok: false, error: sv.errors.generic };
    if (input.category_id !== null) {
      const { data: area } = await supabase.from("categories").select("id").eq("id", input.category_id).eq("deck_id", deckId).maybeSingle();
      if (!area) return { ok: false, error: sv.errors.generic };
    }

    const normalized = normalizeKindInput(input.kind, input.options);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    const saved = await saveCardAction({
      id: input.id,
      deck_id: deckId,
      category_id: input.category_id,
      front: String(input.front ?? ""),
      back: String(input.back ?? ""),
      hint: String(input.hint ?? ""),
      is_active: row.is_active,
      kind: normalized.kind,
      options: normalized.options,
    });
    if (!saved.ok) return saved;
    if (!approve) return { ok: true, data: { reviewedAt: null, kind: normalized.kind, options: normalized.options } };

    const issues = approvalIssues({ front: input.front.trim(), back: input.back.trim(), kind: normalized.kind, options: normalized.options }, sv);
    if (issues.length > 0) return { ok: false, error: `${sv.granskning.cannotApprove} ${issues.join(" ")}` };
    const reviewedAt = new Date().toISOString();
    const { error } = await supabase
      .from("cards")
      .update(approvedPatch(ctx.userId, reviewedAt))
      .eq("deck_id", deckId)
      .eq("id", input.id);
    if (error) return fail(error);
    revalidateDeck(deckId);
    return { ok: true, data: { reviewedAt, kind: normalized.kind, options: normalized.options } };
  });
}

/** Ett korts granskningsläge före ett beslut, för Ångra. */
export type ReviewSnapshot = {
  id: string;
  review_status: "utkast" | "avvisad" | null;
  review_note: string | null;
  is_active: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  flag_note: string | null;
  flagged_at: string | null;
  flagged_by: string | null;
};

const isDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

/**
 * Ångra: återställer korten till läget före beslutet. Värdena kommer från klienten och
 * rensas: bara kända statusar, ett kort med status är alltid inaktivt, granskaren och den som
 * flaggat kan bara återställas till ett uuid (eller null), och utan anteckning ingen flagga.
 */
export async function restoreReviewAction(deckId: string, snapshots: ReviewSnapshot[]): Promise<ActionResult> {
  const sv = await getT();
  return editorAction(deckId, async ({ supabase }) => {
    if (!Array.isArray(snapshots) || snapshots.length > LIMITS.bulkCards) return { ok: false, error: sv.errors.generic };
    // Kort med samma läge (typiskt många utkast efter ett massgodkännande) återställs i ett anrop.
    const groups = new Map<string, { values: Omit<ReviewSnapshot, "id">; ids: string[] }>();
    for (const s of snapshots) {
      if (!s || !isUuid(s.id)) return { ok: false, error: sv.errors.generic };
      const status = s.review_status === "utkast" || s.review_status === "avvisad" ? s.review_status : null;
      const flagNote = typeof s.flag_note === "string" ? cleanFlagNote(s.flag_note).slice(0, LIMITS.flagNote) || null : null;
      const values: Omit<ReviewSnapshot, "id"> = {
        review_status: status,
        review_note: typeof s.review_note === "string" ? s.review_note.slice(0, LIMITS.reviewNote) : null,
        is_active: status === null ? s.is_active === true : false,
        reviewed_by: isUuid(s.reviewed_by) ? s.reviewed_by : null,
        reviewed_at: isDate(s.reviewed_at) ? s.reviewed_at : null,
        flag_note: flagNote,
        flagged_at: flagNote && isDate(s.flagged_at) ? s.flagged_at : flagNote ? new Date().toISOString() : null,
        flagged_by: flagNote && isUuid(s.flagged_by) ? s.flagged_by : null,
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
  });
}
