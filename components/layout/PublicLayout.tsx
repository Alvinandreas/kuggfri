import type { ReactNode } from "react";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { routes } from "@/lib/routes";

/**
 * Ramen för den som inte är inloggad: logga, temaväljare, innehållet och tre länkar i
 * foten. Inget annat att klicka på, så att vägen till kontot är den enda.
 *
 * wide (landningssidan och inloggningsflödet): på stor skärm fyller innehållet höjden mellan
 * sidhuvud och sidfot (main är en flexkolumn, sidan väljer själv med lg:grow), och sidfoten
 * står kvar i fönstrets nederkant om formuläret är högre än fönstret, så att länkarna i den
 * alltid syns utan att man rullar. Ytan och skuggan i dukens färg döljer det som glider under.
 */
export async function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const sv = await getT();
  return (
    <div className="relative flex min-h-dvh flex-col overflow-clip">
      {/* Svagt grönt sken bakom sidhuvudet: ger djup utan att bli en bild. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] opacity-70 dark:opacity-50"
        style={{ background: "radial-gradient(ellipse 60% 55% at 50% 0%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%)" }}
      />
      <header className={`relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8 ${wide ? "sm:py-6 lg:py-4" : "sm:py-6"}`}>
        <Link href={routes.landing()} aria-label={sv.app.name} className="inline-flex items-center rounded-md">
          <Logo variant="menu" height={38} priority decorative />
        </Link>
        <ThemeToggle />
      </header>
      <main id="innehall" className={`relative z-10 mx-auto w-full flex-1 px-4 pb-16 pt-4 sm:px-8 ${wide ? "max-w-6xl lg:flex lg:flex-col lg:pb-4 lg:pt-2" : "max-w-3xl"}`}>
        {children}
      </main>
      <footer
        className={`relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-8 ${wide ? "lg:sticky lg:bottom-0 lg:bg-bg lg:py-3 lg:shadow-[0_-0.5rem_0.75rem_var(--bg)]" : ""}`}
      >
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
