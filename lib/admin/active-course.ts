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
 * i `lib/admin/nav.ts` och `app/(app)/admin/page.tsx`, som är de enda som läser konstanten.
 */
export const ACTIVE_ADMIN_COURSE_SLUG = "materialteknik";

/** Den låsta kursen bland dem användaren får redigera; annars den första (en examinator för en annan kurs). */
export function pickActiveAdminCourse<T extends { slug: string }>(decks: readonly T[]): T | undefined {
  return decks.find((d) => d.slug === ACTIVE_ADMIN_COURSE_SLUG) ?? decks[0];
}
