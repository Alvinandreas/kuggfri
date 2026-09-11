import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * Landningssida för länkar i e-post (magic link och bekräftelse av konto).
 * Stöder både token_hash-flödet (@supabase/ssr) och PKCE-koden som Supabase
 * standardmallar skickar via sin egen verify-sida.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createSupabaseServerClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const redirectTo = new URL(ok ? next : "/logga-in?fel=lank", request.url);
  return NextResponse.redirect(redirectTo);
}
