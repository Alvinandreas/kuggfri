import { describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";
import {
  buildFinalReviewQueue,
  buildFsrsQueue,
  countDueBy,
  estimateKnowledge,
  isDue,
  newProgress,
  nextDueDate,
  previewIntervals,
  queueStats,
  ratingToGrade,
  resetScheduleKeepRating,
  retrievability,
  reviewCard,
} from "@/lib/fsrs/scheduler";
import { applyRating } from "@/lib/fsrs/apply-rating";
import type { ProgressMap } from "@/lib/progress/types";

const NOW = new Date("2026-09-11T08:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("ratingToGrade", () => {
  it("mappar 1–5 enligt spec", () => {
    expect(ratingToGrade(1)).toBe(Rating.Again);
    expect(ratingToGrade(2)).toBe(Rating.Again);
    expect(ratingToGrade(3)).toBe(Rating.Hard);
    expect(ratingToGrade(4)).toBe(Rating.Good);
    expect(ratingToGrade(5)).toBe(Rating.Easy);
  });
});

describe("reviewCard", () => {
  it("skapar progress för ett nytt kort och sparar den råa skattningen", () => {
    const p = reviewCard("k1", undefined, 4, NOW);
    expect(p.card_id).toBe("k1");
    expect(p.self_rating).toBe(4);
    expect(p.reps).toBe(1);
    expect(p.state).not.toBe(0);
    expect(p.last_review).toBe(NOW.toISOString());
    expect(new Date(p.due).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("muterar aldrig indata", () => {
    const before = reviewCard("k1", undefined, 3, NOW);
    const frozen = Object.freeze({ ...before });
    const after = reviewCard("k1", frozen, 5, new Date(NOW.getTime() + DAY));
    expect(frozen).toEqual(before);
    expect(after).not.toBe(frozen);
    expect(after.reps).toBe(2);
  });

  it("ger längre intervall för högre skattning", () => {
    const easy = reviewCard("k", undefined, 5, NOW);
    const good = reviewCard("k", undefined, 4, NOW);
    const hard = reviewCard("k", undefined, 3, NOW);
    const again = reviewCard("k", undefined, 1, NOW);
    const t = (p: { due: string }) => new Date(p.due).getTime();
    expect(t(easy)).toBeGreaterThan(t(good));
    expect(t(good)).toBeGreaterThan(t(hard));
    expect(t(hard)).toBeGreaterThanOrEqual(t(again));
  });

  it("räknar lapses när ett repeterat kort glöms", () => {
    let p = reviewCard("k", undefined, 5, NOW);
    p = reviewCard("k", p, 5, new Date(NOW.getTime() + 10 * DAY));
    expect(p.state).toBe(2);
    const forgotten = reviewCard("k", p, 1, new Date(NOW.getTime() + 40 * DAY));
    expect(forgotten.lapses).toBe(1);
    expect(forgotten.self_rating).toBe(1);
  });
});

describe("isDue / kö", () => {
  it("nya kort är förfallna och förfaller enligt due", () => {
    expect(isDue(undefined, NOW)).toBe(true);
    const p = reviewCard("k", undefined, 4, NOW);
    expect(isDue(p, NOW)).toBe(false);
    expect(isDue(p, new Date(NOW.getTime() + 400 * DAY))).toBe(true);
  });

  it("bygger kön med mest förfallna först (per dag) och nya kort sist", () => {
    const later = new Date(NOW.getTime() + 60 * DAY);
    const keepOrder = () => 0.999999;
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 5, NOW), // förfaller sent
      b: reviewCard("b", undefined, 3, NOW), // förfaller tidigt
      c: reviewCard("c", undefined, 5, new Date(NOW.getTime() + 59 * DAY)), // ej förfallen vid later
    };
    const queue = buildFsrsQueue(["d", "a", "b", "c", "e"], progress, later, keepOrder);
    expect(queue).toEqual(["b", "a", "d", "e"]);
    expect(queueStats(["d", "a", "b", "c", "e"], progress, later)).toEqual({ due: 2, new: 2, total: 5 });
  });

  it("blandar nya kort och kort med samma förfallodag", () => {
    const seq = [0.9, 0.1, 0.5, 0.3, 0.7, 0.2];
    let i = 0;
    const random = () => seq[i++ % seq.length] ?? 0;
    const ids = ["a", "b", "c", "d", "e", "f"];
    const queue = buildFsrsQueue(ids, {}, NOW, random);
    expect([...queue].sort()).toEqual(ids);
    expect(queue).not.toEqual(ids);
  });

  it("nextDueDate och countDueBy ignorerar redan förfallna kort", () => {
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 5, NOW),
      b: reviewCard("b", undefined, 3, NOW),
    };
    const next = nextDueDate(["a", "b", "c"], progress, NOW);
    expect(next?.toISOString()).toBe(progress.b?.due);
    expect(countDueBy(["a", "b"], progress, new Date(NOW.getTime() + 365 * DAY), NOW)).toBe(2);
    expect(nextDueDate(["c"], progress, NOW)).toBeNull();
  });
});

describe("resetScheduleKeepRating", () => {
  it("nollställer schemat men behåller skattningen", () => {
    const p = reviewCard("k", undefined, 2, NOW);
    const reset = resetScheduleKeepRating(p, NOW);
    expect(reset.self_rating).toBe(2);
    expect(reset.state).toBe(0);
    expect(reset.reps).toBe(0);
    expect(reset.last_review).toBeNull();
    expect(isDue(reset, NOW)).toBe(true);
    expect(newProgress("k", NOW).self_rating).toBeNull();
  });
});

describe("applyRating – fri och slumpad repetition rör inte progressen", () => {
  const progress: ProgressMap = { k: reviewCard("k", undefined, 5, NOW) };
  const snapshot = JSON.stringify(progress);

  it("fri repetition returnerar null och lämnar progressen orörd", () => {
    expect(applyRating({ mode: "free", cardId: "k", rating: 1, progress, now: NOW })).toBeNull();
    expect(applyRating({ mode: "free", cardId: "ny", rating: 5, progress, now: NOW })).toBeNull();
    expect(JSON.stringify(progress)).toBe(snapshot);
  });

  it("slumpad genomkörning returnerar null och lämnar progressen orörd", () => {
    expect(applyRating({ mode: "random", cardId: "k", rating: 1, progress, now: NOW })).toBeNull();
    expect(JSON.stringify(progress)).toBe(snapshot);
  });

  it("kluriga kort uppdaterar bara self_rating och last_review, inte schemat", () => {
    const later = new Date(NOW.getTime() + DAY);
    const next = applyRating({ mode: "tricky", cardId: "k", rating: 4, progress, now: later });
    expect(next?.self_rating).toBe(4);
    expect(next?.last_review).toBe(later.toISOString());
    expect(next?.due).toBe(progress.k?.due);
    expect(next?.reps).toBe(progress.k?.reps);
    expect(next?.state).toBe(progress.k?.state);
    // Ett aldrig sett kort får en ny rad i state New (0), fortfarande nytt för schemat.
    const fresh = applyRating({ mode: "tricky", cardId: "ny", rating: 2, progress, now: later });
    expect(fresh?.state).toBe(0);
    expect(fresh?.self_rating).toBe(2);
    expect(JSON.stringify(progress)).toBe(snapshot);
  });

  it("schemalagd repetition returnerar ny progress utan att mutera kartan", () => {
    const next = applyRating({ mode: "fsrs", cardId: "k", rating: 1, progress, now: new Date(NOW.getTime() + DAY) });
    expect(next).not.toBeNull();
    expect(next?.self_rating).toBe(1);
    expect(JSON.stringify(progress)).toBe(snapshot);
  });
});

describe("dosering, intervalltak och förhandsvisning", () => {
  it("begränsar antalet nya kort i kön men aldrig de förfallna", () => {
    const progress: ProgressMap = {};
    for (const id of ["d1", "d2"]) progress[id] = { ...reviewCard(id, undefined, 4, new Date(NOW.getTime() - 30 * DAY)) };
    const queue = buildFsrsQueue(["d1", "d2", "n1", "n2", "n3", "n4"], progress, NOW, () => 0.5, { maxNew: 2 });
    expect(queue.slice(0, 2).sort()).toEqual(["d1", "d2"]);
    expect(queue).toHaveLength(4);
    expect(buildFsrsQueue(["n1", "n2"], {}, NOW, Math.random, { maxNew: 0 })).toEqual([]);
    expect(buildFsrsQueue(["n1", "n2"], {}, NOW)).toHaveLength(2);
  });

  it("intervalltaket håller korten inom tiden till tentan", () => {
    const first = reviewCard("k", undefined, 4, NOW);
    const later = new Date(NOW.getTime() + 3 * DAY);
    const free = reviewCard("k", first, 5, later);
    const capped = reviewCard("k", first, 5, later, { maxInterval: 6 });
    expect(free.scheduled_days).toBeGreaterThan(8);
    // ts-fsrs håller Again < Hard < Good < Easy med en dags mellanrum: Easy hamnar högst två dagar över taket.
    expect(capped.scheduled_days).toBeLessThanOrEqual(8);
    expect(reviewCard("k", first, 4, later, { maxInterval: 6 }).scheduled_days).toBeLessThanOrEqual(7);
    expect(reviewCard("k", first, 3, later, { maxInterval: 6 }).scheduled_days).toBeLessThanOrEqual(6);
  });

  it("förhandsvisar intervallen i samma ordning som skattningarna", () => {
    const p = previewIntervals("k", undefined, NOW);
    const t = (r: 1 | 2 | 3 | 4 | 5) => p[r].getTime();
    expect(t(1)).toBe(t(2));
    expect(t(2)).toBeLessThan(t(3));
    expect(t(3)).toBeLessThan(t(4));
    expect(t(4)).toBeLessThan(t(5));
    // Förhandsvisningen stämmer med vad en riktig skattning ger.
    expect(reviewCard("k", undefined, 4, NOW).due).toBe(p[4].toISOString());
  });

  it("återkallelsesannolikhet: 0 för nya kort, 1 direkt efter repetition, sjunker sedan", () => {
    expect(retrievability(undefined, NOW)).toBe(0);
    const p = reviewCard("k", undefined, 4, NOW);
    expect(retrievability(p, NOW)).toBe(1);
    const week = retrievability(p, new Date(NOW.getTime() + 7 * DAY));
    expect(week).toBeLessThan(1);
    expect(week).toBeGreaterThan(0.5);
    const est = estimateKnowledge(["k", "x"], { k: p }, NOW);
    expect(est).toEqual({ known: 1, share: 0.5, reviewed: 1, total: 2 });
  });

  it("slutrepetitionen tar alla kort, svagast först", () => {
    const strong = reviewCard("s", undefined, 5, NOW);
    const weak = reviewCard("w", undefined, 4, new Date(NOW.getTime() - 20 * DAY));
    const queue = buildFinalReviewQueue(["s", "w", "n"], { s: strong, w: weak }, NOW, () => 0.5);
    expect(queue).toEqual(["n", "w", "s"]);
  });
});
