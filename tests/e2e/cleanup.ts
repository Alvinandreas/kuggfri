/**
 * Städning av kurser som E2E-testerna skapar, så att inget blir kvar i "Alla kurser" efter en
 * körning (Alvins önskemål 30 sep 2026). Används av testerna i afterEach och av den globala
 * teardownen. Kursens områden, kort, progress, tentor och examinatorer följer med via
 * `on delete cascade` på decks.
 *
 * Ingen import från @playwright/test här, så att modulen kan köras fristående med tsx.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

/** Standardnyckeln som lokala Supabase CLI använder. Skriv över med env om den skiljer sig (se `supabase status`). */
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/** Kurser som aldrig tas bort, hur de än heter. */
export const PROTECTED_DECK_SLUGS: readonly string[] = ["materialteknik"];

/** Id-prefixet för testkurser som skapas med fasta id i testerna. */
const E2E_DECK_ID_PREFIX = "00000000-0000-4000-8000-0000000e";

type DeckRef = { id: string; slug: string; title: string };

/** Skapad av ett E2E-test: adressen börjar med e2e-, titeln med E2E eller id:t med testprefixet. */
export function isE2eDeck(deck: DeckRef): boolean {
  if (PROTECTED_DECK_SLUGS.includes(deck.slug)) return false;
  return deck.slug.startsWith("e2e-") || deck.title.startsWith("E2E") || deck.id.startsWith(E2E_DECK_ID_PREFIX);
}

/** Städningen körs bara mot en lokal Supabase, aldrig mot produktionen. */
export function isLocalSupabase(url: string = SUPABASE_URL): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Tar bort E2E-skapade kurser. Med `slug` bara den kursen (om den är en E2E-kurs), annars alla.
 * Returnerar de borttagna kurserna. Rör aldrig en skyddad kurs.
 */
export async function removeE2eDecks(options: { slug?: string; db?: SupabaseClient } = {}): Promise<DeckRef[]> {
  if (!isLocalSupabase()) return [];
  const db = options.db ?? serviceClient();
  let query = db.from("decks").select("id, slug, title");
  if (options.slug) query = query.eq("slug", options.slug);
  const { data, error } = await query;
  if (error) throw new Error(`Kunde inte läsa kurserna: ${error.message}`);
  const doomed = ((data ?? []) as DeckRef[]).filter(isE2eDeck);
  if (doomed.length === 0) return [];
  const { error: deleteError } = await db
    .from("decks")
    .delete()
    .in(
      "id",
      doomed.map((d) => d.id),
    );
  if (deleteError) throw new Error(`Kunde inte ta bort E2E-kurserna: ${deleteError.message}`);
  return doomed;
}

/** Felrapporter som reports.spec.ts skickar ("E2E-rapport <tid>: …"); de hamnar annars bland kursens åtgärdade rapporter. */
export async function removeE2eReports(db: SupabaseClient = serviceClient()): Promise<number> {
  if (!isLocalSupabase()) return 0;
  const { data, error } = await db.from("card_reports").delete().like("message", "E2E-rapport %").select("id");
  if (error) throw new Error(`Kunde inte ta bort E2E-rapporterna: ${error.message}`);
  return data?.length ?? 0;
}
