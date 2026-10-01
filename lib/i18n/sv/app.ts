/** Gemensamt för hela tjänsten: appens namn, menyer, sidfot, tema, vanliga knappar, tider och felsidor. Sätts ihop till sv i lib/i18n/sv.ts. */

export const app = {
  name: "Kuggfri",
  tagline: "Flashcards för Chalmersstudenter.",
  skipToContent: "Hoppa till innehållet",
} as const;

export const nav = {
  menu: "Meny",
} as const;

export const shell = {
  mainNav: "Huvudmeny",
  sectionStudy: "Plugga",
  sectionAdmin: "Administrera",
  home: "Hem",
  courses: "Kurser",
  /** Kursens sida (lägen, områden, starta pass) när det bara finns en kurs. */
  coursePage: "Kurssidan",
  examMode: "Tentaläget",
  examModeLocked: "Tentaläget, låst",
  /** Genvägen till adminstartsidan med alla kurser (och Ny kurs för admin). */
  allCourses: "Alla kurser",
  designSystem: "Designsystem",
  /** Räknarna på adminflikarnas genvägar, i tooltip och skärmläsartext. */
  pendingDrafts: (n: number) => (n === 1 ? "1 kort att granska" : `${n} kort att granska`),
  openReports: (n: number) => (n === 1 ? "1 öppen felrapport" : `${n} öppna felrapporter`),
  myStats: "Min statistik",
  infoNav: "Hjälp och information",
  help: "Hjälp",
  collapse: "Fäll ihop sidomenyn",
  expand: "Fäll ut sidomenyn",
  openMenu: "Öppna menyn",
  closeMenu: "Stäng menyn",
  profileMenu: "Profilmeny",
  account: "Konto och inställningar",
  theme: "Tema",
  privacy: "Integritet",
  about: "Om",
  logout: "Logga ut",
} as const;

export const footer = {
  privacy: "Integritetspolicy",
  about: "Om Kuggfri",
} as const;

export const theme = {
  label: "Färgtema",
  system: "Följ systemet",
  light: "Ljust",
  dark: "Mörkt",
} as const;

export const common = {
  cancel: "Avbryt",
  confirm: "Bekräfta",
  close: "Stäng",
  save: "Spara",
  delete: "Ta bort",
  back: "Tillbaka",
  loading: "Laddar…",
  notFound: "Sidan finns inte.",
  forbiddenTitle: "Åtkomst nekad",
  forbiddenBody: "Du har inte behörighet till den här sidan.",
  toHome: "Till startsidan",
  required: "Obligatoriskt",
} as const;

export const time = {
  now: "nu",
  today: "i dag",
  tomorrow: "i morgon",
  inDays: (n: number) => `om ${n} dagar`,
  inMonths: (n: number) => (n === 1 ? "om en månad" : `om ${n} månader`),
  overdue: "förfallet",
} as const;

export const errors = {
  generic: "Något gick fel. Försök igen.",
  pageTitle: "Något gick fel",
  pageBody: "Ett oväntat fel uppstod. Försök igen, eller gå till startsidan.",
  retry: "Försök igen",
} as const;
