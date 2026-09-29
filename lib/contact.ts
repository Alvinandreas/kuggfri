/**
 * Kontaktuppgifter, på ett ställe: Om, Hjälp och integritetspolicyn läser härifrån så att
 * de aldrig säger olika saker. Alvin driver tjänsten och är personuppgiftsansvarig; Johan
 * är examinator för Materialteknik och ansvarar för kursens innehåll.
 */
export const CONTACTS = {
  operator: {
    name: "Alvin Andreasson",
    role: "Driver Kuggfri: konto, tekniska problem och personuppgifter",
    email: "alvinan@chalmers.se",
  },
  examiner: {
    name: "Johan Ahlström",
    role: "Examinator för Materialteknik: frågor om kursens innehåll",
    email: "johan.ahlstrom@chalmers.se",
  },
} as const;
