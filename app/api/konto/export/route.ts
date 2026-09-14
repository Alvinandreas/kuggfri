import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** "Ladda ner mina data": allt som hör till kontot, som JSON. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: profile }, { data: progress }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, created_at").eq("id", user.id).maybeSingle(),
    supabase.from("card_progress").select("*").eq("user_id", user.id).order("card_id"),
    supabase.from("study_sessions").select("*").eq("user_id", user.id).order("started_at"),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email ?? null, created_at: user.created_at },
    profile,
    card_progress: progress ?? [],
    study_sessions: sessions ?? [],
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="kuggfri-data.json"',
      "cache-control": "no-store",
    },
  });
}
