import type { Dict } from "@/lib/i18n";
import { calendarDaysUntil, endOfDay } from "@/lib/time/day";
import { stockholmDateTime } from "@/lib/time/stockholm";

export { calendarDaysUntil, endOfDay };

/** "nu", "i dag", "i morgon", "om 3 dagar", "om 2 månader" eller "förfallet". */
export function formatRelative(sv: Dict, date: Date, now: Date = new Date()): string {
  if (date.getTime() <= now.getTime()) {
    return calendarDaysUntil(date, now) < 0 ? sv.time.overdue : sv.time.now;
  }
  const days = calendarDaysUntil(date, now);
  if (days <= 0) return sv.time.today;
  if (days === 1) return sv.time.tomorrow;
  if (days < 45) return sv.time.inDays(days);
  return sv.time.inMonths(Math.round(days / 30));
}

/** Datum och klockslag i svensk tid: "29 sep. 2026 14:32" (locale: ordlistans meta.locale). Ogiltig tid ger "". */
export function formatDateTime(iso: string, locale?: string): string {
  return stockholmDateTime(iso, locale);
}
