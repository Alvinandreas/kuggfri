"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { cx } from "@/components/ui/cx";

type Props = {
  deckId: string;
  openReports: number;
  /** Utkast som väntar på granskning. */
  pendingDrafts: number;
};

/**
 * Flikarna under deckets rubrik, som piller i samma form som SegmentedControl (vald flik
 * = den fyllda pillern). Egen komponent eftersom flikarna behöver test-id och en räknare.
 * Aktiv flik = längsta matchande prefix, så att områdes- och kortsidorna räknas till "Innehåll".
 */
export function DeckTabs({ deckId, openReports, pendingDrafts }: Props) {
  const pathname = usePathname();
  const base = `/admin/deck/${deckId}`;
  const tabs = [
    { href: base, label: sv.admin.tabOverview, exact: true, prefixes: [`${base}/statistik`] },
    { href: `${base}/innehall`, label: sv.admin.tabContent, prefixes: [`${base}/kategori`, `${base}/kort`] },
    { href: `${base}/granskning`, label: sv.admin.tabReview, badge: pendingDrafts },
    { href: `${base}/rapporter`, label: sv.admin.tabReports, badge: openReports },
    { href: `${base}/import`, label: sv.admin.tabImport },
    { href: `${base}/installningar`, label: sv.admin.tabSettings },
  ];
  const isActive = (t: (typeof tabs)[number]) =>
    t.exact ? pathname === t.href || (t.prefixes ?? []).some((p) => pathname.startsWith(p)) : pathname.startsWith(t.href) || (t.prefixes ?? []).some((p) => pathname.startsWith(p));

  return (
    <nav aria-label={sv.admin.title} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex min-w-max gap-0.5 rounded-full bg-surface-2 p-1 text-sm">
        {tabs.map((t) => {
          const active = isActive(t);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                data-testid={`deck-tab-${t.href.split("/").pop()}`}
                className={cx(
                  "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-4 font-semibold transition-colors duration-200",
                  active ? "bg-inverse text-inverse-fg" : "text-muted hover:bg-surface-3 hover:text-fg",
                )}
              >
                {t.label}
                {t.badge ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold tabular-nums text-accent-fg">{t.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
