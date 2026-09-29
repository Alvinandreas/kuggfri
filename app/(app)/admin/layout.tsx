import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { Plus, ShieldCheck } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { getCurrentUser } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/access";

/** Undermenyn: små piller, dämpade tills man hovrar. */
const navLink =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg";

/**
 * Server-side skydd av allt under /admin (utöver middleware).
 * Admin och examinatorer släpps in; andra får 403 via forbidden(),
 * utloggade skickas till inloggningen.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, ctx] = await Promise.all([getCurrentUser(), getAdminContext()]);
  if (!user) redirect("/logga-in?next=%2Fadmin");
  if (!ctx) forbidden();

  // En examinator med en enda kurs har ingen annan adminsida att gå till ("Admin" leder
  // tillbaka till samma kurs), så undermenyn visas bara när den har något att erbjuda.
  const showNav = ctx.isAdmin || ctx.examinerDeckIds.length > 1;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:gap-8">
      {showNav ? (
        <nav aria-label={sv.admin.title} className="flex flex-wrap items-center gap-1">
          <Link href="/admin" className="-ml-3.5 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-colors duration-150 hover:bg-surface-2">
            <ShieldCheck size={16} aria-hidden className="text-accent" />
            {sv.admin.title}
          </Link>
          {ctx.isAdmin ? (
            <>
              <Link href="/admin/deck" className={navLink}>
                {sv.admin.allDecks}
              </Link>
              <Link href="/admin/deck/ny" className={navLink}>
                <Plus size={16} aria-hidden />
                {sv.admin.newDeck}
              </Link>
            </>
          ) : null}
        </nav>
      ) : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
