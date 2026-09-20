import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { forbiddenHtml } from "@/lib/auth/forbidden-html";
import { decideAdminAccess } from "@/lib/auth/admin-gate";
import { buildCsp, createNonce, NONCE_HEADER } from "@/lib/security/headers";

/**
 * 1. Sätter en innehållspolicy (CSP) med en färsk nonce per request. Next.js märker sina
 *    egna inline-skript med den, och layouten märker temaskriptet.
 * 2. Håller Supabase-sessionen färsk på varje request.
 * 3. Skyddar /admin server-side: icke-admin får 403 redan här, innan någon sida renderas.
 *    Layouten under /admin gör samma kontroll igen.
 *
 * Inloggningskoder (?code=…) löses bara in på /auth/confirm. Hamnar en länk på någon
 * annan sida skickas besökaren dit i stället; att lösa in koder överallt gör det möjligt
 * att logga in någon annan på ett konto de inte äger.
 */
export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV !== "production");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set("content-security-policy", csp);

  const { supabase, response, user } = await updateSession(request, requestHeaders);
  response.headers.set("content-security-policy", csp);

  const { pathname, searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  if (code && !pathname.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirm";
    // Behåll vart besökaren skulle ha hamnat, men bara som en intern sökväg.
    url.searchParams.set("next", pathname === "/" ? "/" : pathname);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("content-security-policy", csp);
    return redirect;
  }

  if (pathname.startsWith("/admin")) {
    let profile: { is_admin: boolean } | null = null;
    let examinerDecks = 0;
    if (user) {
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      profile = data;
      if (!profile?.is_admin) {
        const { count } = await supabase.from("deck_examiners").select("deck_id", { count: "exact", head: true }).eq("user_id", user.id);
        examinerDecks = count ?? 0;
      }
    }
    const decision = decideAdminAccess(user, profile, examinerDecks);
    if (decision.kind === "redirect-login") {
      const loginUrl = new URL("/logga-in", request.url);
      loginUrl.searchParams.set("next", pathname);
      const redirect = NextResponse.redirect(loginUrl);
      redirect.headers.set("content-security-policy", csp);
      return redirect;
    }
    if (decision.kind === "forbidden") {
      return new NextResponse(forbiddenHtml(), {
        status: 403,
        headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": csp },
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Allt utom statiska filer och bilder.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
