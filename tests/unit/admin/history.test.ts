import { describe, expect, it } from "vitest";
import {
  changedFields,
  differsFromPublished,
  diffOptions,
  exactTime,
  isPublished,
  relativeTime,
  restoreValues,
  versionFromRow,
  versionStatus,
  type VersionContent,
} from "@/lib/admin/history";
import type { CardVersionRow } from "@/lib/supabase/database.types";

const base: VersionContent = {
  category_id: "a1",
  front: "Vad är martensit?",
  back: "En hård, spröd fas.",
  hint: null,
  kind: "sjalvskattning",
  options: null,
  is_active: true,
  review_status: null,
  source: null,
};

describe("versionStatus och isPublished", () => {
  it("delar in versioner i publicerad, utkast, avvisad och inaktiv", () => {
    expect(versionStatus(base)).toBe("publicerad");
    expect(versionStatus({ ...base, is_active: false })).toBe("inaktiv");
    expect(versionStatus({ ...base, is_active: false, review_status: "utkast" })).toBe("utkast");
    expect(versionStatus({ ...base, is_active: false, review_status: "avvisad" })).toBe("avvisad");
    expect(isPublished(base)).toBe(true);
    expect(isPublished({ ...base, review_status: "utkast", is_active: false })).toBe(false);
  });
});

describe("restoreValues", () => {
  it("ett kort med granskningsstatus blir alltid inaktivt", () => {
    expect(restoreValues({ ...base, review_status: "utkast", is_active: true }).is_active).toBe(false);
    expect(restoreValues({ ...base, is_active: true }).is_active).toBe(true);
    expect(restoreValues({ ...base, is_active: false }).is_active).toBe(false);
  });

  it("tar bara med innehållet", () => {
    const withExtra = { ...base, id: 5, author: "x", original: true } as VersionContent;
    expect(Object.keys(restoreValues(withExtra)).sort()).toEqual(Object.keys(base).sort());
  });
});

describe("changedFields", () => {
  it("ger de ändrade fälten i visningsordning", () => {
    const after: VersionContent = { ...base, front: "Vad är martensit i stål?", category_id: "a2", review_status: "utkast", is_active: false };
    expect(changedFields(base, after)).toEqual(["status", "category_id", "front"]);
  });

  it("räknar tom och saknad ledtråd och källa som samma", () => {
    expect(changedFields({ ...base, hint: "" }, { ...base, hint: null })).toEqual([]);
    expect(changedFields({ ...base, source: " " }, base)).toEqual([]);
  });

  it("jämför alternativen med text och rätt-markering", () => {
    const a = { ...base, kind: "alternativ" as const, options: [{ text: "A", correct: true }, { text: "B", correct: false }] };
    expect(changedFields(a, { ...a, options: [{ text: "A", correct: false }, { text: "B", correct: true }] })).toEqual(["options"]);
    expect(changedFields(a, { ...a, options: [...a.options] })).toEqual([]);
  });
});

describe("differsFromPublished", () => {
  it("bortser från status men ser ändrat innehåll", () => {
    const draft: VersionContent = { ...base, review_status: "utkast", is_active: false };
    expect(differsFromPublished(base, draft)).toBe(false);
    expect(differsFromPublished(base, { ...draft, back: "En hård fas." })).toBe(true);
  });
});

describe("diffOptions", () => {
  it("visar kvarvarande, borttagna och tillagda alternativ och ändrad rätt-markering", () => {
    const before = [
      { text: "Ferrit", correct: false },
      { text: "Perlit", correct: true },
      { text: "Cementit", correct: false },
    ];
    const after = [
      { text: "Ferrit", correct: true },
      { text: "Perlit", correct: false },
      { text: "Martensit", correct: false },
    ];
    expect(diffOptions(before, after)).toEqual([
      { text: "Ferrit", before: false, after: true },
      { text: "Perlit", before: true, after: false },
      { text: "Cementit", before: false, after: null },
      { text: "Martensit", before: null, after: false },
    ]);
  });

  it("klarar att ena sidan saknar alternativ", () => {
    expect(diffOptions(null, [{ text: "Sant", correct: true }])).toEqual([{ text: "Sant", before: null, after: true }]);
    expect(diffOptions(null, null)).toEqual([]);
  });
});

describe("versionFromRow", () => {
  it("tolkar alternativ, typ och status", () => {
    const row: CardVersionRow = {
      id: 7,
      card_id: "k1",
      deck_id: "d1",
      replaced_at: "2026-09-28T18:00:00Z",
      replaced_by: null,
      category_id: null,
      front: "F",
      back: "B",
      hint: null,
      kind: "alternativ",
      options: [{ text: "A", correct: true }, { text: "B", correct: false }],
      is_active: false,
      review_status: "utkast",
      source: "Rättelse: x",
      original: true,
    };
    const v = versionFromRow(row, "Innehållsverktyget");
    expect(v).toMatchObject({ id: 7, author: "Innehållsverktyget", kind: "alternativ", review_status: "utkast" });
    expect(v.options).toEqual([{ text: "A", correct: true }, { text: "B", correct: false }]);
    expect(versionFromRow({ ...row, options: "trasigt" }, "").options).toBeNull();
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-09-28T20:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("ger svensk relativ tid", () => {
    expect(relativeTime(ago(20_000), now)).toBe("nyss");
    expect(relativeTime(ago(5 * 60_000), now)).toBe("för 5 minuter sedan");
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe("för 3 timmar sedan");
    expect(relativeTime(ago(26 * 3_600_000), now)).toBe("i går");
    expect(relativeTime(ago(4 * 86_400_000), now)).toBe("för 4 dagar sedan");
  });

  it("äldre än två veckor blir ett datum, trasig tid blir tom", () => {
    expect(relativeTime("2026-08-01T12:00:00Z", now)).toMatch(/2026/);
    expect(relativeTime("inte en tid", now)).toBe("");
    expect(exactTime("inte en tid")).toBe("");
  });
});
