import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getCurrentUser } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/access";

/**
 * Server-side skydd av allt under /admin (utöver middleware).
 * Admin och examinatorer släpps in; andra får 403 via forbidden(),
 * utloggade skickas till inloggningen.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, ctx] = await Promise.all([getCurrentUser(), getAdminContext()]);
  if (!user) redirect("/logga-in?next=%2Fadmin");
  if (!ctx) forbidden();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <nav aria-label={sv.admin.title} className="flex items-center gap-4 border-b border-line pb-3 text-sm">
        <Link href="/admin" className="font-semibold">
          {sv.admin.title}
        </Link>
        {ctx.isAdmin ? (
          <>
            <Link href="/admin/deck" className="text-muted hover:text-fg">
              {sv.admin.allDecks}
            </Link>
            <Link href="/admin/deck/ny" className="text-muted hover:text-fg">
              {sv.admin.newDeck}
            </Link>
          </>
        ) : null}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
