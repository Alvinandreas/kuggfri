import { describe, expect, it } from "vitest";
import { parseExamFile } from "@/lib/tentor/format";
import { forStudent, type Answers } from "@/lib/tentor/model";
import {
  SUBMIT_GRACE_MS,
  attemptOverview,
  deadlineMs,
  dueWarning,
  formatClock,
  formatDuration,
  formatPoints,
  groupByPart,
  halfSteps,
  isExpired,
  kindCounts,
  kindSummary,
  navBoxes,
  parseStored,
  sanitizeAnswers,
  sanitizeSelfGrades,
  step,
  submitSummary,
  timeLeftMs,
  toggleFlag,
  wordCount,
} from "@/lib/tentor/session";

const FIL = `# T
tid: 60
poäng: 6
betyg: 3=3

## 1a
del: Metaller
typ: flerval
poäng: 1

Fråga

- [ ] a
- [x] b

## 1b
typ: flera
poäng: 1

Fråga

- [x] a
- [x] b
- [ ] c

## 2
typ: sant-falskt
poäng: 1

Fråga

- [sant] p
- [falskt] q

## 3
del: Polymerer
typ: para
poäng: 1
alternativ: A | B

Fråga

- x => A
- y => B

## 4
typ: numerisk
poäng: 1
svar: 2

Fråga

## 5
typ: text
poäng: 1

Fråga

### Lösning

Svar.
`;

const exam = parseExamFile(FIL, "t").exam;
const student = forStudent(exam);

describe("tid", () => {
  const start = "2026-09-29T10:00:00.000Z";
  const deadline = deadlineMs(start, 60);

  it("räknar ner från försökets start och skrivtid", () => {
    expect(deadline - new Date(start).getTime()).toBe(3_600_000);
    expect(timeLeftMs(deadline, deadline - 90_000)).toBe(90_000);
    expect(timeLeftMs(deadline, deadline + 5)).toBe(0);
  });

  it("formaterar klockan och skrivtiden", () => {
    expect(formatClock(4 * 3_600_000)).toBe("4:00:00");
    expect(formatClock(59 * 60_000 + 1_500)).toBe("59:02");
    expect(formatClock(0)).toBe("0:00");
    expect(formatDuration(240)).toBe("4 timmar");
    expect(formatDuration(90)).toBe("1 timme 30 minuter");
    expect(formatDuration(45)).toBe("45 minuter");
  });

  it("varnar vid 15 och 5 minuter, en gång var och den mest brådskande först", () => {
    expect(dueWarning(20 * 60_000, [])).toEqual({ warn: null, shown: [] });
    const a = dueWarning(15 * 60_000, []);
    expect(a).toEqual({ warn: 15, shown: [15] });
    expect(dueWarning(10 * 60_000, a.shown).warn).toBeNull();
    expect(dueWarning(4 * 60_000, a.shown)).toEqual({ warn: 5, shown: [15, 5] });
    // Öppnar man tentan med 3 minuter kvar visas bara 5-minutersvarningen.
    expect(dueWarning(3 * 60_000, [])).toEqual({ warn: 5, shown: [15, 5] });
    expect(dueWarning(0, []).warn).toBeNull();
  });

  it("pågående, senaste och bästa försök; utgångna försök räknas inte som pågående", () => {
    const now = new Date("2026-09-29T12:00:00Z").getTime();
    const attempts = [
      { id: "a", exam_id: "e", started_at: "2026-09-28T10:00:00Z", submitted_at: "2026-09-28T12:00:00Z", points: 4, grade: "4" },
      { id: "b", exam_id: "e", started_at: "2026-09-29T08:00:00Z", submitted_at: "2026-09-29T09:00:00Z", points: 2, grade: "U" },
      { id: "c", exam_id: "e", started_at: "2026-09-29T11:30:00Z", submitted_at: null, points: null, grade: null },
    ];
    const o = attemptOverview(attempts, 60, now);
    expect(o.inProgress?.id).toBe("c");
    expect(o.latest?.id).toBe("b");
    expect(o.best?.id).toBe("a");
    expect(o.submitted).toBe(2);
    const later = now + 60 * 60_000;
    expect(attemptOverview(attempts, 60, later).inProgress).toBeNull();
    expect(isExpired(attempts[2]!, 60, later)).toBe(true);
    expect(isExpired(attempts[2]!, 60, deadlineMs(attempts[2]!.started_at, 60) + SUBMIT_GRACE_MS)).toBe(false);
    expect(isExpired(attempts[0]!, 60, later)).toBe(false);
  });
});

describe("navigeringsraden", () => {
  it("grupperar per del; del ärvs av uppgifterna efter", () => {
    expect(groupByPart(exam.questions).map((g) => [g.part, g.items.map((i) => i.id)])).toEqual([
      ["Metaller", ["1a", "1b", "2"]],
      ["Polymerer", ["3", "4", "5"]],
    ]);
    expect(groupByPart([{ id: "1", part: null }, { id: "2", part: null }])).toEqual([{ part: null, items: [{ id: "1", index: 0 }, { id: "2", index: 1 }] }]);
  });

  it("markerar besvarade, aktuell och flaggade", () => {
    const answers: Answers = { "1a": { kind: "flerval", choice: 1 }, "4": { kind: "numerisk", value: " " } };
    const boxes = navBoxes(exam.questions, answers, ["2"], 1).flatMap((g) => g.boxes);
    expect(boxes.find((b) => b.id === "1a")).toMatchObject({ answered: true, current: false, flagged: false });
    expect(boxes.find((b) => b.id === "1b")).toMatchObject({ answered: false, current: true });
    expect(boxes.find((b) => b.id === "2")?.flagged).toBe(true);
    expect(boxes.find((b) => b.id === "4")?.answered).toBe(false);
  });

  it("stegar inom tentan och växlar flaggor", () => {
    expect(step(0, -1, 6)).toBe(0);
    expect(step(2, 1, 6)).toBe(3);
    expect(step(5, 1, 6)).toBe(5);
    expect(toggleFlag(["1a"], "2")).toEqual(["1a", "2"]);
    expect(toggleFlag(["1a", "2"], "1a")).toEqual(["2"]);
  });

  it("sammanfattar inför inlämningen", () => {
    const answers: Answers = { "1a": { kind: "flerval", choice: 0 }, "5": { kind: "text", value: "Svar" } };
    expect(submitSummary(exam.questions, answers, ["5", "3"])).toEqual({ unanswered: ["1b", "2", "3", "4"], flagged: ["3", "5"], answered: 2 });
  });
});

describe("svar från webbläsaren", () => {
  it("behåller giltiga svar och kastar resten", () => {
    const raw = {
      "1a": { kind: "flerval", choice: 7 },
      "1b": { kind: "flera", choices: [2, 0, 0, 9, "x"] },
      "2": { kind: "sant-falskt", values: [true, "ja", false] },
      "3": { kind: "para", values: ["A", "Z"] },
      "4": { kind: "text", value: "fel typ" },
      "5": { kind: "text", value: "x".repeat(30_000) },
      okänd: { kind: "text", value: "hej" },
    };
    const a = sanitizeAnswers(student.questions, raw);
    expect(a["1a"]).toEqual({ kind: "flerval", choice: null });
    expect(a["1b"]).toEqual({ kind: "flera", choices: [0, 2] });
    expect(a["2"]).toEqual({ kind: "sant-falskt", values: [true, null] });
    expect(a["3"]).toEqual({ kind: "para", values: ["A", null] });
    expect(a["4"]).toBeUndefined();
    expect(a["5"]?.kind === "text" && a["5"].value.length).toBe(20_000);
    expect(a).not.toHaveProperty("okänd");
    expect(sanitizeAnswers(exam.questions, null)).toEqual({});
    expect(sanitizeAnswers(exam.questions, [1, 2])).toEqual({});
  });

  it("egna poäng begränsas till 0 till max i halva poäng", () => {
    expect(sanitizeSelfGrades([{ id: "5", max: 2 }], { "5": 1.3, "1a": 1, x: "2" })).toEqual({ "5": 1.5 });
    expect(sanitizeSelfGrades([{ id: "5", max: 2 }], { "5": 9 })).toEqual({ "5": 2 });
    expect(sanitizeSelfGrades([{ id: "5", max: 2 }], { "5": -1 })).toEqual({ "5": 0 });
  });

  it("läser det sparade i webbläsaren försiktigt", () => {
    expect(parseStored(null)).toBeNull();
    expect(parseStored("{trasig")).toBeNull();
    expect(parseStored(JSON.stringify({ answers: { "1a": { kind: "flerval", choice: 1 } }, flags: ["2", 3], savedAt: 5 }))).toEqual({
      answers: { "1a": { kind: "flerval", choice: 1 } },
      flags: ["2"],
      savedAt: 5,
    });
  });
});

describe("siffror och text", () => {
  it("poäng, ord, steg och typer", () => {
    expect(formatPoints(1.5)).toBe("1,5");
    expect(formatPoints(12.8333)).toBe("12,83");
    expect(formatPoints(20)).toBe("20");
    expect(wordCount("  ett två\n tre ")).toBe(3);
    expect(wordCount("   ")).toBe(0);
    expect(halfSteps(2)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(halfSteps(1.5)).toEqual([0, 0.5, 1, 1.5]);
    expect(kindSummary(kindCounts(exam.questions))).toBe(
      "1 flervalsfråga, 1 fråga med flera svar, 1 sant/falskt-fråga, 1 para ihop-uppgift, 1 räkneuppgift med svar, 1 skrivuppgift",
    );
    expect(kindSummary([{ kind: "flerval", count: 3 }])).toBe("3 flervalsfrågor");
  });
});
