/**
 * Inloggning med Google via Googles egen inloggningssida (OAuth 2.0 / OpenID Connect,
 * auktoriseringskod). Rena hjälpfunktioner; flödet finns i app/auth/google/.
 *
 *   1. /auth/google?next=…  slumpar state och engångskod (nonce), sparar dem i en kortlivad
 *      httpOnly-cookie och skickar webbläsaren till accounts.google.com.
 *   2. Google skickar tillbaka till /auth/google/callback på VÅR domän med en kod. Servern
 *      kontrollerar state, växlar koden mot en ID-token (med klienthemligheten) och loggar in i
 *      Supabase med signInWithIdToken och den råa engångskoden.
 *
 * Omdirigeringen går via kuggfri.com, inte via Supabase-projektets adress, så Googles sida visar
 * Kuggfri och ingen främmande domän. Ingen iframe, ingen förifylld "Logga in som …".
 */

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_COOKIE = "kuggfri_google";
export const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

/** Klient-id:t från Google Cloud (inte hemligt). Null när Google-inloggning inte är påslagen. */
export function googleClientId(env: Record<string, string | undefined> = { NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID }): string | null {
  const id = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  // Formatet är <siffror>-<tecken>.apps.googleusercontent.com, utan protokoll eller snedstreck.
  return id && /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id) ? id : null;
}

/** Adressen till Googles inloggningssida. Kontoväljaren visas alltid (ingen tyst inloggning). */
export function buildGoogleAuthUrl(input: { clientId: string; redirectUri: string; state: string; nonceHash: string }): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonceHash);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("hl", "sv");
  return url.toString();
}

/** Slumpad sträng (hex) för state och engångskod. */
export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 som hex (Google får engångskodens hash, Supabase den råa koden). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type GoogleFlow = { state: string; nonce: string; next: string };

export function encodeFlow(flow: GoogleFlow): string {
  return Buffer.from(JSON.stringify(flow), "utf8").toString("base64url");
}

export function decodeFlow(value: string | undefined): GoogleFlow | null {
  if (!value) return null;
  try {
    const f = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<GoogleFlow>;
    return typeof f.state === "string" && typeof f.nonce === "string" && typeof f.next === "string" ? { state: f.state, nonce: f.nonce, next: f.next } : null;
  } catch {
    return null;
  }
}

/** Konstant-tidsjämförelse av två strängar (state från Google mot state i cookien). */
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
