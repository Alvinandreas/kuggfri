import { describe, expect, it } from "vitest";
import { DEFAULT_DUGGA, duggaCount, duggaExamSize, duggaQuery, parseDugga } from "@/lib/study/dugga";

describe("dugga", () => {
  it("läser standardreglerna när adressen saknar dem", () => {
    expect(parseDugga({})).toEqual(DEFAULT_DUGGA);
  });

  it("läser och skriver samma regler", () => {
    const s = { size: 10 as const, hints: true, timer: false };
    const query = Object.fromEntries(new URLSearchParams(duggaQuery(s).slice(1)));
    expect(parseDugga(query)).toEqual(s);
    expect(parseDugga({ antal: "alla", ledtradar: "0", tid: "1" })).toEqual({ size: "alla", hints: false, timer: true });
  });

  it("okända värden faller tillbaka på standard", () => {
    expect(parseDugga({ antal: "999" }).size).toBe(DEFAULT_DUGGA.size);
  });

  it("antal frågor begränsas av urvalet", () => {
    expect(duggaCount(20, 6)).toBe(6);
    expect(duggaCount("alla", 144)).toBe(144);
    expect(duggaExamSize("alla")).toBe(Number.POSITIVE_INFINITY);
  });
});
