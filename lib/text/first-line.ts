/**
 * Första icke-tomma raden i en markdowntext som läsbar klartext: rubrik-/listtecken, fetstil,
 * kodmarkeringar och KaTeX-syntax ($…$, \kommandon, { }, ^, _) tas bort. Används som kortets
 * "rubrik" i listor och tabeller där vi inte renderar markdown.
 */
export function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? text;
  return plainText(line.replace(/^[#*\-\s]+/, ""));
}

/** Tar bort markdown- och KaTeX-syntax ur en kort text. */
export function plainText(s: string): string {
  return s
    .replace(/\$\$?([^$]*)\$\$?/g, (_, inner: string) => inner) // $E = mc^2$ -> E = mc^2
    .replace(/\\(?:frac|sqrt|text|mathrm|mathbf|left|right|cdot|times)\b/g, (m) => (m === "\\cdot" ? "·" : m === "\\times" ? "×" : ""))
    .replace(/\\([a-zA-Z]+)/g, "$1") // \sigma -> sigma
    .replace(/[{}]/g, "")
    .replace(/\^|_(?=\S)/g, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
