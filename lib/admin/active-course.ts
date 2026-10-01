/**
 * Kursen som adminfunktionerna gäller (Alvins beslut 30 sep 2026, se DECISIONS.md).
 *
 * Tjänsten är i dag utformad för en enda kurs. Sidomenyns adminposter (Översikt, Innehåll,
 * Granskning, Tentor, Felrapporter, Import, Inställningar) och ingången /admin leder därför
 * alltid hit, oavsett vilken sida man står på och oavsett om databasen har andra kurser
 * (till exempel testkurser). Sidomenyn skriver inte ut något kursnamn, så att examinatorerna
 * aldrig behöver undra vilken kurs de administrerar.
 *
 * När fler kurser blir aktiva: byt låsningen mot ett kursval (till exempel kursen i adressen)
 * i `pickActiveAdminCourse` nedan, som `lib/admin/nav.ts` och `app/(app)/admin/page.tsx` använder.
 */
export const ACTIVE_ADMIN_COURSE_SLUG = "materialteknik";

/**
 * Vad som gäller när användaren inte får redigera den låsta kursen (en examinator för en annan kurs):
 * - `"forsta"`: den första av kurserna (sidomenyn, lib/admin/nav.ts);
 * - `"enda"`: kursen bara om den är den enda, annars ingen (ingången /admin, som då visar listan).
 */
export type AdminCourseFallback = "forsta" | "enda";

/** Den låsta kursen bland dem användaren får redigera; annars enligt `fallback`. */
export function pickActiveAdminCourse<T extends { slug: string }>(decks: readonly T[], fallback: AdminCourseFallback): T | undefined {
  const locked = decks.find((d) => d.slug === ACTIVE_ADMIN_COURSE_SLUG);
  if (locked) return locked;
  if (fallback === "enda") return decks.length === 1 ? decks[0] : undefined;
  return decks[0];
}
