import { describe, expect, it } from "vitest";
import { imageFilePath, imageProblems, imageRefs } from "@/lib/content/images";

describe("bilder i korten", () => {
  it("hittar bildreferenser med alt-text, även med titel", () => {
    const md = 'Se figuren.\n\n![Järns unära fasdiagram](/kort/materialteknik/jarn.svg "Järn")\n\nOch ![kort](/x.png).';
    expect(imageRefs(md)).toEqual([
      { alt: "Järns unära fasdiagram", src: "/kort/materialteknik/jarn.svg" },
      { alt: "kort", src: "/x.png" },
    ]);
  });

  it("godkänner en bild i kursens mapp med beskrivande alt-text", () => {
    expect(imageProblems({ alt: "Järns unära fasdiagram", src: "/kort/materialteknik/jarn.svg" }, "materialteknik")).toEqual([]);
    expect(imageFilePath("/kort/materialteknik/jarn.svg")).toBe("public/kort/materialteknik/jarn.svg");
  });

  it("underkänner externa bilder, fel mapp, okänt format, .. och kort alt-text", () => {
    const fel = (alt: string, src: string) => imageProblems({ alt, src }, "materialteknik");
    expect(fel("Ett diagram här", "https://example.com/a.svg")).toHaveLength(1);
    expect(fel("Ett diagram här", "/kort/annan-kurs/a.svg")).toHaveLength(1);
    expect(fel("Ett diagram här", "/kort/materialteknik/a.gif")).toHaveLength(1);
    expect(fel("Ett diagram här", "/kort/materialteknik/../a.svg")).toHaveLength(1);
    expect(fel("bild", "/kort/materialteknik/a.svg")).toHaveLength(1);
  });
});
