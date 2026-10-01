/**
 * Sökparametrar som Next.js ger sidorna: ett värde, flera värden (?x=1&x=2) eller inget.
 * Ren modul. Alla sidor tolkar parametrarna likadant: det första värdet gäller.
 */

export type SearchParamValue = string | string[] | undefined;
export type SearchParams = Record<string, SearchParamValue>;

/** Första värdet av en parameter, eller undefined om den saknas. */
export function first(v: SearchParamValue): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Påslagen flagga: första värdet är exakt "1". */
export function flag(v: SearchParamValue): boolean {
  return first(v) === "1";
}

/**
 * Positivt heltal (Number.parseInt, bas 10) med tak, eller null när värdet saknas,
 * inte går att tolka eller inte är större än noll.
 */
export function positiveInt(v: SearchParamValue, max: number): number | null {
  const n = Number.parseInt(first(v) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(max, n) : null;
}
