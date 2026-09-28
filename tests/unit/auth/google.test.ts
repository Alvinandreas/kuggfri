import { describe, expect, it } from "vitest";
import { buildGoogleAuthUrl, decodeFlow, encodeFlow, googleClientId, randomToken, sameString, sha256Hex } from "@/lib/auth/google";

const ID = "257077473861-4l08q0iunperpdo37l3uu2fbmjq7gugu.apps.googleusercontent.com";

describe("inloggning med Google", () => {
  it("godtar bara ett klient-id i Googles format", () => {
    expect(googleClientId({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: ID })).toBe(ID);
    expect(googleClientId({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: ` ${ID} ` })).toBe(ID);
    expect(googleClientId({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: `http://${ID}/` })).toBeNull();
    expect(googleClientId({})).toBeNull();
  });

  it("skickar till Googles egen sida med kontoväljare, state och engångskodens hash", () => {
    const url = new URL(buildGoogleAuthUrl({ clientId: ID, redirectUri: "https://kuggfri.com/auth/google/callback", state: "s1", nonceHash: "h1" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: ID,
      redirect_uri: "https://kuggfri.com/auth/google/callback",
      response_type: "code",
      scope: "openid email profile",
      state: "s1",
      nonce: "h1",
      prompt: "select_account",
      hl: "sv",
    });
  });

  it("packar flödet i cookien och avvisar skräp", () => {
    const flow = { state: randomToken(), nonce: randomToken(), next: "/d/materialteknik" };
    expect(flow.state).toMatch(/^[0-9a-f]{64}$/);
    expect(decodeFlow(encodeFlow(flow))).toEqual(flow);
    expect(decodeFlow("inte-base64-json")).toBeNull();
    expect(decodeFlow(undefined)).toBeNull();
    expect(decodeFlow(Buffer.from('{"state":1}').toString("base64url"))).toBeNull();
  });

  it("jämför state och hashar engångskoden", async () => {
    expect(sameString("abc", "abc")).toBe(true);
    expect(sameString("abc", "abd")).toBe(false);
    expect(sameString("abc", "abcd")).toBe(false);
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
