import { parseCsv } from "./csv";

/** Ett kort så som det ser ut efter tolkning, före diff mot databasen. */
export type ImportCard = {
  front: string;
  back: string;
  hint: string | null;
  category: string | null;
  sort_order: number | null;
  /** Rad i källan (1-baserat) för felmeddelanden. */
  row: number;
};

export type ImportError = { row: number; message: string };

export type ImportParseResult = {
  cards: ImportCard[];
  errors: ImportError[];
  format: "csv" | "json";
};

const COLUMN_ALIASES: Record<keyof Omit<ImportCard, "row">, string[]> = {
  front: ["front", "question", "fråga", "framsida", "term"],
  back: ["back", "answer", "svar", "baksida", "definition"],
  hint: ["hint", "ledtråd", "ledtrad"],
  category: ["category", "kategori", "deck", "section"],
  sort_order: ["sort_order", "sortorder", "order", "ordning", "position"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function findColumn(headers: string[], key: keyof typeof COLUMN_ALIASES): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of COLUMN_ALIASES[key]) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r\n/g, "\n").trim();
}

function parseSortOrder(value: unknown, row: number, errors: ImportError[]): number | null {
  const s = cleanText(value);
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isInteger(n)) {
    errors.push({ row, message: `Ogiltig sort_order: ”${s}”.` });
    return null;
  }
  return n;
}

function validateCard(card: ImportCard, errors: ImportError[]): boolean {
  let ok = true;
  if (!card.front) {
    errors.push({ row: card.row, message: "Framsidan (front) saknas." });
    ok = false;
  }
  if (!card.back) {
    errors.push({ row: card.row, message: "Baksidan (back) saknas." });
    ok = false;
  }
  if (card.front.length > 5000 || card.back.length > 20000) {
    errors.push({ row: card.row, message: "Kortet är orimligt långt." });
    ok = false;
  }
  return ok;
}

export function parseImportCsv(text: string): ImportParseResult {
  const errors: ImportError[] = [];
  const csv = parseCsv(text);
  for (const e of csv.errors) errors.push({ row: e.line, message: e.message });

  if (csv.headers.length === 0) {
    return { cards: [], errors, format: "csv" };
  }

  const col = {
    front: findColumn(csv.headers, "front"),
    back: findColumn(csv.headers, "back"),
    hint: findColumn(csv.headers, "hint"),
    category: findColumn(csv.headers, "category"),
    sort_order: findColumn(csv.headers, "sort_order"),
  };

  if (col.front === -1 || col.back === -1) {
    errors.push({
      row: 1,
      message: `Rubrikraden måste innehålla kolumnerna front och back. Hittade: ${csv.headers.join(", ") || "(inga)"}.`,
    });
    return { cards: [], errors, format: "csv" };
  }

  const cards: ImportCard[] = [];
  csv.rows.forEach((fields, i) => {
    const row = csv.lineNumbers[i] ?? i + 2;
    const card: ImportCard = {
      front: cleanText(fields[col.front]),
      back: cleanText(fields[col.back]),
      hint: col.hint === -1 ? null : cleanText(fields[col.hint]) || null,
      category: col.category === -1 ? null : cleanText(fields[col.category]) || null,
      sort_order: col.sort_order === -1 ? null : parseSortOrder(fields[col.sort_order], row, errors),
      row,
    };
    if (validateCard(card, errors)) cards.push(card);
  });

  return { cards, errors, format: "csv" };
}

export function parseImportJson(text: string): ImportParseResult {
  const errors: ImportError[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    errors.push({ row: 0, message: `Ogiltig JSON: ${e instanceof Error ? e.message : String(e)}` });
    return { cards: [], errors, format: "json" };
  }

  // Tillåt både en ren lista och exportformatet { cards: [...] }.
  let list: unknown;
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === "object" && Array.isArray((data as { cards?: unknown }).cards)) {
    list = (data as { cards: unknown[] }).cards;
  } else {
    errors.push({ row: 0, message: "JSON måste vara en lista med kort eller ett objekt med fältet cards." });
    return { cards: [], errors, format: "json" };
  }

  const cards: ImportCard[] = [];
  (list as unknown[]).forEach((item, i) => {
    const row = i + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push({ row, message: "Posten är inte ett objekt." });
      return;
    }
    const obj = item as Record<string, unknown>;
    const pick = (key: keyof typeof COLUMN_ALIASES): unknown => {
      for (const alias of COLUMN_ALIASES[key]) {
        if (alias in obj) return obj[alias];
      }
      return undefined;
    };
    const categoryRaw = pick("category");
    const categoryValue =
      categoryRaw && typeof categoryRaw === "object" && "title" in (categoryRaw as object)
        ? (categoryRaw as { title: unknown }).title
        : categoryRaw;
    const card: ImportCard = {
      front: cleanText(pick("front")),
      back: cleanText(pick("back")),
      hint: cleanText(pick("hint")) || null,
      category: cleanText(categoryValue) || null,
      sort_order: parseSortOrder(pick("sort_order"), row, errors),
      row,
    };
    if (validateCard(card, errors)) cards.push(card);
  });

  return { cards, errors, format: "json" };
}

/** Gissar format på innehållet och tolkar det. */
export function parseImport(text: string, format: "auto" | "csv" | "json" = "auto"): ImportParseResult {
  const trimmed = text.replace(/^﻿/, "").trim();
  if (format === "json" || (format === "auto" && (trimmed.startsWith("[") || trimmed.startsWith("{")))) {
    return parseImportJson(trimmed);
  }
  return parseImportCsv(text);
}
