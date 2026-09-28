import { describe, expect, it } from "vitest";
import { parseSource } from "@/lib/cards/sources";
import { cardSources, countBySourceTag, groupSourceRefs, isSourceFilter, matchesSource, mergeLocators, sourceTags } from "@/lib/admin/sources";
import { mergeSubsetOrder } from "@/lib/admin/card-form";
import { DEFAULT_REVIEW_FILTER, countPublishedChanges, filterReviewCards, reviewProgress, type ReviewCard } from "@/lib/admin/review";

const BROTTSEGHET =
  "Rättelse: brottvillkoret var omvänt (kortet sa att brott sker när K1c > K1); Canvas, Kapitel_08 Seghet och Brott, s. 7; Canvas, Kapitel_08 Seghet och Brott, s. 14; " +
  "Canvas, Fö 9 Brott och brottseghet, s. 7; Canvas, Fö 9 Brott och brottseghet, s. 10; Canvas, Kapitel_08 Seghet och Brott, s. 13; Canvas, Kapitel_08 Seghet och Brott, s. 18; " +
  "Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 15";

describe("källmärkning", () => {
  it("ger källtyperna, annars Originalkort eller Ingen källa", () => {
    expect(sourceTags({ source: "Canvas, Quiz vecka 1, fråga 2; Canvas, Kapitel_03 Materialval, s. 4" })).toEqual(["forelasning", "quiz"]);
    expect(sourceTags({ source: null, original: true })).toEqual(["original"]);
    expect(sourceTags({ source: null })).toEqual(["ingen"]);
    expect(sourceTags({ source: "  ", original: false })).toEqual(["ingen"]);
  });

  it("filtrerar på källtyp", () => {
    const quiz = { source: "Canvas, Quiz vecka 3, fråga 1" };
    expect(matchesSource(quiz, "quiz")).toBe(true);
    expect(matchesSource(quiz, "tenta")).toBe(false);
    expect(matchesSource(quiz, "alla")).toBe(true);
    expect(matchesSource(quiz, undefined)).toBe(true);
    expect(matchesSource({ source: null, original: true }, "original")).toBe(true);
    expect(matchesSource({ source: null, original: true }, "ingen")).toBe(false);
  });

  it("känner igen giltiga filtervärden från adressen", () => {
    expect(isSourceFilter("quiz")).toBe(true);
    expect(isSourceFilter("original")).toBe(true);
    expect(isSourceFilter("alla")).toBe(true);
    expect(isSourceFilter("något")).toBe(false);
    expect(isSourceFilter(undefined)).toBe(false);
  });

  it("räknar kort per källmärkning", () => {
    const counts = countBySourceTag([{ source: "Canvas, Quiz 1, fråga 1; Canvas, Tentamen med svar 2020, uppgift 2" }, { source: null, original: true }, { source: null }]);
    expect(counts.quiz).toBe(1);
    expect(counts.tenta).toBe(1);
    expect(counts.original).toBe(1);
    expect(counts.ingen).toBe(1);
    expect(counts.forelasning).toBe(0);
  });
});

describe("grupperade källor", () => {
  it("slår ihop sidor i samma dokument och sorterar dem", () => {
    const groups = groupSourceRefs(parseSource(BROTTSEGHET).refs);
    expect(groups).toEqual([
      { kind: "forelasning", document: "Kapitel_08 Seghet och Brott", locator: "s. 7, 13, 14, 18", count: 4 },
      { kind: "forelasning", document: "Fö 9 Brott och brottseghet", locator: "s. 7, 10", count: 2 },
      { kind: "forelasning", document: "2026-09-23 Kapitel_09 Utmattning", locator: "s. 15", count: 1 },
    ]);
  });

  it("slår ihop olika slags hänvisningar och tar bort dubbletter", () => {
    expect(mergeLocators(["fråga 7", "s. 4", "fråga 3", "fråga 7", null])).toBe("fråga 3, 7, s. 4");
    expect(mergeLocators(["sida 6-7", "s. 2", "sidorna 10 och 11"])).toBe("s. 2, 6-7, 10, 11");
    expect(mergeLocators(["uppg. 2", "uppgift 1"])).toBe("uppgift 1, 2");
    expect(mergeLocators([null, ""])).toBeNull();
  });

  it("räknar samma dokument med olika skrivsätt som ett", () => {
    const groups = groupSourceRefs(parseSource("Canvas, Quiz vecka 3, fråga 1; Canvas, quiz  vecka 3, fråga 2").refs);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: "quiz", document: "Quiz vecka 3", locator: "fråga 1, 2" });
  });

  it("ger rättelsens motivering för sig och säger vad som saknas", () => {
    const s = cardSources({ source: BROTTSEGHET });
    expect(s.correction).toBe("brottvillkoret var omvänt (kortet sa att brott sker när K1c > K1)");
    expect(s.missing).toBeNull();
    expect(cardSources({ source: null, original: true })).toEqual({ groups: [], correction: null, missing: "original" });
    expect(cardSources({ source: null }).missing).toBe("ingen");
  });
});

describe("källfilter i granskningen", () => {
  const NOW = Date.parse("2026-09-28T20:00:00Z");
  let n = 0;
  const card = (over: Partial<ReviewCard> = {}): ReviewCard => {
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
      created_at: new Date(NOW - 1000 + n).toISOString(),
      ...over,
    };
  };
  const areas = [{ id: "a1", title: "Metaller" }];
  const quiz = card({ source: "Canvas, Quiz vecka 1, fråga 1", published_before: true });
  const lecture = card({ source: "Canvas, Kapitel_08 Seghet och Brott, s. 7" });
  const original = card({ original: true });

  it("visar bara kort med källtypen", () => {
    const list = [quiz, lecture, original];
    expect(filterReviewCards(list, { ...DEFAULT_REVIEW_FILTER, source: "quiz" }, areas, NOW).map((c) => c.id)).toEqual([quiz.id]);
    expect(filterReviewCards(list, { ...DEFAULT_REVIEW_FILTER, source: "original" }, areas, NOW).map((c) => c.id)).toEqual([original.id]);
    expect(filterReviewCards(list, DEFAULT_REVIEW_FILTER, areas, NOW)).toHaveLength(3);
  });

  it("förlopp och ändringsräkning följer källfiltret", () => {
    const list = [quiz, lecture, original];
    expect(reviewProgress(list, { area: "alla", kind: "alla", source: "forelasning" }, NOW)).toEqual({ done: 0, total: 1 });
    expect(countPublishedChanges(list, { ...DEFAULT_REVIEW_FILTER, source: "forelasning" }, NOW)).toBe(0);
    expect(countPublishedChanges(list, { ...DEFAULT_REVIEW_FILTER, source: "quiz" }, NOW)).toBe(1);
  });
});

describe("mergeSubsetOrder", () => {
  it("lägger de omsorterade korten på de synliga kortens platser", () => {
    expect(mergeSubsetOrder(["a", "b", "c", "d", "e"], ["d", "b"])).toEqual(["a", "d", "c", "b", "e"]);
    expect(mergeSubsetOrder(["a", "b"], ["b", "a"])).toEqual(["b", "a"]);
    expect(mergeSubsetOrder(["a", "b", "c"], [])).toEqual(["a", "b", "c"]);
  });
});
