import { describe, expect, it } from "vitest";
import { percent, percentText } from "@/lib/text/percent";

describe("percent", () => {
  it("avrundar till hela procent", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(144, 144)).toBe(100);
  });

  it("ger 0 i stället för NaN när nämnaren är tom", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(5, 0)).toBe(0);
    expect(percent(1, -3)).toBe(0);
    expect(percent(Number.NaN, 10)).toBe(0);
  });
});

describe("percentText", () => {
  it("skriver ut andelen med enhet", () => {
    expect(percentText(1, 2)).toBe("50 %");
    expect(percentText(0, 7)).toBe("0 %");
  });

  it("skiljer 'vet inte' från 'noll procent'", () => {
    expect(percentText(0, 0)).toBe("–");
    expect(percentText(0, 0, "för tidigt")).toBe("för tidigt");
  });
});
