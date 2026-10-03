import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRoster } from "@/lib/enrollment/parse";
import { isXlsx, XlsxError, xlsxRows, xlsxToText } from "@/lib/enrollment/xlsx";

/** Fixturerna byggs som Excel sparar: delade strängar, tal, formaterad text, tomma rader och celler. */
const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)));

describe("xlsx", () => {
  it("läser första bladet via relationen, med delade strängar, tal, formaterad text och tomma celler", async () => {
    const rows = await xlsxRows(fixture("deltagare-excel.xlsx"));
    expect(rows).toEqual([
      ["Personnummer", "Namn", "E-post"],
      ["200301151234", "Lindqvist, Saga", "saga.lindqvist@kuggfri.test"],
      [],
      ["", "Omid Ahmadi", "omid.ahmadi@kuggfri.test"],
      ["", "Berglund & Co", "elin.berglund@kuggfri.test"],
    ]);
  });

  it("läser också en okomprimerad fil", async () => {
    expect(await xlsxRows(fixture("deltagare-okomprimerad.xlsx"))).toEqual(await xlsxRows(fixture("deltagare-excel.xlsx")));
  });

  it("ger en lista som läsaren tar emot, utan personnummer", async () => {
    const roster = parseRoster(await xlsxToText(fixture("deltagare-excel.xlsx")));
    expect(roster.entries.map((e) => [e.email, e.name])).toEqual([
      ["saga.lindqvist@kuggfri.test", "Lindqvist, Saga"],
      ["omid.ahmadi@kuggfri.test", "Omid Ahmadi"],
      ["elin.berglund@kuggfri.test", "Berglund & Co"],
    ]);
    expect(roster.problems).toEqual([]);
    expect(JSON.stringify(roster)).not.toContain("1234");
  });

  it("avvisar filer som inte är xlsx", async () => {
    await expect(xlsxRows(new TextEncoder().encode("E-post\nanna@chalmers.se"))).rejects.toBeInstanceOf(XlsxError);
  });

  it("känner igen xlsx på namn eller typ", () => {
    expect(isXlsx({ name: "Deltagare.XLSX", type: "" })).toBe(true);
    expect(isXlsx({ name: "lista", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })).toBe(true);
    expect(isXlsx({ name: "lista.csv", type: "text/csv" })).toBe(false);
  });
});
