/**
 * Städar text från Brainscape-exporter till giltig markdown.
 * Används av seed-bygget. Admin-importen rör inte texten.
 *
 * - "− " (minustecken) och "– " (tankstreck) i början av rad blir nästlade
 *   punkter under närmast föregående "* "-punkt.
 * - En rad som slutar med kolon och följer direkt på en listpunkt får en tom
 *   rad före sig så att den inte slås ihop med punkten.
 * - Windows-radbrytningar och avslutande blanksteg tas bort.
 */
export function normalizeBrainscapeMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  /** Vilken typ av lista vi befinner oss i: "star" (* eller 1.) nästlar streckrader under sig. */
  let list: "star" | "dash" | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const trimmed = line.trim();

    if (trimmed === "") {
      list = null;
      out.push("");
      continue;
    }

    if (/^\* /.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      list = "star";
      out.push(trimmed);
      continue;
    }

    if (/^[−–-] /.test(trimmed)) {
      const item = trimmed.replace(/^[−–-] /, "");
      if (list === "star") {
        out.push(`  - ${item}`);
      } else {
        out.push(`- ${item}`);
        list = "dash";
      }
      continue;
    }

    if (list !== null && /:$/.test(trimmed) && /^[A-ZÅÄÖ]/.test(trimmed)) {
      out.push("");
      out.push(trimmed);
      list = null;
      continue;
    }

    out.push(trimmed);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Typografiska rättelser godkända av Alvin 2026-09-14. Ändrar aldrig
 * innehållets betydelse, bara hur det skrivs:
 * 1. "=>" blir "→".
 * 2. Kemiska formler får nedsänkta siffror (Fe₃C, CO₂, Al₂O₃, SiO₂, O₂, H₂O).
 * 3. Matte skriven med unicode-kursiv blir KaTeX.
 */
const CHEMICAL_FORMULAS: Record<string, string> = {
  Fe3C: "Fe₃C",
  CO2: "CO₂",
  Al2O3: "Al₂O₃",
  SiO2: "SiO₂",
  Fe2O3: "Fe₂O₃",
  H2O: "H₂O",
  O2: "O₂",
};

const MATH_REPLACEMENTS: [RegExp, string][] = [
  [/𝜎\s*=\s*𝐸\s*𝜀/g, "$\\sigma = E\\,\\varepsilon$"],
  [/𝜀\s*=\s*𝛼\s*∆𝑇/g, "$\\varepsilon = \\alpha\\,\\Delta T$"],
  [/𝜖𝑇\s*=\s*𝛼\s*\(𝑇\s*−\s*𝑇0\)/g, "$\\varepsilon_T = \\alpha\\,(T - T_0)$"],
  [/𝐾1𝑐\s*=\s*𝐸𝐺𝑐/g, "$K_{1c} = E\\,G_c$"],
  [/𝛼(?=\s*=)/g, "$\\alpha$"],
  [/\bK1c\b/g, "$K_{1c}$"],
  [/\bK1\b/g, "$K_1$"],
  [/\bMPa\s?m1\/2\b/g, "$\\text{MPa}\\sqrt{\\text{m}}$"],
];

/**
 * Nyckel för dubblettdetektering i seeden: baksidans första 100 tecken,
 * normaliserade. Kort vars svar börjar likadant räknas som samma kort.
 */
export function duplicateKey(back: string): string {
  return back.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 100);
}

export function applyTypography(text: string): string {
  let out = text.replace(/\s*=>\s*/g, " → ");
  for (const [formula, pretty] of Object.entries(CHEMICAL_FORMULAS)) {
    out = out.replace(new RegExp(`(?<![A-Za-z0-9₀-₉])${formula}(?![A-Za-z0-9₀-₉])`, "g"), pretty);
  }
  for (const [pattern, replacement] of MATH_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
