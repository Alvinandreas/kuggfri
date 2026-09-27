/** Sätter ihop klassnamn och hoppar över tomma och falska värden. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
