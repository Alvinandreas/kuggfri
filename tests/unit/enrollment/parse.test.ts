import { describe, expect, it } from "vitest";
import { normalizeEmail, parseRoster } from "@/lib/enrollment/parse";

describe("normalizeEmail", () => {
  it("ger gemener utan mailto och vinkelparenteser", () => {
    expect(normalizeEmail("  Anna.Andersson@Chalmers.SE ")).toBe("anna.andersson@chalmers.se");
    expect(normalizeEmail("mailto:bo@student.chalmers.se")).toBe("bo@student.chalmers.se");
    expect(normalizeEmail("<cid@chalmers.se>")).toBe("cid@chalmers.se");
  });

  it("avvisar det som inte är adresser", () => {
    expect(normalizeEmail("anna@chalmers")).toBeNull();
    expect(normalizeEmail("anna chalmers.se")).toBeNull();
    expect(normalizeEmail("@chalmers.se")).toBeNull();
  });
});

describe("parseRoster", () => {
  it("läser en Ladok-export med semikolon och rubrik, utan personnummer", () => {
    const csv = "﻿Personnummer;Efternamn;Förnamn;E-postadress\r\n19990101-1234;Andersson;Anna;anna@chalmers.se\r\n20000202-2345;Berg;Bo;BO@chalmers.se\r\n";
    const r = parseRoster(csv);
    expect(r.entries).toEqual([
      { email: "anna@chalmers.se", name: "Anna Andersson", line: 2 },
      { email: "bo@chalmers.se", name: "Bo Berg", line: 3 },
    ]);
    expect(r.problems).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("1234");
  });

  it("läser kommaseparerat med citerade fält och en namnkolumn", () => {
    const r = parseRoster('Namn,E-post\n"Andersson, Anna",anna@chalmers.se\n');
    expect(r.entries).toEqual([{ email: "anna@chalmers.se", name: "Andersson, Anna", line: 2 }]);
  });

  it("läser rader inklistrade från Excel (tabb) utan rubrik", () => {
    const r = parseRoster("Anna Andersson\tanna@chalmers.se\nBo Berg\t19990101-1234\tbo@chalmers.se");
    expect(r.entries.map((e) => [e.email, e.name])).toEqual([
      ["anna@chalmers.se", "Anna Andersson"],
      ["bo@chalmers.se", "Bo Berg"],
    ]);
  });

  it("läser bara adresser, en per rad eller kommaseparerade", () => {
    expect(parseRoster("a@chalmers.se\nb@chalmers.se\n\n").entries.map((e) => e.email)).toEqual(["a@chalmers.se", "b@chalmers.se"]);
    expect(parseRoster("a@chalmers.se, b@chalmers.se, c@chalmers.se").entries.map((e) => e.email)).toEqual(["a@chalmers.se", "b@chalmers.se", "c@chalmers.se"]);
  });

  it("läser mottagare kopierade ur Outlook, med namn", () => {
    const r = parseRoster('Anna Andersson <anna@chalmers.se>; "Berg, Bo" <bo@chalmers.se>');
    expect(r.entries.map((e) => [e.email, e.name])).toEqual([
      ["anna@chalmers.se", "Anna Andersson"],
      ["bo@chalmers.se", "Berg, Bo"],
    ]);
  });

  it("räknar dubbletter en gång och behåller namnet", () => {
    const r = parseRoster("anna@chalmers.se\nAnna Andersson\tANNA@chalmers.se");
    expect(r.entries).toEqual([{ email: "anna@chalmers.se", name: "Anna Andersson", line: 1 }]);
    expect(r.duplicates).toBe(1);
  });

  it("rapporterar rader utan adress och ogiltiga adresser med radnummer", () => {
    const r = parseRoster("E-post;Namn\nanna@chalmers.se;Anna\n;Bo\nbo@chalmers;Bo");
    expect(r.entries.map((e) => e.email)).toEqual(["anna@chalmers.se"]);
    expect(r.problems).toEqual([
      { line: 3, text: ";Bo", reason: "ingen-adress" },
      { line: 4, text: "bo@chalmers", reason: "ogiltig-adress" },
    ]);
  });

  it("visar aldrig personnummer i listan över problem", () => {
    const r = parseRoster("Personnummer;Namn;E-post\n19990101-1234;Anna;\n990101+1234;Bo;bo@chalmers");
    expect(r.problems.map((p) => p.text)).toEqual(["[personnummer];Anna;", "bo@chalmers"]);
    expect(JSON.stringify(r)).not.toMatch(/1234/);
  });

  it("ger en tom lista för tom text", () => {
    expect(parseRoster("  \n\n")).toEqual({ entries: [], problems: [], duplicates: 0 });
  });
});
