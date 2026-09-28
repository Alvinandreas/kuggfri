/**
 * kuggfri – områden och uppgiftstyper i filerna (content/<kurs>/). Rör aldrig databasen;
 * kör `plan` och `apply` efteråt som vanligt. Kortens nycklar ändras aldrig, så id och
 * studenternas progress följer med när ett kort byter område eller typ.
 *
 *   npm run kuggfri -- omraden <kurs>                                  översikt: område × uppgiftstyp, utkast
 *   npm run kuggfri -- nytt-omrade <kurs> <key> --titel "..." [--efter <key>]
 *   npm run kuggfri -- byt-namn-omrade <kurs> <key> --titel "..."
 *   npm run kuggfri -- flytta <kurs> <kort>[,<kort>...] --till <område>
 *   npm run kuggfri -- byt-typ <kurs> <kort>[,<kort>...] --typ <sjalvskattning|begrepp>
 *   npm run kuggfri -- mappa <kurs> <fil.tsv> [--skapa] [--ja]         kortnyckel<TAB>område[<TAB>typ] per rad
 *   npm run kuggfri -- ordna-omraden <kurs> <key>,<key>,...            ny ordning, filerna numreras om
 *   npm run kuggfri -- ta-bort-omrade <kurs> <key>                     bara tomma områden
 *   npm run kuggfri -- markera-original <kurs> --commit <sha>          korten som fanns i den committen blir original
 *
 * Ett område som blir tomt tas inte bort automatiskt; ta bort det ur kurs.json när du vill
 * (apply raderar det i databasen när det saknas i filerna och inte har kort kvar).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { CARD_KIND_LABEL, CARD_KINDS, isAutoGraded, isCardKind, type CardKind } from "@/lib/cards/kinds";
import { isValidKey, type ContentCard, type ContentCategory, type ContentCourse } from "@/lib/content/model";
import { loadCourse, saveCourse } from "@/lib/content/store";

const ROOT = process.cwd();
const say = (s = "") => process.stdout.write(s + "\n");

type Args = { positional: string[]; flags: Record<string, string | boolean> };

function load(courseKey: string | undefined): ContentCourse {
  if (!courseKey) throw new Error("Ange kurs.");
  const { course, issues } = loadCourse(ROOT, courseKey);
  if (issues.length > 0) {
    for (const i of issues) say(`  ${i.file}:${i.line} ${i.message}`);
    throw new Error("Rätta felen i filerna först (npm run kuggfri -- kontrollera).");
  }
  return course;
}

function keysArg(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function findArea(course: ContentCourse, key: string): ContentCategory {
  const area = course.categories.find((c) => c.key === key);
  if (!area) throw new Error(`Området ”${key}” finns inte. Finns: ${course.categories.map((c) => c.key).join(", ")}`);
  return area;
}

/** Filnamn efter ordningen: 01-nyckel.md, 02-… */
function renumber(course: ContentCourse): ContentCourse {
  return { ...course, categories: course.categories.map((c, i) => ({ ...c, file: `${String(i + 1).padStart(2, "0")}-${c.key}.md` })) };
}

/** Flyttar kort (nycklar) till målområdet, sist i den ordning de anges. Returnerar ny kurs. */
export function moveCards(course: ContentCourse, cardKeys: string[], target: string): { course: ContentCourse; moved: number } {
  findArea(course, target);
  const wanted = new Set(cardKeys);
  const found = new Map<string, ContentCard>();
  const categories = course.categories.map((c) => ({
    ...c,
    cards: c.key === target ? c.cards : c.cards.filter((card) => (wanted.has(card.key) ? (found.set(card.key, card), false) : true)),
  }));
  const already = new Set(course.categories.find((c) => c.key === target)?.cards.map((c) => c.key));
  const missing = cardKeys.filter((k) => !found.has(k) && !already.has(k));
  if (missing.length > 0) throw new Error(`Hittar inte kort: ${missing.join(", ")}`);
  const incoming = cardKeys.map((k) => found.get(k)).filter((c): c is ContentCard => !!c);
  return {
    course: { ...course, categories: categories.map((c) => (c.key === target ? { ...c, cards: [...c.cards, ...incoming] } : c)) },
    moved: incoming.length,
  };
}

/** Byter uppgiftstyp mellan vändkortstyperna (självskattning ↔ begrepp). */
export function setKind(course: ContentCourse, cardKeys: string[], kind: CardKind): { course: ContentCourse; changed: number } {
  if (isAutoGraded(kind)) throw new Error("Sant/Falskt och Alternativ kräver svarsalternativ; skriv dem i filen eller i admin.");
  const wanted = new Set(cardKeys);
  const seen = new Set<string>();
  let changed = 0;
  const categories = course.categories.map((c) => ({
    ...c,
    cards: c.cards.map((card) => {
      if (!wanted.has(card.key)) return card;
      seen.add(card.key);
      if (isAutoGraded(card.kind)) throw new Error(`”${card.key}” är ${CARD_KIND_LABEL[card.kind]}; byt typ på den i filen.`);
      if (card.kind !== kind) changed++;
      return { ...card, kind };
    }),
  }));
  const missing = cardKeys.filter((k) => !seen.has(k));
  if (missing.length > 0) throw new Error(`Hittar inte kort: ${missing.join(", ")}`);
  return { course: { ...course, categories }, changed };
}

// ---------------------------------------------------------------------------

function cmdOmraden(args: Args): void {
  const course = load(args.positional[1]);
  const kinds = CARD_KINDS;
  const head = ["Område", ...kinds.map((k) => CARD_KIND_LABEL[k]), "Utkast", "Avvisade", "Inaktiva"];
  const rows: string[][] = [];
  const totals = new Array(head.length - 1).fill(0) as number[];
  for (const area of course.categories) {
    const counts = [
      ...kinds.map((k) => area.cards.filter((c) => c.kind === k && c.active).length),
      area.cards.filter((c) => c.review === "utkast").length,
      area.cards.filter((c) => c.review === "avvisad").length,
      area.cards.filter((c) => !c.active && !c.review).length,
    ];
    counts.forEach((n, i) => (totals[i] = (totals[i] ?? 0) + n));
    rows.push([`${area.key} (${area.title})`, ...counts.map(String)]);
  }
  rows.push(["Totalt", ...totals.map(String)]);
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (cells: string[]) => cells.map((c, i) => (i === 0 ? c.padEnd(widths[i] ?? 0) : c.padStart(widths[i] ?? 0))).join("  ");
  say(line(head));
  say(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) say(line(r));
}

function cmdNyttOmrade(args: Args): void {
  const [, courseKey, key] = args.positional;
  const course = load(courseKey);
  if (!key || !isValidKey(key)) throw new Error("Ange en giltig nyckel (a–z, 0–9, bindestreck).");
  if (course.categories.some((c) => c.key === key)) throw new Error(`Området ”${key}” finns redan.`);
  const title = typeof args.flags.titel === "string" ? args.flags.titel : key;
  const after = typeof args.flags.efter === "string" ? args.flags.efter : null;
  const index = after ? course.categories.findIndex((c) => c.key === after) + 1 : course.categories.length;
  if (after && index === 0) throw new Error(`Området ”${after}” finns inte.`);
  const categories = [...course.categories];
  categories.splice(index, 0, { key, title, file: `${key}.md`, cards: [] });
  saveCourse(ROOT, renumber({ ...course, categories }));
  say(`Skapade området ${key} (”${title}”) på plats ${index + 1}.`);
}

function cmdBytNamn(args: Args): void {
  const [, courseKey, key] = args.positional;
  const course = load(courseKey);
  const title = args.flags.titel;
  if (!key || typeof title !== "string") throw new Error('kuggfri byt-namn-omrade <kurs> <key> --titel "..."');
  findArea(course, key);
  saveCourse(ROOT, { ...course, categories: course.categories.map((c) => (c.key === key ? { ...c, title } : c)) });
  say(`Området ${key} heter nu ”${title}”.`);
}

function cmdFlytta(args: Args): void {
  const [, courseKey, keys] = args.positional;
  const target = args.flags.till;
  if (typeof target !== "string") throw new Error("kuggfri flytta <kurs> <kort>[,<kort>...] --till <område>");
  const { course, moved } = moveCards(load(courseKey), keysArg(keys), target);
  saveCourse(ROOT, course);
  say(`Flyttade ${moved} kort till ${target}. Kör plan för att se ändringen mot databasen.`);
}

function cmdBytTyp(args: Args): void {
  const [, courseKey, keys] = args.positional;
  const kind = args.flags.typ;
  if (!isCardKind(kind)) throw new Error(`--typ ska vara en av: ${CARD_KINDS.join(", ")}`);
  const { course, changed } = setKind(load(courseKey), keysArg(keys), kind);
  saveCourse(ROOT, course);
  say(`${changed} kort har nu typen ${CARD_KIND_LABEL[kind]}.`);
}

/** TSV: kortnyckel, område, [typ]. Rader som börjar med # och rubrikrad ignoreras. */
function cmdMappa(args: Args): void {
  const [, courseKey, file] = args.positional;
  if (!file) throw new Error("kuggfri mappa <kurs> <fil.tsv> [--skapa]");
  let course = load(courseKey);
  const rows = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => l.split("\t").map((c) => c.trim()))
    .filter((r) => r[0] && !r[0].startsWith("#") && r[0] !== "kortnyckel");
  const byArea = new Map<string, string[]>();
  const byKind = new Map<CardKind, string[]>();
  for (const [cardKey, area, kind] of rows) {
    if (!cardKey || !area) continue;
    byArea.set(area, [...(byArea.get(area) ?? []), cardKey]);
    if (kind && isCardKind(kind) && !isAutoGraded(kind)) byKind.set(kind, [...(byKind.get(kind) ?? []), cardKey]);
    else if (kind && !isCardKind(kind)) throw new Error(`Okänd typ ”${kind}” för ${cardKey}.`);
  }
  const unknown = [...byArea.keys()].filter((a) => !course.categories.some((c) => c.key === a));
  if (unknown.length > 0) {
    if (args.flags.skapa !== true) throw new Error(`Områden saknas: ${unknown.join(", ")}. Skapa dem med nytt-omrade, eller kör med --skapa.`);
    course = { ...course, categories: [...course.categories, ...unknown.map((key) => ({ key, title: key, file: `${key}.md`, cards: [] }))] };
    say(`Skapade områdena ${unknown.join(", ")} (titel = nyckel; byt med byt-namn-omrade).`);
  }
  let moved = 0;
  for (const [area, keys] of byArea) {
    // Kort som redan ligger i området står kvar på sin plats.
    const inArea = new Set(course.categories.find((c) => c.key === area)?.cards.map((c) => c.key));
    const toMove = keys.filter((k) => !inArea.has(k));
    if (toMove.length === 0) continue;
    const r = moveCards(course, toMove, area);
    course = r.course;
    moved += r.moved;
  }
  let changed = 0;
  for (const [kind, keys] of byKind) {
    const r = setKind(course, keys, kind);
    course = r.course;
    changed += r.changed;
  }
  saveCourse(ROOT, renumber(course));
  say(`Klart: ${moved} kort flyttade, ${changed} bytte typ. Filerna är numrerade efter ordningen i kurs.json.`);
}

function cmdOrdna(args: Args): void {
  const [, courseKey, keys] = args.positional;
  const course = load(courseKey);
  const order = keysArg(keys);
  const missing = course.categories.filter((c) => !order.includes(c.key)).map((c) => c.key);
  if (missing.length > 0) throw new Error(`Ordningen saknar: ${missing.join(", ")}`);
  const categories = order.map((k) => findArea(course, k));
  saveCourse(ROOT, renumber({ ...course, categories }));
  say(`Ny ordning: ${order.join(", ")}.`);
}

function cmdTaBort(args: Args): void {
  const [, courseKey, key] = args.positional;
  const course = load(courseKey);
  const area = findArea(course, key ?? "");
  if (area.cards.length > 0) throw new Error(`Området ”${area.key}” har ${area.cards.length} kort. Flytta dem först.`);
  saveCourse(ROOT, renumber({ ...course, categories: course.categories.filter((c) => c.key !== area.key) }));
  say(`Tog bort det tomma området ${area.key}. apply tar bort det i databasen.`);
}

/**
 * Markerar korten som fanns i en viss commit som original (den beprövade uppsättningen).
 * Kort som inte fanns där avmarkeras inte: markeringen läggs bara till.
 */
function cmdMarkeraOriginal(args: Args): void {
  const [, courseKey] = args.positional;
  const commit = args.flags.commit;
  if (!courseKey || typeof commit !== "string") throw new Error("kuggfri markera-original <kurs> --commit <sha>");
  const course = load(courseKey);
  const out = execFileSync("git", ["grep", "-h", "^key: ", commit, "--", `content/${courseKey}`], { encoding: "utf8" });
  const keys = new Set(out.split(/\r?\n/).map((l) => l.replace(/^key:\s*/, "").trim()).filter(Boolean));
  let marked = 0;
  const found = new Set<string>();
  const categories = course.categories.map((c) => ({
    ...c,
    cards: c.cards.map((card) => {
      if (!keys.has(card.key)) return card;
      found.add(card.key);
      if (card.original) return card;
      marked++;
      return { ...card, original: true };
    }),
  }));
  saveCourse(ROOT, { ...course, categories });
  const missing = [...keys].filter((k) => !found.has(k));
  say(`${marked} kort markerade som original (${found.size} av ${keys.size} nycklar från ${commit} finns kvar).`);
  if (missing.length > 0) say(`Saknas i filerna: ${missing.join(", ")}`);
}

export function runOmraden(command: string, args: Args): void {
  switch (command) {
    case "omraden":
    case "områden":
      return cmdOmraden(args);
    case "nytt-omrade":
      return cmdNyttOmrade(args);
    case "byt-namn-omrade":
      return cmdBytNamn(args);
    case "flytta":
      return cmdFlytta(args);
    case "byt-typ":
      return cmdBytTyp(args);
    case "mappa":
      return cmdMappa(args);
    case "ordna-omraden":
      return cmdOrdna(args);
    case "ta-bort-omrade":
      return cmdTaBort(args);
    case "markera-original":
      return cmdMarkeraOriginal(args);
    default:
      throw new Error(`Okänt kommando: ${command}`);
  }
}

export const OMRADE_COMMANDS = ["omraden", "områden", "nytt-omrade", "byt-namn-omrade", "flytta", "byt-typ", "mappa", "ordna-omraden", "ta-bort-omrade", "markera-original"];
