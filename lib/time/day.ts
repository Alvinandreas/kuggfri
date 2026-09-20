/**
 * Kalenderdagar. En enda definition, eftersom datumaritmetik är det man absolut inte
 * vill ha två sanningar om när tentaplanen styr vilka kort studenten får se.
 *
 * Allt räknas i lokal tid: "i dag" är studentens dag, inte UTC:s.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Antal hela kalenderdagar från `now` till `date`. Negativt om datumet passerat. */
export function calendarDaysUntil(date: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

/** Lokal kalenderdag som YYYY-MM-DD. */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
