import Link from "next/link";
import { sv } from "@/lib/i18n/sv";
import { getCurrentProfile } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/access";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Logo } from "@/components/layout/Logo";

export async function Header() {
  const [session, adminCtx] = await Promise.all([getCurrentProfile(), getAdminContext()]);
  const isAdmin = adminCtx !== null;

  return (
    <header className="border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[var(--content-width)] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" aria-label={`${sv.app.name} – ${sv.nav.decks}`} className="inline-flex shrink-0 items-center rounded-md">
          <Logo variant="menu" height={40} priority />
        </Link>
        <nav aria-label={sv.nav.menu} className="flex min-w-0 items-center gap-0.5 whitespace-nowrap text-sm sm:gap-1">
          <Link href="/" className="hidden rounded-md px-2 py-1.5 text-muted hover:text-fg sm:inline-block">
            {sv.nav.decks}
          </Link>
          <Link href="/om" className="rounded-md px-1.5 py-1.5 text-muted hover:text-fg sm:px-2">
            {sv.nav.about}
          </Link>
          {isAdmin ? (
            <Link href="/admin" className="rounded-md px-1.5 py-1.5 text-muted hover:text-fg sm:px-2">
              {sv.nav.admin}
            </Link>
          ) : null}
          {session ? (
            <>
              <Link href="/konto" className="rounded-md px-1.5 py-1.5 text-muted hover:text-fg sm:px-2">
                {sv.nav.account}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link href="/logga-in" className="rounded-md px-1.5 py-1.5 text-muted hover:text-fg sm:px-2">
              {sv.nav.login}
            </Link>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
