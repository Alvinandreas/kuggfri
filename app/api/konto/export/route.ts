import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * "Ladda ner mina data" (GDPR art. 15 och 20): allt vi har om kontot, som JSON.
 *
 * Listan måste vara fullständig. Läggs en ny tabell med personuppgifter till ska den
 * också hämtas här, och beskrivas i docs/PERSONUPPGIFTER.md.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [profile, progress, sessions, reviews, reports, examiner, emails] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("card_progress").select("*").eq("user_id", user.id).order("card_id"),
    supabase.from("study_sessions").select("*").eq("user_id", user.id).order("started_at"),
    supabase.from("review_log").select("card_id, rating, mode, reviewed_at").eq("user_id", user.id).order("reviewed_at"),
    supabase.from("card_reports").select("id, card_id, message, contact, status, created_at, resolved_at").eq("user_id", user.id).order("created_at"),
    supabase.from("deck_examiners").select("deck_id, created_at").eq("user_id", user.id),
    supabase.from("email_log").select("kind, deck_id, subject, sent_at").eq("user_id", user.id).order("sent_at"),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    om_filen:
      "Allt Kuggfri har sparat om ditt konto. Progressen i card_progress är algoritmens tillstånd per kort, review_log är dina repetitioner, study_sessions är när du pluggat. Läs mer på /integritet.",
    account: { id: user.id, email: user.email ?? null, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null },
    profile: profile.data,
    card_progress: progress.data ?? [],
    review_log: reviews.data ?? [],
    study_sessions: sessions.data ?? [],
    card_reports: reports.data ?? [],
    deck_examiners: examiner.data ?? [],
    email_log: emails.data ?? [],
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="kuggfri-data.json"',
      "cache-control": "no-store",
    },
  });
}
