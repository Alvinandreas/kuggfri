import { describe, expect, it } from "vitest";
import { buildOptions, initialAlternatives, initialTrueFalse, moveItem, normalizeKindInput } from "@/lib/admin/card-form";
import { trueFalseOptions } from "@/lib/cards/kinds";

describe("buildOptions", () => {
  it("vändkort sparas utan alternativ, även om det finns rader kvar i formuläret", () => {
    expect(buildOptions("sjalvskattning", [{ text: "A", correct: true }], true)).toBeNull();
    expect(buildOptions("begrepp", [], null)).toBeNull();
  });

  it("Sant/Falskt blir de två fasta alternativen, eller null utan valt svar", () => {
    expect(buildOptions("sant-falskt", [], false)).toEqual(trueFalseOptions(false));
    expect(buildOptions("sant-falskt", [], null)).toBeNull();
  });

  it("Alternativ trimmas och behåller ordning och rätt-markering", () => {
    expect(
      buildOptions(
        "alternativ",
        [
          { text: " Järn ", correct: true },
          { text: "Trä", correct: false },
        ],
        null,
      ),
    ).toEqual([
      { text: "Järn", correct: true },
      { text: "Trä", correct: false },
    ]);
  });
});

describe("startvärden", () => {
  it("tar kortets alternativ, annars två tomma rader med den första som rätt", () => {
    expect(initialAlternatives("alternativ", [{ text: "X", correct: false }, { text: "Y", correct: true }]).map((o) => [o.text, o.correct])).toEqual([
      ["X", false],
      ["Y", true],
    ]);
    const blank = initialAlternatives("sjalvskattning", null);
    expect(blank.map((o) => [o.text, o.correct])).toEqual([
      ["", true],
      ["", false],
    ]);
    expect(new Set(blank.map((o) => o.key)).size).toBe(2);
  });

  it("läser Sant/Falskt-svaret", () => {
    expect(initialTrueFalse("sant-falskt", trueFalseOptions(true))).toBe(true);
    expect(initialTrueFalse("alternativ", trueFalseOptions(true))).toBeNull();
  });
});

describe("moveItem", () => {
  it("flyttar upp och ner, men inte utanför listan", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});

describe("normalizeKindInput (serverns kontroll)", () => {
  it("nollställer alternativen när typen blir ett vändkort", () => {
    expect(normalizeKindInput("begrepp", [{ text: "A", correct: true }])).toEqual({ ok: true, kind: "begrepp", options: null });
  });

  it("godtar giltiga alternativ och trimmar texten", () => {
    expect(normalizeKindInput("alternativ", [{ text: " A ", correct: true }, { text: "B", correct: true }])).toEqual({
      ok: true,
      kind: "alternativ",
      options: [
        { text: "A", correct: true },
        { text: "B", correct: true },
      ],
    });
  });

  it("nekar okänd typ, fel form och ogiltiga alternativ", () => {
    expect(normalizeKindInput("flerval", null).ok).toBe(false);
    expect(normalizeKindInput("alternativ", "inte en lista").ok).toBe(false);
    expect(normalizeKindInput("alternativ", [{ text: "A", correct: true }]).ok).toBe(false);
    expect(normalizeKindInput("alternativ", [{ text: "A", correct: false }, { text: "B", correct: false }]).ok).toBe(false);
    expect(normalizeKindInput("sant-falskt", [{ text: "Ja", correct: true }, { text: "Nej", correct: false }]).ok).toBe(false);
    expect(normalizeKindInput("sant-falskt", null).ok).toBe(false);
  });

  it("nekar för många alternativ", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ text: `Alt ${i}`, correct: i === 0 }));
    expect(normalizeKindInput("alternativ", many).ok).toBe(false);
  });
});
