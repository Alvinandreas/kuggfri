import type { ReactNode } from "react";
import { getCurrentProfile } from "@/lib/supabase/server";
import { getAdminNav } from "@/lib/admin/nav";
import { getMyDecks } from "@/lib/content/queries";
import { getHiddenTabs } from "@/lib/admin/sidebar-tabs-queries";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProgressMigrator } from "@/components/auth/ProgressMigrator";

/** Skalet runt allt för inloggade: sidomenyn och en bred, luftig innehållsyta. */
export async function AppShell({ children }: { children: ReactNode }) {
  const [session, adminNav, decks, hiddenTabs] = await Promise.all([getCurrentProfile(), getAdminNav().catch(() => null), getMyDecks().catch(() => []), getHiddenTabs()]);
  const email = session?.user.email ?? "";
  const name = session?.profile?.display_name?.trim() || email.split("@")[0] || "";
  return (
    <div className="app-main min-h-dvh">
      <Sidebar user={{ name, email }} adminDeck={adminNav?.activeDeck ?? null} adminDeckIds={adminNav?.deckIds ?? []} isAdmin={adminNav?.isAdmin === true} courses={decks.map((d) => ({ id: d.id, slug: d.slug, title: d.title, examModeOpen: d.exam_mode_open === true }))} hiddenTabs={hiddenTabs} />
      <main id="innehall" className="mx-auto w-full max-w-[74rem] px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <ProgressMigrator userId={session?.user.id ?? null} />
        {children}
      </main>
    </div>
  );
}
