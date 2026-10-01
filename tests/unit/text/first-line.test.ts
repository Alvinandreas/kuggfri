import { describe, expect, it } from "vitest";
import { firstLine, matchKey, plainText } from "@/lib/text/first-line";

describe("firstLine", () => {
  it("tar första icke-tomma raden och rensar markdown", () => {
    expect(firstLine("\n\n## Vad är ferrit?\n\nSvar")).toBe("Vad är ferrit?");
    expect(firstLine("* En punkt")).toBe("En punkt");
    expect(firstLine("**Fet** text")).toBe("Fet text");
    expect(firstLine("`kod`")).toBe("kod");
  });

  it("gör KaTeX läsbart i stället för att visa syntax", () => {
    expect(firstLine("Vad är $\\sigma$?")).toBe("Vad är σ?");
    // Multiplikationspunkten blir ett gångertecken (mittpunkten används inte i Kuggfri).
    expect(plainText("$a \\cdot b$")).toBe("a × b");
    expect(plainText("$a \\times b$")).toBe("a × b");
    expect(plainText("$K_{1c}$")).toBe("K1c");
    expect(plainText("$\\frac{a}{b}$")).toBe("a/b");
    expect(plainText("$\\dfrac{E^{1/2}}{\\rho}$")).toBe("E1/2/ρ");
    expect(plainText("$\\cos\\theta \\approx 1$")).toBe("cosθ ≈ 1");
  });

  it("visar Millerindex och riktningar med klamrar och streck", () => {
    expect(plainText("riktningsfamiljen $\\langle 111 \\rangle$")).toBe("riktningsfamiljen ⟨ 111 ⟩");
    expect(plainText("planfamiljen $\\{100\\}$")).toBe("planfamiljen {100}");
    expect(plainText("planet $(1\\bar{1}0)$")).toBe("planet (11̄0)");
  });

  it("tar bort bilder och behåller länktext", () => {
    expect(firstLine("Vilket plan är markerat? ![Kub med axlarna x, y och z](/bilder/kub.png)")).toBe("Vilket plan är markerat?");
    expect(plainText("Se [kursboken](https://example.com) s. 12")).toBe("Se kursboken s. 12");
  });

  it("kapar vid längdtaket utan att lämna blanksteg i slutet", () => {
    const lång = "Redogör för vad gjutning innebär för materialet och ge exempel";
    const kapad = firstLine(lång, { maxLength: 20 });
    expect(kapad.length).toBeLessThanOrEqual(20);
    expect(kapad).toBe(kapad.trimEnd());
    expect(lång.startsWith(kapad)).toBe(true);
    expect(firstLine("kort", { maxLength: 20 })).toBe("kort");
  });

  it("tom text ger tom sträng", () => {
    expect(firstLine("")).toBe("");
    expect(firstLine("   ")).toBe("");
  });
});

describe("matchKey", () => {
  it("normaliserar blanksteg och skiftläge", () => {
    expect(matchKey("  Vad   är   Ferrit?  ")).toBe("vad är ferrit?");
    expect(matchKey("A\nB")).toBe("a b");
    expect(matchKey("Samma")).toBe(matchKey("samma"));
  });
});
