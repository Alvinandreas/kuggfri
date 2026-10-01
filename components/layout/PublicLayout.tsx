import type { ReactNode } from "react";
import Link from "next/link";
import { sv } from "@/lib/i18n/sv";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { routes } from "@/lib/routes";

/**
 * Ramen för den som inte är inloggad: logga, temaväljare, innehållet och två länkar i
 * foten. Inget annat att klicka på, så att vägen till kontot är den enda.
 */
export function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Svagt grönt sken bakom sidhuvudet: ger djup utan att bli en bild. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] opacity-70 dark:opacity-50"
        style={{ background: "radial-gradient(ellipse 60% 55% at 50% 0%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%)" }}
      />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8 sm:py-6">
        <Link href={routes.landing()} aria-label={sv.app.name} className="inline-flex items-center rounded-md">
          <Logo variant="menu" height={38} priority decorative />
        </Link>
        <ThemeToggle />
      </header>
      <main id="innehall" className={`relative z-10 mx-auto w-full flex-1 px-4 pb-16 pt-4 sm:px-8 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
        {children}
      </main>
      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-8">
        <span>© {new Date().getFullYear()} {sv.app.name}</span>
        <nav aria-label={sv.nav.menu} className="flex gap-5">
          <Link href={routes.about()} className="hover:text-fg">
            {sv.footer.about}
          </Link>
          <Link href={routes.help()} className="hover:text-fg">
            {sv.help.title}
          </Link>
          <Link href={routes.privacy()} className="hover:text-fg">
            {sv.footer.privacy}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
