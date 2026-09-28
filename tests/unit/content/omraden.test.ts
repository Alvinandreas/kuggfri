import { describe, expect, it } from "vitest";
import { moveCards, setKind } from "../../../scripts/omraden";
import type { ContentCard, ContentCourse } from "@/lib/content/model";

function card(key: string, extra: Partial<ContentCard> = {}): ContentCard {
  return { key, front: key, back: "b", hint: null, active: true, kind: "sjalvskattning", options: null, review: null, source: null, ...extra };
}

const course: ContentCourse = {
  key: "kurs",
  title: "Kurs",
  description: null,
  course_code: null,
  source_credit: null,
  exam_date: null,
  published: true,
  sort_order: 0,
  categories: [
    { key: "a", title: "A", file: "01-a.md", cards: [card("a1"), card("a2"), card("a3")] },
    { key: "b", title: "B", file: "02-b.md", cards: [card("b1")] },
  ],
};

describe("områdesverktygen", () => {
  it("flyttar kort sist i målområdet i angiven ordning och behåller nycklarna", () => {
    const { course: next, moved } = moveCards(course, ["a3", "a1"], "b");
    expect(moved).toBe(2);
    expect(next.categories[0]?.cards.map((c) => c.key)).toEqual(["a2"]);
    expect(next.categories[1]?.cards.map((c) => c.key)).toEqual(["b1", "a3", "a1"]);
  });

  it("vägrar okända kort och områden", () => {
    expect(() => moveCards(course, ["finns-inte"], "b")).toThrow(/Hittar inte/);
    expect(() => moveCards(course, ["a1"], "c")).toThrow(/finns inte/);
  });

  it("byter mellan vändkortstyperna men inte till automaträttade", () => {
    const { course: next, changed } = setKind(course, ["a1", "b1"], "begrepp");
    expect(changed).toBe(2);
    expect(next.categories[0]?.cards[0]?.kind).toBe("begrepp");
    expect(() => setKind(course, ["a1"], "alternativ")).toThrow();
  });
});
