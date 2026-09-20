/**
 * Andelar i procent. Samlat på ett ställe eftersom division med noll annars ger
 * NaN i en stapelbredd eller "NaN %" i en siffra, och varje anropsplats hade
 * sin egen variant av skyddet.
 */

/** Avrundad andel 0–100. Tom nämnare ger 0: ingen stapel att rita. */
export function percent(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/**
 * Andelen som text, "42 %". Tom nämnare ger ett tankstreck: vi vet inte, till
 * skillnad från "0 %" som påstår att andelen faktiskt är noll.
 */
export function percentText(part: number, whole: number, empty = "–"): string {
  if (!Number.isFinite(whole) || whole <= 0) return empty;
  return `${percent(part, whole)} %`;
}
