/**
 * Tal med svensk formatering (mellanslag som tusentalsavgränsare och decimalkomma), eller i ett
 * annat språk om locale anges (ordlistans `meta.locale`, en-GB för den som slagit på English).
 */

export { percent, percentText } from "@/lib/text/percent";

/** Heltal: 1187 blir "1 187" (en-GB: "1,187"). Inget tal ger ett streck. */
export function formatInteger(n: number, locale = "sv-SE"): string {
  return Number.isFinite(n) ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n) : "–";
}

/** Decimaltal med ett bestämt antal decimaler: 3.8 blir "3,80" med två (en-GB: "3.80"). null ger ett streck. */
export function formatDecimal(n: number | null | undefined, digits = 1, locale = "sv-SE"): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** Poäng med högst två decimaler: 1.5 → "1,5" (en-GB: "1.5"). */
export function formatPoints(n: number, locale = "sv-SE"): string {
  const text = (Math.round(n * 100) / 100).toString();
  return locale.startsWith("sv") ? text.replace(".", ",") : text;
}
