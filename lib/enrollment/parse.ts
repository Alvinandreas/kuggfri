/**
 * Läser en deltagarlista: en CSV-fil från Ladok eller Canvas, rader inklistrade från Excel, eller
 * bara adresser, en per rad eller kommaseparerade. Ren modul utan beroenden, så att samma läsning
 * kan köras i webbläsaren (förhandsvisningen) och på servern (det som faktiskt sparas).
 *
 * Bara e-postadressen och namnet tas med. Personnummer och annat som råkar stå i filen läses
 * aldrig in: en kolumn med siffror blir varken namn eller adress.
 */

export type RosterEntry = { email: string; name: string | null; line: number };
export type RosterProblem = { line: number; text: string; reason: "ingen-adress" | "ogiltig-adress" };
export type Roster = {
  entries: RosterEntry[];
  problems: RosterProblem[];
  /** Adresser som stod mer än en gång i listan (de räknas en gång). */
  duplicates: number;
};

/** Högsta antal rader som läses; en kurs har några hundra studenter, inte tiotusentals. */
export const MAX_ROSTER_ROWS = 5000;

const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** Adressen i normalform (gemener, utan mailto: och vinkelparenteser), eller null. */
export function normalizeEmail(raw: string): string | null {
  const s = raw
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/^<|>$/g, "")
    .trim()
    .toLowerCase();
  return s.length <= 254 && EMAIL.test(s) ? s : null;
}

function looksLikeEmail(cell: string): boolean {
  return cell.includes("@");
}

/** Ett namn: bokstäver, mellanslag, bindestreck, apostrof och punkt. Inga siffror (personnummer). */
function looksLikeName(cell: string): boolean {
  const s = cell.trim();
  return s.length > 0 && s.length <= 120 && !/\d/.test(s) && !s.includes("@") && /\p{L}/u.test(s);
}

/** Raden som den visas i listan över problem, med personnummer maskerade. */
function shown(text: string): string {
  return text
    .trim()
    .replace(/\b(\d{2})?\d{6}[-+]?\d{4}\b/g, "[personnummer]")
    .slice(0, 120);
}

function detectDelimiter(line: string): string {
  const counts: [string, number][] = [
    ["\t", line.split("\t").length - 1],
    [";", line.split(";").length - 1],
    [",", line.split(",").length - 1],
  ];
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? best[0] : "\t";
}

/** En CSV-rad med citattecken ("a, b" är ett fält; "" är ett citattecken i fältet). */
function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur.trim() === "") {
      quoted = true;
      cur = "";
    } else if (ch === delimiter) {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

type Columns = { email: number[]; full: number | null; first: number | null; last: number | null };

const HEADER = {
  email: /^(e-?post(adress)?|e-?mail(\s*address)?|mail(adress)?|epost)$/i,
  full: /^(namn|name|fullständigt namn|full name|student|studentnamn|student name|deltagare)$/i,
  first: /^(förnamn|tilltalsnamn|first\s*name|given\s*name|fornamn)$/i,
  last: /^(efternamn|last\s*name|surname|family\s*name)$/i,
};

/** Kolumnerna ur en rubrikrad, eller null om raden inte är en rubrikrad. */
function headerColumns(cells: string[]): Columns | null {
  if (cells.some(looksLikeEmail)) return null;
  const cols: Columns = { email: [], full: null, first: null, last: null };
  cells.forEach((raw, i) => {
    const c = raw.trim();
    if (HEADER.email.test(c)) cols.email.push(i);
    else if (cols.full === null && HEADER.full.test(c)) cols.full = i;
    else if (cols.first === null && HEADER.first.test(c)) cols.first = i;
    else if (cols.last === null && HEADER.last.test(c)) cols.last = i;
  });
  return cols.email.length > 0 || cols.full !== null || cols.first !== null || cols.last !== null ? cols : null;
}

function clean(name: string | undefined): string | null {
  const s = (name ?? "").replace(/\s+/g, " ").trim();
  return looksLikeName(s) ? s : null;
}

function nameFromColumns(cells: string[], cols: Columns): string | null {
  const first = cols.first !== null ? clean(cells[cols.first]) : null;
  const last = cols.last !== null ? clean(cells[cols.last]) : null;
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return cols.full !== null ? clean(cells[cols.full]) : null;
}

/** Utan rubrik: namnet är de cellerna på raden som ser ut som namn, i ordning. */
function nameFromRow(cells: string[]): string | null {
  const parts = cells.filter((c) => !looksLikeEmail(c)).map((c) => clean(c)).filter((c): c is string => c !== null);
  return parts.length > 0 ? clean(parts.join(" ")) : null;
}

/**
 * Adresserna i en cell. "Anna Andersson <anna@chalmers.se>" (som när man kopierar mottagare ur
 * Outlook) ger namnet också; annars är varje ord med @ en adress.
 */
function addressesInCell(cell: string): { address: string; name: string | null }[] {
  const named = [...cell.matchAll(/([^<>]*?)<([^<>]+@[^<>]+)>/g)];
  if (named.length > 0) {
    // Namnet är texten före <adress>, utan avgränsaren från föregående mottagare och utan citattecken.
    return named.map((m) => ({ address: m[2] ?? "", name: clean((m[1] ?? "").replace(/^[\s,;]+/, "").replace(/"/g, "")) }));
  }
  return cell
    .split(/[\s,;]+/)
    .filter((t) => t.includes("@"))
    .map((address) => ({ address, name: null }));
}

export function parseRoster(text: string): Roster {
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const firstContent = lines.find((l) => l.trim() !== "") ?? "";
  const delimiter = detectDelimiter(firstContent);

  const entries: RosterEntry[] = [];
  const problems: RosterProblem[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let cols: Columns | null = null;
  let headerSeen = false;

  const add = (email: string, name: string | null, line: number) => {
    if (seen.has(email)) {
      duplicates++;
      // Står adressen två gånger och bara den andra har namn, behåll namnet.
      const prev = entries.find((e) => e.email === email);
      if (prev && !prev.name && name) prev.name = name;
      return;
    }
    seen.add(email);
    entries.push({ email, name, line });
  };

  for (let i = 0; i < lines.length && i < MAX_ROSTER_ROWS + 1; i++) {
    const raw = lines[i] ?? "";
    if (raw.trim() === "") continue;
    const cells = splitRow(raw, delimiter);
    const lineNo = i + 1;

    if (!headerSeen) {
      headerSeen = true;
      const header = headerColumns(cells);
      if (header) {
        cols = header;
        continue;
      }
    }

    const emailCells = cols && cols.email.length > 0 ? cols.email.map((c) => cells[c] ?? "") : cells.filter(looksLikeEmail);
    const candidates = emailCells.flatMap(addressesInCell);
    if (candidates.length === 0) {
      problems.push({ line: lineNo, text: shown(raw), reason: "ingen-adress" });
      continue;
    }
    // Flera adresser på samma rad (en inklistrad lista): namnet kommer bara från "Namn <adress>".
    const rowName = candidates.length === 1 ? (cols ? nameFromColumns(cells, cols) : nameFromRow(cells)) : null;
    for (const c of candidates) {
      const email = normalizeEmail(c.address);
      if (email) add(email, c.name ?? rowName, lineNo);
      else problems.push({ line: lineNo, text: shown(c.address), reason: "ogiltig-adress" });
    }
  }

  return { entries: entries.slice(0, MAX_ROSTER_ROWS), problems, duplicates };
}
