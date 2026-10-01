import type { CourseConfigInput } from "./index";

/** Materialteknik (MTT085), Maskinteknik, Chalmers. Innehållet: content/materialteknik/. */
export const materialteknik: CourseConfigInput = {
  slug: "materialteknik",
  examiner: {
    name: "Johan Ahlström",
    role: "Examinator för Materialteknik: frågor om kursens innehåll",
    email: "johan.ahlstrom@chalmers.se",
  },
  examStart: { hour: 8, minute: 30 },
  sourceHints: {
    // Kursboken (Ashby) och polymerdelens kapitel (05142_…, Osswald) samt formelhäftet.
    bok: [/05142_|osswald|ashby|booklet/i],
    // GLU = föreläsningsserien, "PM 3" och "Polymeric materials" = polymerdelens föreläsningar.
    forelasning: [/(?:^|[^a-zåäö])glu(?:[^a-zåäö]|$)|\bpm \d|polymeric materials/i],
  },
};
