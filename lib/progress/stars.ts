"use client";

import { createBrowserSetting } from "@/lib/ui/browser-setting";

/**
 * Stjärnmärkta kort: studentens egna bokmärken för kort att återkomma till. Sparas på
 * enheten (en bekvämlighet, som dagsmålet), inte i kontot.
 */
export const STARS_KEY = "kuggfri:stars:v1";

const EMPTY: readonly string[] = [];

const starsSetting = createBrowserSetting<readonly string[]>(
  STARS_KEY,
  EMPTY,
  (raw) => {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : EMPTY;
  },
  (ids) => (ids.length === 0 ? null : JSON.stringify(ids)),
);

export const readStars = starsSetting.read;

/** Stjärnmärkta kort-id och en växlare för ett kort. */
export function useStars(): { stars: ReadonlySet<string>; toggle: (cardId: string) => void } {
  const [ids, setIds] = starsSetting.useSetting();
  const stars = new Set(ids);
  return {
    stars,
    toggle: (cardId: string) => setIds(stars.has(cardId) ? ids.filter((id) => id !== cardId) : [...ids, cardId]),
  };
}
