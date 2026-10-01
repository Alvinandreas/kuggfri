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

/** KaTeX-kommandon som har ett eget tecken. Övriga kommandon visas med sitt namn (\cos -> cos). */
const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", varepsilon: "ε", epsilon: "ε", eta: "η",
  theta: "θ", lambda: "λ", mu: "μ", nu: "ν", pi: "π", rho: "ρ", sigma: "σ", Sigma: "Σ", sum: "Σ", tau: "τ",
  varphi: "φ", phi: "φ", omega: "ω", Omega: "Ω",
  cdot: "×", times: "×", approx: "≈", le: "≤", leq: "≤", ge: "≥", geq: "≥", ll: "≪", gg: "≫", neq: "≠",
  to: "→", rightarrow: "→", propto: "∝", infty: "∞", circ: "°", langle: "⟨", rangle: "⟩", qquad: " ", quad: " ",
};

/** En klammergrupp med högst en nivå inre klamrar, t.ex. {E^{1/2}}. */
const GROUP = String.raw`\{((?:[^{}]|\{[^{}]*\})*)\}`;

/** Tar bort markdown- och KaTeX-syntax ur en kort text. */
export function plainText(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // bilder syns inte i en textrad
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](länk) -> text
    .replace(/\$\$?([^$]*)\$\$?/g, (_, inner: string) => inner) // $E = mc^2$ -> E = mc^2
    .replace(new RegExp(String.raw`\\d?frac${GROUP}${GROUP}`, "g"), "$1/$2") // \frac{a}{b} -> a/b
    .replace(/\\(?:bar|overline)\{([^{}]*)\}/g, (_, x: string) => [...x].map((c) => `${c}̄`).join("")) // \bar{1} -> 1 med streck
    .replace(/\\[!,;:]/g, (m) => (m === "\\!" ? "" : " ")) // KaTeX-mellanrum: \, -> blanksteg, \! -> inget
    .replace(/\\([{}])/g, (_, b: string) => (b === "{" ? "\u0000" : "\u0001")) // \{100\} ska behålla klamrarna
    .replace(/\\(?:sqrt|text|mathrm|mathbf|left|right|dot|d?frac)\b/g, (m) => (m === "\\sqrt" ? "√" : ""))
    .replace(/\\([a-zA-Z]+)/g, (_, name: string) => SYMBOLS[name] ?? name) // \sigma -> σ, \cos -> cos
    .replace(/[{}]/g, "")
    .replace(/\u0000/g, "{")
    .replace(/\u0001/g, "}")
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
