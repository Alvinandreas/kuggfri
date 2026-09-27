import type { ReactNode } from "react";
import { getCurrentProfile } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/access";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProgressMigrator } from "@/components/auth/ProgressMigrator";

/** Skalet runt allt för inloggade: sidomenyn och en bred, luftig innehållsyta. */
export async function AppShell({ children }: { children: ReactNode }) {
  const [session, adminCtx] = await Promise.all([getCurrentProfile(), getAdminContext()]);
  const email = session?.user.email ?? "";
  const name = session?.profile?.display_name?.trim() || email.split("@")[0] || "";
  return (
    <div className="app-main min-h-dvh">
      <Sidebar user={{ name, email }} canAdmin={adminCtx !== null} isAdmin={adminCtx?.isAdmin === true} />
      <main id="innehall" className="mx-auto w-full max-w-[74rem] px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <ProgressMigrator userId={session?.user.id ?? null} />
        {children}
      </main>
    </div>
  );
}
