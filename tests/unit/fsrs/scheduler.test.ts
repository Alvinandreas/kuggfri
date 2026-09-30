import { describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";
import {
  buildExtraQueue,
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

describe("applyRating: varje skattning räknas, i alla lägen (30 sep 2026)", () => {
  const progress: ProgressMap = { k: reviewCard("k", undefined, 5, NOW) };
  const snapshot = JSON.stringify(progress);
  const later = new Date(NOW.getTime() + DAY);

  it("fri repetition, slumpad genomkörning, kluriga kort och dugga schemalägger om precis som schemalagd repetition", () => {
    const expected = reviewCard("k", progress.k, 4, later);
    for (const mode of ["fsrs", "free", "random", "tricky", "exam"] as const) {
      expect(applyRating({ mode, cardId: "k", rating: 4, progress, now: later })).toEqual(expected);
    }
    expect(expected.reps).toBe(2);
    expect(expected.last_review).toBe(later.toISOString());
    expect(JSON.stringify(progress)).toBe(snapshot);
  });

  it("ett aldrig sett kort blir introducerat, oavsett läge", () => {
    const fresh = applyRating({ mode: "free", cardId: "ny", rating: 2, progress, now: later });
    expect(fresh.state).not.toBe(0);
    expect(fresh.reps).toBe(1);
    expect(fresh.self_rating).toBe(2);
    expect(isDue(fresh, later)).toBe(false);
  });

  it("intervalltaket (tentadatum) gäller i alla lägen", () => {
    let p = reviewCard("t", undefined, 5, NOW);
    p = reviewCard("t", p, 5, new Date(p.due));
    const at = new Date(p.due);
    const capped = applyRating({ mode: "free", cardId: "t", rating: 5, progress: { t: p }, now: at, schedule: { maxInterval: 5 } });
    expect(capped.scheduled_days).toBeLessThanOrEqual(5 + 2);
  });
});

describe("tidiga repetitioner och repetitioner samma dag", () => {
  /** Ett kort med ett intervall på drygt två veckor: Bra i dag, Bra igen när det förföll. */
  function matureCard() {
    const first = reviewCard("m", undefined, 4, NOW);
    return reviewCard("m", first, 4, new Date(first.due));
  }

  it("återkallelsesannolikheten räknas på den verkliga förflutna tiden", () => {
    const p = matureCard();
    const last = Date.parse(p.last_review ?? "");
    const early = retrievability(p, new Date(last + 2 * DAY));
    const onTime = retrievability(p, new Date(p.due));
    expect(early).toBeGreaterThan(0.95);
    // Vid förfallodagen är sannolikheten nära målet 90 % (fuzz flyttar dagen några procent).
    expect(onTime).toBeGreaterThan(0.85);
    expect(onTime).toBeLessThan(0.95);
  });

  it("en tidig repetition ökar stabiliteten, men mindre än en repetition i tid", () => {
    const p = matureCard();
    const last = Date.parse(p.last_review ?? "");
    const early = reviewCard("m", p, 4, new Date(last + 2 * DAY));
    const onTime = reviewCard("m", p, 4, new Date(p.due));
    expect(early.elapsed_days).toBe(2);
    expect(onTime.elapsed_days).toBe(p.scheduled_days);
    expect(early.stability).toBeGreaterThan(p.stability);
    expect(early.stability).toBeLessThan(onTime.stability);
    expect(early.scheduled_days).toBeLessThan(onTime.scheduled_days);
    // Det nya intervallet räknas från den tidiga repetitionen, inte från det gamla datumet.
    expect(Date.parse(early.due)).toBeGreaterThan(Date.parse(p.due));
  });

  it("flera repetitioner samma dag blåser aldrig upp stabiliteten eller intervallet", () => {
    const first = reviewCard("s", undefined, 4, NOW);
    let p = first;
    const days: number[] = [];
    for (let h = 1; h <= 6; h++) {
      p = reviewCard("s", p, 5, new Date(NOW.getTime() + h * 60 * 60 * 1000));
      expect(p.stability).toBe(first.stability);
      days.push(p.scheduled_days);
    }
    expect(p.reps).toBe(7);
    // Samma intervall varje gång: sex Lätt samma dag ger inte längre intervall än ett.
    expect(new Set(days).size).toBe(1);
    // Jämför med sex Lätt på förfallodagarna: där växer stabiliteten kraftigt.
    let spaced = first;
    for (let i = 0; i < 6; i++) spaced = reviewCard("s", spaced, 5, new Date(spaced.due));
    expect(spaced.stability).toBeGreaterThan(first.stability * 10);
  });

  it("en miss samma dag sänker stabiliteten, och kortet förfaller inte igen förrän i morgon", () => {
    const first = reviewCard("a", undefined, 4, NOW);
    const missed = reviewCard("a", first, 1, new Date(NOW.getTime() + 2 * 60 * 60 * 1000));
    expect(missed.stability).toBeLessThan(first.stability);
    expect(missed.scheduled_days).toBeGreaterThanOrEqual(1);
    expect(isDue(missed, new Date(NOW.getTime() + 12 * 60 * 60 * 1000))).toBe(false);
  });
});

describe("Plugga vidare: buildExtraQueue", () => {
  const H = 60 * 60 * 1000;
  /** Repeterat kort med given stabilitet och senaste repetition för `ago` ms sedan. */
  function reviewed(cardId: string, stability: number, ago: number): ProgressMap[string] {
    return {
      ...reviewCard(cardId, undefined, 4, new Date(NOW.getTime() - ago)),
      stability,
    };
  }
  const progress: ProgressMap = {
    forfallet: reviewed("forfallet", 2, 10 * DAY),
    snart: reviewed("snart", 3, 2 * DAY),
    langt: reviewed("langt", 100, DAY),
    idag: reviewed("idag", 3, 1 * H),
  };
  const ids = ["idag", "ny1", "langt", "snart", "ny2", "forfallet"];

  it("tar kort närmast att förfalla först, sedan nya kort, sist kort som redan repeterats i dag", () => {
    const queue = buildExtraQueue(ids, progress, NOW, () => 0.5);
    expect(queue.slice(0, 3)).toEqual(["forfallet", "snart", "langt"]);
    expect(new Set(queue.slice(3, 5))).toEqual(new Set(["ny1", "ny2"]));
    expect(queue[5]).toBe("idag");
  });

  it("ett block i taget, men aldrig tomt så länge urvalet har kort", () => {
    expect(buildExtraQueue(ids, progress, NOW, () => 0.5, { size: 2 })).toEqual(["forfallet", "snart"]);
    expect(buildExtraQueue(["idag"], progress, NOW, () => 0.5, { size: 20 })).toEqual(["idag"]);
    expect(buildExtraQueue([], progress, NOW)).toEqual([]);
  });

  it("nya kort utöver dagens dos: inget tak utöver blockets storlek", () => {
    const many = Array.from({ length: 60 }, (_, i) => `n${i}`);
    expect(buildExtraQueue(many, {}, NOW, Math.random, { size: 40 })).toHaveLength(40);
    expect(buildExtraQueue(many, {}, NOW)).toHaveLength(60);
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
