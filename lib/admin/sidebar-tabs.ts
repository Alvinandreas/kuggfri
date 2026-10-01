/**
 * Flikarna i sidomenyn som global admin kan dölja tillfälligt (Alvins beslut 2 okt 2026), t.ex.
 * inför en visning. En dold flik syns inte i sidomenyn för någon, admin inräknad; sidan går
 * fortfarande att nå via adressen. Inställningen ligger i app_settings (key 'dolda_flikar') och
 * ändras under Admininställningar, som alltid nås från profilmenyn.
 *
 * Ren logik utan Supabase, så att den kan enhetstestas.
 */
export const SIDEBAR_TAB_KEYS = [
  "hem",
  "statistik",
  "kurser",
  "kurssidan",
  "tentalaget",
  "oversikt",
  "innehall",
  "granskning",
  "tentor",
  "felrapporter",
  "importera",
  "installningar",
  "alla-kurser",
  "designsystem",
  "hjalp",
  "om",
  "integritet",
] as const;

export type SidebarTabKey = (typeof SIDEBAR_TAB_KEYS)[number];

/** Flikarna i sidomenyns grupper, i sidomenyns ordning. */
export const SIDEBAR_TAB_GROUPS: readonly { group: "study" | "admin" | "info"; keys: readonly SidebarTabKey[] }[] = [
  { group: "study", keys: ["hem", "statistik", "kurser", "kurssidan", "tentalaget"] },
  { group: "admin", keys: ["oversikt", "innehall", "granskning", "tentor", "felrapporter", "importera", "installningar", "alla-kurser", "designsystem"] },
  { group: "info", keys: ["hjalp", "om", "integritet"] },
];

export const HIDDEN_TABS_SETTING = "dolda_flikar";

export function isSidebarTabKey(value: unknown): value is SidebarTabKey {
  return typeof value === "string" && (SIDEBAR_TAB_KEYS as readonly string[]).includes(value);
}

/** Tolkar det lagrade värdet: bara kända nycklar, i sidomenyns ordning, utan dubbletter. */
export function parseHiddenTabs(value: unknown): SidebarTabKey[] {
  if (!Array.isArray(value)) return [];
  const set = new Set(value.filter(isSidebarTabKey));
  return SIDEBAR_TAB_KEYS.filter((k) => set.has(k));
}
