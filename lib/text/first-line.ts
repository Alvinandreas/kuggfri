/**
 * Första icke-tomma raden i en markdowntext som läsbar klartext: rubrik-/listtecken, fetstil,
 * kodmarkeringar och KaTeX-syntax ($…$, \kommandon, { }, ^, _) tas bort. Används som kortets
 * "rubrik" överallt där vi inte renderar markdown: i listor och tabeller i appen, i planen
 * från innehållspipelinen och i mejlen till examinatorn.
 *
 * En enda definition med ett valfritt längdtak, så att samma kort heter samma sak i alla tre.
 */
export function firstLine(text: string, options: { maxLength?: number } = {}): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? text;
  const clean = plainText(line.replace(/^[#*\-\s]+/, ""));
  const max = options.maxLength;
  return max !== undefined && clean.length > max ? clean.slice(0, max).trimEnd() : clean;
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

/**
 * Normaliserad text för att para ihop kort som saknar nyckel med rader i databasen.
 * Används både av adminimportens diff och av innehållspipelinens adoption; skulle de två
 * glida isär skulle samma kort kunna matchas olika på de två vägarna in i databasen.
 */
export function matchKey(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
