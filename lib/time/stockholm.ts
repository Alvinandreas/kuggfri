/**
 * Datum och klockslag i svensk tid. Alla formatterare använder sv-SE och Europe/Stockholm, så
 * att servern (UTC på Vercel), webbläsaren och testerna visar samma sak. Tar en ISO-sträng,
 * millisekunder eller ett Date; en ogiltig tid ger en tom sträng.
 */

export const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";

export type DateInput = string | number | Date;

const DAY_MS = 24 * 60 * 60 * 1000;

function formatter(options: Intl.DateTimeFormatOptions): (value: DateInput) => string {
  const format = new Intl.DateTimeFormat("sv-SE", { ...options, timeZone: STOCKHOLM_TIME_ZONE });
  return (value) => {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? "" : format.format(d);
  };
}

/** Dagen som nyckel (ÅÅÅÅ-MM-DD): "2026-09-30". */
export const stockholmDayKey = formatter({ year: "numeric", month: "2-digit", day: "2-digit" });

/** Dag och kort månad: "30 sep.". */
export const stockholmDayMonth = formatter({ day: "numeric", month: "short" });

/** Datum med kort månad: "30 sep. 2026". */
export const stockholmDate = formatter({ day: "numeric", month: "short", year: "numeric" });

/** Datum med utskriven månad: "31 oktober 2024". */
export const stockholmLongDate = formatter({ day: "numeric", month: "long", year: "numeric" });

/** Klockslaget: "14:32". */
export const stockholmTime = formatter({ hour: "2-digit", minute: "2-digit" });

/** Datum och klockslag: "29 sep. 2026 14:32". */
export const stockholmDateTime = formatter({ dateStyle: "medium", timeStyle: "short" });

/** Dagrubrik: "30 sep", med år om det inte är i år ("30 sep 2025"). Månaden utan punkt. */
export function stockholmDayHeading(value: DateInput, now: number): string {
  const day = stockholmDayKey(value);
  if (!day) return "";
  const sameYear = day.slice(0, 4) === stockholmDayKey(now).slice(0, 4);
  return (sameYear ? stockholmDayMonth(value) : stockholmDate(value)).replace(/\./g, "");
}

/** Relativ dag i svensk tid: "today", "yesterday" eller null (vyn sätter texten). */
export function stockholmRelativeDay(value: DateInput, now: number): "today" | "yesterday" | null {
  const day = stockholmDayKey(value);
  if (day === stockholmDayKey(now)) return "today";
  if (day === stockholmDayKey(now - DAY_MS)) return "yesterday";
  return null;
}
