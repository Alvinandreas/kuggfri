import { describe, expect, it } from "vitest";
import { buildSessionResult } from "@/lib/study/session-result";
import type { SelectableCard } from "@/lib/study/selection";
import type { CardProgress, ProgressMap } from "@/lib/progress/types";

const NOW = new Date("2026-09-20T09:00:00Z");

const cards: SelectableCard[] = [
  { id: "a", category_id: "k1", sort_order: 0 },
  { id: "b", category_id: "k1", sort_order: 1 },
  { id: "c", category_id: "k2", sort_order: 2 },
];

/** Ett repeterat kort som förfaller om `days` dagar. Negativt = redan förfallet. */
function scheduled(cardId: string, days: number): CardProgress {
  return {
    card_id: cardId,
    due: new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
    stability: 10,
    difficulty: 5,
    elapsed_days: 1,
    scheduled_days: Math.max(1, Math.round(days)),
    reps: 2,
    lapses: 0,
    state: 2,
    last_review: new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    self_rating: 4,
  };
}

function build(progress: ProgressMap, options: { finalReview?: boolean; dailyNew?: number } = {}) {
  return buildSessionResult({
    deckSlug: "mtt015",
    cards,
    progress,
    reviews: [],
    selection: { kind: "all" },
    dailyNew: options.dailyNew ?? 10,
    weekdaysOnly: false,
    finalReview: options.finalReview ?? false,
    now: NOW,
  });
}

describe("buildSessionResult: nextDue", () => {
  it("tar tidigaste kommande datum och räknar korten som förfaller den dagen", () => {
    const result = build({ a: scheduled("a", 2), b: scheduled("b", 2.4), c: scheduled("c", 9) });
    expect(result.nextDue?.date.toISOString()).toBe(scheduled("a", 2).due);
    // b förfaller senare samma dygn och ska räknas med, c ligger en vecka bort.
    expect(result.nextDue?.count).toBe(2);
  });

  it("är null när ingenting är schemalagt framåt", () => {
    expect(build({}).nextDue).toBeNull();
    expect(build({ a: scheduled("a", -1) }).nextDue).toBeNull();
  });
});

describe("buildSessionResult: klar för i dag", () => {
  it("är klar när inget är förfallet, även med nya kort kvar", () => {
    const result = build({ a: scheduled("a", 3) });
    expect(result.today.done).toBe(true);
  });

  it("är inte klar när ett kort fortfarande är förfallet", () => {
    const result = build({ a: scheduled("a", -1), b: scheduled("b", 3) });
    expect(result.today.done).toBe(false);
  });

  it("kräver att även nya kort är gjorda under slutrepetitionen", () => {
    // Inför tentan ska allt gås igenom: b och c saknar progress och räknas som nya.
    expect(build({ a: scheduled("a", 3) }, { finalReview: true }).today.done).toBe(false);
    const allSeen = { a: scheduled("a", 3), b: scheduled("b", 4), c: scheduled("c", 5) };
    expect(build(allSeen, { finalReview: true }).today.done).toBe(true);
  });
});

describe("buildSessionResult: ta fler nya kort", () => {
  it("erbjuder högst dagsmålet och högst de nya kort som finns kvar", () => {
    const withTwoNew = build({ a: scheduled("a", 3) }, { dailyNew: 10 });
    expect(withTwoNew.today.continueCount).toBe(2);
    const capped = build({}, { dailyNew: 1 });
    expect(capped.today.continueCount).toBe(1);
  });

  it("länkar tillbaka till samma urval och läge", () => {
    const href = build({ a: scheduled("a", 3) }).today.continueHref;
    expect(href).toBe("/d/mtt015/plugga?mode=fsrs&urval=all&nya=2");
  });

  it("erbjuder inget när allt är introducerat eller under slutrepetitionen", () => {
    const allSeen = { a: scheduled("a", 3), b: scheduled("b", 4), c: scheduled("c", 5) };
    expect(build(allSeen).today.continueHref).toBeNull();
    expect(build(allSeen).today.continueCount).toBe(0);
    expect(build({ a: scheduled("a", 3) }, { finalReview: true }).today.continueHref).toBeNull();
  });

  it("räknar bara nya kort inom urvalet", () => {
    const result = buildSessionResult({
      deckSlug: "mtt015",
      cards,
      progress: { a: scheduled("a", 3) },
      reviews: [],
      selection: { kind: "categories", categoryIds: ["k2"] },
      dailyNew: 10,
      weekdaysOnly: false,
      finalReview: false,
      now: NOW,
    });
    // Bara c ligger i k2; b är nytt men utanför urvalet.
    expect(result.today.continueCount).toBe(1);
    expect(result.today.continueHref).toContain("urval=kategori%3Ak2");
  });
});

describe("buildSessionResult: dagsläge", () => {
  it("rapporterar totalen och avrundar uppskattad kunskap", () => {
    const result = build({ a: scheduled("a", 3) });
    expect(result.today.total).toBe(3);
    expect(Number.isInteger(result.today.known)).toBe(true);
    expect(result.today.known).toBeGreaterThanOrEqual(0);
    expect(result.today.known).toBeLessThanOrEqual(3);
  });
});
