import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { maintenanceGate, underUtveckling } from "@/lib/maintenance";

/**
 * Avstängningsgrinden. Reglerna som testas är de som avgör om studenterna kan nå
 * tjänsten, så de ska inte gå att ändra av misstag:
 *
 *  - en deploy i molnet är stängd tills någon uttryckligen öppnar den,
 *  - den lokala utvecklingen är öppen utan att någon variabel behöver sättas,
 *  - förhandsvisningsnyckeln är enda vägen förbi, och bara om den är satt.
 */
const original = { ...process.env };

beforeEach(() => {
  delete process.env.UNDER_UTVECKLING;
  delete process.env.FORHANDSVISNING_NYCKEL;
  delete process.env.VERCEL;
});

afterEach(() => {
  process.env = { ...original };
});

function begäran(url = "https://kuggfri.com/", kaka?: string): NextRequest {
  const request = new NextRequest(url);
  if (kaka) request.cookies.set("kuggfri-forhandsvisning", kaka);
  return request;
}

describe("underUtveckling", () => {
  it("är på i molnet när inget är satt", () => {
    process.env.VERCEL = "1";
    expect(underUtveckling()).toBe(true);
  });

  it("är av lokalt när inget är satt", () => {
    expect(underUtveckling()).toBe(false);
  });

  it("öppnas bara av ett uttryckligt av-värde", () => {
    process.env.VERCEL = "1";
    for (const värde of ["0", "false", "nej", "av", "AV"]) {
      process.env.UNDER_UTVECKLING = värde;
      expect(underUtveckling()).toBe(false);
    }
  });

  it("stänger även lokalt när variabeln är satt", () => {
    process.env.UNDER_UTVECKLING = "1";
    expect(underUtveckling()).toBe(true);
  });

  it("tolkar ett okänt värde som stängt", () => {
    process.env.UNDER_UTVECKLING = "kanske";
    expect(underUtveckling()).toBe(true);
  });
});

describe("maintenanceGate", () => {
  it("släpper igenom allt när tjänsten är öppen", () => {
    process.env.UNDER_UTVECKLING = "0";
    expect(maintenanceGate(begäran())).toBeNull();
  });

  it("svarar 503 utan att röra databasen när tjänsten är stängd", async () => {
    process.env.UNDER_UTVECKLING = "1";
    const svar = maintenanceGate(begäran());
    expect(svar?.status).toBe(503);
    expect(svar?.headers.get("x-kuggfri-lage")).toBe("under-utveckling");
    expect(svar?.headers.get("cache-control")).toBe("no-store");
    const html = await svar!.text();
    expect(html).toContain("Under utveckling");
    // Inget kursinnehåll och ingen navigering får läcka ut ur den stängda sidan.
    expect(html).not.toContain("materialteknik");
  });

  it("stänger även bakgrundsjobben, så inga mejl går ut", () => {
    process.env.UNDER_UTVECKLING = "1";
    expect(maintenanceGate(begäran("https://kuggfri.com/api/cron/daily"))?.status).toBe(503);
  });

  it("utan satt nyckel finns ingen väg förbi", () => {
    process.env.UNDER_UTVECKLING = "1";
    expect(maintenanceGate(begäran("https://kuggfri.com/?nyckel=vadsomhelst"))?.status).toBe(503);
    expect(maintenanceGate(begäran("https://kuggfri.com/", "vadsomhelst"))?.status).toBe(503);
  });

  it("rätt nyckel sätter kakan och städar bort nyckeln ur adressen", () => {
    process.env.UNDER_UTVECKLING = "1";
    process.env.FORHANDSVISNING_NYCKEL = "en-lang-hemlig-strang";
    const svar = maintenanceGate(begäran("https://kuggfri.com/d/materialteknik?nyckel=en-lang-hemlig-strang"));
    expect(svar?.status).toBe(307);
    expect(svar?.headers.get("location")).toBe("https://kuggfri.com/d/materialteknik");
    const kaka = svar?.cookies.get("kuggfri-forhandsvisning");
    expect(kaka?.value).toBe("en-lang-hemlig-strang");
    // En vecka: kakan ska överleva att datorn startas om natten före en presentation.
    expect(kaka?.maxAge).toBe(60 * 60 * 24 * 7);
    expect(kaka?.httpOnly).toBe(true);
  });

  it("fel nyckel ger samma stängda sida", () => {
    process.env.UNDER_UTVECKLING = "1";
    process.env.FORHANDSVISNING_NYCKEL = "en-lang-hemlig-strang";
    expect(maintenanceGate(begäran("https://kuggfri.com/?nyckel=nastan-ratt"))?.status).toBe(503);
    expect(maintenanceGate(begäran("https://kuggfri.com/?nyckel=en-lang-hemlig-strane"))?.status).toBe(503);
  });

  it("kakan från en tidigare nyckel släpper igenom", () => {
    process.env.UNDER_UTVECKLING = "1";
    process.env.FORHANDSVISNING_NYCKEL = "en-lang-hemlig-strang";
    expect(maintenanceGate(begäran("https://kuggfri.com/", "en-lang-hemlig-strang"))).toBeNull();
    expect(maintenanceGate(begäran("https://kuggfri.com/", "fel-kaka"))?.status).toBe(503);
  });
});
