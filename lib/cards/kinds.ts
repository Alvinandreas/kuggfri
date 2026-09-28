/**
 * Uppgiftstyper. Ren modul utan beroenden, delas av innehållspipelinen, admin och studievyerna.
 *
 * Terminologi: ett kort hör till ett OMRÅDE (kursens ämnesindelning, tabellen categories) och
 * har en UPPGIFTSTYP (det här). Typen avgör hur kortet visas och rättas, området avgör var
 * kunskapen räknas (radarn, "Kan nu" per område).
 */
import type { SelfRating } from "@/lib/progress/types";

export const CARD_KINDS = ["sjalvskattning", "begrepp", "sant-falskt", "alternativ"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const DEFAULT_CARD_KIND: CardKind = "sjalvskattning";

export type CardOption = { text: string; correct: boolean };

export const REVIEW_STATUSES = ["utkast", "avvisad"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const CARD_KIND_LABEL: Record<CardKind, string> = {
  sjalvskattning: "Självskattning",
  begrepp: "Begrepp",
  "sant-falskt": "Sant/Falskt",
  alternativ: "Alternativ",
};

export const CARD_KIND_DESCRIPTION: Record<CardKind, string> = {
  sjalvskattning: "Fråga och svar. Du vänder kortet och skattar hur väl du kunde det.",
  begrepp: "Ett begrepp som ska förklaras. Du vänder kortet och skattar dig själv.",
  "sant-falskt": "Ett påstående som är sant eller falskt. Rättas automatiskt.",
  alternativ: "Välj rätt svar bland alternativen, som på tentan. Rättas automatiskt.",
};

export function isCardKind(value: unknown): value is CardKind {
  return typeof value === "string" && (CARD_KINDS as readonly string[]).includes(value);
}

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && (REVIEW_STATUSES as readonly string[]).includes(value);
}

/** Rättas kortet automatiskt (svarsalternativ) i stället för med självskattning? */
export function isAutoGraded(kind: CardKind): boolean {
  return kind === "sant-falskt" || kind === "alternativ";
}

/** Sant/Falskt lagras som två fasta alternativ, så att båda automaträttade typerna delar logik. */
export function trueFalseOptions(answer: boolean): CardOption[] {
  return [
    { text: "Sant", correct: answer },
    { text: "Falskt", correct: !answer },
  ];
}

/** Svaret på ett Sant/Falskt-kort, eller null om alternativen inte har den formen. */
export function trueFalseAnswer(options: readonly CardOption[] | null): boolean | null {
  if (!options || options.length !== 2) return null;
  const sant = options.find((o) => o.text === "Sant");
  const falskt = options.find((o) => o.text === "Falskt");
  if (!sant || !falskt || sant.correct === falskt.correct) return null;
  return sant.correct;
}

/** Tolkar ett jsonb-värde från databasen. Okänd form ger null. */
export function parseOptions(value: unknown): CardOption[] | null {
  if (!Array.isArray(value)) return null;
  const out: CardOption[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { text, correct } = item as { text?: unknown; correct?: unknown };
    if (typeof text !== "string" || typeof correct !== "boolean") return null;
    out.push({ text, correct });
  }
  return out;
}

/** Problem med ett korts typ och alternativ, som meningar. Tom lista = giltigt. */
export function validateKind(kind: CardKind, options: readonly CardOption[] | null): string[] {
  const issues: string[] = [];
  if (!isAutoGraded(kind)) {
    if (options && options.length > 0) issues.push(`Typen ${CARD_KIND_LABEL[kind]} har inga svarsalternativ.`);
    return issues;
  }
  if (!options || options.length < 2) {
    issues.push(kind === "sant-falskt" ? "Sant/Falskt-kortet saknar svar (svar: sant eller svar: falskt)." : "Alternativfrågan behöver minst två alternativ.");
    return issues;
  }
  if (kind === "sant-falskt" && trueFalseAnswer(options) === null) issues.push("Sant/Falskt-kortet ska ha exakt alternativen Sant och Falskt.");
  if (!options.some((o) => o.correct)) issues.push("Minst ett alternativ måste vara rätt.");
  if (options.some((o) => !o.text.trim())) issues.push("Ett alternativ är tomt.");
  const seen = new Set<string>();
  for (const o of options) {
    const k = o.text.trim().toLowerCase();
    if (seen.has(k)) issues.push(`Alternativet ”${o.text}” finns två gånger.`);
    seen.add(k);
  }
  return issues;
}

/** Är svaret rätt? Med flera rätta alternativ måste exakt de rätta vara valda. */
export function isCorrectAnswer(options: readonly CardOption[], chosen: readonly number[]): boolean {
  const picked = new Set(chosen);
  return options.every((o, i) => o.correct === picked.has(i));
}

/**
 * Skattningen ett automaträttat svar ger (Alvins modell, 28 sep): rätt första gången = 3,
 * rätt igen = 4, rätt en tredje gång i rad = 5. Fel = 1 och räknaren börjar om.
 *
 * Kortets senaste skattning fungerar som räknare, så ingen extra kolumn behövs: efter ett
 * rätt svar är den 3, 4 eller 5, och ett fel nollställer den till 1.
 */
export function autoRating(correct: boolean, previous: SelfRating | null | undefined): SelfRating {
  if (!correct) return 1;
  if (previous === 3) return 4;
  if (previous === 4 || previous === 5) return 5;
  return 3;
}
