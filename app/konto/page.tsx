import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getCurrentProfile } from "@/lib/supabase/server";
import { AccountPanel } from "@/components/account/AccountPanel";

export const metadata: Metadata = { title: sv.account.title };

export default async function AccountPage() {
  const session = await getCurrentProfile();
  if (!session) redirect("/logga-in?next=%2Fkonto");
  return (
    <AccountPanel
      userId={session.user.id}
      email={session.user.email ?? ""}
      displayName={session.profile?.display_name ?? ""}
    />
  );
}
