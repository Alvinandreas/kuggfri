/**
 * Radslut. Filer och utdata från Windows kan ha CRLF; allt som läser rad för rad ska se
 * samma rader oavsett. En ensam \r (gamla Mac-radslut) lämnas orörd.
 */

/** CRLF → LF. */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/** Texten uppdelad i rader, oavsett om radsluten är LF eller CRLF. */
export function lines(text: string): string[] {
  return normalizeNewlines(text).split("\n");
}
