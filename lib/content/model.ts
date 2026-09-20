/**
 * Innehållsmodellen för pipelinen (docs/INNEHALL.md). Ren modul: inga beroenden på
 * Supabase, React eller filsystemet. Används av kortfilsparsern, planeraren och CLI:t.
 */
import { createHash } from "node:crypto";
import { matchKey } from "@/lib/text/first-line";

export { matchKey };

export type ContentCard = {
  /** Stabil nyckel inom kursen. Texterna får ändras utan att kortet byter identitet. */
  key: string;
  front: string;
  back: string;
  hint: string | null;
  /** false = kortet finns kvar men visas inte för studenterna. */
  active: boolean;
};

export type ContentCategory = {
  key: string;
  title: string;
  /** Filnamn relativt kursmappen. */
  file: string;
  cards: ContentCard[];
};

export type ContentCourse = {
  /** Kursens nyckel = sluggen i /d/<key>. */
  key: string;
  title: string;
  description: string | null;
  course_code: string | null;
  source_credit: string | null;
  /** YYYY-MM-DD eller null. */
  exam_date: string | null;
  published: boolean;
  sort_order: number;
  categories: ContentCategory[];
};

// ---------------------------------------------------------------------------
// Nycklar och id:n
// ---------------------------------------------------------------------------

/**
 * Fast namnrymd för UUID v5. Samma värde som seed-bygget använde, så att kort som
 * redan finns i databasen behåller sina id:n och gästers localStorage-progress överlever.
 */
export const UUID_NAMESPACE = "6b9d1c1e-2f2a-4a3e-9d1e-8f3c2a1b7d4e";

export function uuidV5(name: string): string {
  const ns = Buffer.from(UUID_NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function deckId(courseKey: string): string {
  return uuidV5(`deck:${courseKey}`);
}

export function categoryId(courseKey: string, categoryKey: string): string {
  return uuidV5(`category:${courseKey}:${categoryKey}`);
}

export function cardId(courseKey: string, cardKey: string): string {
  return uuidV5(`card:${courseKey}:${cardKey}`);
}

const KEY_MAX = 40;

/** Text → nyckel: gemener, svenska tecken translittererade, bara a–z, 0–9 och bindestreck. */
export function slugifyKey(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= KEY_MAX) return base || "kort";
  // Klipp vid ordgräns så att nyckeln går att läsa.
  const cut = base.slice(0, KEY_MAX);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > KEY_MAX / 2 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "") || "kort";
}

/** Gör nyckeln unik genom att lägga till -2, -3 … Uppdaterar mängden. */
export function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

export function isValidKey(key: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(key) && key.length <= 64;
}

// ---------------------------------------------------------------------------
// Hashning
//
// Hashen täcker *innehållet*: det som bär information och som går att förlora.
// Ordningen (sort_order) ingår inte. Skälet: ordning är en egenskap hos listan som
// helhet, så en enda radering i admin lämnar luckor i numreringen och skulle få varje
// följande kort att se ändrat ut. Ordningen följer i stället alltid filerna, och `pull`
// tar in den ordning som gäller i databasen. Kategoritillhörighet räknas som innehåll,
// eftersom att flytta ett kort mellan kategorier är ett redaktionellt beslut.
// ---------------------------------------------------------------------------

function short(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 8);
}

/**
 * Kortets innehåll: allt utom nyckeln, plus vilken kategori det ligger i.
 *
 * Typen är `Omit<ContentCard, "key">` och inte en handplockad lista, med flit. Lägger vi
 * till ett fält på kortet (t.ex. korttyp eller svarsalternativ) blir varje anropsställe ett
 * kompileringsfel tills fältet skickas med. Med en handplockad lista hade det nya fältet
 * i stället fallit utanför hashen, och pipelinen hade sett ett ändrat kort som oförändrat
 * och aldrig skrivit det till databasen. Det är det enda stället i kodbasen där en glömd
 * rad ger tyst dataförlust.
 */
export function cardContentHash(card: Omit<ContentCard, "key">, categoryKey: string | null): string {
  const fields = Object.entries(card)
    // Nyckeln är identitet, inte innehåll: att byta nyckel ska inte se ut som en ändring.
    // Filtreras bort här så att anropare kan skicka ett helt ContentCard utan att hashen
    // skiljer sig från den som byggs ur en databasrad.
    .filter(([name]) => name !== "key")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => [name, value ?? ""] as const);
  return `c${short(JSON.stringify([fields, categoryKey ?? ""]))}`;
}

/** Innehållshashen ur en lagrad source_hash. null när den saknas eller har okänd form. */
export function storedContentHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  return /^c[0-9a-f]{8}$/.test(hash) ? hash : null;
}

export function categoryHash(title: string): string {
  return `c${short(title)}`;
}

export function deckHashOf(course: Omit<ContentCourse, "categories">): string {
  return `c${short(
    JSON.stringify([course.title, course.description ?? "", course.course_code ?? "", course.source_credit ?? "", course.exam_date ?? "", course.published, course.sort_order]),
  )}`;
}

/** Alla kort i kursen i den ordning de ska ha, med kategori och global sort_order. */
export function flattenCards(course: ContentCourse): { card: ContentCard; categoryKey: string; sortOrder: number }[] {
  const out: { card: ContentCard; categoryKey: string; sortOrder: number }[] = [];
  let order = 0;
  for (const category of course.categories) {
    for (const card of category.cards) {
      out.push({ card, categoryKey: category.key, sortOrder: order });
      order++;
    }
  }
  return out;
}
