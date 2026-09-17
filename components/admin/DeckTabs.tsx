"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sv } from "@/lib/i18n/sv";

type Props = {
  deckId: string;
  openReports: number;
};

/**
 * Flikarna under deckets rubrik. Aktiv flik = längsta matchande prefix, så att
 * kategori- och kortsidorna räknas till "Innehåll".
 */
export function DeckTabs({ deckId, openReports }: Props) {
  const pathname = usePathname();
  const base = `/admin/deck/${deckId}`;
  const tabs = [
    { href: base, label: sv.admin.tabOverview, exact: true, prefixes: [`${base}/statistik`] },
    { href: `${base}/innehall`, label: sv.admin.tabContent, prefixes: [`${base}/kategori`, `${base}/kort`] },
    { href: `${base}/rapporter`, label: sv.admin.tabReports, badge: openReports },
    { href: `${base}/import`, label: sv.admin.tabImport },
    { href: `${base}/installningar`, label: sv.admin.tabSettings },
  ];
  const isActive = (t: (typeof tabs)[number]) =>
    t.exact ? pathname === t.href || (t.prefixes ?? []).some((p) => pathname.startsWith(p)) : pathname.startsWith(t.href) || (t.prefixes ?? []).some((p) => pathname.startsWith(p));

  return (
    <nav aria-label={sv.admin.title} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line text-sm">
        {tabs.map((t) => {
          const active = isActive(t);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                data-testid={`deck-tab-${t.href.split("/").pop()}`}
                className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 font-medium transition-colors ${
                  active ? "border-accent text-fg" : "border-transparent text-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                {t.label}
                {t.badge ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{t.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
