/** Texten på en rad: radbrytningar (med blanksteg runt) blir ett mellanslag, ändarna trimmas. */
export function oneLine(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, " ").trim();
}
