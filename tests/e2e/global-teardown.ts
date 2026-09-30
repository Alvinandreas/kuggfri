/**
 * Körs en gång efter E2E-testerna, även när tester fallerat: tar bort alla kurser som testerna
 * skapat (adressen börjar med e2e-, titeln med E2E), så att "Alla kurser" inte fylls på mellan
 * körningarna, och felrapporterna de skickat ("E2E-rapport …"). Materialteknik rörs aldrig, och
 * bara en lokal Supabase städas (se cleanup.ts).
 *
 * Fristående: `npx tsx tests/e2e/global-teardown.ts`.
 */
import { isLocalSupabase, removeE2eDecks, removeE2eReports } from "./cleanup";

export default async function globalTeardown() {
  // Mot produktion (E2E_BASE_URL satt, E2E_SKIP_SETUP=1) skapas inga kurser och inget städas.
  if (process.env.E2E_SKIP_SETUP === "1" || !isLocalSupabase()) return;
  try {
    const removed = await removeE2eDecks();
    if (removed.length > 0) console.log(`E2E-städning: tog bort ${removed.length} testkurs(er): ${removed.map((d) => d.slug).join(", ")}`);
    const reports = await removeE2eReports();
    if (reports > 0) console.log(`E2E-städning: tog bort ${reports} testrapport(er).`);
  } catch (error) {
    // En misslyckad städning ska synas men inte göra en grön körning röd.
    console.warn(`E2E-städning misslyckades: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (process.argv[1] && /global-teardown\.ts$/.test(process.argv[1])) {
  void globalTeardown();
}
