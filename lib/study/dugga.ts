/**
 * Duggans regler, valda på kurssidan innan den startar: antal frågor, om ledtrådar får
 * visas och om tiden ska tas. Reglerna följer med i adressen till passet (antal, ledtradar,
 * tid), så att en dugga går att länka till och starta om med samma regler.
 */
export type DuggaSize = 10 | 20 | 30 | "alla";

export type DuggaSettings = {
  size: DuggaSize;
  hints: boolean;
  timer: boolean;
};

export const DUGGA_SIZES: readonly DuggaSize[] = [10, 20, 30, "alla"];

export const DEFAULT_DUGGA: DuggaSettings = { size: 20, hints: false, timer: true };

/** Antal frågor för ett urval med `available` kort. */
export function duggaCount(size: DuggaSize, available: number): number {
  return size === "alla" ? available : Math.min(size, available);
}

/** Antalet som selectCardIds och planDeckSession ska använda (Infinity = alla). */
export function duggaExamSize(size: DuggaSize): number {
  return size === "alla" ? Number.POSITIVE_INFINITY : size;
}

type Query = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseDugga(query: Query): DuggaSettings {
  const rawSize = first(query.antal);
  const size: DuggaSize = rawSize === "alla" ? "alla" : rawSize === "10" ? 10 : rawSize === "30" ? 30 : rawSize === "20" ? 20 : DEFAULT_DUGGA.size;
  const hints = first(query.ledtradar) === "1";
  const rawTimer = first(query.tid);
  const timer = rawTimer === undefined ? DEFAULT_DUGGA.timer : rawTimer === "1";
  return { size, hints, timer };
}

/** "&antal=20&ledtradar=0&tid=1", att hänga på passets adress. */
export function duggaQuery(s: DuggaSettings): string {
  return `&antal=${s.size}&ledtradar=${s.hints ? 1 : 0}&tid=${s.timer ? 1 : 0}`;
}
