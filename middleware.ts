import { NextResponse, type NextRequest } from "next/server";
import { maintenanceGate } from "@/lib/maintenance";
import { updateSession } from "@/lib/supabase/middleware";
import { forbiddenHtml } from "@/lib/auth/forbidden-html";
import { decideAdminAccess } from "@/lib/auth/admin-gate";
import { inviteRewriteTarget, isPublicPath, loginRedirectTarget } from "@/lib/auth/route-gate";
import { buildCsp, createNonce, NONCE_HEADER } from "@/lib/security/headers";

/**
 * 1. Sätter en innehållspolicy (CSP) med en färsk nonce per request. Next.js märker sina
 *    egna inline-skript med den, och layouten märker temaskriptet.
 * 2. Håller Supabase-sessionen färsk på varje request.
 * 3. Kräver konto: utloggade skickas till landningssidan (lib/auth/route-gate.ts).
 * 4. Skyddar /admin server-side: icke-admin får 403 redan här, innan någon sida renderas.
 *    Layouten under /admin gör samma kontroll igen.
 *
 * Inloggningskoder (?code=…) löses bara in på /auth/confirm. Hamnar en länk på någon
 * annan sida skickas besökaren dit i stället; att lösa in koder överallt gör det möjligt
 * att logga in någon annan på ett konto de inte äger.
 *
 * Avstängningsgrinden svarar först av allt, innan sessionen rörs och innan någon sida
 * renderas, så att ingenting av tjänsten kan nås medan den är stängd. Se lib/maintenance.ts.
 */
export async function middleware(request: NextRequest) {
  const stängt = maintenanceGate(request);
  if (stängt) return stängt;

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

  // Konto krävs för allt utom landningssidan, inloggningsflödet och informationssidorna.
  // En kurslänk visar kursens inbjudan på samma adress, så att länkförhandsvisningen stämmer.
  const invite = user ? null : inviteRewriteTarget(pathname);
  if (invite) {
    const rewrite = NextResponse.rewrite(new URL(invite, request.url), { request: { headers: requestHeaders } });
    rewrite.headers.set("content-security-policy", csp);
    // Sessionskakor som updateSession rensat eller förnyat ska följa med även här.
    for (const cookie of response.cookies.getAll()) rewrite.cookies.set(cookie);
    return rewrite;
  }
  if (!user && !isPublicPath(pathname)) {
    const redirect = NextResponse.redirect(new URL(loginRedirectTarget(pathname, request.nextUrl.search), request.url));
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
