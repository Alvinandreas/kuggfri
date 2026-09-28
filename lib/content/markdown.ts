/**
 * Kortfiler: markdown in, modell ut, och tillbaka igen. Ren modul.
 *
 * Formatet (docs/INNEHALL.md avsnitt 3):
 *
 *   # Områdets titel
 *
 *   ## Kortets framsida
 *   key: stabil-nyckel
 *   ledtråd: valfri ledtråd
 *   aktiv: nej
 *
 *   Baksidan i markdown, med $KaTeX$, listor och flera stycken.
 *
 *   ## Ett påstående som är sant eller falskt
 *   key: ett-pastaende
 *   typ: sant-falskt
 *   svar: falskt
 *
 *   Förklaringen, som visas efter svaret.
 *
 *   ## En flervalsfråga
 *   key: en-flervalsfraga
 *   typ: alternativ
 *   status: utkast
 *   källa: Canvas, Tentamen MTT085 24-10, uppgift 2
 *
 *   - [ ] Fel alternativ
 *   - [x] Rätt alternativ (flera [x] = flera rätta)
 *
 *   Förklaringen, som visas efter svaret.
 *
 * `##` i kolumn noll startar ett nytt kort, utom inuti en kodstaket (```).
 * Typer: självskattning (standard), begrepp, sant-falskt, alternativ (lib/cards/kinds.ts).
 * `status: utkast` = förslag som väntar på granskning; ett utkast är aldrig aktivt.
 */
import type { ContentCard } from "./model";
import { isValidKey } from "./model";
import {
  DEFAULT_CARD_KIND,
  isAutoGraded,
  isReviewStatus,
  trueFalseAnswer,
  trueFalseOptions,
  validateKind,
  type CardKind,
  type CardOption,
  type ReviewStatus,
} from "@/lib/cards/kinds";

export type CardFile = {
  title: string;
  cards: ContentCard[];
};

export type ParseIssue = { line: number; message: string };

export type ParseResult = {
  file: CardFile;
  issues: ParseIssue[];
};

const ATTRIBUTE_RE = /^(key|nyckel|ledtråd|ledtrad|hint|aktiv|active|typ|type|svar|answer|status|källa|kalla|source)\s*:\s*(.*)$/i;

const OPTION_RE = /^- \[( |x|X)\] (.+)$/;

/** Skrivsätt i filerna → uppgiftstyp. */
const KIND_ALIASES: Record<string, CardKind> = {
  sjalvskattning: "sjalvskattning",
  självskattning: "sjalvskattning",
  vanligt: "sjalvskattning",
  begrepp: "begrepp",
  "sant-falskt": "sant-falskt",
  "sant/falskt": "sant-falskt",
  "ja-nej": "sant-falskt",
  "ja/nej": "sant-falskt",
  alternativ: "alternativ",
  flerval: "alternativ",
};

function isFence(line: string): boolean {
  return /^\s*```/.test(line);
}

function parseBool(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !(v === "nej" || v === "no" || v === "false" || v === "0");
}

function parseAnswer(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === "sant" || v === "ja" || v === "true") return true;
  if (v === "falskt" || v === "nej" || v === "false") return false;
  return null;
}

/** Baksida när förklaring saknas: rätt svar i klartext (databasen kräver en baksida). */
export function answerSummary(kind: CardKind, options: readonly CardOption[]): string {
  if (kind === "sant-falskt") return trueFalseAnswer(options) ? "Påståendet är sant." : "Påståendet är falskt.";
  const right = options.filter((o) => o.correct).map((o) => o.text);
  return right.length === 1 ? `Rätt svar: ${right[0]}` : `Rätta svar: ${right.join("; ")}`;
}

type Pending = {
  front: string;
  line: number;
  key: string | null;
  hint: string | null;
  active: boolean;
  kind: CardKind;
  /** Oigenkänt värde på typ:, för felmeddelandet. */
  unknownKind: string | null;
  answer: boolean | null;
  unknownAnswer: string | null;
  review: ReviewStatus | null;
  source: string | null;
  body: string[];
};

export function parseCardFile(text: string): ParseResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const issues: ParseIssue[] = [];
  let title = "";
  const cards: ContentCard[] = [];

  let current: Pending | null = null;
  let inFence = false;
  let readingAttributes = false;

  const finish = () => {
    if (!current) return;
    const c: Pending = current;
    current = null;
    const at = (message: string) => issues.push({ line: c.line, message });
    if (c.unknownKind !== null) at(`Okänd typ ”${c.unknownKind}” (självskattning, begrepp, sant-falskt eller alternativ).`);
    if (c.unknownAnswer !== null) at(`Okänt svar ”${c.unknownAnswer}” (sant eller falskt).`);

    // Alternativen står först i brödtexten; resten är förklaringen (baksidan).
    let body = c.body;
    let options: CardOption[] | null = null;
    if (c.kind === "alternativ") {
      let i = 0;
      while (i < body.length && !body[i]?.trim()) i++;
      options = [];
      for (; i < body.length; i++) {
        const m = OPTION_RE.exec(body[i] ?? "");
        if (!m) break;
        options.push({ text: (m[2] ?? "").trim(), correct: m[1] !== " " });
      }
      body = body.slice(i);
    } else if (c.kind === "sant-falskt") {
      options = c.answer === null ? null : trueFalseOptions(c.answer);
    } else if (c.answer !== null) {
      at("svar: gäller bara typen sant-falskt.");
    }
    for (const problem of validateKind(c.kind, options)) at(`Kortet ”${c.front}”: ${problem}`);

    let back = body.join("\n").trim();
    if (!back && isAutoGraded(c.kind) && options && options.length >= 2) back = answerSummary(c.kind, options);
    if (!back) at(`Kortet ”${c.front}” saknar baksida.`);
    if (c.key !== null && !isValidKey(c.key)) at(`Ogiltig nyckel ”${c.key}” (bara a–z, 0–9 och bindestreck).`);

    cards.push({
      key: c.key ?? "",
      front: c.front,
      back,
      hint: c.hint,
      // Ett förslag är aldrig aktivt, oavsett vad som står i aktiv:.
      active: c.review ? false : c.active,
      kind: c.kind,
      options: isAutoGraded(c.kind) ? options : null,
      review: c.review,
      source: c.source,
    });
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
      current = {
        front,
        line: lineNo,
        key: null,
        hint: null,
        active: true,
        kind: DEFAULT_CARD_KIND,
        unknownKind: null,
        answer: null,
        unknownAnswer: null,
        review: null,
        source: null,
        body: [],
      };
      readingAttributes = true;
      return;
    }

    if (!current) {
      if (!inFence && raw.trim() && !title) {
        issues.push({ line: lineNo, message: "Text före områdesrubriken (# Titel)." });
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
        else if (name === "typ" || name === "type") {
          const kind = KIND_ALIASES[value.toLowerCase()];
          if (kind) current.kind = kind;
          else current.unknownKind = value;
        } else if (name === "svar" || name === "answer") {
          current.answer = parseAnswer(value);
          current.unknownAnswer = current.answer === null ? value : null;
        } else if (name === "status") {
          const v = value.toLowerCase();
          if (isReviewStatus(v)) current.review = v;
          else if (v && v !== "publicerad" && v !== "granskad") issues.push({ line: lineNo, message: `Okänd status ”${value}” (utkast eller avvisad).` });
        } else if (name === "källa" || name === "kalla" || name === "source") current.source = value || null;
        else current.hint = value || null;
        return;
      }
      readingAttributes = false;
    }

    current.body.push(raw);
  });

  finish();

  if (!title) issues.push({ line: 1, message: "Filen saknar områdesrubrik (# Titel)." });
  return { file: { title, cards }, issues };
}

/** Modell → kanonisk filtext. parseCardFile(serializeCardFile(x)) ger tillbaka x. */
export function serializeCardFile(file: CardFile): string {
  const out: string[] = [`# ${file.title}`, ""];
  for (const card of file.cards) {
    out.push(`## ${card.front}`);
    if (card.key) out.push(`key: ${card.key}`);
    if (card.kind !== DEFAULT_CARD_KIND) out.push(`typ: ${card.kind}`);
    if (card.kind === "sant-falskt") {
      const answer = trueFalseAnswer(card.options);
      if (answer !== null) out.push(`svar: ${answer ? "sant" : "falskt"}`);
    }
    if (card.review) out.push(`status: ${card.review}`);
    if (card.source) out.push(`källa: ${card.source}`);
    if (card.hint) out.push(`ledtråd: ${card.hint}`);
    if (!card.active && !card.review) out.push("aktiv: nej");
    out.push("");
    if (card.kind === "alternativ" && card.options) {
      for (const o of card.options) out.push(`- [${o.correct ? "x" : " "}] ${o.text}`);
      out.push("");
    }
    out.push(card.back.trim());
    out.push("");
  }
  return `${out.join("\n").trimEnd()}\n`;
}
