import { describe, expect, it } from "vitest";
import {
  buildOptions,
  cardFormValues,
  changeKind,
  fixErrorsMessage,
  formOptions,
  initialAlternatives,
  initialCardForm,
  initialTrueFalse,
  kindIssues,
  moveItem,
  normalizeKindInput,
  requiredIssues,
  savedCardFields,
  type CardFormState,
} from "@/lib/admin/card-form";
import { sv } from "@/lib/i18n/sv";
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

const texts = (form: CardFormState) => form.alternatives.map((o) => [o.text, o.correct]);

describe("initialCardForm", () => {
  it("ett nytt kort är ett tomt vändkort med två tomma alternativrader och inget Sant/Falskt-svar", () => {
    const form = initialCardForm();
    expect({ ...form, alternatives: texts(form) }).toEqual({
      front: "",
      back: "",
      hint: "",
      kind: "sjalvskattning",
      alternatives: [
        ["", true],
        ["", false],
      ],
      trueFalse: null,
    });
  });

  it("läser kortets fält, med saknad ledtråd som tom text", () => {
    const form = initialCardForm({ front: "F", back: "B", hint: null, kind: "alternativ", options: [{ text: "A", correct: false }, { text: "B", correct: true }] });
    expect([form.front, form.back, form.hint, form.kind, form.trueFalse]).toEqual(["F", "B", "", "alternativ", null]);
    expect(texts(form)).toEqual([
      ["A", false],
      ["B", true],
    ]);
  });

  it("initialKind byter typ, men alternativen och svaret läses ur kortets egen typ", () => {
    const tf = initialCardForm({ front: "F", back: "B", hint: "H", kind: "sant-falskt", options: trueFalseOptions(false) }, "alternativ");
    expect(tf.kind).toBe("alternativ");
    expect(tf.trueFalse).toBe(false);
    expect(texts(tf)).toEqual([
      ["", true],
      ["", false],
    ]);
  });
});

describe("changeKind", () => {
  const start = initialCardForm({ front: "F", back: "B", hint: "", kind: "alternativ", options: [{ text: " Järn ", correct: true }, { text: "Trä", correct: false }] });

  it("behåller alternativen och Sant/Falskt-svaret, så att de finns kvar när man byter tillbaka", () => {
    const flipped = changeKind(changeKind(start, "begrepp"), "alternativ");
    expect(flipped).toEqual(start);
    expect(changeKind(start, "begrepp").alternatives).toBe(start.alternatives);
    const answered = { ...changeKind(start, "sant-falskt"), trueFalse: true };
    expect(changeKind(changeKind(answered, "sjalvskattning"), "sant-falskt").trueFalse).toBe(true);
  });

  it("det som sparas följer typen", () => {
    expect(formOptions(start)).toEqual([
      { text: "Järn", correct: true },
      { text: "Trä", correct: false },
    ]);
    expect(formOptions(changeKind(start, "begrepp"))).toBeNull();
    expect(formOptions(changeKind(start, "sant-falskt"))).toBeNull();
    expect(formOptions({ ...changeKind(start, "sant-falskt"), trueFalse: false })).toEqual(trueFalseOptions(false));
  });
});

describe("validering", () => {
  it("kindIssues är typens fel för det som skulle sparas", () => {
    const blank = initialCardForm();
    expect(kindIssues(blank)).toEqual([]);
    expect(kindIssues(changeKind(blank, "sant-falskt"))).toHaveLength(1);
    expect(kindIssues(changeKind(blank, "alternativ"))).toContain("Ett alternativ är tomt.");
    const filled = { ...changeKind(blank, "alternativ"), alternatives: blank.alternatives.map((o, i) => ({ ...o, text: `Alt ${i}` })) };
    expect(kindIssues(filled)).toEqual([]);
  });

  it("requiredIssues ger Obligatoriskt en gång om något fält är tomt eller bara blanksteg", () => {
    expect(requiredIssues(sv, "a", "b")).toEqual([]);
    expect(requiredIssues(sv, "  ")).toEqual([sv.common.required]);
    expect(requiredIssues(sv, "", "")).toEqual([sv.common.required]);
    expect(requiredIssues(sv)).toEqual([]);
  });

  it("fixErrorsMessage sätter felen efter uppmaningen", () => {
    expect(fixErrorsMessage(sv, ["A.", "B."])).toBe(`${sv.admin.fixErrors} A. B.`);
  });
});

describe("det som sparas", () => {
  const form: CardFormState = initialCardForm({ front: " F ", back: " B ", hint: "  ", kind: "alternativ", options: [{ text: " A ", correct: true }, { text: "B", correct: false }] });

  it("cardFormValues skickar texten som den står (servern trimmar)", () => {
    expect(cardFormValues(form)).toEqual({
      front: " F ",
      back: " B ",
      hint: "  ",
      kind: "alternativ",
      options: [
        { text: "A", correct: true },
        { text: "B", correct: false },
      ],
    });
  });

  it("savedCardFields trimmar och gör en tom ledtråd till null", () => {
    expect(savedCardFields(form)).toEqual({ ...cardFormValues(form), front: "F", back: "B", hint: null });
    expect(savedCardFields({ ...form, hint: " Fe " }).hint).toBe("Fe");
  });
});
