import { describe, expect, it } from "vitest";
import { decideAdminAccess } from "@/lib/auth/admin-gate";
import { forbiddenHtml } from "@/lib/auth/forbidden-html";
import { safeNext } from "@/lib/auth/safe-next";

describe("decideAdminAccess", () => {
  it("utloggad skickas till inloggning", () => {
    expect(decideAdminAccess(null, null)).toEqual({ kind: "redirect-login" });
  });

  it("vanlig användare nekas (403)", () => {
    expect(decideAdminAccess({ id: "u1" }, { is_admin: false })).toEqual({ kind: "forbidden" });
  });

  it("användare utan profil nekas (403)", () => {
    expect(decideAdminAccess({ id: "u1" }, null)).toEqual({ kind: "forbidden" });
    expect(decideAdminAccess({ id: "u1" }, undefined)).toEqual({ kind: "forbidden" });
  });

  it("admin släpps in", () => {
    expect(decideAdminAccess({ id: "u1" }, { is_admin: true })).toEqual({ kind: "ok" });
  });

  it("examinator (minst ett deck) släpps in utan att vara admin", () => {
    expect(decideAdminAccess({ id: "u1" }, { is_admin: false }, 1)).toEqual({ kind: "ok" });
    expect(decideAdminAccess({ id: "u1" }, null, 2)).toEqual({ kind: "ok" });
    expect(decideAdminAccess({ id: "u1" }, { is_admin: false }, 0)).toEqual({ kind: "forbidden" });
  });
});

describe("forbiddenHtml", () => {
  it("är en svensk 403-sida utan indexering", () => {
    const html = forbiddenHtml();
    expect(html).toContain("Åtkomst nekad");
    expect(html).toContain('lang="sv"');
    expect(html).toContain("noindex");
  });
});

describe("safeNext", () => {
  it("tillåter bara interna sökvägar", () => {
    expect(safeNext("/d/materialteknik")).toBe("/d/materialteknik");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(["/konto"])).toBe("/konto");
  });
});
