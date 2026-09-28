import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";
import { signupNextFromMetadata } from "@/lib/auth/signup-next";

/** Typerna som Kuggfris mejlmallar (supabase/templates) skickar. Allt annat avvisas. */
const EMAIL_TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "magiclink", "email_change"]);

function parseType(value: string | null): EmailOtpType | null {
  return value && EMAIL_TYPES.has(value as EmailOtpType) ? (value as EmailOtpType) : null;
}

/**
 * Landningssida för länkar i e-post: bekräftelse av nytt konto (signup/email), inloggningslänk
 * (magiclink), återställt lösenord (recovery) och byte av e-postadress (email_change).
 * Stöder både token_hash-flödet (@supabase/ssr) och PKCE-koden som Supabase
 * standardmallar skickar via sin egen verify-sida.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = parseType(searchParams.get("type"));
  const code = searchParams.get("code");
  const isSignup = type === "signup" || type === "email";

  const supabase = await createSupabaseServerClient();
  let ok = false;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
    // Bekräftelsemejlet har en fast länk (next=/). Registrerade man sig från en kurslänk
    // sparades målet i användarens metadata, så att man hamnar i kursen efter bekräftelsen.
    if (ok && isSignup && next === "/") {
      next = signupNextFromMetadata(data.user?.user_metadata) ?? "/hem";
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  // En bekräftelselänk som redan använts (t.ex. av en länkskanner i mejlprogrammet) eller gått ut
  // får en egen förklaring: kontot kan mycket väl redan vara bekräftat.
  const failure = isSignup ? "/logga-in?fel=bekraftelse" : "/logga-in?fel=lank";
  const redirectTo = new URL(ok ? next : failure, request.url);
  return NextResponse.redirect(redirectTo);
}
