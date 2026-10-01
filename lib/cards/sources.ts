/**
 * Källor på kort: tolkar fältet `source` (kortfilernas `källa:`) till strukturerade poster med
 * källtyp, dokument och sida/fråga. Ren modul; delas av admin (visning, filter) och verktygen.
 *
 * Formatet som skribenter och granskare använder (docs/KALLKRITIK.md):
 *   källa: Canvas, <dokument>, s. <sida>; Canvas, <quiz>, fråga <n>
 *   källa: Rättelse: <vad som var fel>; Canvas, <dokument>, s. <sida>
 * Kort utan källa är originalkort (före 28 sep 2026) eller skrivna i admin.
 */
import { ALL_COURSES } from "@/lib/courses";

export const SOURCE_KINDS = ["forelasning", "tenta", "quiz", "ovning", "labb", "bok", "ordlista", "kursdokument", "ovrigt"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  forelasning: "Föreläsning",
  tenta: "Tenta",
  quiz: "Quiz",
  ovning: "Övning",
  labb: "Labb",
  bok: "Bok",
  ordlista: "Ordlista",
  kursdokument: "Kursdokument",
  ovrigt: "Övrigt",
};

export type SourceRef = {
  kind: SourceKind;
  /** Dokumentets namn, utan "Canvas, " och utan sidhänvisning. */
  document: string;
  /** "s. 14", "s. 6-7", "fråga 3", "uppgift 2" … eller null. */
  locator: string | null;
  /** Hela posten som den stod. */
  raw: string;
};

export type ParsedSource = {
  refs: SourceRef[];
  /** Motiveringen om kortet är en rättelse av ett publicerat kort, annars null. */
  correction: string | null;
};

/**
 * De generiska reglerna, som gäller alla kurser. Ordningen spelar roll: första träffen vinner
 * (t.ex. "Quiz Polymeric materials" före föreläsning). "bok" har ingen generisk regel: bokens
 * namn är alltid kursens eget och står bland kursens källtips.
 */
const GENERIC_RULES: [SourceKind, RegExp | null][] = [
  ["quiz", /\bquiz\b/i],
  ["tenta", /tentamen|\bsvar\b|svarsförslag|formelblad/i],
  ["ordlista", /dictionary|ordlista/i],
  ["labb", /lab[-_ ]?pm|laboration/i],
  ["ovning", /tutorials?|turorials|övning|ovning|exercise/i],
  ["kursdokument", /läsanvisning|lasanvisning|kurs-?pm|kursplan|kursintroduktion|lärmål/i],
  ["bok", null],
  ["forelasning", /kapitel|\bf[öo] ?\d|\bf[öo]\d|lecture|\bl\d|sammanfattning|föreläsning/i],
];

/**
 * Reglerna med kursernas källtips (lib/courses) inlagda på sin källtyps plats. Källan på ett
 * kort vet inte vilken kurs den hör till, så tipsen från alla kurser gäller överallt; det är
 * ofarligt så länge tipsen är kursens egna dokumentnamn.
 */
const RULES: [SourceKind, RegExp[]][] = GENERIC_RULES.map(([kind, generic]) => {
  const hints = ALL_COURSES.flatMap((c) => c.sourceHints[kind] ?? []);
  return [kind, generic ? [generic, ...hints] : hints];
});

export function sourceKindOf(document: string): SourceKind {
  for (const [kind, patterns] of RULES) if (patterns.some((re) => re.test(document))) return kind;
  return "ovrigt";
}

const LOCATOR_RE = /,\s*((?:s\.|sid(?:a|orna)?|fråga|uppgift|uppg\.?|bild)\s*[\w\d.,–-]+(?:\s*(?:och|,)\s*\d+)*)\s*$/i;

function parseRef(part: string): SourceRef | null {
  const raw = part.trim();
  if (!raw) return null;
  let rest = raw.replace(/^canvas\s*,\s*/i, "");
  let locator: string | null = null;
  const m = LOCATOR_RE.exec(rest);
  if (m) {
    locator = (m[1] ?? "").trim();
    rest = rest.slice(0, m.index).trim();
  }
  return { kind: sourceKindOf(rest), document: rest, locator, raw };
}

export function parseSource(source: string | null | undefined): ParsedSource {
  if (!source?.trim()) return { refs: [], correction: null };
  const parts = source.split(";").map((p) => p.trim());
  let correction: string | null = null;
  if (/^rättelse\s*:/i.test(parts[0] ?? "")) {
    // Motiveringen kan själv innehålla semikolon: allt fram till första "Canvas, …" hör till den.
    const note: string[] = [(parts.shift() ?? "").replace(/^rättelse\s*:\s*/i, "")];
    while (parts.length > 0 && !/^canvas\s*,/i.test(parts[0] ?? "")) note.push(parts.shift() ?? "");
    correction = note.join("; ").trim() || null;
  }
  const refs = parts.map(parseRef).filter((r): r is SourceRef => r !== null);
  return { refs, correction };
}

/** Källtyperna på ett kort, unika, i SOURCE_KINDS-ordning. Tom lista = ingen källa angiven. */
export function sourceKinds(source: string | null | undefined): SourceKind[] {
  const kinds = new Set(parseSource(source).refs.map((r) => r.kind));
  return SOURCE_KINDS.filter((k) => kinds.has(k));
}
