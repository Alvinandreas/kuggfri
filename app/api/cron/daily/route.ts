import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSiteUrl, getSupabaseEnv } from "@/lib/supabase/env";
import { createMailer, readMailerConfig, type Mailer } from "@/lib/email/mailer";
import { buildDigestEmail, buildReminderEmail, buildReminderStopEmail, decideReminder, type DigestData, type ReminderDeck } from "@/lib/email/templates";
import { MIN_STUDENTS } from "@/lib/admin/thresholds";

export const dynamic = "force-dynamic";

/**
 * Dagligt cron-jobb (vercel.json): gallring av gamla uppgifter, påminnelser till studenter som
 * valt det, och på måndagar examinatorns veckobrev. Anropas av Vercel med Authorization: Bearer CRON_SECRET.
 * ?digest=1 tvingar veckobrevet (för test). Utan SMTP-konfiguration skickas inget, men svaret
 * visar vad som skulle ha skickats.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY saknas" }, { status: 500 });
  }
  const { url } = getSupabaseEnv();
  const supabase = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const config = readMailerConfig();
  const mailer: Mailer | null = config ? createMailer(config) : null;
  const siteUrl = getSiteUrl();
  const now = new Date();
  const stockholmWeekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Stockholm" }).format(now);
  const forceDigest = new URL(request.url).searchParams.get("digest") === "1";
  const doDigest = forceDigest || stockholmWeekday === "Mon";

  const summary = { configured: mailer !== null, reminders: 0, stops: 0, digests: 0, skipped: 0, purged: {} as Record<string, number>, errors: [] as string[] };

  // Gallring av det som inte ska sparas för alltid (docs/PERSONUPPGIFTER.md avsnitt 3).
  const { data: purged, error: purgeErr } = await supabase.rpc("purge_old_data");
  if (purgeErr) summary.errors.push(`purge_old_data: ${purgeErr.message}`);
  else summary.purged = (purged ?? {}) as Record<string, number>;

  // Påminnelser
  const { data: candidates, error: candErr } = await supabase.rpc("reminder_candidates");
  if (candErr) summary.errors.push(`reminder_candidates: ${candErr.message}`);
  for (const c of candidates ?? []) {
    const decks = (c.decks ?? []) as ReminderDeck[];
    const due = decks.reduce((s, d) => s + d.due, 0);
    const decision = decideReminder({ sentToday: c.sent_today, remindersSinceLastReview: c.reminders_since_last_review, due });
    if (decision === "skip") {
      summary.skipped++;
      continue;
    }
    const email = decision === "stop" ? buildReminderStopEmail({ name: c.display_name, siteUrl }) : buildReminderEmail({ name: c.display_name, decks, siteUrl, now });
    try {
      if (mailer) await mailer.send({ to: c.email, ...email });
      if (decision === "stop") {
        await supabase.from("profiles").update({ reminder_email: false }).eq("id", c.user_id);
      }
      if (mailer) await supabase.from("email_log").insert({ kind: decision === "stop" ? "reminder_stop" : "reminder", user_id: c.user_id, subject: email.subject });
      if (decision === "stop") summary.stops++;
      else summary.reminders++;
    } catch (e) {
      summary.errors.push(`reminder ${c.user_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Veckobrev
  if (doDigest) {
    const { data: recipients, error: recErr } = await supabase.rpc("digest_recipients");
    if (recErr) summary.errors.push(`digest_recipients: ${recErr.message}`);
    const cache = new Map<string, DigestData>();
    for (const r of recipients ?? []) {
      try {
        let data = cache.get(r.deck_id);
        if (!data) {
          const { data: d, error } = await supabase.rpc("deck_digest", { p_deck_id: r.deck_id, p_min_students: MIN_STUDENTS });
          if (error) throw error;
          data = d as DigestData;
          cache.set(r.deck_id, data);
        }
        // Skicka inte samma veckobrev två gånger samma dag (t.ex. vid manuell körning).
        const { data: already } = await supabase
          .from("email_log")
          .select("id")
          .eq("user_id", r.user_id)
          .eq("kind", "digest")
          .eq("deck_id", r.deck_id)
          .gte("sent_at", new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString())
          .limit(1);
        if ((already ?? []).length > 0 && !forceDigest) {
          summary.skipped++;
          continue;
        }
        const email = buildDigestEmail({ name: r.display_name, deckTitle: r.deck_title, deckId: r.deck_id, data, minStudents: MIN_STUDENTS, siteUrl, now });
        if (mailer) {
          await mailer.send({ to: r.email, ...email });
          await supabase.from("email_log").insert({ kind: "digest", user_id: r.user_id, deck_id: r.deck_id, subject: email.subject });
        }
        summary.digests++;
      } catch (e) {
        summary.errors.push(`digest ${r.deck_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return NextResponse.json({ ok: summary.errors.length === 0, ...summary, sentAt: now.toISOString() });
}
