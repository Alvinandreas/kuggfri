import { describe, expect, it } from "vitest";
import { buildFsrsQueue, isDue, newProgress, previewIntervals, queueStats, reviewCard } from "@/lib/fsrs/scheduler";
import { selectCardIds, type SelectableCard } from "@/lib/study/selection";
import { createSession, currentCardId, rateCurrent } from "@/lib/fsrs/session";
import type { ProgressMap, SelfRating } from "@/lib/progress/types";

/**
 * Lanseringskontroll av schemat: det en student faktiskt möter dag ett.
 *
 * Delarna är testade var för sig på andra ställen. Det här är kedjan: ett orört kort
 * ska vara förfallet direkt, knapparna 1–5 ska ligga i växande ordning, ett kort som
 * inte satt ska tillbaka innan passet är slut, och fri repetition ska inte röra schemat.
 */
const NOW = new Date("2026-09-22T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("schemat dag ett", () => {
  it("ett orört kort är förfallet direkt och räknas som nytt", () => {
    const p = newProgress("c1", NOW);
    expect(p.state).toBe(0);
    expect(isDue(p, NOW)).toBe(true);
    expect(queueStats(["c1"], { c1: p }, NOW)).toEqual({ due: 0, new: 1, total: 1 });
  });

  it("knapparna 1–5 ligger i växande ordning", () => {
    const intervals = previewIntervals("c1", undefined, NOW);
    const dagar = ([1, 2, 3, 4, 5] as SelfRating[]).map((r) => (intervals[r].getTime() - NOW.getTime()) / DAY);
    // Ligger de inte i ordning är knapptexterna missvisande för studenten.
    for (let i = 1; i < dagar.length; i++) expect(dagar[i]!).toBeGreaterThanOrEqual(dagar[i - 1]!);
    // Korta inlärningssteg är avstängda, så även en etta hamnar tidigast i morgon.
    // Att kortet ändå kommer tillbaka direkt sköts av sessionen, se testet nedan.
    expect(dagar[0]!).toBeGreaterThanOrEqual(1);
    expect(dagar[4]!).toBeGreaterThan(dagar[0]!);
  });

  it("en femma flyttar kortet framåt, en etta tar tillbaka det", () => {
    const lätt = reviewCard("c1", undefined, 5, NOW);
    expect(new Date(lätt.due).getTime()).toBeGreaterThan(NOW.getTime() + DAY);
    expect(lätt.self_rating).toBe(5);

    const svårt = reviewCard("c2", undefined, 1, NOW);
    expect(new Date(svårt.due).getTime()).toBeLessThan(new Date(lätt.due).getTime());
    expect(svårt.self_rating).toBe(1);
  });

  it("första passet doseras, inte hela kursen på en gång", () => {
    const ids = Array.from({ length: 144 }, (_, i) => `c${i}`);
    expect(buildFsrsQueue(ids, {}, NOW, () => 0.5, { maxNew: 20 }).length).toBe(20);
    // Utan tak tar kön hela kursen: det är doseringen som skyddar mot 144 kort dag ett.
    expect(buildFsrsQueue(ids, {}, NOW, () => 0.5).length).toBe(144);
  });

  it("fri repetition rör inte schemat", () => {
    const cards: SelectableCard[] = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, category_id: "k1", sort_order: i }));
    const progress: ProgressMap = { c0: reviewCard("c0", undefined, 4, NOW) };
    const före = progress.c0!.due;
    const ids = selectCardIds({ cards, progress, mode: "free", selection: { kind: "all" }, now: NOW, random: () => 0.5 });
    expect(ids.length).toBeGreaterThan(0);
    // Urvalet läser bara: inget skrivs förrän studenten skattar.
    expect(progress.c0!.due).toBe(före);
  });

  it("ett kort som inte satt kommer tillbaka innan passet är slut", () => {
    // Det här är skälet till att korta inlärningssteg är avstängda i schemat: garantin
    // ligger i sessionen i stället. Faller den här, kan en etta försvinna till i morgon.
    const session = createSession(["a", "b"], "fsrs");
    expect(currentCardId(session)).toBe("a");
    const efterEtta = rateCurrent(session, 1);
    expect(efterEtta.order).toEqual(["a", "b", "a"]);

    const efterFemma = rateCurrent(createSession(["a", "b"], "fsrs"), 5);
    expect(efterFemma.order).toEqual(["a", "b"]);
  });

  it("ett repeterat kort kommer inte tillbaka förrän det förfaller", () => {
    const p = reviewCard("c1", undefined, 4, NOW);
    expect(isDue(p, NOW)).toBe(false);
    const senare = new Date(new Date(p.due).getTime() + 1000);
    expect(isDue(p, senare)).toBe(true);
  });
});
