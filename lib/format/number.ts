/** Tal med svensk formatering: mellanslag som tusentalsavgränsare och decimalkomma. */

export { percent, percentText } from "@/lib/text/percent";

const INTEGER = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });

/** Heltal: 1187 blir "1 187". Inget tal ger ett streck. */
export function formatInteger(n: number): string {
  return Number.isFinite(n) ? INTEGER.format(n) : "–";
}

/** Decimaltal med ett bestämt antal decimaler: 3.8 blir "3,80" med två. null ger ett streck. */
export function formatDecimal(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** Poäng med decimalkomma och högst två decimaler: 1.5 → "1,5". */
export function formatPoints(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace(".", ",");
}
