import { describe, expect, it } from "vitest";
import { formatDecimal, formatInteger, formatPoints, percent, percentText } from "@/lib/format/number";
import { oneLine } from "@/lib/text/one-line";

describe("tal", () => {
  it("heltal med mellanslag som tusentalsavgränsare", () => {
    expect(formatInteger(1187).replace(/\s/g, " ")).toBe("1 187");
    expect(formatInteger(12)).toBe("12");
    expect(formatInteger(Number.NaN)).toBe("–");
  });

  it("decimaltal med komma och bestämt antal decimaler", () => {
    expect(formatDecimal(3.8, 2)).toBe("3,80");
    expect(formatDecimal(4.25)).toBe("4,3");
    expect(formatDecimal(null)).toBe("–");
    expect(formatDecimal(undefined)).toBe("–");
    expect(formatDecimal(Number.POSITIVE_INFINITY)).toBe("–");
  });

  it("poäng med komma och högst två decimaler", () => {
    expect(formatPoints(1.5)).toBe("1,5");
    expect(formatPoints(12.8333)).toBe("12,83");
    expect(formatPoints(20)).toBe("20");
  });

  it("procent", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percentText(1, 4)).toBe("25 %");
    expect(percentText(1, 0)).toBe("–");
  });
});

describe("oneLine", () => {
  it("radbrytningar blir ett mellanslag och ändarna trimmas", () => {
    expect(oneLine("  Fel enhet.\n\n  Ska vara MPa.  ")).toBe("Fel enhet. Ska vara MPa.");
    expect(oneLine("a\r\nb")).toBe("a b");
    expect(oneLine(" \n ")).toBe("");
  });
});
