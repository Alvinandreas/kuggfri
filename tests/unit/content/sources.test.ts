import { describe, expect, it } from "vitest";
import { parseSource, sourceKindOf, sourceKinds } from "@/lib/cards/sources";

describe("källor på kort", () => {
  it("delar upp flera källor med dokument och sida/fråga", () => {
    const p = parseSource("Canvas, Quiz Polymeric materials Fö19-21, fråga 7; Canvas, MTT085 Polymeric materials L4-5, s. 6; Canvas, 05142_06b-4, s. 23");
    expect(p.correction).toBeNull();
    expect(p.refs).toEqual([
      { kind: "quiz", document: "Quiz Polymeric materials Fö19-21", locator: "fråga 7", raw: "Canvas, Quiz Polymeric materials Fö19-21, fråga 7" },
      { kind: "forelasning", document: "MTT085 Polymeric materials L4-5", locator: "s. 6", raw: "Canvas, MTT085 Polymeric materials L4-5, s. 6" },
      { kind: "bok", document: "05142_06b-4", locator: "s. 23", raw: "Canvas, 05142_06b-4, s. 23" },
    ]);
  });

  it("plockar ut motiveringen för en rättelse", () => {
    const p = parseSource('Rättelse: "upp över 910 °C" gällde inte över ca 1394 °C; Canvas, GLU 02 Fasdiagram, s. 4');
    expect(p.correction).toBe('"upp över 910 °C" gällde inte över ca 1394 °C');
    expect(p.refs).toHaveLength(1);
    expect(p.refs[0]).toMatchObject({ kind: "forelasning", document: "GLU 02 Fasdiagram", locator: "s. 4" });
  });

  it("räknar semikolon i rättelsens motivering till motiveringen", () => {
    const p = parseSource("Rättelse: fel temperatur; packningsgrad tillagd; Canvas, GLU 01 Kristallstrukturer, s. 12");
    expect(p.correction).toBe("fel temperatur; packningsgrad tillagd");
    expect(p.refs.map((r) => r.document)).toEqual(["GLU 01 Kristallstrukturer"]);
  });

  it("känner igen källtyperna i kursmaterialet", () => {
    const cases: [string, string][] = [
      ["Kapitel_08 Seghet och Brott", "forelasning"],
      ["GLU_5-8 Mikrostruktur och intro till Fasdiagram", "forelasning"],
      ["Fö 12 Stål", "forelasning"],
      ["Fo 7 Styvhet", "forelasning"],
      ["2025 MTT085 Fo21", "forelasning"],
      ["MTT085 PM 3", "forelasning"],
      ["Tentamen Materialteknik med svar 2020-10-24", "tenta"],
      ["Svar Materialteknik 2019-10-26", "tenta"],
      ["Svarsförslag uppgift 4-6, IMS085 251030", "tenta"],
      ["Quiz vecka 3", "quiz"],
      ["MTT085 Tutorials-Part 3-5", "ovning"],
      ["MTT085-Turorials-Part12", "ovning"],
      ["Övning 7 m lösningar", "ovning"],
      ["Lab_PM_M2_v2026", "labb"],
      ["Short_dictionary_ v2026", "ordlista"],
      ["05142_10 (Osswald kap. 10)", "bok"],
      ["Ashby et al Materials 3 utgåvan PRELIMINÄR Läsanvisning och detaljerade lärmål Kap 1-12", "kursdokument"],
      ["performance-indices-booklet-bokpeien22", "bok"],
      ["något helt annat", "ovrigt"],
    ];
    for (const [doc, kind] of cases) expect(sourceKindOf(doc), doc).toBe(kind);
  });

  it("ger unika källtyper och tom lista utan källa", () => {
    expect(sourceKinds("Canvas, Quiz vecka 1, fråga 2; Canvas, Kapitel_03 Materialval, s. 4; Canvas, Kapitel_04 Elastisk deformation, s. 2")).toEqual(["forelasning", "quiz"]);
    expect(sourceKinds(null)).toEqual([]);
    expect(sourceKinds("")).toEqual([]);
  });
});
