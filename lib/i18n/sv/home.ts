/** Startsidan, landningssidan, inbjudningar och översikten på hemsidan. Sätts ihop till sv i lib/i18n/sv.ts. */

export const home = {
  title: "Kurser",
  lead: "Alla kurser är gratis. Välj en för att se korten och börja plugga.",
  empty: "Det finns inga publicerade kurser ännu.",
  cards: (n: number) => (n === 1 ? "1 kort" : `${n} kort`),
  courseCode: "Kurskod",
} as const;

export const landing = {
  title: "Plugga smartare inför tentan.",
  lead: "Kuggfri visar rätt kort på rätt dag, så att det du lär dig sitter kvar till tentan. Gratis och utan reklam.",
  points: [
    { title: "Repetition i rätt tid", body: "Schemat lär sig vad du kan och tar fram det du håller på att glömma." },
    { title: "Granskat av examinatorerna", body: "Korten bygger på kursens eget material, med källa på varje kort, och granskas av kursens examinatorer." },
    { title: "Se hur du ligger till", body: "Inlärd kunskap per område och nedräkning till tentadagen." },
  ],
  formLabel: "Konto",
  tabRegister: "Skapa konto",
  tabLogin: "Logga in",
  registerTitle: "Skapa ditt konto",
  registerLead: "Det tar en halv minut.",
  loginTitle: "Välkommen tillbaka",
  loginLead: "Logga in för att fortsätta plugga.",
  nextHint: "Logga in eller skapa ett konto för att öppna kursen.",
} as const;

export const invite = {
  eyebrow: "Du är inbjuden till en kurs på Kuggfri",
  lead: "Skapa ett konto på en halv minut, så öppnas kursen direkt. Gratis, utan reklam, och schemat visar rätt kort på rätt dag fram till tentan.",
} as const;

export const dashboard = {
  title: "Hem",
  greeting: (hour: number, name: string) => {
    const who = name ? `, ${name}` : "";
    if (hour >= 5 && hour < 10) return `God morgon${who}`;
    if (hour >= 18 || hour < 5) return `God kväll${who}`;
    return `Hej${who}`;
  },
  leadDue: (n: number) => (n === 1 ? "Ett kort väntar på dig i dag." : `${n} kort väntar på dig i dag.`),
  leadDone: "Du är klar för i dag. Snyggt jobbat!",
  leadStart: "Välj en kurs för att komma igång.",
  leadFirst: (n: number) => `Ditt första pass är redo: ${n} kort, några minuter. Skatta ärligt, så lär sig schemat vad du kan.`,
  streak: (n: number) => (n === 1 ? "1 dag i rad" : `${n} dagar i rad`),
  streakLabel: "Streak",
  today: "Dagens pass",
  todayPlan: (due: number, fresh: number) =>
    [due > 0 ? `${due} att repetera` : null, fresh > 0 ? `${fresh} nya` : null].filter(Boolean).join(", "),
  continue: "Fortsätt plugga",
  startFirst: "Börja plugga",
  doneTitle: "Klart för i dag",
  doneBody: "Schemat har nya kort åt dig i morgon. Vill du fortsätta nu kan du plugga vidare, det räknas också.",
  moreNew: (n: number) => `Ta ${n} nya kort till`,
  extra: "Plugga vidare",
  knowledge: "Inlärd kunskap",
  knowledgeHelp: "Andel av kursens kort du kan just nu enligt schemat.",
  examCountdown: "Tid kvar till tentan",
  examPast: "Tentan har varit",
  openCourse: "Till kursen",
  avg7: "Snittskattning",
  avg7Sub: "av 5, senaste veckan",
  avg7None: "inget senaste veckan",
  moreCourses: "Fler kurser",
  allCourses: "Alla kurser",
  cardsLeft: (n: number) => `${n} kvar i dag`,
  notStarted: "Inte påbörjad",
  loading: "Laddar din progress…",
} as const;
