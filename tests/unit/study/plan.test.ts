import { describe, expect, it } from "vitest";
import { daysUntil, estimateMinutes, examPhase, parseExamDate, planNewCards } from "@/lib/study/plan";
import { DEFAULT_PREFS, LOCAL_PREFS_KEY, readPrefs, writePrefs } from "@/lib/progress/prefs";

const NOW = new Date(2026, 8, 19, 10, 0, 0); // 19 sep 2026, lokal tid

describe("tentaplan", () => {
  it("tolkar datum och räknar dagar", () => {
    expect(parseExamDate("2026-10-27")?.getDate()).toBe(27);
    expect(parseExamDate(null)).toBeNull();
    expect(parseExamDate("nej")).toBeNull();
    expect(daysUntil(new Date(2026, 9, 27), NOW)).toBe(38);
    expect(daysUntil(new Date(2026, 8, 18), NOW)).toBe(-1);
  });

  it("fasen styrs av dagar kvar", () => {
    expect(examPhase(null, NOW)).toEqual({ kind: "none" });
    expect(examPhase(new Date(2026, 9, 27), NOW)).toEqual({ kind: "upcoming", daysLeft: 38, maxInterval: 35 });
    expect(examPhase(new Date(2026, 8, 21), NOW)).toEqual({ kind: "final", daysLeft: 2 });
    expect(examPhase(new Date(2026, 8, 19), NOW)).toEqual({ kind: "final", daysLeft: 0 });
    expect(examPhase(new Date(2026, 8, 10), NOW)).toEqual({ kind: "past", daysAgo: 9 });
  });

  it("doserar nya kort efter dagsmålet utan tenta", () => {
    expect(planNewCards({ newRemaining: 144, introducedToday: 0, dailyGoal: 20, phase: { kind: "none" } })).toEqual({
      limit: 20,
      neededPerDay: null,
      catchUp: false,
    });
    expect(planNewCards({ newRemaining: 144, introducedToday: 15, dailyGoal: 20, phase: { kind: "none" } }).limit).toBe(5);
    expect(planNewCards({ newRemaining: 144, introducedToday: 25, dailyGoal: 20, phase: { kind: "none" } }).limit).toBe(0);
    expect(planNewCards({ newRemaining: 3, introducedToday: 0, dailyGoal: 20, phase: { kind: "none" } }).limit).toBe(3);
  });

  it("höjer dagsmålet öppet när tentan kräver det, men sänker det aldrig", () => {
    const soon = examPhase(new Date(2026, 8, 29), NOW); // 10 dagar kvar, 6 dagar att introducera
    const plan = planNewCards({ newRemaining: 144, introducedToday: 0, dailyGoal: 20, phase: soon });
    expect(plan.neededPerDay).toBe(24);
    expect(plan.limit).toBe(24);
    expect(plan.catchUp).toBe(true);
    const relaxed = planNewCards({ newRemaining: 30, introducedToday: 0, dailyGoal: 20, phase: soon });
    expect(relaxed.neededPerDay).toBe(5);
    expect(relaxed.limit).toBe(20);
    expect(relaxed.catchUp).toBe(false);
  });

  it("uppskattar tid", () => {
    expect(estimateMinutes(20)).toBe(5);
    expect(estimateMinutes(1)).toBe(1);
    expect(estimateMinutes(0)).toBe(1);
  });
});

describe("inställningar", () => {
  function memStorage(initial: Record<string, string> = {}) {
    const m = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  }

  it("ger standard när inget sparats eller när data är trasig", () => {
    expect(readPrefs(memStorage())).toEqual(DEFAULT_PREFS);
    expect(readPrefs(memStorage({ [LOCAL_PREFS_KEY]: "{" }))).toEqual(DEFAULT_PREFS);
    expect(readPrefs(memStorage({ [LOCAL_PREFS_KEY]: JSON.stringify({ dailyNew: 999 }) })).dailyNew).toBe(DEFAULT_PREFS.dailyNew);
  });

  it("sparar och läser tillbaka", () => {
    const s = memStorage();
    writePrefs(s, { dailyNew: 40, weekdaysOnly: true });
    expect(readPrefs(s)).toEqual({ dailyNew: 40, weekdaysOnly: true });
  });
});
