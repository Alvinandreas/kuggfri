import { describe, expect, it } from "vitest";
import { buildProgressStats, localDayKey } from "@/lib/stats/progress-stats";
import { reviewCard } from "@/lib/fsrs/scheduler";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 8, 14, 15, 0, 0); // 14 sep 2026 15:00 lokal tid

function at(daysAgo: number, hour = 10): string {
  const d = new Date(NOW.getTime() - daysAgo * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const rev = (card_id: string, rating: 1 | 2 | 3 | 4 | 5, daysAgo: number): ReviewEntry => ({
  card_id,
  rating,
  mode: "fsrs",
  reviewed_at: at(daysAgo),
});

describe("buildProgressStats", () => {
  it("räknar repetitioner per dag och ackumulerad kunskap med framåtbärning", () => {
    const reviews: ReviewEntry[] = [
      rev("a", 3, 3),
      rev("b", 5, 3),
      rev("a", 5, 1),
      rev("c", 2, 1),
      rev("b", 2, 0), // b tappar sin femma i dag
    ];
    const s = buildProgressStats({ cardIds: ["a", "b", "c", "d"], progress: {}, reviews, now: NOW, days: 5 });
    expect(s.series.map((p) => p.reviews)).toEqual([0, 2, 0, 2, 1]);
    expect(s.series.map((p) => p.seen)).toEqual([0, 2, 2, 3, 3]);
    expect(s.series.map((p) => p.learned)).toEqual([0, 1, 1, 2, 1]);
    expect(s.reviewsToday).toBe(1);
    expect(s.totalReviews).toBe(5);
    expect(s.hasReviews).toBe(true);
    expect(s.series[4]?.day).toBe(localDayKey(NOW));
  });

  it("bär kunskapsläget från före fönstret in i första dagen", () => {
    const reviews: ReviewEntry[] = [rev("a", 5, 30), rev("b", 5, 20)];
    const s = buildProgressStats({ cardIds: ["a", "b"], progress: {}, reviews, now: NOW, days: 7 });
    expect(s.series.every((p) => p.seen === 2 && p.learned === 2 && p.reviews === 0)).toBe(true);
  });

  it("räknar streak bakåt från i dag, eller från i går om inget gjorts i dag", () => {
    const withToday = buildProgressStats({ cardIds: ["a"], progress: {}, reviews: [rev("a", 4, 0), rev("a", 4, 1), rev("a", 4, 2), rev("a", 4, 4)], now: NOW });
    expect(withToday.streak).toBe(3);
    const withoutToday = buildProgressStats({ cardIds: ["a"], progress: {}, reviews: [rev("a", 4, 1), rev("a", 4, 2)], now: NOW });
    expect(withoutToday.streak).toBe(2);
    const broken = buildProgressStats({ cardIds: ["a"], progress: {}, reviews: [rev("a", 4, 2)], now: NOW });
    expect(broken.streak).toBe(0);
  });

  it("snitt senaste 7 dagarna och nuläge ur progressen", () => {
    const progress: ProgressMap = {
      a: reviewCard("a", undefined, 5, NOW),
      b: reviewCard("b", undefined, 2, NOW),
    };
    const s = buildProgressStats({ cardIds: ["a", "b", "c"], progress, reviews: [rev("a", 5, 1), rev("b", 2, 10)], now: NOW });
    expect(s.avg7).toBe(5);
    expect(s.seen).toBe(2);
    expect(s.learned).toBe(1);
    expect(s.tricky).toBe(2); // b (2) och c (aldrig sedd)
    expect(s.totalCards).toBe(3);
  });

  it("ignorerar historik för kort som inte hör till decket", () => {
    const s = buildProgressStats({ cardIds: ["a"], progress: {}, reviews: [rev("x", 5, 0)], now: NOW });
    expect(s.totalReviews).toBe(0);
    expect(s.hasReviews).toBe(false);
    expect(s.avg7).toBeNull();
    expect(s.streak).toBe(0);
  });
});
