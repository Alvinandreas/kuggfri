/**
 * Passets inställningar: vad studenten ställer in under "Inställningar" i Ditt pass innan
 * passet startar. Varje läge har sina egna (antal kort, nya kort, ordning, uppgiftstyper,
 * ledtrådar, tidtagning) och varje inställning styr faktiskt urvalet, kön eller visningen.
 *
 * Ren modul. Inställningarna följer med i adressen till passet, så att ett pass går att
 * länka till och fortsätta med samma val. Bara det som skiljer sig från lägets standard
 * skrivs ut (duggan skriver alltid sina tre regler, som förut), så att standardvalen ger
 * samma adresser och samma pass som innan inställningarna fanns.
 */
import type { StudyMode } from "@/lib/progress/types";
import type { CardKind } from "@/lib/cards/kinds";
import { DEFAULT_DUGGA, parseDugga } from "@/lib/study/dugga";

/** Lägena på kurssidan: Stjärnmärkta körs som fri repetition men har egna inställningar. */
export type SettingsMode = StudyMode | "starred";

export type SessionSize = 10 | 20 | 30 | "alla";
export const SESSION_SIZES: readonly SessionSize[] = [10, 20, 30, "alla"];

/**
 * Ordningen i passet.
 * - standard: lägets egen ordning (schemat: förfallna först; fri repetition, kluriga och
 *   stjärnmärkta: svagast först).
 * - kurs: kursens ordning.
 * - slump: slumpad.
 * - omrade: schemalagd repetition, ett område i taget (i kursens ordning).
 */
export type SessionOrder = "standard" | "kurs" | "slump" | "omrade";

/** Uppgiftstyper: alla, bara vändkort (skattas själv) eller bara flerval (rättas direkt). */
export type KindFilter = "alla" | "vand" | "flerval";
export const KIND_FILTERS: readonly KindFilter[] = ["alla", "vand", "flerval"];

export type SessionSettings = {
  /** Antal kort i passet. "alla": hela urvalet (schemalagt: dagens kort). */
  size: SessionSize;
  /** Ledtrådar får visas när kortet har en. */
  hints: boolean;
  /** Duggan: visa tiden. */
  timer: boolean;
  /** Schemalagt: följ dagens dos av nya kort. Av: bara repetitioner. */
  newCards: boolean;
  order: SessionOrder;
  kinds: KindFilter;
  /** Kluriga kort: ta med kort som aldrig skattats. Av: bara kort skattade 1–2. */
  unseen: boolean;
  /** Slumpad genomkörning: bara de ikryssade områdena i stället för hela kursen. */
  followAreas: boolean;
};

export type SettingKey = "size" | "newCards" | "order" | "kinds" | "unseen" | "followAreas" | "hints" | "timer";

/**
 * Inställningarna varje läge visar, i den ordning de visas. Ledtrådar visas bara när
 * urvalet har kort med ledtråd (duggan visar alltid sina regler).
 */
export const MODE_SETTINGS: Record<SettingsMode, readonly SettingKey[]> = {
  fsrs: ["size", "newCards", "order", "hints"],
  tricky: ["size", "order", "unseen", "hints"],
  free: ["size", "order", "kinds", "hints"],
  random: ["size", "kinds", "followAreas", "hints"],
  exam: ["size", "hints", "timer"],
  starred: ["size", "order", "hints"],
};

/** Ordningarna ett läge kan välja mellan. Två val blir ett reglage, fler en segmentväljare. */
export const ORDER_CHOICES: Record<SettingsMode, readonly SessionOrder[]> = {
  fsrs: ["standard", "omrade"],
  tricky: ["standard", "slump"],
  free: ["standard", "kurs", "slump"],
  random: ["standard"],
  exam: ["standard"],
  starred: ["standard", "kurs", "slump"],
};

const BASE: SessionSettings = {
  size: "alla",
  hints: true,
  timer: false,
  newCards: true,
  order: "standard",
  kinds: "alla",
  unseen: true,
  followAreas: false,
};

/** Standardvärdena: samma pass som innan inställningarna fanns. */
export function defaultSettings(mode: SettingsMode): SessionSettings {
  if (mode === "exam") return { ...BASE, size: DEFAULT_DUGGA.size, hints: DEFAULT_DUGGA.hints, timer: DEFAULT_DUGGA.timer };
  return { ...BASE };
}

/** Taket på antal kort, eller undefined för "alla". */
export function sizeLimit(size: SessionSize): number | undefined {
  return size === "alla" ? undefined : size;
}

function isSize(v: unknown): v is SessionSize {
  return v === 10 || v === 20 || v === 30 || v === "alla";
}

/**
 * Tar in ett värde av okänd form (localStorage, gamla versioner) och ger giltiga
 * inställningar för läget: okända fält och värden faller tillbaka på lägets standard.
 */
export function sanitizeSettings(mode: SettingsMode, raw: unknown): SessionSettings {
  const d = defaultSettings(mode);
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const bool = (key: keyof SessionSettings, fallback: boolean) => (typeof r[key] === "boolean" ? (r[key] as boolean) : fallback);
  const order = typeof r.order === "string" && (ORDER_CHOICES[mode] as readonly string[]).includes(r.order) ? (r.order as SessionOrder) : d.order;
  const kinds = typeof r.kinds === "string" && (KIND_FILTERS as readonly string[]).includes(r.kinds) ? (r.kinds as KindFilter) : d.kinds;
  const s: SessionSettings = {
    size: isSize(r.size) ? r.size : d.size,
    hints: bool("hints", d.hints),
    timer: bool("timer", d.timer),
    newCards: bool("newCards", d.newCards),
    order,
    kinds,
    unseen: bool("unseen", d.unseen),
    followAreas: bool("followAreas", d.followAreas),
  };
  return normalize(mode, s);
}

/** Inställningar som läget inte har får alltid standardvärdet, så att de inte påverkar passet. */
function normalize(mode: SettingsMode, s: SessionSettings): SessionSettings {
  const d = defaultSettings(mode);
  const has = new Set(MODE_SETTINGS[mode]);
  const out = { ...s };
  for (const key of Object.keys(d) as (keyof SessionSettings)[]) {
    if (!has.has(key as SettingKey)) (out as Record<string, unknown>)[key] = d[key];
  }
  return out;
}

type Query = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Läser inställningarna ur passets adress. Saknade parametrar ger lägets standard. */
export function parseSessionSettings(mode: SettingsMode, query: Query): SessionSettings {
  const d = defaultSettings(mode);
  if (mode === "exam") {
    const dugga = parseDugga(query);
    return { ...d, size: dugga.size, hints: dugga.hints, timer: dugga.timer };
  }
  const rawSize = first(query.antal);
  const size: SessionSize = rawSize === "alla" ? "alla" : rawSize === "10" ? 10 : rawSize === "20" ? 20 : rawSize === "30" ? 30 : d.size;
  const flag = (key: string, fallback: boolean) => {
    const v = first(query[key]);
    return v === "1" ? true : v === "0" ? false : fallback;
  };
  const rawOrder = first(query.ordning);
  const rawKinds = first(query.typer);
  return sanitizeSettings(mode, {
    size,
    hints: flag("ledtradar", d.hints),
    newCards: flag("nyakort", d.newCards),
    order: rawOrder ?? d.order,
    kinds: rawKinds ?? d.kinds,
    unseen: flag("osedda", d.unseen),
    followAreas: flag("omraden", d.followAreas),
  });
}

/**
 * "&antal=10&ordning=slump" att hänga på passets adress. Bara det som skiljer sig från
 * lägets standard, utom i duggan som alltid skriver sina regler (antal, ledtradar, tid).
 */
export function settingsQuery(mode: SettingsMode, s: SessionSettings): string {
  if (mode === "exam") return `&antal=${s.size}&ledtradar=${s.hints ? 1 : 0}&tid=${s.timer ? 1 : 0}`;
  const d = defaultSettings(mode);
  const n = normalize(mode, s);
  const parts: string[] = [];
  if (n.size !== d.size) parts.push(`antal=${n.size}`);
  if (n.newCards !== d.newCards) parts.push(`nyakort=${n.newCards ? 1 : 0}`);
  if (n.order !== d.order) parts.push(`ordning=${n.order}`);
  if (n.kinds !== d.kinds) parts.push(`typer=${n.kinds}`);
  if (n.unseen !== d.unseen) parts.push(`osedda=${n.unseen ? 1 : 0}`);
  if (n.followAreas !== d.followAreas) parts.push(`omraden=${n.followAreas ? 1 : 0}`);
  if (n.hints !== d.hints) parts.push(`ledtradar=${n.hints ? 1 : 0}`);
  return parts.map((p) => `&${p}`).join("");
}

/** Hör uppgiftstypen till filtret? Kort utan typ räknas som självskattning. */
export function kindMatches(kind: CardKind | undefined, filter: KindFilter): boolean {
  if (filter === "alla") return true;
  const auto = kind === "sant-falskt" || kind === "alternativ";
  return filter === "flerval" ? auto : !auto;
}

/** Kort som passar uppgiftstypfiltret. */
export function filterKinds<T extends { kind?: CardKind }>(cards: readonly T[], filter: KindFilter): T[] {
  return filter === "alla" ? [...cards] : cards.filter((c) => kindMatches(c.kind, filter));
}

/** Sparade val per läge i webbläsaren, så att studenten slipper ställa om varje gång. */
export const SETTINGS_STORAGE_KEY = "kuggfri:passinstallningar:v1";

const MODES: readonly SettingsMode[] = ["fsrs", "tricky", "free", "random", "exam", "starred"];

/** Läser alla sparade val. Trasig eller saknad lagring ger standardvärden. */
export function readStoredSettings(storage: Pick<Storage, "getItem"> | null | undefined): Record<SettingsMode, SessionSettings> {
  let raw: unknown = null;
  try {
    const text = storage?.getItem(SETTINGS_STORAGE_KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = null;
  }
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(MODES.map((m) => [m, sanitizeSettings(m, obj[m])])) as Record<SettingsMode, SessionSettings>;
}

/** Sparar alla val. Går lagringen inte att nå gäller valen ändå för sidvisningen. */
export function writeStoredSettings(storage: Pick<Storage, "setItem"> | null | undefined, all: Record<SettingsMode, SessionSettings>): void {
  try {
    storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Privat fönster eller full lagring: valen gäller för den här sidvisningen.
  }
}
