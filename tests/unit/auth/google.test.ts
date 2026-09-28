import { describe, expect, it } from "vitest";
import { googleClientId, safeNext, sha256Hex } from "@/lib/auth/google";

describe("inloggning med Google", () => {
  it("godtar bara ett klient-id i Googles format", () => {
    const id = "257077473861-4l08q0iunperpdo37l3uu2fbmjq7gugu.apps.googleusercontent.com";
    expect(googleClientId({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: id })).toBe(id);
    expect(googleClientId({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: ` ${id} ` })).toBe(id);
    expect(googleClientId({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: `http://${id}/` })).toBeNull();
    expect(googleClientId({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: "" })).toBeNull();
    expect(googleClientId({})).toBeNull();
  });

  it("skickar bara vidare till relativa sökvägar på den egna sajten", () => {
    expect(safeNext("/d/materialteknik")).toBe("/d/materialteknik");
    expect(safeNext("//evil.example")).toBe("/hem");
    expect(safeNext("/\\evil.example")).toBe("/hem");
    expect(safeNext("https://evil.example")).toBe("/hem");
  });

  it("hashar engångskoden med SHA-256 som hex", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
