/**
 * Kontaktuppgifter, på ett ställe: Om, Hjälp och integritetspolicyn läser härifrån så att
 * de aldrig säger olika saker. Alvin driver tjänsten och är personuppgiftsansvarig; varje
 * kurs examinator ansvarar för kursens innehåll och står i kursens konfiguration (lib/courses).
 */
import { ALL_COURSES, type CourseContact } from "@/lib/courses";

/** Sajtens värdnamn så som det skrivs i löptext ("Konto på kuggfri.com", QR-kodens etikett). */
export const SITE_HOST = "kuggfri.com";

export const CONTACTS = {
  operator: {
    name: "Alvin Andreasson",
    role: "Driver Kuggfri: konto, tekniska problem och personuppgifter",
    email: "alvinan@chalmers.se",
  },
} as const;

/** Kursernas examinatorer i kursordning, var och en en gång (samma person kan ha flera kurser). */
export const EXAMINERS: readonly CourseContact[] = ALL_COURSES.flatMap((c) => (c.examiner ? [c.examiner] : [])).filter(
  (c, i, all) => all.findIndex((o) => o.email === c.email) === i,
);
