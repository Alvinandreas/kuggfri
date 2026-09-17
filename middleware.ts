import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { forbiddenHtml } from "@/lib/auth/forbidden-html";
import { decideAdminAccess } from "@/lib/auth/admin-gate";

/**
 * 1. Håller Supabase-sessionen färsk på varje request.
 * 2. Fångar upp inloggningskoder (?code=…) från e-postlänkar oavsett vilken sida de
 *    landar på, t.ex. om Supabase skickat användaren till startsidan i stället för
 *    /auth/confirm. Koden byts mot en session och adressen städas.
 * 3. Skyddar /admin server-side: icke-admin får 403 redan här,
 *    innan någon sida renderas. Layouten under /admin gör samma kontroll igen.
 */
export async function middleware(request: NextRequest) {
  const { supabase, response, user } = await updateSession(request);
  const { pathname, searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  if (code && !pathname.startsWith("/auth/")) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    const url = request.nextUrl.clone();
    url.searchParams.delete("code");
    if (error) {
      url.pathname = "/logga-in";
      url.search = "?fel=lank";
    }
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
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
      return NextResponse.redirect(loginUrl);
    }
    if (decision.kind === "forbidden") {
      return new NextResponse(forbiddenHtml(), {
        status: 403,
        headers: { "content-type": "text/html; charset=utf-8" },
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
