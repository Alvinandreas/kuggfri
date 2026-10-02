"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Lang } from "./types";

/**
 * Sparar språket på kontot (profiles.lang) när reglaget English används. Webbläsaren minns valet i
 * en kaka; kontot behöver det för det som skickas utan webbläsare, som veckobrevet. Bara egna
 * raden (RLS) och bara kolumnen lang. Utloggad: inget sparas.
 */
export async function saveLanguageAction(lang: Lang): Promise<void> {
  if (lang !== "sv" && lang !== "en") return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("profiles").update({ lang }).eq("id", user.id);
  if (error) console.error("[språk] kunde inte spara språket", error.message);
}
