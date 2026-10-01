import { describe, expect, it } from "vitest";
import { toCategoryOption, toHomeDeck, toOverviewCard, toStudyCard } from "@/lib/content/view-models";
import type { CardRow, CategoryRow, DeckRow } from "@/lib/supabase/database.types";

function card(overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: "c1",
    deck_id: "d1",
    category_id: "k1",
    front: "Fråga",
    back: "Svar",
    hint: null,
    sort_order: 3,
    is_active: true,
    key: "nyckel",
    source_hash: "hash",
    kind: "sjalvskattning",
    options: null,
    review_status: null,
    review_note: "anteckning",
    reviewed_by: "redaktör",
    reviewed_at: "2026-09-30T10:00:00Z",
    source: "Föreläsning 3",
    original: true,
    flag_note: null,
    flagged_at: null,
    ...overrides,
  } as CardRow;
}

const category = { id: "k1", deck_id: "d1", title: "Område", sort_order: 0, key: "omr", source_hash: null } as unknown as CategoryRow;

describe("toCategoryOption", () => {
  it("ger bara id och titel", () => {
    expect(toCategoryOption(category)).toEqual({ id: "k1", title: "Område" });
  });
});

describe("toOverviewCard", () => {
  it("ger samma fält som kurssidan byggde förut, i samma ordning", () => {
    const out = toOverviewCard(card({ hint: "Tänk på…", kind: "begrepp", original: false }));
    expect(out).toEqual({ id: "c1", category_id: "k1", sort_order: 3, front: "Fråga", original: false, kind: "begrepp", hasHint: true });
    expect(Object.keys(out)).toEqual(["id", "category_id", "sort_order", "front", "original", "kind", "hasHint"]);
  });

  it("hasHint är falskt för saknad och tom ledtråd", () => {
    expect(toOverviewCard(card({ hint: null })).hasHint).toBe(false);
    expect(toOverviewCard(card({ hint: "" })).hasHint).toBe(false);
  });

  it("tar inte med redaktörernas fält", () => {
    const out = toOverviewCard(card()) as Record<string, unknown>;
    for (const k of ["back", "source", "review_note", "flag_note", "key", "deck_id"]) expect(out).not.toHaveProperty(k);
  });
});

describe("toStudyCard", () => {
  it("ger samma fält som passet byggde förut och tolkar alternativen", () => {
    const options = [
      { text: "Sant", correct: true },
      { text: "Falskt", correct: false },
    ];
    const out = toStudyCard(card({ kind: "sant-falskt", options, hint: "Ledtråd" }));
    expect(out).toEqual({
      id: "c1",
      category_id: "k1",
      front: "Fråga",
      back: "Svar",
      hint: "Ledtråd",
      sort_order: 3,
      kind: "sant-falskt",
      options,
      original: true,
    });
    expect(Object.keys(out)).toEqual(["id", "category_id", "front", "back", "hint", "sort_order", "kind", "options", "original"]);
  });

  it("trasiga alternativ blir null, som med parseOptions", () => {
    expect(toStudyCard(card({ options: [{ text: 1 }] as unknown as CardRow["options"] })).options).toBeNull();
    expect(toStudyCard(card({ options: null })).options).toBeNull();
  });
});

describe("toHomeDeck", () => {
  it("ger deckets fält, områdena och kortens ordning", () => {
    const deck = {
      id: "d1",
      slug: "kurs",
      title: "Kursen",
      course_code: "ABC123",
      exam_date: "2026-10-20",
      description: "Beskrivning",
      is_published: true,
    } as unknown as DeckRow;
    const out = toHomeDeck({ deck, categories: [category], cards: [card(), card({ id: "c2", category_id: null, sort_order: 0 })] });
    expect(out).toEqual({
      id: "d1",
      slug: "kurs",
      title: "Kursen",
      course_code: "ABC123",
      exam_date: "2026-10-20",
      categories: [{ id: "k1", title: "Område" }],
      cards: [
        { id: "c1", category_id: "k1", sort_order: 3 },
        { id: "c2", category_id: null, sort_order: 0 },
      ],
    });
    expect(Object.keys(out)).toEqual(["id", "slug", "title", "course_code", "exam_date", "categories", "cards"]);
  });
});
