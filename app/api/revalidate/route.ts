import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/content/queries";

export const dynamic = "force-dynamic";

/**
 * Rensar cachen för publikt innehåll (fem minuter, se lib/content/queries.ts).
 *
 * Admin-gränssnittet rensar själv när något sparas där. Innehållspipelinen skriver direkt
 * till databasen och kan inte göra det, så `kuggfri apply` anropar den här rutten i stället.
 * Skyddad med samma hemlighet som cron-jobbet (CRON_SECRET).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidateTag(CONTENT_TAG);
  return NextResponse.json({ ok: true, revalidated: CONTENT_TAG, at: new Date().toISOString() });
}
