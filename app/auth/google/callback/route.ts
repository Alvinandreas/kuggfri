import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decodeFlow, GOOGLE_CALLBACK_PATH, GOOGLE_COOKIE, GOOGLE_TOKEN_URL, googleLoginClientId, sameString } from "@/lib/auth/google";
import { getRequestOrigin } from "@/lib/supabase/request-origin";
import { routes } from "@/lib/routes";

/**
 * Steg 2 av inloggning med Google: Google skickar tillbaka hit med en kod. Kontrollera state,
 * växla koden mot en ID-token och logga in i Supabase med den och den råa engångskoden.
 * Alla fel leder till inloggningssidan med ett begripligt meddelande (fel=google), aldrig till
 * en tekniskt felsida.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const flow = decodeFlow(request.cookies.get(GOOGLE_COOKIE)?.value);
  const fail = (reason: string, cancelled = false) => {
    if (!cancelled) console.error("[auth] google:", reason);
    const res = NextResponse.redirect(new URL(cancelled ? routes.login() : routes.login({ fel: "google" }), request.url));
    res.cookies.delete({ name: GOOGLE_COOKIE, path: "/auth/google" });
    return res;
  };

  // Avbrutet hos Google (användaren tryckte Avbryt): tillbaka till inloggningen utan felmeddelande.
  if (params.get("error") === "access_denied") return fail("avbrutet", true);
  const code = params.get("code");
  const state = params.get("state");
  if (!flow || !code || !state || !sameString(state, flow.state)) return fail("state eller kod saknas eller stämmer inte");

  const clientId = googleLoginClientId();
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !secret) return fail("klient-id eller hemlighet saknas");

  const origin = await getRequestOrigin();
  let idToken: string | undefined;
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: secret,
        redirect_uri: `${origin}${GOOGLE_CALLBACK_PATH}`,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    const body = (await res.json()) as { id_token?: string; error?: string };
    if (!res.ok || !body.id_token) return fail(`tokenväxling: ${body.error ?? res.status}`);
    idToken = body.id_token;
  } catch (e) {
    return fail(`tokenväxling: ${e instanceof Error ? e.message : String(e)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce: flow.nonce });
  if (error) return fail(`supabase: ${error.message}`);

  const res = NextResponse.redirect(new URL(flow.next, request.url));
  res.cookies.delete({ name: GOOGLE_COOKIE, path: "/auth/google" });
  return res;
}
