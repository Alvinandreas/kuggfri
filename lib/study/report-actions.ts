"use server";

import { isUuid } from "@/lib/actions/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export type ReportResult = { ok: true } | { ok: false; error: string };

const MAX_MESSAGE = 1000;
const MAX_CONTACT = 200;

/**
 * Skickar in en felrapport på ett kort. Fungerar för gäster (anon) och inloggade;
 * user_id sätts av databasens default (auth.uid()) och kan inte anges härifrån.
 * RLS släpper bara igenom kort i publicerade deck.
 */
export async function reportCardAction(input: { cardId: string; message: string; contact?: string }): Promise<ReportResult> {
  const sv = await getT();
  const message = (input.message ?? "").trim();
  const contact = (input.contact ?? "").trim().slice(0, MAX_CONTACT) || null;
  if (message.length < 3) return { ok: false, error: sv.report.tooShort };
  if (message.length > MAX_MESSAGE) return { ok: false, error: sv.report.tooLong };
  if (!isUuid(input.cardId)) return { ok: false, error: sv.errors.generic };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("card_reports").insert({ card_id: input.cardId, message, contact });
  if (error) {
    console.error("[report]", error.code, error.message);
    // 53400 = takgränsen i databasen. Den har ett eget, begripligt meddelande: utan det
    // får studenten "något gick fel" och uppmanas försöka igen direkt, vilket bara misslyckas.
    if (error.code === "53400") return { ok: false, error: error.message || sv.report.rateLimited };
    return { ok: false, error: sv.errors.generic };
  }
  return { ok: true };
}
