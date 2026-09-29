import { describe, expect, it } from "vitest";
import { parseExamFile, parseGrades, parseNumber } from "@/lib/tentor/format";
import { gradeExam, gradeFor, gradeQuestion, totalWithSelfGrades } from "@/lib/tentor/grade";
import { forStudent, isAnswered, type Answers } from "@/lib/tentor/model";

const FIL = `# Tentamen MTT085 2024-10-31
datum: 2024-10-31
tid: 240
poäng: 10
betyg: 3=4, 5=8, 4=6
hjälpmedel: Typgodkänd räknare
källa: Canvas, Tentamen MTT085 24-10
status: utkast

## 1a
del: Metaller
typ: flerval
poäng: 1
sida: 2

Definiera "eutektisk reaktion".

- [ ] Fel ett
- [x] Rätt
- [ ] Fel två

## 1b
typ: flera
poäng: 2
poängsättning: delpoäng

Vilka gitter är tätpackade?

- [x] FCC
- [ ] BCC
- [x] HCP

## 2
typ: sant-falskt
poäng: 2

Ange sant eller falskt.

- [sant] FCC har packningsgrad 0,74.
- [falskt] BCC är tätpackat.

## 3
typ: para
poäng: 2
alternativ: Ferrit | Austenit | Cementit
bild: bilder/2024-10-31-3.webp

Para ihop.

- 1 => Ferrit
- 2 => Cementit

## 4
typ: numerisk
poäng: 1
svar: 0,727
tolerans: 0,01
enhet: -

Beräkna andelen α.

### Lösning

Hävstångsregeln ger 0,727.

## 5
del: Polymerer
typ: text
poäng: 2

Förklara skjuvförtunning.

### Lösning

Viskositeten minskar med ökande skjuvhastighet.
`;

describe("tentafiler", () => {
  it("läser tentan, uppgifterna och facit", () => {
    const { exam, issues } = parseExamFile(FIL, "2024-10-31");
    expect(issues).toEqual([]);
    expect(exam).toMatchObject({ key: "2024-10-31", title: "Tentamen MTT085 2024-10-31", date: "2024-10-31", durationMinutes: 240, maxPoints: 10, aids: "Typgodkänd räknare", status: "utkast" });
    expect(exam.grades).toEqual([{ grade: "3", min: 4 }, { grade: "4", min: 6 }, { grade: "5", min: 8 }]);
    expect(exam.questions.map((q) => [q.id, q.kind, q.points])).toEqual([
      ["1a", "flerval", 1], ["1b", "flera", 2], ["2", "sant-falskt", 2], ["3", "para", 2], ["4", "numerisk", 1], ["5", "text", 2],
    ]);
    const [q1a, q1b, q2, q3, q4, q5] = exam.questions;
    expect(q1a).toMatchObject({ part: "Metaller", page: "2", prompt: 'Definiera "eutektisk reaktion".' });
    expect(q1a?.options?.map((o) => o.correct)).toEqual([false, true, false]);
    expect(q1b?.scoring).toBe("delpoang");
    expect(q2?.statements).toEqual([{ text: "FCC har packningsgrad 0,74.", answer: true }, { text: "BCC är tätpackat.", answer: false }]);
    expect(q3).toMatchObject({ choices: ["Ferrit", "Austenit", "Cementit"], images: ["bilder/2024-10-31-3.webp"], pairs: [{ prompt: "1", answer: "Ferrit" }, { prompt: "2", answer: "Cementit" }] });
    expect(q4?.numeric).toEqual({ value: 0.727, tolerance: 0.01, relative: false, unit: "-" });
    expect(q4?.solution).toBe("Hävstångsregeln ger 0,727.");
    expect(q5?.solution).toContain("Viskositeten");
  });

  it("rapporterar fel med radnummer", () => {
    const fel = `# T
tid: 240
poäng: 5
betyg: 3=2

## 1
typ: flerval
poäng: 1

Fråga

- [x] a
- [x] b

## 1
typ: okänd
poäng: 1

Fråga

## 2
typ: text
poäng: 1

Fråga utan lösning
`;
    const msgs = parseExamFile(fel, "t").issues.map((i) => i.message);
    expect(msgs.some((m) => m.includes("exakt ett rätt"))).toBe(true);
    expect(msgs.some((m) => m.includes("två gånger"))).toBe(true);
    expect(msgs.some((m) => m.includes("okänd eller saknad typ"))).toBe(true);
    expect(msgs.some((m) => m.includes("Lösning krävs"))).toBe(true);
    expect(msgs.some((m) => m.includes("summerar till 3"))).toBe(true);
  });

  it("tolkar tal och betygsgränser", () => {
    expect(parseNumber("0,727")).toBe(0.727);
    expect(parseNumber("12")).toBe(12);
    expect(parseNumber("abc")).toBeNull();
    expect(parseGrades("3=20, 4=30, 5=40")).toEqual([{ grade: "3", min: 20 }, { grade: "4", min: 30 }, { grade: "5", min: 40 }]);
    expect(parseGrades("trasigt")).toBeNull();
  });
});

describe("studentens version", () => {
  it("innehåller inget facit", () => {
    const s = forStudent(parseExamFile(FIL, "x").exam);
    const json = JSON.stringify(s);
    expect(json).not.toContain('"correct"');
    expect(json).not.toContain("Hävstångsregeln");
    expect(json).not.toContain("0.727");
    expect(json).not.toContain("Canvas, Tentamen");
    expect(s.questions[1]).toMatchObject({ options: ["FCC", "BCC", "HCP"], correctCount: 2, selfGraded: false });
    expect(s.questions[3]).toMatchObject({ pairs: ["1", "2"], choices: ["Ferrit", "Austenit", "Cementit"] });
    expect(s.questions[5]?.selfGraded).toBe(true);
  });
});

describe("rättning", () => {
  const exam = parseExamFile(FIL, "x").exam;
  const q = (id: string) => exam.questions.find((x) => x.id === id)!;

  it("flerval, flera med delpoäng, sant/falskt och para", () => {
    expect(gradeQuestion(q("1a"), { kind: "flerval", choice: 1 })).toMatchObject({ points: 1, outcome: "ratt" });
    expect(gradeQuestion(q("1a"), { kind: "flerval", choice: 0 })).toMatchObject({ points: 0, outcome: "fel" });
    expect(gradeQuestion(q("1a"), undefined)).toMatchObject({ points: 0, outcome: "obesvarad" });
    expect(gradeQuestion(q("1b"), { kind: "flera", choices: [0, 2] })).toMatchObject({ points: 2, outcome: "ratt" });
    expect(gradeQuestion(q("1b"), { kind: "flera", choices: [0] })).toMatchObject({ points: 1, outcome: "delvis" });
    expect(gradeQuestion(q("1b"), { kind: "flera", choices: [0, 1] })).toMatchObject({ points: 0, outcome: "fel" });
    expect(gradeQuestion(q("2"), { kind: "sant-falskt", values: [true, true] })).toMatchObject({ points: 1, outcome: "delvis" });
    expect(gradeQuestion(q("3"), { kind: "para", values: ["Ferrit", "Cementit"] })).toMatchObject({ points: 2, outcome: "ratt" });
  });

  it("numeriskt svar inom toleransen, med decimalkomma och enhet", () => {
    expect(gradeQuestion(q("4"), { kind: "numerisk", value: "0,73" })).toMatchObject({ points: 1 });
    expect(gradeQuestion(q("4"), { kind: "numerisk", value: "0.72 " })).toMatchObject({ points: 1 });
    expect(gradeQuestion(q("4"), { kind: "numerisk", value: "0,70" })).toMatchObject({ points: 0 });
    expect(gradeQuestion(q("4"), { kind: "numerisk", value: "ungefär hälften" })).toMatchObject({ points: 0 });
  });

  it("skrivuppgifter självrättas och räknas in i totalen och betyget", () => {
    const answers: Answers = { "1a": { kind: "flerval", choice: 1 }, "1b": { kind: "flera", choices: [0, 2] }, "4": { kind: "numerisk", value: "0,727" }, "5": { kind: "text", value: "Den minskar." } };
    const result = gradeExam(exam, answers);
    expect(result.autoPoints).toBe(4);
    expect(result.selfMax).toBe(2);
    expect(result.questions.find((r) => r.id === "5")?.outcome).toBe("sjalv");
    expect(totalWithSelfGrades(result, { "5": 1.6 })).toBe(5.5);
    expect(totalWithSelfGrades(result, { "5": 9 })).toBe(6);
    expect(gradeFor(3.5, exam.grades)).toBe("U");
    expect(gradeFor(6, exam.grades)).toBe("4");
    expect(isAnswered({ kind: "text", value: "  " })).toBe(false);
  });
});
