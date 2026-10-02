import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";
import { signupNextFromMetadata } from "@/lib/auth/signup-next";
import { routes } from "@/lib/routes";

/** Typerna som Kuggfris mejlmallar (supabase/templates) skickar. Allt annat avvisas. */
const EMAIL_TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "magiclink", "email_change"]);

function parseType(value: string | null): EmailOtpType | null {
  return value && EMAIL_TYPES.has(value as EmailOtpType) ? (value as EmailOtpType) : null;
}

/**
 * Länkar i e-post: bekräftelse av nytt konto (signup/email), inloggningslänk (magiclink),
 * återställt lösenord (recovery) och byte av e-postadress (email_change).
 *
 * Engångskoden (token_hash) förbrukas bara av ett POST från knappen på mellansidan /bekrafta.
 * Ett GET, som när en länkskanner i mejlprogrammet (Outlooks Safe Links) öppnar länken innan
 * studenten gör det, visar bara mellansidan och lämnar koden orörd. PKCE-koden (?code=) från
 * Supabase standardmallar löses fortfarande in direkt.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = parseType(searchParams.get("type"));
  if (tokenHash && type) {
    const to = new URL(routes.confirmLink(), request.url);
    to.searchParams.set("token_hash", tokenHash);
    to.searchParams.set("type", type);
    to.searchParams.set("next", safeNext(searchParams.get("next")));
    return NextResponse.redirect(to, 303);
  }
  const code = searchParams.get("code");
  let ok = false;
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  const next = safeNext(searchParams.get("next"));
  return NextResponse.redirect(new URL(ok ? next : routes.login({ fel: "lank" }), request.url), 303);
}

/** Knappen på /bekrafta: förbrukar engångskoden och skickar vidare. Bara från vår egen sajt. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.redirect(new URL(routes.login({ fel: "lank" }), request.url), 303);
  }
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = parseType(String(form.get("type") ?? ""));
  let next = safeNext(String(form.get("next") ?? "/"));
  const isSignup = type === "signup" || type === "email";

  let ok = false;
  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
    // Bekräftelsemejlet har en fast länk (next=/). Registrerade man sig från en kurslänk
    // sparades målet i användarens metadata, så att man hamnar i kursen efter bekräftelsen.
    if (ok && isSignup && next === "/") {
      next = signupNextFromMetadata(data.user?.user_metadata) ?? routes.home();
    }
  }

  // En länk som redan använts eller gått ut får en egen förklaring: kontot kan mycket väl redan
  // vara bekräftat.
  const failure = isSignup ? routes.login({ fel: "bekraftelse" }) : routes.login({ fel: "lank" });
  return NextResponse.redirect(new URL(ok ? next : failure, request.url), 303);
}
