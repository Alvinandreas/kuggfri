/**
 * Liten, strikt CSV-parser (RFC 4180) utan beroenden.
 * - Hanterar citattecken, dubblerade citattecken, radbrytningar inuti fält, CRLF och BOM.
 * - Avgränsare upptäcks automatiskt (komma, semikolon eller tabb) om inget anges.
 * - Fel rapporteras med radnummer men parsern fortsätter där det går.
 */

export type CsvError = { line: number; message: string };

export type CsvResult = {
  headers: string[];
  /** Datarader (utan rubrikraden). Varje rad har ett fält per rubrik. */
  rows: string[][];
  /** Radnummer i källfilen (1-baserat) för varje rad i `rows`. */
  lineNumbers: number[];
  errors: CsvError[];
  delimiter: string;
};

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    // Räkna bara utanför citattecken.
    let count = 0;
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

type RawRecord = { fields: string[]; line: number };

function tokenize(text: string, delimiter: string, errors: CsvError[]): RawRecord[] {
  const records: RawRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (ch === "\n") line++;
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      if (field.length > 0) {
        errors.push({ line, message: "Citattecken mitt i ett fält." });
        field += ch;
      } else {
        inQuotes = true;
      }
      i++;
      continue;
    }
    if (ch === delimiter) {
      fields.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      fields.push(field);
      records.push({ fields, line: recordStartLine });
      fields = [];
      field = "";
      line++;
      recordStartLine = line;
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  if (inQuotes) {
    errors.push({ line: recordStartLine, message: "Oavslutat citattecken." });
  }
  if (field.length > 0 || fields.length > 0) {
    fields.push(field);
    records.push({ fields, line: recordStartLine });
  }
  return records;
}

export function parseCsv(input: string, options: { delimiter?: string } = {}): CsvResult {
  const text = input.replace(/^﻿/, "");
  const errors: CsvError[] = [];
  const delimiter = options.delimiter ?? detectDelimiter(text);
  const records = tokenize(text, delimiter, errors).filter(
    (r) => !(r.fields.length === 1 && r.fields[0]?.trim() === ""),
  );

  const headerRecord = records[0];
  if (!headerRecord) {
    errors.push({ line: 1, message: "Filen är tom." });
    return { headers: [], rows: [], lineNumbers: [], errors, delimiter };
  }
  const headers = headerRecord.fields.map((h) => h.trim());
  const rows: string[][] = [];
  const lineNumbers: number[] = [];

  for (const rec of records.slice(1)) {
    if (rec.fields.length !== headers.length) {
      errors.push({
        line: rec.line,
        message: `Raden har ${rec.fields.length} fält men rubriken har ${headers.length}.`,
      });
      // Ta med raden ändå, justerad till rubrikens längd, så att användaren kan se den.
      const adjusted = headers.map((_, idx) => rec.fields[idx] ?? "");
      rows.push(adjusted);
      lineNumbers.push(rec.line);
      continue;
    }
    rows.push(rec.fields);
    lineNumbers.push(rec.line);
  }

  return { headers, rows, lineNumbers, errors, delimiter };
}
