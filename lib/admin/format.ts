/** Tal i adminvyerna med svensk formatering: mellanslag som tusentalsavgränsare och decimalkomma. */
const INT = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });

/** Heltal: 1187 blir "1 187". */
export function formatCount(n: number): string {
  return Number.isFinite(n) ? INT.format(n) : "–";
}

/** Decimaltal med ett bestämt antal decimaler: 3.8 blir "3,80" med två. null ger ett streck. */
export function formatDecimal(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}
