import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/time/format";
import {
  stockholmDate,
  stockholmDateTime,
  stockholmDayHeading,
  stockholmDayKey,
  stockholmDayMonth,
  stockholmLongDate,
  stockholmRelativeDay,
  stockholmTime,
} from "@/lib/time/stockholm";

// 22:30 UTC den 29 september är 00:30 den 30 september i svensk sommartid.
const LATE_UTC = "2026-09-29T22:30:00Z";
const NOW = Date.parse("2026-09-30T10:00:00Z");

describe("Stockholmsformatterarna", () => {
  it("datum, klockslag och dagnyckel", () => {
    expect(stockholmDayKey("2026-09-30T10:00:00Z")).toBe("2026-09-30");
    expect(stockholmDayMonth("2026-09-30T10:00:00Z")).toBe("30 sep.");
    expect(stockholmDate("2026-09-30T10:00:00Z")).toBe("30 sep. 2026");
    expect(stockholmLongDate("2024-10-31T12:00:00Z")).toBe("31 oktober 2024");
    expect(stockholmTime("2026-09-30T12:32:00Z")).toBe("14:32");
    expect(stockholmDateTime("2026-09-29T12:32:00Z")).toBe("29 sep. 2026 14:32");
  });

  it("tar ISO-sträng, millisekunder och Date; ogiltig tid ger tom sträng", () => {
    const t = Date.parse("2026-09-30T10:00:00Z");
    expect(stockholmDayKey(t)).toBe("2026-09-30");
    expect(stockholmDayKey(new Date(t))).toBe("2026-09-30");
    expect(stockholmDateTime("inte en tid")).toBe("");
    expect(stockholmDayKey(Number.NaN)).toBe("");
  });

  it("dagrubriker utan punkt, med år bara om det inte är i år", () => {
    expect(stockholmDayHeading("2026-09-20T10:00:00Z", NOW)).toBe("20 sep");
    expect(stockholmDayHeading("2025-10-02T10:00:00Z", NOW)).toBe("2 okt 2025");
    expect(stockholmDayHeading("inte en tid", NOW)).toBe("");
  });

  it("relativ dag räknas i svensk tid", () => {
    expect(stockholmRelativeDay(LATE_UTC, NOW)).toBe("today");
    expect(stockholmRelativeDay("2026-09-29T05:00:00Z", NOW)).toBe("yesterday");
    expect(stockholmRelativeDay("2026-09-20T05:00:00Z", NOW)).toBeNull();
  });
});

describe("tidszonen", () => {
  const original = process.env.TZ;
  beforeAll(() => {
    // Som på Vercel: serverns tidszon är UTC.
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it("en tid nära midnatt UTC visas i svensk tid även när processen kör i UTC", () => {
    // Utan tidszon hade det blivit 29 sep. 22:30.
    expect(new Intl.DateTimeFormat("sv-SE", { timeStyle: "short" }).format(new Date(LATE_UTC))).toBe("22:30");
    expect(stockholmDayKey(LATE_UTC)).toBe("2026-09-30");
    expect(stockholmTime(LATE_UTC)).toBe("00:30");
    expect(stockholmDateTime(LATE_UTC)).toBe("30 sep. 2026 00:30");
    expect(formatDateTime(LATE_UTC)).toBe("30 sep. 2026 00:30");
  });

  it("vintertid: en timme före UTC", () => {
    expect(stockholmDateTime("2026-12-31T23:15:00Z")).toBe("1 jan. 2027 00:15");
  });
});
