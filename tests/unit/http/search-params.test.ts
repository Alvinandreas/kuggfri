import { describe, expect, it } from "vitest";
import { first, flag, positiveInt } from "@/lib/http/search-params";

describe("first", () => {
  it("ger värdet, det första av flera eller undefined", () => {
    expect(first("a")).toBe("a");
    expect(first("")).toBe("");
    expect(first(["a", "b"])).toBe("a");
    expect(first([])).toBeUndefined();
    expect(first(undefined)).toBeUndefined();
  });
});

describe("flag", () => {
  it("är på bara när första värdet är exakt 1", () => {
    expect(flag("1")).toBe(true);
    expect(flag(["1", "0"])).toBe(true);
    expect(flag(["0", "1"])).toBe(false);
    expect(flag("0")).toBe(false);
    expect(flag("true")).toBe(false);
    expect(flag(" 1")).toBe(false);
    expect(flag("")).toBe(false);
    expect(flag(undefined)).toBe(false);
  });
});

/** Tolkningen som sidan /d/[slug]/plugga hade före modulen, för ?nya= och ?pass=. */
function oldExtraNew(v: string | string[] | undefined): number | null {
  const rawExtra = Array.isArray(v) ? v[0] : v;
  const parsedExtra = rawExtra ? Number.parseInt(rawExtra, 10) : Number.NaN;
  return Number.isFinite(parsedExtra) && parsedExtra > 0 ? Math.min(200, parsedExtra) : null;
}
function oldPass(v: string | string[] | undefined): number {
  const rawPass = Number.parseInt((Array.isArray(v) ? v[0] : v) ?? "", 10);
  return Number.isFinite(rawPass) && rawPass > 0 ? Math.min(10_000, rawPass) : 0;
}

describe("positiveInt", () => {
  it("tolkar positiva heltal med tak", () => {
    expect(positiveInt("5", 200)).toBe(5);
    expect(positiveInt("250", 200)).toBe(200);
    expect(positiveInt(["7", "9"], 200)).toBe(7);
    expect(positiveInt("12abc", 200)).toBe(12);
    expect(positiveInt("3.9", 200)).toBe(3);
  });

  it("ger null för saknat, tomt, noll, negativt och otolkbart", () => {
    for (const v of [undefined, "", [], "0", "-3", "abc", "NaN", "Infinity", " "]) expect(positiveInt(v, 200)).toBeNull();
  });

  it("tolkar ?nya= och ?pass= exakt som sidan gjorde förut", () => {
    const inputs: (string | string[] | undefined)[] = [
      undefined, "", " ", "0", "1", "5", "199", "200", "201", "9999", "10000", "10001", "1e3", "0x10", "-1", "+4", " 8", "08",
      "3.7", "12abc", "abc", "Infinity", [], ["4"], ["", "4"], ["abc", "4"], ["300", "2"],
    ];
    for (const v of inputs) {
      expect(positiveInt(v, 200)).toBe(oldExtraNew(v));
      expect(positiveInt(v, 10_000) ?? 0).toBe(oldPass(v));
    }
  });
});
