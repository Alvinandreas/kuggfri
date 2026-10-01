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
const card = (id: string, category_id: string, front: string, is_active: boolean, review_status: string | null, reviewed_at: string | null = null) => ({
  id,
  category_id,
  front,
  kind: "sjalvskattning" as const,
  is_active,
  review_status,
  reviewed_at,
});
const cards = [
  card("1", "a", "Vad är $\\sigma$?", true, null, "2026-10-01T10:00:00Z"),
  card("2", "a", "Utkast", false, "utkast"),
  card("3", "b", "Inaktivt", false, null),
  card("4", "b", "Ogranskat", true, null),
];

describe("areaStatsCsv", () => {
  it("ger en rad per område med innehåll, granskning och statistik, tomt under anonymitetsgränsen", () => {
    const rows = lines(areaStatsCsv(areas, cards, [{ category_id: "a", students: 6, ratings: 40, avg: 3.25, low: 10, learned: 2 }]));
    expect(rows[0]).toBe("Nr;Område;Kort i rotation;Varav godkända;Utkast;Studenter;Skattningar;Snittskattning (1–5);Andel skattningar 1–2 (%)");
    expect(rows[1]).toBe("1;Kristallstruktur;1;1;1;6;40;3,25;25");
    expect(rows[2]).toBe("2;Polymerers struktur;1;0;0;;;;");
  });
});

describe("cardStatsCsv", () => {
  it("tar korten i rotation med granskningsläget, och frågan som läsbar text", () => {
    const rows = lines(cardStatsCsv(areas, cards, [{ card_id: "1", ratings: 8, avg: 4, low: 1, reps: 20 }]));
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatch(/^Kristallstruktur;Vad är σ\?;[^;]+;Godkänd;8;4;13;20$/);
    expect(rows[2]).toMatch(/^Polymerers struktur;Ogranskat;[^;]+;Ogranskad;;;;$/);
  });
});
