import { sv } from "@/lib/i18n/sv";
import { calendarDaysUntil, endOfDay } from "@/lib/time/day";

export { calendarDaysUntil, endOfDay };

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
