import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { Plus, Settings2, ShieldCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/access";
import { routes } from "@/lib/routes";

/** Undermenyn: små piller, dämpade tills man hovrar. */
const navLink =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg";

/**
 * Server-side skydd av allt under /admin (utöver middleware).
 * Admin och examinatorer släpps in; andra får 403 via forbidden(),
 * utloggade skickas till inloggningen.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sv = await getT();
  const [user, ctx] = await Promise.all([getCurrentUser(), getAdminContext()]);
  if (!user) redirect(routes.login({ next: routes.admin.home() }));
  if (!ctx) forbidden();

  // Undermenyn (Admin, Alla kurser, Ny kurs) är administratörens. Adminfunktionerna gäller
  // Materialteknik (beslut 30 sep 2026), så examinatorer ser varken andra kurser eller menyn.
  const showNav = ctx.isAdmin;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:gap-8">
      {showNav ? (
        <nav aria-label={sv.admin.title} className="flex flex-wrap items-center gap-1">
          <Link href={routes.admin.home()} className="-ml-3.5 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-colors duration-150 hover:bg-surface-2">
            <ShieldCheck size={16} aria-hidden className="text-accent" />
            {sv.admin.title}
          </Link>
          {ctx.isAdmin ? (
            <>
              <Link href={routes.admin.decks()} className={navLink}>
                {sv.admin.allDecks}
              </Link>
              <Link href={routes.admin.newDeck()} className={navLink}>
                <Plus size={16} aria-hidden />
                {sv.admin.newDeck}
              </Link>
              <Link href={routes.admin.globalSettings()} className={navLink}>
                <Settings2 size={16} aria-hidden />
                {sv.admin.globalSettings}
              </Link>
            </>
          ) : null}
        </nav>
      ) : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
