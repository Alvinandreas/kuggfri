import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Vilka kurser den inloggade får läsa: kurser där hen står på deltagarlistan, och de kurser hen
 * redigerar (admin och examinatorer). Kursinnehållet hämtas ur serverns cache, som inte vet vem
 * som frågar, så varje sida som visar en kurs kontrollerar åtkomsten här. Databasens policy på
 * korten (is_enrolled) hindrar att API:t går runt det.
 *
 * En gång per request (React cache).
 */
export const getViewableDeckIds = cache(async (): Promise<Set<string>> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_deck_ids");
  if (error) {
    console.error("[deltagare] my_deck_ids:", error.message);
    return new Set();
  }
  return new Set((data ?? []) as string[]);
});

/** Får den inloggade läsa kursen? */
export async function canViewDeck(deckId: string): Promise<boolean> {
  return (await getViewableDeckIds()).has(deckId);
}
