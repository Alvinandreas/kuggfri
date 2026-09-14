/**
 * Innehållsgranskning: listar kort i seed/ som kan behöva en handpåläggning.
 * Ändrar ingenting. Skriver docs/INNEHALL-GRANSKNING.md.
 *
 * Körs med: npx tsx scripts/content-review.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseImportCsv } from "../lib/import/parse-import";
import { applyTypography, duplicateKey, normalizeBrainscapeMarkdown } from "../lib/import/normalize";

type Finding = { category: string; front: string; reasons: string[]; excerpt: string };

const UNICODE_MATH = /[\u{1D400}-\u{1D7FF}]|[𝜎𝜀𝛼∆αβγσε]/u;

function firstLine(s: string): string {
  return (s.split("\n").find((l) => l.trim()) ?? s).trim();
}

function review(front: string, back: string): string[] {
  const reasons: string[] = [];
  if (UNICODE_MATH.test(back) || UNICODE_MATH.test(front)) reasons.push("unicode-matte (kan bli KaTeX)");
  if (/=>/.test(back)) reasons.push("pil \"=>\" (kan bli →)");
  if (/^[−–] /m.test(back)) reasons.push("lös strecklista kvar");
  if (back.length > 1200) reasons.push(`lång baksida (${back.length} tecken)`);
  if (/\n[a-zåäö]/.test(back) && !/^\s*[-*]/m.test(back)) reasons.push("radbrytning mitt i mening utan lista");
  if (/^Repetition:/i.test(front)) reasons.push("dubblett-markering i framsidan");
  if (/\(\s*$/m.test(back) || /^\s*\)/m.test(back)) reasons.push("parentes delad över rader");
  if (/[A-Za-z]\d(?![\d.,])/.test(back) && /Fe3C|CO2|Al2O3|SiO2|H2O/.test(back)) reasons.push("kemisk formel utan nedsänkt text (Fe3C, CO2 …)");
  return reasons;
}

const root = process.cwd();
const dir = join(root, "seed", "materialteknik");
const manifest = JSON.parse(readFileSync(join(dir, "deck.json"), "utf8")) as { categories: { file: string; title: string }[] };

const findings: Finding[] = [];
const seenBacks = new Set<string>();
let total = 0;
for (const cat of manifest.categories) {
  const parsed = parseImportCsv(readFileSync(join(dir, cat.file), "utf8"));
  for (const card of parsed.cards) {
    const front = applyTypography(normalizeBrainscapeMarkdown(card.front));
    const back = applyTypography(normalizeBrainscapeMarkdown(card.back));
    // Samma dubblettregel som seed-bygget.
    const key = duplicateKey(back);
    if (seenBacks.has(key)) continue;
    seenBacks.add(key);
    total++;
    const reasons = review(front, back);
    if (reasons.length > 0) {
      findings.push({ category: cat.title, front: firstLine(front), reasons, excerpt: back.slice(0, 160).replace(/\n/g, " ⏎ ") });
    }
  }
}

const byReason = new Map<string, number>();
for (const f of findings) for (const r of f.reasons) byReason.set(r, (byReason.get(r) ?? 0) + 1);

const out: string[] = [
  "# Innehållsgranskning – Materialteknik",
  "",
  `Genererad ${new Date().toISOString().slice(0, 10)} av \`scripts/content-review.ts\`. ${findings.length} av ${total} kort har minst en anmärkning.`,
  "",
  "Inget här är ändrat. Alvin bockar i det som ska åtgärdas; Claude gör sedan bara formateringsändringar (aldrig innehåll).",
  "",
  "## Sammanfattning per typ",
  "",
  ...[...byReason.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `- ${r}: ${n} kort`),
  "",
  "## Generella åtgärder (godkända av Alvin 2026-09-14, gjorda i `lib/import/normalize.ts`)",
  "",
  "- [x] \"=>\" är utbytt mot \"→\"",
  "- [x] Kemiska formler har nedsänkt text: Fe₃C, CO₂, Al₂O₃, SiO₂, O₂",
  "- [x] Unicode-matte är KaTeX, t.ex. `$\\sigma = E\\,\\varepsilon$`, `$\\varepsilon_T = \\alpha\\,(T - T_0)$`",
  "- [x] Sju dubbletter borttagna (alla i \"Tillverkning och värmebehandling av stål\", originalen finns i \"Stål, värmebehandling och bearbetning\")",
  "",
  "Öppen fråga till Alvin: kortet om brottseghet anger `K1c = EGc`. Det fysikaliskt korrekta sambandet är",
  "K_Ic = √(E·G_c); kvadratroten föll troligen bort i Brainscape-exporten. Det är en innehållsändring, så",
  "Claude har inte rättat det. Säg till om det ska rättas.",
  "",
  "Anmärkningen \"radbrytning mitt i mening\" nedan är ofarlig: markdown slår ihop raderna vid visning.",
  "",
  "## Kort med anmärkning",
  "",
];
let currentCat = "";
for (const f of findings) {
  if (f.category !== currentCat) {
    currentCat = f.category;
    out.push(`### ${currentCat}`, "");
  }
  out.push(`- [ ] **${f.front}**`, `  - ${f.reasons.join("; ")}`, `  - _${f.excerpt}…_`);
}
out.push("");

mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "docs", "INNEHALL-GRANSKNING.md"), out.join("\n"), "utf8");
console.log(`Skrev docs/INNEHALL-GRANSKNING.md: ${findings.length} av ${total} kort med anmärkning.`);
