/** Första icke-tomma raden i en markdowntext, utan inledande rubrik-/listtecken. Används som kortets "rubrik" i listor. */
export function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? text;
  return line.replace(/^[#*\-\s]+/, "").trim();
}
