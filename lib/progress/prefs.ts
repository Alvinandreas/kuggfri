/**
 * Studentens egna inställningar för studierytmen. Sparas i localStorage på enheten
 * (samma för gäst och konto: det är en bekvämlighet per enhet, inte data).
 * Saknas nyckeln gäller standardvärdena.
 */
import { DAILY_NEW_CHOICES, DEFAULT_DAILY_NEW } from "@/lib/study/plan";

export const LOCAL_PREFS_KEY = "kuggfri:prefs:v1";

export type StudyPrefs = {
  /** Nya kort per dag. */
  dailyNew: number;
  /** Räkna inte helger som missade dagar i streaken. */
  weekdaysOnly: boolean;
};

export const DEFAULT_PREFS: StudyPrefs = { dailyNew: DEFAULT_DAILY_NEW, weekdaysOnly: false };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readPrefs(storage: StorageLike): StudyPrefs {
  let raw: string | null;
  try {
    raw = storage.getItem(LOCAL_PREFS_KEY);
  } catch {
    return { ...DEFAULT_PREFS };
  }
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const parsed = JSON.parse(raw) as Partial<StudyPrefs> | null;
    const dailyNew =
      typeof parsed?.dailyNew === "number" && (DAILY_NEW_CHOICES as readonly number[]).includes(parsed.dailyNew)
        ? parsed.dailyNew
        : DEFAULT_PREFS.dailyNew;
    const weekdaysOnly = typeof parsed?.weekdaysOnly === "boolean" ? parsed.weekdaysOnly : DEFAULT_PREFS.weekdaysOnly;
    return { dailyNew, weekdaysOnly };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(storage: StorageLike, prefs: StudyPrefs): void {
  try {
    storage.setItem(LOCAL_PREFS_KEY, JSON.stringify({ version: 1, ...prefs }));
  } catch {
    // Blockerat lagringsutrymme: inställningen gäller bara den här sidvisningen.
  }
}
