import { describe, expect, it } from "vitest";
import { localDayKey, parseDayKey } from "@/lib/time/day";

describe("parseDayKey", () => {
  it("ger lokal midnatt den dagen", () => {
    const d = parseDayKey("2026-03-29");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 2, 29, 0, 0]);
  });

  it("är motsatsen till localDayKey", () => {
    for (const key of ["2026-01-01", "2026-10-25", "2026-12-31", "2028-02-29"]) {
      expect(localDayKey(parseDayKey(key))).toBe(key);
    }
  });
});
