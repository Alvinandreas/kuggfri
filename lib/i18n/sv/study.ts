/** Passet: korten, uppgiftstyperna, automaträttade frågor, sammanfattningen, felrapporter, snabbpassen och duggan. Sätts ihop till sv i lib/i18n/sv.ts. */

export const study = {
  /** Flikens titel under passet. */
  pageTitle: (deck: string) => `Plugga ${deck}`,
  front: "Framsida",
  back: "Baksida",
  flip: "Vänd kortet",
  showHint: "Visa ledtråd",
  hint: "Ledtråd",
  rateLabel: "Hur väl kunde du det här?",
  rate: {
    1: "Inte alls",
    2: "Nästan",
    3: "Delvis",
    4: "Bra",
    5: "Klockrent",
  } as Record<1 | 2 | 3 | 4 | 5, string>,
  finalReviewBanner: (days: number) =>
    days === 0 ? "Tentan är i dag: slutrepetition av alla kort, svagast först." : days === 1 ? "Tentan är i morgon: slutrepetition av alla kort, svagast först." : `Tentan om ${days} dagar: slutrepetition av alla kort, svagast först.`,
  catchUpBanner: (perDay: number) => `För att hinna alla kort före tentan visas ${perDay} nya kort per dag den här perioden.`,
  extraBanner: "Plugga vidare: först kort som snart ska repeteras, sedan nya kort. Allt räknas in i schemat.",
  previous: "Föregående",
  next: "Nästa",
  skip: "Hoppa över",
  remaining: (n: number) => (n === 1 ? "1 kort kvar" : `${n} kort kvar`),
  position: (i: number, total: number) => `Kort ${i} av ${total}`,
  cardAnnounce: (i: number, total: number) => `Kort ${i} av ${total}. Framsidan visas.`,
  flippedAnnounce: "Baksidan visas.",
  ratedAnnounce: (r: number) => `Skattat ${r} av 5.`,
  stamp: (r: number) => `${r}`,
  empty: "Det finns inga kort att visa i det här läget just nu.",
  emptyFsrs:
    "Inga kort är förfallna just nu. Vill du fortsätta kan du välja Plugga vidare på kursens sida, det räknas också.",
  emptyTricky: "Det finns inga kluriga kort i urvalet. Bra jobbat.",
  backToDeck: "Tillbaka till kursen",
  loading: "Laddar…",
  saveError: "Kunde inte spara skattningen. Kontrollera anslutningen.",
  queued: (n: number) => (n === 1 ? "1 skattning väntar på anslutning och skickas automatiskt." : `${n} skattningar väntar på anslutning och skickas automatiskt.`),
  examProgress: (i: number, total: number) => `Fråga ${i} av ${total}`,
} as const;

/**
 * Uppgiftstyperna (lib/cards/kinds.ts). Samma logik på båda ställena: label är typens namn i
 * admin och innehållsverktyget, instruction är samma typ som uppmaning till studenten överst
 * på kortet (fram och bak). Alternativkort med flera rätta svar får instructionMulti.
 */
export const cardKind = {
  label: {
    sjalvskattning: "Självskattning",
    begrepp: "Begrepp",
    "sant-falskt": "Sant/Falskt",
    alternativ: "Alternativ",
  } as Record<"sjalvskattning" | "begrepp" | "sant-falskt" | "alternativ", string>,
  instruction: {
    sjalvskattning: "Självskattning",
    begrepp: "Förklara begreppet",
    "sant-falskt": "Sant eller falskt",
    alternativ: "Välj rätt alternativ",
  } as Record<"sjalvskattning" | "begrepp" | "sant-falskt" | "alternativ", string>,
  instructionMulti: "Välj alla rätta alternativ",
  description: {
    sjalvskattning: "Fråga och svar. Du vänder kortet och skattar hur väl du kunde det.",
    begrepp: "Ett begrepp som ska förklaras. Du vänder kortet och skattar dig själv.",
    "sant-falskt": "Ett påstående som är sant eller falskt. Rättas automatiskt.",
    alternativ: "Välj rätt svar bland alternativen, som på tentan. Ett eller flera kan vara rätt. Rättas automatiskt.",
  } as Record<"sjalvskattning" | "begrepp" | "sant-falskt" | "alternativ", string>,
} as const;

/** Automaträttade uppgiftstyper (Sant/Falskt, Alternativ) i passet. */
export const quiz = {
  pickOne: "Välj ett alternativ",
  pickMany: (n: number) => `Välj ${n} alternativ`,
  submit: "Svara",
  continue: "Fortsätt",
  correct: "Rätt",
  wrong: "Inte riktigt",
  correctDetail: (rating: number) =>
    rating >= 5 ? "Rätt tre gånger i rad. Den här sitter." : rating === 4 ? "Rätt igen. En gång till så sitter den." : "Rätt. Frågan kommer tillbaka för att befästa den.",
  wrongDetail: "Frågan kommer tillbaka snart, så att du får öva på den igen.",
  chosenWrong: "Ditt svar",
  rightAnswer: "Rätt svar",
  missed: "Missat rätt alternativ",
  explanation: "Förklaring",
  answeredAnnounce: (correct: boolean) => (correct ? "Rätt svar." : "Fel svar. Rätt svar markerat."),
  keyboardHelp: "1–9 väljer, Enter svarar och fortsätter, → hoppar över",
  optionLabel: (i: number) => String.fromCharCode(65 + i),
} as const;

export const summary = {
  title: "Passet är klart",
  examTitle: "Duggan är klar",
  examScore: (ok: number, total: number) => `Du kunde ${ok} av ${total} kort bra eller direkt.`,
  examNote: "Svaren räknas in i schemat, precis som i de andra lägena. Det som tog emot kommer tillbaka snart.",
  doneTitle: "Klar för i dag",
  doneBody: "Dagens kort är repeterade och schemat har koll på resten. Har du mer energi kan du plugga vidare.",
  extraTitle: "Snyggt, extra pass klart",
  extraBody: "Allt du pluggade nu räknas in i schemat och gör de kommande passen lättare.",
  extraHeading: "Plugga vidare",
  extraOffer: (n: number) =>
    `${n === 1 ? "1 kort" : `${n} kort`} till: först de som snart ska repeteras, sedan nya kort utöver dagsmålet. Varje skattning räknas in i schemat, så extra plugg är aldrig bortkastat.`,
  extraButton: "Plugga vidare",
  tileToday: "Repetitioner i dag",
  tileTodaySub: (n: number) => (n === 1 ? "1 i det här passet" : `${n} i det här passet`),
  tileStreak: "Dagar i rad",
  tileKnown: "Kort du kan just nu",
  tileKnownHelp: "Uppskattat ur schemat: summan av sannolikheten att du minns varje kort just nu.",
  freezesLeft: (n: number) => (n === 1 ? "1 frysning kvar" : `${n} frysningar kvar`),
  freezeUsed: "En frysning täckte en missad dag.",
  continuePass: (n: number) => `Kör ${n} kort till`,
  continueNew: (n: number) => (n === 1 ? "Ta 1 nytt kort till" : `Ta ${n} nya kort till`),
  continueHelp: "Utöver dagsmålet. Bra om du har tid över, inte nödvändigt.",
  reviewed: (n: number) => (n === 1 ? "1 kort genomgånget" : `${n} kort genomgångna`),
  distribution: "Fördelning av skattningar",
  needsWork: "Behöver mest arbete",
  colQuestion: "Fråga",
  colRating: "Skattning",
  needsWorkEmpty: "Inga kort fick låg skattning.",
  nextDue: "Nästa schemalagda repetition",
  nextDueNone: "Inget kort är schemalagt ännu.",
  nextDueCount: (n: number, when: string) => (n === 1 ? `1 kort ${when}.` : `${n} kort ${when}.`),
  freeModeNote: "Fri repetition räknas in i schemat, precis som schemalagd repetition.",
  randomModeNote: "Slumpad genomkörning räknas in i schemat, precis som schemalagd repetition.",
  trickyModeNote: "Skattningarna räknas in i schemat. Kort du nu kan slutar räknas som kluriga.",
  backToDeck: "Tillbaka till kursen",
  home: "Till hem",
  again: "Ett pass till",
  againExam: "Ny dugga",
} as const;

export const session = {
  toolbar: "Verktyg för passet",
  info: "Så funkar det",
  soundOn: "Stäng av ljudet",
  soundOff: "Slå på ljudet",
  star: "Stjärnmärk kortet",
  unstar: "Ta bort stjärnan",
  report: "Rapportera fel på kortet",
  helpTitle: "Så pluggar du i Kuggfri",
  helpFlipTitle: "Vänd kortet",
  helpFlip: "Försök svara i huvudet först. Vänd sedan kortet genom att klicka på det, trycka på Vänd kortet eller mellanslag.",
  helpRateTitle: "Skatta hur väl du kunde svaret",
  helpRate: "Skatta ärligt direkt efter att du vänt kortet. Det är skattningen som bestämmer när kortet kommer tillbaka.",
  rateMeaning: {
    1: "Du kunde inte svaret. Kortet kommer tillbaka snart.",
    2: "Nära, men inte rätt. Kortet kommer tillbaka snart.",
    3: "Rätt, men det tog emot. Kortet kommer tillbaka ganska snart.",
    4: "Rätt utan större problem.",
    5: "Direkt och säkert. Kortet dröjer längst innan det kommer tillbaka.",
  } as Record<1 | 2 | 3 | 4 | 5, string>,
  helpKeysTitle: "Tangentbordet",
  keys: [
    ["Mellanslag", "Vänd kortet"],
    ["1–5", "Skatta kortet"],
    ["← →", "Föregående och nästa kort"],
    ["H", "Visa ledtråd"],
    ["1–9", "Välj svar på en flervalsfråga"],
    ["Enter", "Svara och gå vidare"],
  ] as ReadonlyArray<readonly [string, string]>,
  helpButtonsTitle: "Knapparna",
  helpStar: "Stjärnan markerar kort du vill återkomma till. Välj läget Stjärnmärkta på kurssidan för att plugga bara dem.",
  helpSound: "Högtalaren slår av och på ljudet när du skattar ett kort.",
  helpReport: "Flaggan skickar en felrapport om kortet till kursens examinator.",
  helpSwipe: "På mobilen kan du också svepa: vänster skattar 1, höger skattar 5.",
  helpSchedule: "Läs mer om schemat, lägena och duggan under Hjälp.",
  starredTitle: "Dina stjärnmärkta kort",
  starredShow: (n: number) => (n === 1 ? "Visa ditt stjärnmärkta kort" : `Visa dina ${n} stjärnmärkta kort`),
  starredEmpty: "Du har inte stjärnmärkt några kort än. Tryck på stjärnan uppe till höger på ett kort under passet.",
  starredHelp: "Tryck på stjärnan för att ta bort ett kort ur listan.",
} as const;

export const report = {
  title: "Rapportera fel på kortet",
  help: "Beskriv vad som är fel eller otydligt. Rapporten går till kursens examinator.",
  message: "Vad är fel?",
  contact: "E-post om du vill ha svar (valfritt)",
  send: "Skicka rapport",
  sent: "Tack! Rapporten är skickad.",
  tooShort: "Skriv några ord om vad som är fel.",
  tooLong: "Rapporten är för lång (max 1000 tecken).",
  rateLimited: "För många rapporter på kort tid. Försök igen om en stund.",
} as const;

// Dialogerna bakom genvägarna Kluriga kort och Dugga på hemsidan.
export const quick = {
  trickyLead: "Korten du skattat 1–2, och kort du inte sett än. Svagast först. Skattningen räknas in i schemat.",
  weak: "Skattade 1–2",
  unseen: "Inte sedda än",
  time: "Tid",
  minutes: (n: number) => `${n} min`,
  about: "ungefär",
  cardsOf: (n: number, total: number) => `${n} av ${total}`,
  areas: "Områden",
  areasHelp: "Bocka ur det du inte vill ta nu.",
  areaCount: (weak: number, unseen: number) =>
    weak + unseen === 0
      ? "Inga kluriga"
      : [weak > 0 ? `${weak} ${weak === 1 ? "skattat" : "skattade"} 1–2` : "", unseen > 0 ? `${unseen} osedda` : ""].filter(Boolean).join(", "),
  selectAll: "Välj alla",
  trickyStart: "Starta kluriga kort",
  startMeta: (n: number, minutes: number) => `${n === 1 ? "1 kort" : `${n} kort`}, cirka ${minutes} min`,
  trickyNone: "Välj minst ett område med kluriga kort.",
  duggaLead: "Slumpade frågor ur hela kursen, en i taget och utan att gå tillbaka. Du skattar dig själv som vanligt, och svaren räknas in i schemat.",
  duggaStartMeta: (n: number, minutes: number, hints: boolean) =>
    `${n === 1 ? "1 fråga" : `${n} frågor`}, cirka ${minutes} min, ${hints ? "med ledtrådar" : "utan ledtrådar"}`,
  onCoursePage: "Fler val på kurssidan",
} as const;

/** Inställningar under Ditt pass på kurssidan: olika för varje läge, styr passet. */
export const passSettings = {
  size: "Antal kort",
  sizeToday: (n: number) => `Dagens (${n})`,
  sizeAll: (n: number) => `Alla (${n})`,
  sizeTodayHelp: "Förfallna kort kommer först. Tar du färre väntar resten till nästa pass.",
  newCards: "Nya kort i dag",
  newCardsHelp: "Följ dagens dos av nya kort. Av: bara repetitioner.",
  byArea: "Ett område i taget",
  byAreaHelp: "Ta korten område för område i stället för blandat.",
  hardestFirst: "Svåraste först",
  hardestFirstHelp: "Kort du skattat 1 kommer först. Av: slumpad ordning.",
  unseen: "Ta med osedda kort",
  unseenHelp: "Kort du aldrig skattat räknas som kluriga. Av: bara kort du skattat 1 eller 2.",
  order: "Ordning",
  orderHelp: "Svagast först, i kursens ordning eller slumpat.",
  orderStandard: "Svagast",
  orderCourse: "Kursordning",
  orderRandom: "Slumpad",
  kinds: "Uppgiftstyper",
  kindsHelp: "Vändkort skattar du själv. Flerval (sant eller falskt och alternativ) rättas direkt.",
  kindsAll: "Alla",
  kindsFlip: "Vändkort",
  kindsQuiz: "Flerval",
  followAreas: "Bara valda områden",
  followAreasHelp: "Av: hela kursen, oavsett vilka områden som är ikryssade.",
} as const;

export const dugga = {
  settingsTitle: "Inställningar",
  questions: "Antal frågor",
  hints: "Tillåt ledtrådar",
  hintsHelp: "Visa ledtråden när kortet har en.",
  timer: "Tidtagning",
  timerHelp: "Visa hur lång tid duggan tar.",
  start: "Starta duggan",
  badge: "Dugga",
  elapsed: "Tid",
  duration: (text: string) => `Tid: ${text}`,
  homeMeta: "Välj antal frågor och regler",
  areaMeta: "Bara det här området, dina regler",
} as const;
