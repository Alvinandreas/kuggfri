import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { forbiddenHtml } from "@/lib/auth/forbidden-html";
import { decideAdminAccess } from "@/lib/auth/admin-gate";

/**
 * 1. Håller Supabase-sessionen färsk på varje request.
 * 2. Skyddar /admin server-side: icke-admin får 403 redan här,
 *    innan någon sida renderas. Layouten under /admin gör samma kontroll igen.
 */
export async function middleware(request: NextRequest) {
  const { supabase, response, user } = await updateSession(request);

  if (request.nextUrl.pathname.startsWith("/admin")) {
    let profile: { is_admin: boolean } | null = null;
    if (user) {
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      profile = data;
    }
    const decision = decideAdminAccess(user, profile);
    if (decision.kind === "redirect-login") {
      const loginUrl = new URL("/logga-in", request.url);
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
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
