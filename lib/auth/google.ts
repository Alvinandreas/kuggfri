/**
 * Hjälpare för inloggning med Google (components/auth/GoogleButton.tsx). Rena funktioner.
 */

/** Klient-id:t från Google Cloud (inte hemligt). Null när Google-inloggning inte är påslagen. */
export function googleClientId(env: Record<string, string | undefined> = { NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID }): string | null {
  const id = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  // Formatet är <siffror>-<tecken>.apps.googleusercontent.com, utan protokoll eller snedstreck.
  return id && /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id) ? id : null;
}

/** Bara relativa sökvägar på vår egen sajt får vara mål efter inloggningen. */
export function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/hem";
}

/** SHA-256 som hex (Google vill ha engångskodens hash, Supabase den råa koden). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
