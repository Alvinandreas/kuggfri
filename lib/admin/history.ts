/**
 * Ren logik för kortens historik (card_versions) i admin: versionernas status, vilka fält som
 * skiljer två versioner åt, alternativens skillnad och svensk relativ tid. Inga beroenden på
 * React eller Supabase.
 */
import { diffSequence } from "@/lib/admin/diff";
import { stockholmDate, stockholmDateTime } from "@/lib/time/stockholm";
import { DEFAULT_CARD_KIND, isCardKind, isReviewStatus, parseOptions, type CardKind, type CardOption } from "@/lib/cards/kinds";
import type { CardVersionRow } from "@/lib/supabase/database.types";

/** Det i ett kort som historiken sparar och som en återställning skriver tillbaka. */
export type VersionContent = {
  category_id: string | null;
  front: string;
  back: string;
  hint: string | null;
  kind: CardKind;
  options: CardOption[] | null;
  is_active: boolean;
  review_status: "utkast" | "avvisad" | null;
  source: string | null;
};

/** En tidigare version, som admin visar den. */
export type CardVersion = VersionContent & {
  id: number;
  card_id: string;
  /** Versionen gällde fram till den här tidpunkten. */
  replaced_at: string;
  replaced_by: string | null;
  /** Vem som ersatte versionen, färdig att visa. */
  author: string;
};

export type VersionStatus = "publicerad" | "utkast" | "avvisad" | "inaktiv";

/** Tolkar en rad från databasen; okänd typ eller status ger standardvärdet. */
export function versionFromRow(row: CardVersionRow, author: string): CardVersion {
  return {
    id: Number(row.id),
    card_id: row.card_id,
    replaced_at: row.replaced_at,
    replaced_by: row.replaced_by,
    author,
    category_id: row.category_id,
    front: row.front,
    back: row.back,
    hint: row.hint,
    kind: isCardKind(row.kind) ? row.kind : DEFAULT_CARD_KIND,
    options: parseOptions(row.options),
    is_active: row.is_active,
    review_status: isReviewStatus(row.review_status) ? row.review_status : null,
    source: row.source,
  };
}

/** Innehållsdelen av ett kort eller en version. */
export function contentOf(card: VersionContent): VersionContent {
  return {
    category_id: card.category_id,
    front: card.front,
    back: card.back,
    hint: card.hint,
    kind: card.kind,
    options: card.options,
    is_active: card.is_active,
    review_status: card.review_status,
    source: card.source,
  };
}

export function versionStatus(v: Pick<VersionContent, "review_status" | "is_active">): VersionStatus {
  if (v.review_status === "utkast") return "utkast";
  if (v.review_status === "avvisad") return "avvisad";
  return v.is_active ? "publicerad" : "inaktiv";
}

/** Syntes versionen för studenterna (granskad och aktiv)? */
export function isPublished(v: Pick<VersionContent, "review_status" | "is_active">): boolean {
  return v.review_status === null && v.is_active;
}

/**
 * Hur en återställning skriver kortet: versionens innehåll, men ett kort med granskningsstatus
 * är alltid inaktivt (check-constrainten i databasen).
 */
export function restoreValues(v: VersionContent): VersionContent {
  return { ...contentOf(v), is_active: v.review_status === null ? v.is_active : false };
}

// ---------------------------------------------------------------------------
// Skillnader
// ---------------------------------------------------------------------------

/** Fälten i den ordning skillnaderna visas. status = publicerad, utkast, avvisad eller inaktiv. */
export const CONTENT_FIELDS = ["status", "kind", "category_id", "front", "options", "back", "hint", "source"] as const;
export type ContentField = (typeof CONTENT_FIELDS)[number];

const norm = (s: string | null) => (s ?? "").trim();

export function sameOptions(a: readonly CardOption[] | null, b: readonly CardOption[] | null): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((o, i) => o.text === y[i]!.text && o.correct === y[i]!.correct);
}

/** Fälten som skiljer sig mellan två versioner, i visningsordning. */
export function changedFields(before: VersionContent, after: VersionContent): ContentField[] {
  return CONTENT_FIELDS.filter((f) => {
    switch (f) {
      case "status":
        return versionStatus(before) !== versionStatus(after);
      case "kind":
        return before.kind !== after.kind;
      case "category_id":
        return before.category_id !== after.category_id;
      case "options":
        return !sameOptions(before.options, after.options);
      case "hint":
      case "source":
        return norm(before[f]) !== norm(after[f]);
      default:
        return before[f] !== after[f];
    }
  });
}

/**
 * Skiljer sig kortets innehåll från en publicerad version, bortsett från status? Ett utkast
 * som bara godkänts och ångrats har samma innehåll och räknas då inte som en ändring.
 */
export function differsFromPublished(published: VersionContent, card: VersionContent): boolean {
  return changedFields(published, { ...contentOf(card), is_active: published.is_active, review_status: published.review_status }).length > 0;
}

/** En rad i alternativens skillnad. before/after = rätt eller fel, null = alternativet fanns inte. */
export type OptionDiffRow = { text: string; before: boolean | null; after: boolean | null };

/**
 * Alternativen före och efter, radvis: kvar (eventuellt med ändrad rätt-markering), borttagna
 * och tillagda, i den ordning de står.
 */
export function diffOptions(before: readonly CardOption[] | null, after: readonly CardOption[] | null): OptionDiffRow[] {
  const a = before ?? [];
  const b = after ?? [];
  const parts = diffSequence(
    a.map((o) => o.text.trim()),
    b.map((o) => o.text.trim()),
  );
  const rows: OptionDiffRow[] = [];
  let i = 0;
  let j = 0;
  for (const p of parts) {
    if (p.type === "same") rows.push({ text: b[j]!.text, before: a[i++]!.correct, after: b[j++]!.correct });
    else if (p.type === "del") rows.push({ text: a[i]!.text, before: a[i++]!.correct, after: null });
    else rows.push({ text: b[j]!.text, before: null, after: b[j++]!.correct });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Tid
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Svensk relativ tid: "nyss", "för 5 minuter sedan", "i går", "för 3 dagar sedan", annars datum. */
export function relativeTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, now - t);
  if (diff < MINUTE) return "nyss";
  const rtf = new Intl.RelativeTimeFormat("sv", { numeric: "auto" });
  if (diff < HOUR) return rtf.format(-Math.floor(diff / MINUTE), "minute");
  if (diff < DAY) return rtf.format(-Math.floor(diff / HOUR), "hour");
  const days = Math.floor(diff / DAY);
  if (days < 14) return rtf.format(-days, "day");
  return stockholmDate(t);
}

/** Exakt tid i svensk tid, t.ex. till en title. */
export function exactTime(iso: string): string {
  return stockholmDateTime(iso);
}
