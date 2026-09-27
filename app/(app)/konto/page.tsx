import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { createSupabaseServerClient, getCurrentProfile } from "@/lib/supabase/server";
import { getPublishedDecks } from "@/lib/content/queries";
import { AccountPanel } from "@/components/account/AccountPanel";

export const metadata: Metadata = { title: sv.account.title };

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const session = await getCurrentProfile();
  if (!session) redirect("/logga-in?next=%2Fkonto");
  const supabase = await createSupabaseServerClient();
  const [decks, { data: examinerRows }] = await Promise.all([
    getPublishedDecks(),
    supabase.from("deck_examiners").select("deck_id").eq("user_id", session.user.id).limit(1),
  ]);
  const isExaminer = Boolean(session.profile?.is_admin) || (examinerRows ?? []).length > 0;
  return (
    <AccountPanel
      userId={session.user.id}
      email={session.user.email ?? ""}
      displayName={session.profile?.display_name ?? ""}
      reminderEmail={session.profile?.reminder_email ?? false}
      digestEmail={session.profile?.digest_email ?? true}
      isExaminer={isExaminer}
      decks={decks.map((d) => ({ id: d.id, slug: d.slug, title: d.title }))}
      focusPassword={query["byt-losenord"] === "1"}
    />
  );
}
