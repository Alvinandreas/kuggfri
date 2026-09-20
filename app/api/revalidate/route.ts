import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/content/queries";
import { bearerMatches } from "@/lib/security/headers";

export const dynamic = "force-dynamic";

/**
 * Rensar cachen för publikt innehåll (fem minuter, se lib/content/queries.ts).
 *
 * Admin-gränssnittet rensar själv när något sparas där. Innehållspipelinen skriver direkt
 * till databasen och kan inte göra det, så `kuggfri apply` anropar den här rutten i stället.
 * Skyddad med REVALIDATE_SECRET om den finns, annars CRON_SECRET. Egen hemlighet är att
 * föredra: den här används från en utvecklardator och ska inte kunna starta cron-jobbet.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.REVALIDATE_SECRET ?? process.env.CRON_SECRET;
  if (!bearerMatches(auth, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidateTag(CONTENT_TAG);
  return NextResponse.json({ ok: true, revalidated: CONTENT_TAG, at: new Date().toISOString() });
}
