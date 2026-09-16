import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getCurrentProfile } from "@/lib/supabase/server";
import { decideAdminAccess } from "@/lib/auth/admin-gate";

/**
 * Server-side skydd av allt under /admin (utöver middleware).
 * Icke-admin får 403 via forbidden(), utloggade skickas till inloggningen.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentProfile();
  const decision = decideAdminAccess(session?.user ?? null, session?.profile);
  if (decision.kind === "redirect-login") redirect("/logga-in?next=%2Fadmin");
  if (decision.kind === "forbidden") forbidden();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <nav aria-label={sv.admin.title} className="flex items-center gap-3 border-b border-line pb-3 text-sm">
        <Link href="/admin" className="font-semibold">
          {sv.admin.title}
        </Link>
        <Link href="/admin" className="text-muted hover:text-fg">
          {sv.admin.decks}
        </Link>
        <Link href="/admin/deck/ny" className="text-muted hover:text-fg">
          {sv.admin.newDeck}
        </Link>
      </nav>
      <div className="min-w-0 overflow-x-auto">{children}</div>
    </div>
  );
}
