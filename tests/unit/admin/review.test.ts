import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_FILTER,
  inTab,
  isUnreviewed,
  reviewProgress,
  activeFilterCount,
  approvalIssues,
  cleanFlagNote,
  contentMatrix,
  countByTab,
  formatDay,
  groupByArea,
  groupReviewList,
  matchesReviewFilter,
  nextAfterDecision,
  orderByArea,
  relativeDay,
  reviewList,
  reviewRelevant,
  reviewTab,
  stockholmDay,
  step,
  type ReviewCard,
} from "@/lib/admin/review";

const NOW = Date.parse("2026-09-30T08:00:00Z");
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
    original: false,
    flag_note: null,
    flagged_at: null,
    flagged_by: null,
    ...over,
  };
}

const reviewed = (hoursAgo: number, over: Partial<ReviewCard> = {}) =>
  card({ review_status: null, is_active: true, reviewed_at: iso(NOW - hoursAgo * HOUR), reviewed_by: "u1", ...over });
const original = (over: Partial<ReviewCard> = {}) => card({ review_status: null, is_active: true, original: true, ...over });

describe("flikarna", () => {
  it("ogranskade kort i rotation och utkast väntar, godkända är granskade; en flagga ändrar inte läget", () => {
    expect(reviewTab(card())).toBe("att-granska");
    expect(reviewTab(original())).toBe("att-granska"); // i rotation men inte godkänt av en examinator
    expect(isUnreviewed(original())).toBe(true);
    expect(reviewTab(reviewed(1))).toBe("granskade");
    expect(isUnreviewed(reviewed(1))).toBe(false);
    expect(reviewTab(original({ flag_note: "Logiskt fel" }))).toBe("att-granska");
  });

  it("ett flaggat kort står både under Flaggade och under sitt läge, utom ur rotation", () => {
    const flaggedUnreviewed = original({ flag_note: "Logiskt fel" });
    expect(inTab(flaggedUnreviewed, "flaggade")).toBe(true);
    expect(inTab(flaggedUnreviewed, "att-granska")).toBe(true);
    const flaggedReviewed = reviewed(1, { flag_note: "Kolla enheten" });
    expect(inTab(flaggedReviewed, "flaggade")).toBe(true);
    expect(inTab(flaggedReviewed, "granskade")).toBe(true);
    expect(inTab(card({ review_status: "avvisad", flag_note: "x" }), "flaggade")).toBe(false);
  });

  it("kort som tagits ur rotation står under Ur rotation; inaktiverade utanför granskningen hör inte dit", () => {
    expect(reviewTab(card({ review_status: "avvisad" }))).toBe("ur-rotation");
    expect(reviewTab(card({ review_status: null, is_active: false }))).toBeNull();
    const list = [card(), reviewed(1), card({ review_status: "avvisad" }), card({ review_status: null, is_active: false })];
    expect(reviewRelevant(list)).toHaveLength(3);
  });

  it("räknar korten per flik", () => {
    expect(countByTab([card(), card(), reviewed(1), original(), card({ flag_note: "x" }), card({ review_status: "avvisad" })])).toEqual({
      "att-granska": 4,
      granskade: 1,
      flaggade: 1,
      "ur-rotation": 1,
    });
  });
});

describe("listan under en flik", () => {
  it("Att granska och Flaggade i områdenas ordning, utan område sist", () => {
    const a = card({ category_id: "a2" });
    const b = card({ category_id: null });
    const c = card({ category_id: "a1" });
    expect(reviewList([a, b, c], "att-granska", DEFAULT_REVIEW_FILTER, areas).map((x) => x.id)).toEqual([c.id, a.id, b.id]);
    const f1 = card({ category_id: "a2", flag_note: "x" });
    const f2 = reviewed(3, { category_id: "a1", flag_note: "y" });
    expect(reviewList([f1, f2, a], "flaggade", DEFAULT_REVIEW_FILTER, areas).map((x) => x.id)).toEqual([f2.id, f1.id]);
  });

  it("Granskade: senast granskade först; ogranskade originalkort står under Att granska", () => {
    const old = reviewed(30);
    const fresh = reviewed(1);
    const o1 = original({ category_id: "a1" });
    expect(reviewList([old, fresh, o1], "granskade", DEFAULT_REVIEW_FILTER, areas).map((x) => x.id)).toEqual([fresh.id, old.id]);
    expect(reviewList([old, fresh, o1], "att-granska", DEFAULT_REVIEW_FILTER, areas).map((x) => x.id)).toEqual([o1.id]);
  });

  it("grupperar Granskade per dag i svensk tid", () => {
    const sent = reviewed(0, { reviewed_at: "2026-09-29T22:30:00Z" }); // 00:30 den 30:e i Stockholm
    const tidig = reviewed(0, { reviewed_at: "2026-09-29T21:30:00Z" }); // 23:30 den 29:e
    const groups = groupReviewList(reviewList([tidig, sent], "granskade", DEFAULT_REVIEW_FILTER, areas), "granskade", areas);
    expect(groups.map((g) => (g.type === "day" ? g.day : g.type))).toEqual(["2026-09-30", "2026-09-29"]);
  });

  it("grupperar övriga flikar per område; okända områden räknas som utan område", () => {
    const list = orderByArea([card({ category_id: "a2" }), card({ category_id: "okänt" }), card({ category_id: "a1" })], areas);
    expect(groupByArea(list, areas).map((g) => [g.title, g.cards.length])).toEqual([
      ["Metaller", 1],
      ["Polymerer", 1],
      [null, 1],
    ]);
    expect(groupReviewList(list, "att-granska", areas).every((g) => g.type === "area")).toBe(true);
  });
});

describe("filter och sökning", () => {
  const quiz = card({ source: "Canvas, Quiz vecka 1, fråga 1", kind: "alternativ", options: [{ text: "Duktilt brott", correct: true }, { text: "Sprött", correct: false }] });
  const lecture = card({ source: "Canvas, Kapitel_08 Seghet och Brott, s. 7", category_id: "a2", back: "Seghet mäts med slagprov." });
  const orig = card({ original: true, category_id: null });

  it("filtrerar på område, uppgiftstyp, källtyp och ursprung", () => {
    const f = DEFAULT_REVIEW_FILTER;
    expect(matchesReviewFilter(lecture, { ...f, area: "a2" })).toBe(true);
    expect(matchesReviewFilter(quiz, { ...f, area: "a2" })).toBe(false);
    expect(matchesReviewFilter(orig, { ...f, area: "ingen" })).toBe(true);
    expect(matchesReviewFilter(quiz, { ...f, kind: "alternativ" })).toBe(true);
    expect(matchesReviewFilter(lecture, { ...f, kind: "alternativ" })).toBe(false);
    expect(matchesReviewFilter(quiz, { ...f, source: "quiz" })).toBe(true);
    expect(matchesReviewFilter(orig, { ...f, source: "original" })).toBe(true);
    expect(matchesReviewFilter(orig, { ...f, origin: "original" })).toBe(true);
    expect(matchesReviewFilter(orig, { ...f, origin: "nya" })).toBe(false);
    expect(matchesReviewFilter(quiz, { ...f, origin: "nya" })).toBe(true);
  });

  it("söker i fråga, svar, alternativ, källa och flagga, skiftlägesokänsligt och på alla ord", () => {
    const f = DEFAULT_REVIEW_FILTER;
    expect(matchesReviewFilter(lecture, { ...f, query: "SLAGPROV" })).toBe(true);
    expect(matchesReviewFilter(quiz, { ...f, query: "duktilt" })).toBe(true);
    expect(matchesReviewFilter(lecture, { ...f, query: "kapitel_08 seghet" })).toBe(true);
    expect(matchesReviewFilter(lecture, { ...f, query: "seghet kvantmekanik" })).toBe(false);
    expect(matchesReviewFilter(card({ flag_note: "Fel enhet på E" }), { ...f, query: "enhet" })).toBe(true);
  });

  it("räknar aktiva filter utan sökningen", () => {
    expect(activeFilterCount(DEFAULT_REVIEW_FILTER)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_REVIEW_FILTER, area: "a1", origin: "nya", query: "x" })).toBe(2);
  });
});

describe("navigering", () => {
  it("går till nästa kort som finns kvar efter beslutet", () => {
    expect(nextAfterDecision(["a", "b", "c"], ["a", "c"], "b")).toBe("c");
  });

  it("det sista kortet går bakåt i stället för runt, och en tom lista ger inget", () => {
    expect(nextAfterDecision(["a", "b", "c"], ["a", "b"], "c")).toBe("b");
    expect(nextAfterDecision(["a"], [], "a")).toBeNull();
  });

  it("stegar utan att gå runt", () => {
    expect(step(["a", "b", "c"], "b", 1)).toBe("c");
    expect(step(["a", "b", "c"], "c", 1)).toBe("c");
    expect(step(["a", "b", "c"], "a", -1)).toBe("a");
    expect(step(["a", "b"], null, 1)).toBe("a");
    expect(step([], "a", 1)).toBeNull();
  });
});

describe("datum i svensk tid", () => {
  it("ger dagen, i dag och i går oberoende av datorns tidszon", () => {
    expect(stockholmDay("2026-09-29T22:30:00Z")).toBe("2026-09-30");
    expect(relativeDay("2026-09-30T05:00:00Z", NOW)).toBe("today");
    expect(relativeDay("2026-09-29T05:00:00Z", NOW)).toBe("yesterday");
    expect(relativeDay("2026-09-20T05:00:00Z", NOW)).toBeNull();
  });

  it("skriver dag och månad utan punkt, med år bara om det inte är i år", () => {
    expect(formatDay("2026-09-20T10:00:00Z", NOW)).toBe("20 sep");
    expect(formatDay("2025-10-02T10:00:00Z", NOW)).toBe("2 okt 2025");
  });
});

describe("approvalIssues", () => {
  it("godkänner ett helt kort", () => {
    expect(approvalIssues(card())).toEqual([]);
    expect(approvalIssues(card({ kind: "sant-falskt", options: [{ text: "Sant", correct: true }, { text: "Falskt", correct: false }] }))).toEqual([]);
  });

  it("stoppar tomma sidor och ogiltiga alternativ", () => {
    expect(approvalIssues(card({ front: " " }))).toEqual(["Frågan är tom."]);
    expect(approvalIssues(card({ back: "" }))).toEqual(["Svaret är tomt."]);
    expect(approvalIssues(card({ kind: "alternativ", back: "", options: [{ text: "A", correct: false }, { text: "B", correct: false }] }))).toEqual([
      "Förklaringen är tom.",
      "Minst ett alternativ måste vara rätt.",
    ]);
    expect(approvalIssues(card({ kind: "alternativ", options: null }))).toHaveLength(1);
  });
});

describe("flaggans anteckning", () => {
  it("blir en rad utan omgivande blanksteg", () => {
    expect(cleanFlagNote("  Fel enhet.\n\n  Ska vara MPa.  ")).toBe("Fel enhet. Ska vara MPa.");
    expect(cleanFlagNote(" \n ")).toBe("");
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

describe("reviewProgress", () => {
  const areas = [
    { id: "a", title: "Område A" },
    { id: "b", title: "Område B" },
  ];
  const card = (category_id: string | null, review_status: "utkast" | "avvisad" | null, is_active: boolean, reviewed_at: string | null = null, flag_note: string | null = null) => ({
    category_id,
    review_status,
    is_active,
    reviewed_at,
    flag_note,
  });
  const at = "2026-10-01T10:00:00Z";

  it("räknar läget per område i områdenas ordning, och flaggade för sig", () => {
    const p = reviewProgress(
      [
        card("a", null, true, at), // godkänt
        card("a", null, true), // i rotation, ogranskat
        card("a", "utkast", false), // utkast utanför rotation
        card("b", null, true, null, "kolla värdet"), // flaggat
        card("b", "avvisad", false, at), // taget ur rotation
      ],
      areas,
    );
    expect(p.rows.map((r) => [r.areaId, r.approved, r.toReview, r.flagged, r.removed])).toEqual([
      ["a", 1, 2, 0, 0],
      ["b", 0, 1, 1, 1], // det flaggade kortet är också ogranskat
    ]);
    expect(p.total).toEqual({ approved: 1, toReview: 3, flagged: 1, removed: 1 });
  });

  it("hoppar över kort utanför granskningen och utan område, men visar tomma områden", () => {
    const p = reviewProgress([card("a", null, false), card(null, "utkast", false), card("x", "utkast", false)], areas);
    expect(p.total).toEqual({ approved: 0, toReview: 0, flagged: 0, removed: 0 });
    expect(p.rows).toHaveLength(2);
  });
});
