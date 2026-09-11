import { sv } from "@/lib/i18n/sv";

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Slutet av dagen (lokal tid) för ett datum. */
export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Antal kalenderdagar från nu till datumet (lokal tid). Negativt om det passerat. */
export function calendarDaysUntil(date: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY);
}

/** "nu", "i dag", "i morgon", "om 3 dagar", "om 2 månader" eller "förfallet". */
export function formatRelative(date: Date, now: Date = new Date()): string {
  if (date.getTime() <= now.getTime()) {
    return calendarDaysUntil(date, now) < 0 ? sv.time.overdue : sv.time.now;
  }
  const days = calendarDaysUntil(date, now);
  if (days <= 0) return sv.time.today;
  if (days === 1) return sv.time.tomorrow;
  if (days < 45) return sv.time.inDays(days);
  return sv.time.inMonths(Math.round(days / 30));
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
