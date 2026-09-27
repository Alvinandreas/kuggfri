import { describe, expect, it } from "vitest";
import {
  buildMilestones,
  buildMyStats,
  favouriteIndex,
  favouriteTimeOfDay,
  heatLevel,
  heatmapGrid,
  longestStreak,
  rankAreas,
  ratingShares,
  timeOfDayOf,
  weeklyTotals,
} from "@/lib/stats/my-stats";
import { buildProgressStats, localDayKey } from "@/lib/stats/progress-stats";
import type { ReviewEntry, SelfRating } from "@/lib/progress/types";

// Måndag 14 sep 2026 15:00 lokal tid.
const NOW = new Date(2026, 8, 14, 15, 0, 0);

function at(daysAgo: number, hour = 10, minute = 0): string {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, hour, minute, 0, 0);
  return d.toISOString();
}

const rev = (card_id: string, rating: SelfRating, daysAgo: number, hour = 10, minute = 0): ReviewEntry => ({
  card_id,
  rating,
  mode: "fsrs",
  reviewed_at: at(daysAgo, hour, minute),
});

const keyOf = (daysAgo: number) => localDayKey(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo));

describe("buildMyStats", () => {
  it("räknar aktiva dagar, bästa dag, snitt och fördelningar", () => {
    const reviews = [
      rev("a", 1, 3, 8),
      rev("b", 5, 3, 8, 1),
      rev("a", 3, 2, 19),
      rev("b", 4, 2, 19, 2),
      rev("c", 5, 2, 19, 3),
      rev("a", 5, 0, 23),
    ];
    const s = buildMyStats({ cardIds: ["a", "b", "c"], reviews, now: NOW });
    expect(s.totalReviews).toBe(6);
    expect(s.activeDays).toBe(3);
    expect(s.firstDay).toBe(keyOf(3));
    expect(s.bestDay).toEqual({ day: keyOf(2), reviews: 3 });
    expect(s.avgRating).toBeCloseTo(23 / 6);
    expect(s.ratingCounts).toEqual([1, 0, 1, 1, 3]);
    // 14 sep 2026 är en måndag: tre dagar sedan fredag, två sedan lördag.
    expect(s.weekdayCounts).toEqual([1, 0, 0, 0, 2, 3, 0]);
    expect(s.timeOfDay).toEqual({ morning: 2, day: 0, evening: 3, night: 1 });
    expect(s.hourCounts[19]).toBe(3);
    expect(s.perDay.get(keyOf(0))).toBe(1);
  });

  it("ignorerar kort utanför urvalet", () => {
    const s = buildMyStats({ cardIds: ["a"], reviews: [rev("a", 5, 0), rev("x", 1, 0)], now: NOW });
    expect(s.totalReviews).toBe(1);
    expect(s.ratingCounts).toEqual([0, 0, 0, 0, 1]);
  });

  it("delar upp i pass och uppskattar pluggtiden med tak per kort", () => {
    const reviews = [
      rev("a", 3, 1, 10, 0),
      rev("b", 3, 1, 10, 1), // 1 min
      rev("c", 3, 1, 10, 11), // 10 min paus: räknas som 3 min
      rev("a", 4, 1, 12, 0), // nytt pass (>30 min)
      rev("b", 4, 1, 12, 2), // 2 min
    ];
    const s = buildMyStats({ cardIds: ["a", "b", "c"], reviews, now: NOW });
    expect(s.sessions).toBe(2);
    // 1 + 3 + 2 min, plus 20 s för passens sista kort (2 × 20 s).
    expect(s.studyMinutes).toBe(Math.round(6 + 40 / 60));
  });

  it("räknar vändningar: kort som gått från 1–2 till 5", () => {
    const reviews = [rev("a", 2, 3), rev("a", 5, 1), rev("b", 5, 3), rev("b", 1, 2), rev("c", 1, 2), rev("c", 4, 1), rev("a", 5, 0)];
    const s = buildMyStats({ cardIds: ["a", "b", "c"], reviews, now: NOW });
    expect(s.comebacks).toBe(1);
  });

  it("ger tomma värden utan historik", () => {
    const s = buildMyStats({ cardIds: ["a"], reviews: [], now: NOW });
    expect(s.totalReviews).toBe(0);
    expect(s.bestDay).toBeNull();
    expect(s.avgRating).toBeNull();
    expect(s.firstDay).toBeNull();
    expect(s.streak).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.sessions).toBe(0);
    expect(s.studyMinutes).toBe(0);
  });

  it("har samma streak som hemsidans statistik", () => {
    const reviews = [rev("a", 3, 4), rev("a", 3, 3), rev("a", 3, 1), rev("a", 3, 0)];
    const mine = buildMyStats({ cardIds: ["a"], reviews, now: NOW });
    const home = buildProgressStats({ cardIds: ["a"], progress: {}, reviews, now: NOW });
    expect(mine.streak).toBe(home.streak);
  });
});

describe("longestStreak", () => {
  it("minns en längre streak som senare brutits", () => {
    // Tio dagar i rad för 30–21 dagar sedan, sedan uppehåll, sedan två dagar.
    const days = new Set<string>();
    for (let i = 21; i <= 30; i++) days.add(keyOf(i));
    days.add(keyOf(1));
    days.add(keyOf(0));
    expect(longestStreak(days, NOW)).toBe(10);
    const s = buildMyStats({ cardIds: ["a"], reviews: [...days].map((d) => ({ card_id: "a", rating: 3, mode: "fsrs", reviewed_at: new Date(`${d}T10:00:00`).toISOString() })), now: NOW });
    expect(s.longestStreak).toBe(10);
    expect(s.streak).toBe(2);
  });

  it("låter en frysning hålla ihop streaken över en missad dag", () => {
    const days = new Set([keyOf(4), keyOf(3), keyOf(1), keyOf(0)]);
    expect(longestStreak(days, NOW)).toBe(4);
  });

  it("är noll utan aktiva dagar", () => {
    expect(longestStreak(new Set(), NOW)).toBe(0);
  });
});

describe("favoriter", () => {
  it("väljer största värdet, det första vid lika, och null när allt är noll", () => {
    expect(favouriteIndex([0, 3, 5, 5, 1])).toBe(2);
    expect(favouriteIndex([0, 0, 0])).toBeNull();
  });

  it("delar in dygnet i morgon, dag, kväll och natt", () => {
    expect(timeOfDayOf(5)).toBe("morning");
    expect(timeOfDayOf(9)).toBe("morning");
    expect(timeOfDayOf(10)).toBe("day");
    expect(timeOfDayOf(17)).toBe("evening");
    expect(timeOfDayOf(22)).toBe("night");
    expect(timeOfDayOf(3)).toBe("night");
    expect(favouriteTimeOfDay({ morning: 1, day: 2, evening: 7, night: 0 })).toBe("evening");
    expect(favouriteTimeOfDay({ morning: 0, day: 0, evening: 0, night: 0 })).toBeNull();
  });
});

describe("heatmapGrid", () => {
  it("bygger veckokolumner med måndag först och i dag i sista kolumnen", () => {
    const perDay = new Map([
      [keyOf(0), 8],
      [keyOf(1), 2],
      [keyOf(7), 4],
    ]);
    const { weeks, max } = heatmapGrid(perDay, NOW, 3);
    expect(weeks).toHaveLength(3);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(max).toBe(8);
    // Alla kolumner börjar på en måndag.
    expect(weeks.every((w) => w[0]!.date.getDay() === 1)).toBe(true);
    const last = weeks[2]!;
    // NOW är en måndag: i dag först i sista kolumnen, resten av veckan ligger i framtiden.
    expect(last[0]).toMatchObject({ day: keyOf(0), count: 8, level: 4, isToday: true, future: false });
    expect(last.slice(1).every((c) => c.future && c.count === 0)).toBe(true);
    expect(weeks[1]![6]).toMatchObject({ day: keyOf(1), count: 2, level: 1 });
    expect(weeks[1]![0]).toMatchObject({ day: keyOf(7), count: 4, level: 2 });
  });

  it("delar in färgstegen i fjärdedelar av bästa dagen", () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(5, 10)).toBe(2);
    expect(heatLevel(7, 10)).toBe(3);
    expect(heatLevel(10, 10)).toBe(4);
  });
});

describe("weeklyTotals", () => {
  it("summerar per vecka med måndag som första dag", () => {
    const series = buildProgressStats({ cardIds: ["a"], progress: {}, reviews: [rev("a", 3, 8), rev("a", 3, 7), rev("a", 3, 6), rev("a", 3, 0)], now: NOW, days: 10 }).series;
    const weeks = weeklyTotals(series);
    // 10 dagar bakåt från en måndag: lör–sön, en hel vecka, måndagen i dag.
    expect(weeks.map((w) => w.days)).toEqual([2, 7, 1]);
    expect(weeks.map((w) => w.reviews)).toEqual([1, 2, 1]);
  });
});

describe("rankAreas", () => {
  const area = (key: string, share: number, studied = 1, known = 0) => ({ key, share, studied, known });

  it("tar tre starkaste och tre svagaste bland påbörjade områden", () => {
    const areas = [area("a", 0.9), area("b", 0.1), area("c", 0.5), area("d", 0.7), area("e", 0.3), area("f", 0.2), area("g", 0.8), area("h", 1, 0)];
    const { strongest, weakest } = rankAreas(areas);
    expect(strongest.map((a) => a.key)).toEqual(["a", "g", "d"]);
    expect(weakest.map((a) => a.key)).toEqual(["b", "f", "e"]);
  });

  it("delar på få områden utan överlapp", () => {
    const { strongest, weakest } = rankAreas([area("a", 0.2), area("b", 0.6), area("c", 0.4)]);
    expect(strongest.map((a) => a.key)).toEqual(["b", "c"]);
    expect(weakest.map((a) => a.key)).toEqual(["a"]);
  });

  it("avgör lika andel med kunskapsestimatet", () => {
    const { strongest } = rankAreas([area("a", 0, 1, 0.2), area("b", 0, 1, 0.9)], 1);
    expect(strongest.map((a) => a.key)).toEqual(["b"]);
  });
});

describe("buildMilestones", () => {
  it("låser upp det som nåtts och kapar framstegen vid målet", () => {
    const m = buildMilestones({ totalReviews: 140, longestStreak: 3, activeDays: 5, seen: 40, learned: 30, totalCards: 40, comebacks: 0 });
    const byKey = Object.fromEntries(m.map((x) => [x.key, x]));
    expect(byKey.firstReview?.unlocked).toBe(true);
    expect(byKey.reviews100).toMatchObject({ unlocked: true, current: 100, target: 100 });
    expect(byKey.reviews1000).toMatchObject({ unlocked: false, current: 140 });
    expect(byKey.streak7).toMatchObject({ unlocked: false, current: 3, target: 7 });
    expect(byKey.allSeen?.unlocked).toBe(true);
    expect(byKey.halfLearned).toMatchObject({ unlocked: true, target: 20 });
  });

  it("utelämnar kursmålen när kursen saknar kort", () => {
    const m = buildMilestones({ totalReviews: 0, longestStreak: 0, activeDays: 0, seen: 0, learned: 0, totalCards: 0, comebacks: 0 });
    expect(m.some((x) => x.key === "allSeen" || x.key === "halfLearned")).toBe(false);
    expect(m.every((x) => !x.unlocked)).toBe(true);
  });
});

describe("ratingShares", () => {
  it("ger andelar och nollor utan skattningar", () => {
    expect(ratingShares([1, 1, 2, 0, 0])).toEqual([0.25, 0.25, 0.5, 0, 0]);
    expect(ratingShares([0, 0, 0, 0, 0])).toEqual([0, 0, 0, 0, 0]);
  });
});
