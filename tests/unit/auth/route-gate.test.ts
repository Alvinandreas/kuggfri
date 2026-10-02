import { describe, expect, it } from "vitest";
import { inviteRewriteTarget, isPublicPath, loginRedirectTarget } from "@/lib/auth/route-gate";

describe("isPublicPath", () => {
  it.each([
    "/",
    "/logga-in",
    "/registrera",
    "/glomt-losenord",
    "/bekrafta",
    "/om",
    "/hjalp",
    "/integritet",
    "/auth/confirm",
    "/api/cron/daily",
    "/robots.txt",
    "/manifest.webmanifest",
    "/kurs/materialteknik",
  ])("%s är publik", (p) => expect(isPublicPath(p)).toBe(true));

  it.each(["/opengraph-image", "/opengraph-image-1a2b3c", "/kurs/materialteknik/opengraph-image", "/kurs/materialteknik/opengraph-image-1xyvl6"])(
    "delningsbilden %s är publik",
    (p) => expect(isPublicPath(p)).toBe(true),
  );

  it.each([
    "/hem",
    "/kurser",
    "/konto",
    "/admin",
    "/designsystem",
    "/d/materialteknik",
    "/d/materialteknik/plugga",
    "/opengraph-image/extra",
    "/om/",
    "/hjalp/",
    "/integritetx",
  ])("%s kräver konto", (p) => expect(isPublicPath(p)).toBe(false));
});

describe("inviteRewriteTarget", () => {
  it("skriver om en kurslänk till kursens inbjudan", () => {
    expect(inviteRewriteTarget("/d/materialteknik")).toBe("/kurs/materialteknik");
    expect(inviteRewriteTarget("/d/materialteknik/")).toBe("/kurs/materialteknik");
  });
  it("rör inte undersidor eller andra adresser", () => {
    expect(inviteRewriteTarget("/d/materialteknik/plugga")).toBeNull();
    expect(inviteRewriteTarget("/d/")).toBeNull();
    expect(inviteRewriteTarget("/hem")).toBeNull();
  });
});

describe("loginRedirectTarget", () => {
  it("behåller adress och frågesträng som next", () => {
    expect(loginRedirectTarget("/d/materialteknik/plugga", "?mode=exam")).toBe("/?next=%2Fd%2Fmaterialteknik%2Fplugga%3Fmode%3Dexam");
  });
  it("skickar startsidan till sig själv utan next", () => {
    expect(loginRedirectTarget("/", "")).toBe("/");
  });
});
