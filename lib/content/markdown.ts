/**
 * Kortfiler: markdown in, modell ut, och tillbaka igen. Ren modul.
 *
 * Formatet (docs/INNEHALL.md avsnitt 3):
 *
 *   # Kategorins titel
 *
 *   ## Kortets framsida
 *   key: stabil-nyckel
 *   ledtråd: valfri ledtråd
 *   aktiv: nej
 *
 *   Baksidan i markdown, med $KaTeX$, listor och flera stycken.
 *
 *   ## Nästa kort
 *   ...
 *
 * `##` i kolumn noll startar ett nytt kort, utom inuti en kodstaket (```).
 */
import type { ContentCard } from "./model";
import { isValidKey } from "./model";

export type CardFile = {
  title: string;
  cards: ContentCard[];
};

export type ParseIssue = { line: number; message: string };

export type ParseResult = {
  file: CardFile;
  issues: ParseIssue[];
};

const ATTRIBUTE_RE = /^(key|nyckel|ledtråd|ledtrad|hint|aktiv|active)\s*:\s*(.*)$/i;

function isFence(line: string): boolean {
  return /^\s*```/.test(line);
}

function parseBool(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !(v === "nej" || v === "no" || v === "false" || v === "0");
}

export function parseCardFile(text: string): ParseResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const issues: ParseIssue[] = [];
  let title = "";
  const cards: ContentCard[] = [];

  let current: { front: string; line: number; key: string | null; hint: string | null; active: boolean; body: string[] } | null = null;
  let inFence = false;
  let readingAttributes = false;

  const finish = () => {
    if (!current) return;
    const back = current.body.join("\n").trim();
    if (!back) issues.push({ line: current.line, message: `Kortet ”${current.front}” saknar baksida.` });
    if (current.key !== null && !isValidKey(current.key)) {
      issues.push({ line: current.line, message: `Ogiltig nyckel ”${current.key}” (bara a–z, 0–9 och bindestreck).` });
    }
    cards.push({ key: current.key ?? "", front: current.front, back, hint: current.hint, active: current.active });
    current = null;
  };

  lines.forEach((raw, index) => {
    const lineNo = index + 1;
    if (isFence(raw)) inFence = !inFence;

    if (!inFence && raw.startsWith("# ") && !title) {
      title = raw.slice(2).trim();
      return;
    }

    if (!inFence && raw.startsWith("## ")) {
      finish();
      const front = raw.slice(3).trim();
      if (!front) issues.push({ line: lineNo, message: "Tom framsida." });
      current = { front, line: lineNo, key: null, hint: null, active: true, body: [] };
      readingAttributes = true;
      return;
    }

    if (!current) {
      if (!inFence && raw.trim() && !title) {
        issues.push({ line: lineNo, message: "Text före kategorirubriken (# Titel)." });
      }
      return;
    }

    if (readingAttributes) {
      if (!raw.trim()) {
        readingAttributes = false;
        return;
      }
      const m = ATTRIBUTE_RE.exec(raw);
      if (m) {
        const name = (m[1] ?? "").toLowerCase();
        const value = (m[2] ?? "").trim();
        if (name === "key" || name === "nyckel") current.key = value;
        else if (name === "aktiv" || name === "active") current.active = parseBool(value);
        else current.hint = value || null;
        return;
      }
      readingAttributes = false;
    }

    current.body.push(raw);
  });

  finish();

  if (!title) issues.push({ line: 1, message: "Filen saknar kategorirubrik (# Titel)." });
  return { file: { title, cards }, issues };
}

/** Modell → kanonisk filtext. parseCardFile(serializeCardFile(x)) ger tillbaka x. */
export function serializeCardFile(file: CardFile): string {
  const out: string[] = [`# ${file.title}`, ""];
  for (const card of file.cards) {
    out.push(`## ${card.front}`);
    if (card.key) out.push(`key: ${card.key}`);
    if (card.hint) out.push(`ledtråd: ${card.hint}`);
    if (!card.active) out.push("aktiv: nej");
    out.push("");
    out.push(card.back.trim());
    out.push("");
  }
  return `${out.join("\n").trimEnd()}\n`;
}
