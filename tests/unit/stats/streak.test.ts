import { describe, expect, it } from "vitest";
import { computeStreak, STREAK_FREEZES_MAX, STREAK_FREEZE_EVERY_ACTIVE_DAYS } from "@/lib/stats/progress-stats";
import { localDayKey } from "@/lib/time/day";

/**
 * Streaken med frysningar är den mest regelbetungade logiken i appen, och den syns direkt
 * för studenten. Här testas den direkt i stället för bara via buildProgressStats.
 */

const TODAY = new Date(2026, 8, 14, 15, 0, 0); // måndag 14 sep 2026
const DAY = 24 * 60 * 60 * 1000;

/** Mängd av aktiva dagar, angivna som "antal dagar sedan i dag". */
function days(...agoList: number[]): Set<string> {
  return new Set(agoList.map((ago) => localDayKey(new Date(TODAY.getTime() - ago * DAY))));
}

describe("computeStreak", () => {
  it("räknar sammanhängande dagar", () => {
    expect(computeStreak(days(0, 1, 2), TODAY).streak).toBe(3);
    expect(computeStreak(days(1, 2, 3), TODAY).streak).toBe(3);
  });

  it("utan aktivitet finns ingen streak, och alla frysningar är kvar", () => {
    const r = computeStreak(new Set(), TODAY);
    expect(r.streak).toBe(0);
    expect(r.freezesLeft).toBe(STREAK_FREEZES_MAX);
    expect(r.freezeUsedRecently).toBe(false);
  });

  it("i dag räknas inte som missad förrän dagen är slut", () => {
    // Aktiv i går och i förrgår, inget i dag: streaken lever och ingen frysning har gått åt.
    const r = computeStreak(days(1, 2), TODAY);
    expect(r.streak).toBe(2);
    expect(r.freezesLeft).toBe(STREAK_FREEZES_MAX);
  });

  it("en missad dag täcks av en frysning", () => {
    const r = computeStreak(days(0, 1, 3), TODAY); // dag 2 missad
    expect(r.streak).toBe(3);
    expect(r.freezesLeft).toBe(STREAK_FREEZES_MAX - 1);
    expect(r.freezeUsedRecently).toBe(false); // senaste dagen var aktiv
  });

  it("frysningen syns tills nästa aktiva dag", () => {
    // Aktiv dag 2 och 3, missad dag 1, inget i dag.
    const r = computeStreak(days(2, 3), TODAY);
    expect(r.streak).toBe(2);
    expect(r.freezeUsedRecently).toBe(true);
  });

  it("fler missade dagar än frysningar nollställer", () => {
    // Aktiv dag 4, sedan dag 3, 2 och 1 missade: två frysningar räcker inte till tre.
    expect(computeStreak(days(4), TODAY).streak).toBe(0);
  });

  it("en ny frysning fylls på var sjunde aktiva dag, men aldrig över taket", () => {
    const sju = computeStreak(days(...Array.from({ length: STREAK_FREEZE_EVERY_ACTIVE_DAYS }, (_, i) => i)), TODAY);
    expect(sju.streak).toBe(STREAK_FREEZE_EVERY_ACTIVE_DAYS);
    expect(sju.freezesLeft).toBe(STREAK_FREEZES_MAX);

    // Sju aktiva dagar, två missade, sju aktiva till: frysningarna räcker och streaken lever.
    // Streaken räknar aktiva dagar, så de frysta dagarna höjer den inte.
    const aktiva = [...Array.from({ length: 7 }, (_, i) => i + 9), ...Array.from({ length: 7 }, (_, i) => i)];
    const r = computeStreak(days(...aktiva), TODAY);
    expect(r.streak).toBe(14);
    expect(r.freezesLeft).toBeLessThanOrEqual(STREAK_FREEZES_MAX);
  });

  it("i vardagsläge kostar helgen ingen frysning", () => {
    // 14 sep 2026 är en måndag, så dag 1 är söndag och dag 2 lördag.
    // Aktiva: torsdag (4), fredag (3) och måndag (0). Helgen däremellan är inte missad.
    const helg = computeStreak(days(0, 3, 4), TODAY, true);
    expect(helg.streak).toBe(3);
    expect(helg.freezesLeft).toBe(STREAK_FREEZES_MAX);

    // Samma dagar utan vardagsläge: helgen räknas som två missade dagar och äter frysningarna.
    const alla = computeStreak(days(0, 3, 4), TODAY, false);
    expect(alla.streak).toBe(3);
    expect(alla.freezesLeft).toBe(STREAK_FREEZES_MAX - 2);
  });

  it("en missad vardag kostar en frysning även i vardagsläge", () => {
    // Dag 0 (mån) och dag 4 (torsdag); dag 1 (fredag) missad, dag 2–3 är helg.
    const r = computeStreak(days(0, 4), TODAY, true);
    expect(r.streak).toBe(2);
    expect(r.freezesLeft).toBe(STREAK_FREEZES_MAX - 1);
  });
});
