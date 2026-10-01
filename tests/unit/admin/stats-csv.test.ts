import { describe, expect, it } from "vitest";
import { areaStatsCsv, cardStatsCsv, toCsv } from "@/lib/admin/stats-csv";

const lines = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

describe("toCsv", () => {
  it("skriver BOM, semikolon, decimalkomma och CRLF som svensk Excel vill ha", () => {
    const csv = toCsv([
      ["a", 1, 3.456],
      ["b", null, 2],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿a;1;3,46\r\nb;;2\r\n");
  });

  it("citerar fält med semikolon, citattecken och radbrytningar", () => {
    expect(lines(toCsv([['Vad är "K1c"; brottseghet?', "rad\nett"]]))).toEqual(['"Vad är ""K1c""; brottseghet?";"rad\nett"']);
  });
});

const areas = [
  { id: "a", title: "Kristallstruktur" },
  { id: "b", title: "Polymerers struktur" },
];
const cards = [
  { id: "1", category_id: "a", front: "Vad är $\\sigma$?", kind: "sjalvskattning" as const, is_active: true, review_status: null },
  { id: "2", category_id: "a", front: "Utkast", kind: "sjalvskattning" as const, is_active: false, review_status: "utkast" },
  { id: "3", category_id: "b", front: "Inaktivt", kind: "sjalvskattning" as const, is_active: false, review_status: null },
];

describe("areaStatsCsv", () => {
  it("ger en rad per område med innehåll och statistik, tomt under anonymitetsgränsen", () => {
    const rows = lines(areaStatsCsv(areas, cards, [{ category_id: "a", students: 6, ratings: 40, avg: 3.25, low: 10, learned: 2 }]));
    expect(rows[0]).toBe("Nr;Område;Publicerade kort;Utkast;Studenter;Skattningar;Snittskattning (1–5);Andel skattningar 1–2 (%)");
    expect(rows[1]).toBe("1;Kristallstruktur;1;1;6;40;3,25;25");
    expect(rows[2]).toBe("2;Polymerers struktur;0;0;;;;");
  });
});

describe("cardStatsCsv", () => {
  it("tar bara publicerade kort, med frågan som läsbar text", () => {
    const rows = lines(cardStatsCsv(areas, cards, [{ card_id: "1", ratings: 8, avg: 4, low: 1, reps: 20 }]));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatch(/^Kristallstruktur;Vad är σ\?;[^;]+;8;4;13;20$/);
  });
});
