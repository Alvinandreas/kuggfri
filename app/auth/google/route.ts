import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/safe-next";
import { buildGoogleAuthUrl, encodeFlow, GOOGLE_CALLBACK_PATH, GOOGLE_COOKIE, googleClientId, randomToken, sha256Hex } from "@/lib/auth/google";
import { getRequestOrigin } from "@/lib/supabase/request-origin";

/**
 * Steg 1 av inloggning med Google (lib/auth/google.ts): skickar webbläsaren till Googles egen
 * inloggningssida. state skyddar mot förfalskade återkomster, engångskoden mot återuppspelade token.
 */
export async function GET(request: NextRequest) {
  const clientId = googleClientId();
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/logga-in?fel=google", request.url));
  }
  const next = safeNext(new URL(request.url).searchParams.get("next"), "/hem");
  const origin = await getRequestOrigin();
  const state = randomToken();
  const nonce = randomToken();
  const redirectUri = `${origin}${GOOGLE_CALLBACK_PATH}`;
  // Står adressen inte exakt under Authorized redirect URIs i Google Cloud svarar Google
  // redirect_uri_mismatch; loggen visar vilken adress som skickades.
  console.info("[auth] google: redirect_uri", redirectUri);
  const url = buildGoogleAuthUrl({ clientId, redirectUri, state, nonceHash: await sha256Hex(nonce) });

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_COOKIE, encodeFlow({ state, nonce, next }), {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/auth/google",
    maxAge: 10 * 60,
  });
  return response;
}
