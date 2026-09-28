/**
 * Källorna på korten i admin: vilka källtyper ett kort har (för badges och filter) och en
 * läsbar, grupperad lista över källorna (samma dokument på en rad: "s. 7, 13, 14, 18").
 * Bygger på tolkningen i lib/cards/sources. Ren modul utan React och Supabase.
 */
import { SOURCE_KINDS, SOURCE_KIND_LABEL, parseSource, type SourceKind, type SourceRef } from "@/lib/cards/sources";

/**
 * Ett korts källmärkning: källtyperna, eller "original" (originalkort utan källa) eller
 * "ingen" (skrivet i admin utan källa).
 */
export type SourceTag = SourceKind | "original" | "ingen";

export const SOURCE_TAGS: readonly SourceTag[] = [...SOURCE_KINDS, "original", "ingen"];

export const SOURCE_TAG_LABEL: Record<SourceTag, string> = {
  ...SOURCE_KIND_LABEL,
  original: "Originalkort",
  ingen: "Ingen källa",
};

/** "alla" = inget filter. */
export type SourceFilter = "alla" | SourceTag;

export function isSourceFilter(value: unknown): value is SourceFilter {
  return value === "alla" || (typeof value === "string" && (SOURCE_TAGS as readonly string[]).includes(value));
}

type SourceCard = { source: string | null; original?: boolean };

/** Källmärkningen för ett kort, i SOURCE_TAGS-ordning. Alltid minst en. */
export function sourceTags(card: SourceCard): SourceTag[] {
  const kinds = new Set(parseSource(card.source).refs.map((r) => r.kind));
  const tags = SOURCE_KINDS.filter((k) => kinds.has(k));
  if (tags.length > 0) return tags;
  return [card.original ? "original" : "ingen"];
}

export function matchesSource(card: SourceCard, filter: SourceFilter | undefined): boolean {
  if (!filter || filter === "alla") return true;
  return sourceTags(card).includes(filter);
}

/** Antal kort per källmärkning (ett kort med flera källtyper räknas under var och en). */
export function countBySourceTag(cards: readonly SourceCard[]): Record<SourceTag, number> {
  const out = Object.fromEntries(SOURCE_TAGS.map((t) => [t, 0])) as Record<SourceTag, number>;
  for (const c of cards) for (const t of sourceTags(c)) out[t]++;
  return out;
}

// ---------------------------------------------------------------------------
// Gruppering: samma dokument på en rad
// ---------------------------------------------------------------------------

export type SourceGroup = {
  kind: SourceKind;
  document: string;
  /** Sidorna och frågorna ihopslagna ("s. 7, 13, 14", "fråga 3, 7"), eller null. */
  locator: string | null;
  /** Antal källposter som slogs ihop. */
  count: number;
};

const PREFIX_RE = /^(s\.|sidorna|sida|sid\.?|fråga|uppgift|uppg\.?|bild)\s*(.*)$/i;

function normalizePrefix(prefix: string): string {
  const p = prefix.toLowerCase();
  if (p.startsWith("s")) return "s.";
  if (p.startsWith("uppg")) return "uppgift";
  return p;
}

function leadingNumber(value: string): number {
  const m = /^\d+/.exec(value);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

/**
 * Slår ihop hänvisningar till samma dokument: "s. 7", "s. 14", "s. 13" blir "s. 7, 13, 14".
 * Olika slag (sidor, frågor) står efter varandra i den ordning de först förekom. Dubbletter
 * tas bort; värden som inte går att tolka står kvar som de var.
 */
export function mergeLocators(locators: readonly (string | null)[]): string | null {
  const byPrefix = new Map<string, string[]>();
  const other: string[] = [];
  for (const raw of locators) {
    const loc = raw?.trim();
    if (!loc) continue;
    const m = PREFIX_RE.exec(loc);
    if (!m || !m[2]?.trim()) {
      if (!other.includes(loc)) other.push(loc);
      continue;
    }
    const prefix = normalizePrefix(m[1] ?? "");
    const values = byPrefix.get(prefix) ?? [];
    for (const v of (m[2] ?? "").split(/\s*(?:,|\boch\b)\s*/i)) {
      const value = v.trim();
      if (value && !values.includes(value)) values.push(value);
    }
    byPrefix.set(prefix, values);
  }
  const parts = [...byPrefix.entries()].map(([prefix, values]) => {
    const sorted = [...values].sort((a, b) => leadingNumber(a) - leadingNumber(b));
    return `${prefix} ${sorted.join(", ")}`;
  });
  const all = [...parts, ...other];
  return all.length > 0 ? all.join(", ") : null;
}

const docKey = (r: Pick<SourceRef, "kind" | "document">) => `${r.kind}|${r.document.toLowerCase().replace(/\s+/g, " ").trim()}`;

/** Källposterna grupperade per dokument, i den ordning dokumenten först förekommer. */
export function groupSourceRefs(refs: readonly SourceRef[]): SourceGroup[] {
  const groups = new Map<string, { kind: SourceKind; document: string; locators: (string | null)[] }>();
  for (const r of refs) {
    const key = docKey(r);
    const g = groups.get(key);
    if (g) g.locators.push(r.locator);
    else groups.set(key, { kind: r.kind, document: r.document, locators: [r.locator] });
  }
  return [...groups.values()].map((g) => ({ kind: g.kind, document: g.document, locator: mergeLocators(g.locators), count: g.locators.length }));
}

export type CardSources = {
  groups: SourceGroup[];
  /** Motiveringen om kortet är en rättelse, annars null. */
  correction: string | null;
  /** Märkningen när kortet saknar källor ("original" eller "ingen"), annars null. */
  missing: "original" | "ingen" | null;
};

/** Allt som visas om ett korts källor: grupperna, rättelsens motivering och vad som saknas. */
export function cardSources(card: SourceCard): CardSources {
  const parsed = parseSource(card.source);
  const groups = groupSourceRefs(parsed.refs);
  return { groups, correction: parsed.correction, missing: groups.length > 0 ? null : card.original ? "original" : "ingen" };
}
