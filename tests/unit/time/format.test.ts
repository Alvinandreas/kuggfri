import { describe, expect, it } from "vitest";
import { calendarDaysUntil, endOfDay, formatRelative } from "@/lib/time/format";

const NOW = new Date(2026, 8, 11, 9, 0, 0); // 11 sep 2026 kl 09:00 lokal tid
const DAY = 24 * 60 * 60 * 1000;

describe("formatRelative", () => {
  it("hanterar nu, i dag, i morgon, dagar och månader", () => {
    expect(formatRelative(new Date(NOW.getTime() - 1000), NOW)).toBe("nu");
    expect(formatRelative(new Date(NOW.getTime() + 60 * 60 * 1000), NOW)).toBe("i dag");
    expect(formatRelative(new Date(NOW.getTime() + DAY), NOW)).toBe("i morgon");
    expect(formatRelative(new Date(NOW.getTime() + 3 * DAY), NOW)).toBe("om 3 dagar");
    expect(formatRelative(new Date(NOW.getTime() + 60 * DAY), NOW)).toBe("om 2 månader");
    expect(formatRelative(new Date(NOW.getTime() - 3 * DAY), NOW)).toBe("förfallet");
  });

  it("räknar kalenderdagar, inte 24-timmarsperioder", () => {
    const lateTonight = new Date(2026, 8, 11, 23, 30);
    const earlyTomorrow = new Date(2026, 8, 12, 0, 30);
    expect(calendarDaysUntil(earlyTomorrow, lateTonight)).toBe(1);
    expect(formatRelative(earlyTomorrow, lateTonight)).toBe("i morgon");
  });

  it("endOfDay ger sista millisekunden på dagen", () => {
    const e = endOfDay(NOW);
    expect(e.getHours()).toBe(23);
    expect(e.getMinutes()).toBe(59);
    expect(e.getDate()).toBe(11);
  });
});
