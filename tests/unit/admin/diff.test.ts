import { describe, expect, it } from "vitest";
import { cleanupDiff, diffSequence, diffSides, diffText, tokenizeLines, tokenizeWords, type DiffPart } from "@/lib/admin/diff";

const changes = (parts: DiffPart[]) => parts.filter((p) => p.type !== "same");

describe("tokenizeWords", () => {
  it("delar i ord, blanksteg och skiljetecken, även med å, ä och ö", () => {
    expect(tokenizeWords("Stål är segt, järn är sprött.")).toEqual(["Stål", " ", "är", " ", "segt", ",", " ", "järn", " ", "är", " ", "sprött", "."]);
  });

  it("ger tom lista för tom text", () => {
    expect(tokenizeWords("")).toEqual([]);
  });
});

describe("tokenizeLines", () => {
  it("behåller radbrytningen på raden före", () => {
    expect(tokenizeLines("a\nb\n\nc")).toEqual(["a\n", "b\n", "\n", "c"]);
  });
});

describe("diffText", () => {
  it("lika texter ger en enda oförändrad del", () => {
    expect(diffText("Samma text", "Samma text")).toEqual([{ type: "same", text: "Samma text" }]);
    expect(diffText("", "")).toEqual([]);
  });

  it("markerar ett utbytt ord som borttaget och tillagt", () => {
    const parts = diffText("Martensit är mjuk.", "Martensit är hård.");
    expect(parts).toEqual([
      { type: "same", text: "Martensit är " },
      { type: "del", text: "mjuk" },
      { type: "add", text: "hård" },
      { type: "same", text: "." },
    ]);
  });

  it("slår ihop en ändrad fras till en borttagning och ett tillägg", () => {
    const parts = diffText("Diffusion sker snabbare vid låg temperatur.", "Diffusion sker långsammare vid hög temperatur.");
    expect(changes(parts)).toEqual([
      { type: "del", text: "snabbare vid låg" },
      { type: "add", text: "långsammare vid hög" },
    ]);
  });

  it("tillägg i en tom text och borttagning till tom text", () => {
    expect(diffText("", "Ny ledtråd")).toEqual([{ type: "add", text: "Ny ledtråd" }]);
    expect(diffText("Gammal", "")).toEqual([{ type: "del", text: "Gammal" }]);
  });

  it("bevarar båda texterna exakt", () => {
    const before = "Fe–C: $\\alpha$-ferrit\nlöser lite kol.\n\nAustenit löser mer.";
    const after = "Fe–C: $\\alpha$-ferrit löser mycket lite kol.\n\nAustenit (γ) löser mer.";
    expect(diffSides(diffText(before, after))).toEqual({ before, after });
  });

  it("faller tillbaka på rader när orden blir för många", () => {
    // Ordnivån behöver långt fler än 9 celler, radnivån exakt 3 × 3.
    const before = "a b\nsamma\nc d\n";
    const after = "x b\nsamma\nc y\n";
    const parts = diffText(before, after, 9);
    expect(parts).toEqual([
      { type: "del", text: "a b\n" },
      { type: "add", text: "x b\n" },
      { type: "same", text: "samma\n" },
      { type: "del", text: "c d\n" },
      { type: "add", text: "c y\n" },
    ]);
  });

  it("ersätter allt när även raderna blir för många", () => {
    const parts = diffText("a b c", "x y z", 0);
    expect(parts).toEqual([
      { type: "del", text: "a b c" },
      { type: "add", text: "x y z" },
    ]);
  });
});

describe("cleanupDiff", () => {
  it("lägger ihop delar av samma slag och ensamma mellanrum mellan ändringar", () => {
    expect(
      cleanupDiff([
        { type: "same", text: "a" },
        { type: "same", text: " " },
        { type: "del", text: "b" },
        { type: "add", text: "x" },
        { type: "same", text: " " },
        { type: "del", text: "c" },
        { type: "add", text: "y" },
        { type: "same", text: "." },
      ]),
    ).toEqual([
      { type: "same", text: "a " },
      { type: "del", text: "b c" },
      { type: "add", text: "x y" },
      { type: "same", text: "." },
    ]);
  });
});

describe("diffSequence", () => {
  it("ger en del per element", () => {
    expect(diffSequence(["A", "B", "C"], ["A", "C", "D"])).toEqual([
      { type: "same", text: "A" },
      { type: "del", text: "B" },
      { type: "same", text: "C" },
      { type: "add", text: "D" },
    ]);
  });
});
