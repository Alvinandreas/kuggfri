/**
 * Statistiken som CSV, för kursutvärderingen och examinatorns egna analyser. Ren logik utan
 * Supabase, så att formatet kan enhetstestas.
 *
 * Formatet är det som svensk Excel öppnar rätt med dubbelklick: semikolon mellan fälten,
 * decimalkomma, UTF-8 med BOM (annars blir å, ä och ö fel) och CRLF mellan raderna.
 *
 * Bara aggregerad statistik följer med, och bara det databasen redan släppt igenom
 * anonymitetsgränsen (MIN_STUDENTS): ett område eller kort under gränsen får tomma statistikfält.
 */
import { CARD_KIND_LABEL, type CardKind } from "@/lib/cards/kinds";
import { firstLine } from "@/lib/text/first-line";

type Cell = string | number | null;

const BOM = "﻿";

function cell(value: Cell): string {
  if (value === null) return "";
  const text = typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",")) : value;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rader till en CSV-fil (med BOM) som svensk Excel öppnar rätt. */
export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return BOM + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

function share(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

export type CsvArea = { id: string; title: string };
export type CsvCard = {
  id: string;
  category_id: string | null;
  front: string;
  kind: CardKind;
  is_active: boolean;
  review_status: string | null;
  reviewed_at: string | null;
};
export type CsvAreaStats = { category_id: string; students: number; ratings: number; avg: number | null; low: number; learned: number };
export type CsvCardStats = { card_id: string; ratings: number; avg: number | null; low: number | null; reps: number };

const inRotation = (c: CsvCard) => c.review_status === null && c.is_active;

/** Granskningsläget som examinatorn känner igen från granskningen. */
function status(c: CsvCard): string | null {
  if (c.review_status === "utkast") return "Utkast";
  if (c.review_status === "avvisad") return "Ur rotation";
  if (inRotation(c)) return c.reviewed_at ? "Godkänd" : "Ogranskad";
  return null;
}

/** En rad per område: innehållet och hur det går för studenterna. */
export function areaStatsCsv(areas: readonly CsvArea[], cards: readonly CsvCard[], stats: readonly CsvAreaStats[]): string {
  const byArea = new Map(stats.map((s) => [s.category_id, s] as const));
  const header = ["Nr", "Område", "Kort i rotation", "Varav godkända", "Utkast", "Studenter", "Skattningar", "Snittskattning (1–5)", "Andel skattningar 1–2 (%)"];
  const rows = areas.map((a, i) => {
    const mine = cards.filter((c) => c.category_id === a.id);
    const s = byArea.get(a.id);
    return [
      i + 1,
      a.title,
      mine.filter(inRotation).length,
      mine.filter((c) => status(c) === "Godkänd").length,
      mine.filter((c) => status(c) === "Utkast").length,
      s?.students ?? null,
      s?.ratings ?? null,
      s?.avg ?? null,
      s ? share(s.low, s.ratings) : null,
    ];
  });
  return toCsv([header, ...rows]);
}

/** En rad per kort i rotation i kursens ordning, med granskningsläget och statistiken om den passerat gränsen. */
export function cardStatsCsv(areas: readonly CsvArea[], cards: readonly CsvCard[], stats: readonly CsvCardStats[]): string {
  const areaTitle = new Map(areas.map((a) => [a.id, a.title] as const));
  const byCard = new Map(stats.map((s) => [s.card_id, s] as const));
  const header = ["Område", "Fråga", "Uppgiftstyp", "Granskning", "Skattningar", "Snittskattning (1–5)", "Andel skattningar 1–2 (%)", "Repetitioner totalt"];
  const rows = cards
    .filter(inRotation)
    .map((c) => {
      const s = byCard.get(c.id);
      return [
        c.category_id ? (areaTitle.get(c.category_id) ?? null) : null,
        firstLine(c.front),
        CARD_KIND_LABEL[c.kind],
        status(c),
        s?.ratings ?? null,
        s?.avg ?? null,
        s && s.low !== null ? share(s.low, s.ratings) : null,
        s?.reps ?? null,
      ];
    });
  return toCsv([header, ...rows]);
}
