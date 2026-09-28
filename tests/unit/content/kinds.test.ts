import { describe, expect, it } from "vitest";
import { parseCardFile, serializeCardFile } from "@/lib/content/markdown";
import { autoRating, isCorrectAnswer, trueFalseAnswer, validateKind } from "@/lib/cards/kinds";

const FIL = `# Kristallstruktur

## Vad är en enhetscell?
key: enhetscell

Den minsta upprepade enheten i ett kristallgitter.

## Dislokation
key: dislokation
typ: begrepp

En linjedefekt i kristallgittret.

## FCC har högre packningstäthet än BCC.
key: fcc-packning
typ: sant-falskt
svar: sant

FCC: 0,74. BCC: 0,68.

## Vilka gitter är tätpackade?
key: tatpackade-gitter
typ: alternativ
status: utkast
källa: Canvas, Quiz vecka 1, fråga 3

- [x] FCC
- [ ] BCC
- [x] HCP

Både FCC och HCP har packningstätheten 0,74.
`;

describe("uppgiftstyper i kortfilerna", () => {
  it("läser typ, svar, alternativ, status och källa", () => {
    const { file, issues } = parseCardFile(FIL);
    expect(issues).toEqual([]);
    const [vanligt, begrepp, sf, alt] = file.cards;
    expect(vanligt).toMatchObject({ kind: "sjalvskattning", options: null, review: null, source: null, active: true });
    expect(begrepp).toMatchObject({ kind: "begrepp", options: null });
    expect(sf?.kind).toBe("sant-falskt");
    expect(trueFalseAnswer(sf?.options ?? null)).toBe(true);
    expect(sf?.back).toBe("FCC: 0,74. BCC: 0,68.");
    expect(alt).toMatchObject({
      kind: "alternativ",
      review: "utkast",
      active: false,
      source: "Canvas, Quiz vecka 1, fråga 3",
      options: [
        { text: "FCC", correct: true },
        { text: "BCC", correct: false },
        { text: "HCP", correct: true },
      ],
      back: "Både FCC och HCP har packningstätheten 0,74.",
    });
  });

  it("skriver tillbaka exakt samma fil", () => {
    const { file } = parseCardFile(FIL);
    expect(serializeCardFile(file)).toBe(FIL);
  });

  it("fyller i baksidan med rätt svar när förklaring saknas, och det överlever en rundtur", () => {
    const text = "# O\n\n## Påstående\nkey: p\ntyp: sant-falskt\nsvar: falskt\n\n## Fråga\nkey: f\ntyp: flerval\n\n- [ ] a\n- [x] b\n";
    const { file, issues } = parseCardFile(text);
    expect(issues).toEqual([]);
    expect(file.cards[0]?.back).toBe("Påståendet är falskt.");
    expect(file.cards[1]?.back).toBe("Rätt svar: b");
    const again = parseCardFile(serializeCardFile(file)).file;
    expect(again).toEqual(file);
  });

  it("rapporterar okänd typ, saknat svar och alternativ utan rätt svar", () => {
    const text = "# O\n\n## A\nkey: a\ntyp: lucktext\n\nX\n\n## B\nkey: b\ntyp: sant-falskt\n\nX\n\n## C\nkey: c\ntyp: alternativ\n\n- [ ] a\n- [ ] b\n\nX\n";
    const messages = parseCardFile(text).issues.map((i) => i.message);
    expect(messages).toEqual([
      expect.stringContaining("Okänd typ"),
      expect.stringContaining("saknar svar"),
      expect.stringContaining("Minst ett alternativ"),
    ]);
  });
});

describe("rättning och skattning", () => {
  const options = [
    { text: "FCC", correct: true },
    { text: "BCC", correct: false },
    { text: "HCP", correct: true },
  ];

  it("kräver exakt de rätta alternativen", () => {
    expect(isCorrectAnswer(options, [0, 2])).toBe(true);
    expect(isCorrectAnswer(options, [2, 0])).toBe(true);
    expect(isCorrectAnswer(options, [0])).toBe(false);
    expect(isCorrectAnswer(options, [0, 1, 2])).toBe(false);
  });

  it("ger 3, 4 och sedan 5 för rätt svar i rad, och 1 för fel", () => {
    expect(autoRating(true, null)).toBe(3);
    expect(autoRating(true, 3)).toBe(4);
    expect(autoRating(true, 4)).toBe(5);
    expect(autoRating(true, 5)).toBe(5);
    expect(autoRating(false, 5)).toBe(1);
    expect(autoRating(true, 1)).toBe(3);
    expect(autoRating(true, 2)).toBe(3);
  });

  it("validerar sant-falskt-formen", () => {
    expect(validateKind("sant-falskt", [{ text: "Sant", correct: true }, { text: "Falskt", correct: true }])).not.toEqual([]);
    expect(validateKind("begrepp", [{ text: "a", correct: true }])).not.toEqual([]);
    expect(validateKind("begrepp", null)).toEqual([]);
  });
});
