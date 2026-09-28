/**
 * Utgåvor: sparade lägen av en kurs innehåll, att kunna gå tillbaka till.
 *
 * En utgåva är hela kursmodellen (områden och kort, så som filerna uttrycker dem) vid ett
 * tillfälle, sparad som JSON i utgavor/<kurs>/<id>.json. Mappen ligger i git, så utgåvorna finns
 * även på GitHub och inte bara på en dator. De skapas automatiskt före varje apply mot
 * produktionen (då fångas även det som ändrats i admin sedan förra synken), och för hand med
 * `kuggfri utgava`.
 *
 * Att gå tillbaka (`kuggfri aterga`) skriver utgåvans kort till filerna och synkar med --tvinga.
 * Kortens nycklar är desamma, så studenternas progress följer med. Kort som tillkommit efter
 * utgåvan raderas aldrig: de ligger kvar i filerna men blir inaktiva (utkast förblir utkast).
 * Kursens egna uppgifter (titel, tentadatum …) och originalmarkeringen rörs inte.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ContentCard, ContentCategory, ContentCourse } from "@/lib/content/model";

export type Utgava = {
  id: string;
  kurs: string;
  /** ISO-tid. */
  skapad: string;
  /** Varifrån innehållet lästes: databasen (prod/lokal) eller filerna i en commit. */
  kalla: "prod" | "lokal" | "commit";
  commit: string | null;
  notering: string | null;
  antal: Antal;
  course: ContentCourse;
};

export type Antal = { kort: number; aktiva: number; utkast: number; inaktiva: number; original: number };

export function countCourse(course: ContentCourse): Antal {
  const cards = course.categories.flatMap((c) => c.cards);
  return {
    kort: cards.length,
    aktiva: cards.filter((c) => c.active).length,
    utkast: cards.filter((c) => c.review === "utkast").length,
    inaktiva: cards.filter((c) => !c.active && !c.review).length,
    original: cards.filter((c) => c.original).length,
  };
}

export function utgavaDir(root: string, kurs: string): string {
  return join(root, "utgavor", kurs);
}

/** Id: 2026-09-28-2315-prod (sorteras i tidsordning). */
export function utgavaId(now: Date, kalla: Utgava["kalla"]): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}-${kalla}`;
}

export function saveUtgava(root: string, u: Utgava): string {
  const dir = utgavaDir(root, u.kurs);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${u.id}.json`);
  writeFileSync(path, `${JSON.stringify(u, null, 1)}\n`, "utf8");
  return path;
}

export function listUtgavor(root: string, kurs: string): Utgava[] {
  const dir = utgavaDir(root, kurs);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Utgava);
}

/** Hittar en utgåva på hela id:t eller en entydig början av det. */
export function findUtgava(all: Utgava[], idOrPrefix: string): Utgava {
  const exact = all.find((u) => u.id === idOrPrefix);
  if (exact) return exact;
  const hits = all.filter((u) => u.id.startsWith(idOrPrefix));
  if (hits.length === 1 && hits[0]) return hits[0];
  if (hits.length === 0) throw new Error(`Ingen utgåva ”${idOrPrefix}”. Kör kuggfri utgavor <kurs>.`);
  throw new Error(`”${idOrPrefix}” matchar flera utgåvor: ${hits.map((u) => u.id).join(", ")}`);
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Innehållet från utgåvan, men originalmarkeringen behålls om kortet är original i dag. */
function fromUtgava(card: ContentCard, current: ContentCard | undefined): ContentCard {
  return { ...clone(card), original: card.original || (current?.original ?? false) };
}

/**
 * Hela kursens kort som i utgåvan. Kort som finns i dag men inte i utgåvan behålls, inaktiva,
 * i sitt nuvarande område (området läggs sist om det inte fanns i utgåvan).
 */
export function restoreCourse(current: ContentCourse, target: ContentCourse): ContentCourse {
  const currentCards = new Map(current.categories.flatMap((c) => c.cards.map((card) => [card.key, card] as const)));
  const targetKeys = new Set(target.categories.flatMap((c) => c.cards.map((card) => card.key)));
  const categories: ContentCategory[] = target.categories.map((area) => ({
    ...clone(area),
    cards: area.cards.map((card) => fromUtgava(card, currentCards.get(card.key))),
  }));
  for (const area of current.categories) {
    const extra = area.cards.filter((c) => !targetKeys.has(c.key)).map((c) => ({ ...clone(c), active: false }));
    if (extra.length === 0) continue;
    const existing = categories.find((c) => c.key === area.key);
    if (existing) existing.cards.push(...extra);
    else categories.push({ ...clone(area), cards: extra });
  }
  // Kursens egna uppgifter hör inte till korten: de ändras i admin eller kurs.json.
  return { ...current, categories };
}

/**
 * Enstaka kort som i utgåvan. Kortet flyttas till sitt område i utgåvan om det området finns i
 * dag; annars stannar det där det är. Ordningen i området behålls när området är detsamma.
 */
export function restoreCards(current: ContentCourse, target: ContentCourse, keys: string[]): ContentCourse {
  const inTarget = new Map(target.categories.flatMap((a) => a.cards.map((card) => [card.key, { card, area: a.key }] as const)));
  const missing = keys.filter((k) => !inTarget.has(k));
  if (missing.length > 0) throw new Error(`Finns inte i utgåvan: ${missing.join(", ")}`);
  let course = clone(current);
  for (const key of keys) {
    const { card, area } = inTarget.get(key)!;
    const from = course.categories.find((a) => a.cards.some((c) => c.key === key));
    const now = from?.cards.find((c) => c.key === key);
    const restored = fromUtgava(card, now);
    const areaExists = course.categories.some((a) => a.key === area);
    if (from && (from.key === area || !areaExists)) {
      from.cards = from.cards.map((c) => (c.key === key ? restored : c));
      continue;
    }
    course = {
      ...course,
      categories: course.categories.map((a) => ({
        ...a,
        cards: a.key === area ? [...a.cards.filter((c) => c.key !== key), restored] : a.cards.filter((c) => c.key !== key),
      })),
    };
  }
  return course;
}

/** Kort som skiljer sig mellan två kursmodeller, för en översikt innan man återställer. */
export function diffCourses(a: ContentCourse, b: ContentCourse): { andrade: string[]; baraI: string[]; baraU: string[] } {
  const place = (course: ContentCourse) =>
    new Map(course.categories.flatMap((area) => area.cards.map((card) => [card.key, JSON.stringify([area.key, { ...card, original: false }])] as const)));
  const pa = place(a);
  const pb = place(b);
  return {
    andrade: [...pa.keys()].filter((k) => pb.has(k) && pb.get(k) !== pa.get(k)),
    baraI: [...pa.keys()].filter((k) => !pb.has(k)),
    baraU: [...pb.keys()].filter((k) => !pa.has(k)),
  };
}
