import { describe, expect, it } from "vitest";
import {
  RECENT_MS,
  approvalIssues,
  contentMatrix,
  countByArea,
  countPublishedChanges,
  filterReviewCards,
  groupByArea,
  groupReviewList,
  isPublishedChange,
  nextAfterDecision,
  orderByArea,
  reviewBucket,
  reviewProgress,
  reviewRelevant,
  step,
  type ReviewCard,
} from "@/lib/admin/review";

const NOW = Date.parse("2026-09-28T20:00:00Z");
const HOUR = 60 * 60 * 1000;
const iso = (t: number) => new Date(t).toISOString();

const areas = [
  { id: "a1", title: "Metaller" },
  { id: "a2", title: "Polymerer" },
];

let n = 0;
function card(over: Partial<ReviewCard> = {}): ReviewCard {
  n += 1;
  return {
    id: `k${n}`,
    category_id: "a1",
    front: `Fråga ${n}`,
    back: "Svar",
    hint: null,
    kind: "sjalvskattning",
    options: null,
    is_active: false,
    review_status: "utkast",
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    source: null,
    sort_order: n,
    created_at: iso(NOW - 10 * HOUR + n),
    ...over,
  };
}

const approved = (hoursAgo: number, over: Partial<ReviewCard> = {}) =>
  card({ review_status: null, is_active: true, reviewed_at: iso(NOW - hoursAgo * HOUR), reviewed_by: "u1", ...over });

describe("reviewBucket", () => {
  it("delar in utkast, avvisade och nyss godkända", () => {
    expect(reviewBucket(card(), NOW)).toBe("vantar");
    expect(reviewBucket(card({ review_status: "avvisad", reviewed_at: iso(NOW - 100 * HOUR) }), NOW)).toBe("avvisade");
    expect(reviewBucket(approved(2), NOW)).toBe("godkanda");
  });

  it("godkända äldre än ett dygn och vanliga kort hör inte till granskningen", () => {
    expect(reviewBucket(approved(25), NOW)).toBeNull();
    expect(reviewBucket(card({ review_status: null, is_active: true }), NOW)).toBeNull();
    expect(reviewBucket({ review_status: null, reviewed_at: iso(NOW - RECENT_MS) }, NOW)).toBe("godkanda");
  });

  it("tål klientens klocka en bit före serverns", () => {
    expect(reviewBucket(approved(-0.01), NOW)).toBe("godkanda");
  });

  it("reviewRelevant tar bara med kort som hör till granskningen", () => {
    const list = [card(), approved(1), approved(48), card({ review_status: null, is_active: true })];
    expect(reviewRelevant(list, NOW).map((c) => c.id)).toEqual([list[0]!.id, list[1]!.id]);
  });
});

describe("filtrering, ordning och gruppering", () => {
  const a = card({ category_id: "a2", sort_order: 1 });
  const b = card({ category_id: "a1", sort_order: 5, kind: "begrepp" });
  const c = card({ category_id: null, sort_order: 0 });
  const d = card({ category_id: "a1", sort_order: 2 });
  const e = card({ category_id: "okänt", sort_order: 1 });
  const rejected = card({ category_id: "a1", review_status: "avvisad" });
  const list = [a, b, c, d, e, rejected, approved(3, { category_id: "a2" })];

  it("ordnar efter områdenas ordning, utan område sist, sedan sort_order", () => {
    expect(orderByArea([a, b, c, d], areas).map((x) => x.id)).toEqual([d.id, b.id, a.id, c.id]);
  });

  it("filtrerar på status, område och uppgiftstyp", () => {
    const f = (bucket: "vantar" | "avvisade" | "godkanda", area = "alla", kind: "alla" | ReviewCard["kind"] = "alla") =>
      filterReviewCards(list, { bucket, area, kind }, areas, NOW).map((x) => x.id);
    expect(f("vantar")).toEqual([d.id, b.id, a.id, c.id, e.id]);
    expect(f("vantar", "a1")).toEqual([d.id, b.id]);
    expect(f("vantar", "ingen")).toEqual([c.id]);
    expect(f("vantar", "alla", "begrepp")).toEqual([b.id]);
    expect(f("avvisade")).toEqual([rejected.id]);
    expect(f("godkanda", "a2")).toHaveLength(1);
  });

  it("grupperar per område; okända områden räknas som utan område", () => {
    const groups = groupByArea(orderByArea([a, b, c, d, e], areas), areas);
    expect(groups.map((g) => [g.title, g.cards.length])).toEqual([
      ["Metaller", 2],
      ["Polymerer", 1],
      [null, 2],
    ]);
  });

  it("räknar per område för massgodkännandet", () => {
    expect(countByArea([a, b, c, d, e], areas)).toEqual([
      { areaId: "a1", title: "Metaller", count: 2 },
      { areaId: "a2", title: "Polymerer", count: 1 },
      { areaId: null, title: null, count: 2 },
    ]);
  });
});

describe("förlopp", () => {
  it("räknar beslut senaste dygnet av väntande plus beslutade", () => {
    const list = [card(), card(), approved(1), card({ review_status: "avvisad", reviewed_at: iso(NOW - 2 * HOUR) }), approved(30), card({ review_status: "avvisad", reviewed_at: iso(NOW - 50 * HOUR) })];
    expect(reviewProgress(list, { area: "alla", kind: "alla" }, NOW)).toEqual({ done: 2, total: 4 });
  });

  it("följer område- och typfiltret", () => {
    const list = [card({ category_id: "a1" }), approved(1, { category_id: "a2" }), card({ category_id: "a2", kind: "alternativ" })];
    expect(reviewProgress(list, { area: "a2", kind: "alla" }, NOW)).toEqual({ done: 1, total: 2 });
    expect(reviewProgress(list, { area: "a2", kind: "alternativ" }, NOW)).toEqual({ done: 0, total: 1 });
  });
});

describe("navigering", () => {
  it("går till nästa kort som finns kvar efter beslutet", () => {
    expect(nextAfterDecision(["a", "b", "c", "d"], ["a", "c", "d"], "b")).toBe("c");
    expect(nextAfterDecision(["a", "b", "c"], ["a", "b"], "c")).toBe("a");
    expect(nextAfterDecision(["a"], [], "a")).toBeNull();
  });

  it("går vidare även när kortet står kvar i listan (t.ex. avvisat igen)", () => {
    expect(nextAfterDecision(["a", "b", "c"], ["a", "b", "c"], "b")).toBe("c");
    expect(nextAfterDecision(["a", "b"], ["a", "b"], "b")).toBe("a");
  });

  it("stegar utan att gå runt", () => {
    expect(step(["a", "b", "c"], "b", 1)).toBe("c");
    expect(step(["a", "b", "c"], "c", 1)).toBe("c");
    expect(step(["a", "b", "c"], "a", -1)).toBe("a");
    expect(step(["a", "b"], null, 1)).toBe("a");
    expect(step([], "a", 1)).toBeNull();
  });
});

describe("approvalIssues", () => {
  it("godkänner ett helt kort", () => {
    expect(approvalIssues(card())).toEqual([]);
    expect(approvalIssues(card({ kind: "sant-falskt", options: [{ text: "Sant", correct: true }, { text: "Falskt", correct: false }] }))).toEqual([]);
  });

  it("stoppar tomma sidor och ogiltiga alternativ", () => {
    expect(approvalIssues(card({ front: " " }))).toHaveLength(1);
    expect(approvalIssues(card({ kind: "alternativ", back: "", options: [{ text: "A", correct: false }, { text: "B", correct: false }] }))).toEqual([
      "Förklaringen är tom.",
      "Minst ett alternativ måste vara rätt.",
    ]);
    expect(approvalIssues(card({ kind: "alternativ", options: null }))).toHaveLength(1);
  });
});

describe("contentMatrix", () => {
  it("räknar aktiva kort per område och typ, utkast för sig, och summerar", () => {
    const list = [
      card({ review_status: null, is_active: true, kind: "begrepp", category_id: "a1" }),
      card({ review_status: null, is_active: true, kind: "alternativ", category_id: "a1", options: [] }),
      card({ review_status: null, is_active: false, category_id: "a1" }),
      card({ review_status: "utkast", category_id: "a2" }),
      card({ review_status: "avvisad", category_id: "a2" }),
      card({ review_status: null, is_active: true, category_id: null }),
    ];
    const m = contentMatrix(list, areas);
    expect(m.rows.map((r) => [r.title, r.active, r.drafts])).toEqual([
      ["Metaller", 2, 0],
      ["Polymerer", 0, 1],
      [null, 1, 0],
    ]);
    expect(m.rows[0]!.byKind).toEqual({ sjalvskattning: 0, begrepp: 1, "sant-falskt": 0, alternativ: 1 });
    expect(m.total.active).toBe(3);
    expect(m.total.drafts).toBe(1);
    expect(m.total.byKind.sjalvskattning).toBe(1);
  });

  it("visar tomma områden men ingen rad utan område om alla kort har ett", () => {
    const m = contentMatrix([card({ review_status: null, is_active: true })], areas);
    expect(m.rows.map((r) => r.title)).toEqual(["Metaller", "Polymerer"]);
  });
});

describe("ändringar av publicerade kort", () => {
  const all = { bucket: "vantar", area: "alla", kind: "alla" } as const;

  it("ett utkast med tidigare publicerad version är en ändring", () => {
    expect(isPublishedChange(card({ published_before: true }))).toBe(true);
    expect(isPublishedChange(card())).toBe(false);
    expect(isPublishedChange(approved(1, { published_before: true }))).toBe(false);
  });

  it("sorteras först bland dem som väntar, i övrigt i områdenas ordning", () => {
    const a = card({ category_id: "a1" });
    const b = card({ category_id: "a2", published_before: true });
    const c = card({ category_id: "a1", published_before: true });
    const d = card({ category_id: "a2" });
    expect(filterReviewCards([a, b, c, d], all, areas, NOW).map((x) => x.id)).toEqual([c.id, b.id, a.id, d.id]);
  });

  it("sorteras inte först i andra högar", () => {
    const a = card({ category_id: "a1", review_status: "avvisad" });
    const b = card({ category_id: "a2", review_status: "avvisad", published_before: true });
    expect(filterReviewCards([b, a], { ...all, bucket: "avvisade" }, areas, NOW).map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it("filtret visar bara ändringar och räknas inom högen, området och typen", () => {
    const a = card({ category_id: "a1", published_before: true });
    const b = card({ category_id: "a2", published_before: true });
    const c = card({ category_id: "a1" });
    const d = card({ category_id: "a1", review_status: "avvisad", published_before: true });
    const list = [a, b, c, d];
    expect(filterReviewCards(list, { ...all, changesOnly: true }, areas, NOW).map((x) => x.id)).toEqual([a.id, b.id]);
    expect(countPublishedChanges(list, all, NOW)).toBe(2);
    expect(countPublishedChanges(list, { ...all, area: "a1" }, NOW)).toBe(1);
    expect(countPublishedChanges(list, { ...all, bucket: "avvisade" }, NOW)).toBe(1);
    expect(countPublishedChanges(list, { ...all, kind: "begrepp" }, NOW)).toBe(0);
  });

  it("listan får en egen grupp för ändringarna överst, resten per område", () => {
    const a = card({ category_id: "a1" });
    const b = card({ category_id: "a2", published_before: true });
    const c = card({ category_id: "a2" });
    const ordered = filterReviewCards([a, b, c], all, areas, NOW);
    const groups = groupReviewList(ordered, areas);
    expect(groups.map((g) => [g.key, g.changes, g.cards.map((x) => x.id)])).toEqual([
      ["andringar", true, [b.id]],
      ["a1", false, [a.id]],
      ["a2", false, [c.id]],
    ]);
    // Samma ordning som navigeringen.
    expect(groups.flatMap((g) => g.cards.map((x) => x.id))).toEqual(ordered.map((x) => x.id));
  });

  it("bara ändringar (eller inga) grupperas per område som vanligt", () => {
    const a = card({ category_id: "a2", published_before: true });
    const b = card({ category_id: "a1", published_before: true });
    const ordered = filterReviewCards([a, b], all, areas, NOW);
    expect(groupReviewList(ordered, areas).map((g) => [g.key, g.changes])).toEqual([
      ["a1", false],
      ["a2", false],
    ]);
    expect(groupReviewList([card({ category_id: null })], areas).map((g) => g.key)).toEqual(["ingen"]);
  });
});
