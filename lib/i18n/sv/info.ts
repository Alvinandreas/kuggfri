/** Om Kuggfri och integritet. Sätts ihop till sv i lib/i18n/sv.ts. */

export const about = {
  /** Sidtiteln i fliken, som posten i sidomenyn. */
  title: "Om",
  /** Rubriken på sidan, under logotypen. */
  heading: "Om Kuggfri",
  intro:
    "Kuggfri är en fri flashcard-tjänst för kurser på Chalmers. Den är byggd av en student, för studenter, och kostar ingenting.",
  why: "Varför",
  whyBody: "Allt är öppet, gratis och utan spårning.",
  how: "Hur det fungerar",
  howBody:
    "Kort repeteras enligt FSRS, en algoritm för spaced repetition som anpassar intervallen efter hur väl du kunde varje kort. Du kan också plugga fritt, i slumpad ordning eller med duggor, och plugga vidare när dagens pass är klart. Allt du pluggar räknas in i schemat.",
  sources: "Innehåll och källor",
  sourcesBody: "Korten bygger på kursens material. Kreditering per kurs:",
  noSource: "Ingen källa angiven.",
  teachers: "För kursansvariga",
  teachersIntro:
    "Kuggfri är byggt för att en kurs ska kunna använda det utan extra arbete för läraren, men med full insyn och kontroll om man vill ha det.",
  teachersPoints: [
    "Innehållet ägs av kursen. Alla kort kan exporteras när som helst som en vanlig fil, ingen inlåsning.",
    "Studenterna rapporterar fel direkt från kortet. Rapporterna samlas per kurs med länk rakt in i kortet, så granskningen görs där felet finns.",
    "Kursansvarig får en egen examinatorsvy med kursöversikt: svåraste områdena, kluriga frågor, hur långt studenterna kommit och hur många som repeterar varje vecka. Allt är sammanställt och anonymt, och visas först när minst fem studenter skattat.",
    "Examinatorn redigerar kort, områden och ordning själv. Rätten gäller bara den egna kursen.",
    "Redigering sker i webbläsaren med förhandsvisning av formler och formatering. Import från CSV eller JSON visar vad som ändras innan något sparas.",
    "Inga kostnader, ingen reklam, ingen spårning. Studenterna skapar ett konto med namn och e-post; all data lagras inom EU.",
  ],
  teachersOutro:
    "Vill du använda Kuggfri i din kurs, med egen examinatorsvy? Hör av dig till den som driver Kuggfri, se kontaktuppgifterna ovan.",
  privacy: "Integritet",
  privacyBody:
    "Vi sparar bara ditt namn, din e-post och din studieprogress, inget annat. Loggar du in med Google använder vi bara ditt namn och din e-post därifrån. Allt står i integritetspolicyn.",
} as const;

export const privacy = {
  title: "Integritetspolicy",
} as const;
