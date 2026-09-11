import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv } from "@/lib/import/csv";

describe("parseCsv", () => {
  it("tolkar en enkel fil", () => {
    const r = parseCsv("front,back\nHej,Hello\nDå,Bye\n");
    expect(r.headers).toEqual(["front", "back"]);
    expect(r.rows).toEqual([
      ["Hej", "Hello"],
      ["Då", "Bye"],
    ]);
    expect(r.lineNumbers).toEqual([2, 3]);
    expect(r.errors).toEqual([]);
  });

  it("hanterar citattecken, dubblerade citattecken och radbrytningar i fält", () => {
    const text = 'Question,Answer\n"Vad är ""stål""?","Järn + kol.\n\n* Punkt 1\n* Punkt 2"\n';
    const r = parseCsv(text);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.[0]).toBe('Vad är "stål"?');
    expect(r.rows[0]?.[1]).toBe("Järn + kol.\n\n* Punkt 1\n* Punkt 2");
    expect(r.errors).toEqual([]);
  });

  it("hanterar CRLF och BOM", () => {
    const r = parseCsv("﻿front,back\r\na,b\r\nc,d\r\n");
    expect(r.headers).toEqual(["front", "back"]);
    expect(r.rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("upptäcker semikolon och tabb som avgränsare", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter('"a,b";c\n1;2')).toBe(";");
    const r = parseCsv("front;back\nx;y\n");
    expect(r.rows).toEqual([["x", "y"]]);
  });

  it("rapporterar oavslutat citattecken med radnummer", () => {
    const r = parseCsv('front,back\nok,fint\n"trasig,rad\n');
    expect(r.errors.some((e) => e.message.includes("Oavslutat") && e.line === 3)).toBe(true);
  });

  it("rapporterar rader med fel antal fält men behåller dem", () => {
    const r = parseCsv("front,back\na,b,c\nd\n");
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]?.line).toBe(2);
    expect(r.errors[1]?.line).toBe(3);
    expect(r.rows).toEqual([
      ["a", "b"],
      ["d", ""],
    ]);
  });

  it("tom fil ger fel", () => {
    const r = parseCsv("");
    expect(r.headers).toEqual([]);
    expect(r.errors[0]?.message).toContain("tom");
  });

  it("hoppar över tomma rader", () => {
    const r = parseCsv("front,back\n\na,b\n\n\nc,d\n");
    expect(r.rows).toHaveLength(2);
  });

  it("citattecken mitt i ett fält ger fel men tolkas bokstavligt", () => {
    const r = parseCsv('front,back\n5"-skärm,tum\n');
    expect(r.errors.some((e) => e.message.includes("Citattecken"))).toBe(true);
    expect(r.rows[0]?.[0]).toBe('5"-skärm');
  });
});
