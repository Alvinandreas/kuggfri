"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const PAGES = [
  { href: "/hjalp", label: sv.shell.help },
  { href: "/om", label: sv.shell.about },
  { href: "/integritet", label: sv.shell.privacy },
] as const;

type Href = (typeof PAGES)[number]["href"];

function current(pathname: string): number {
  return Math.max(
    0,
    PAGES.findIndex((p) => pathname === p.href),
  );
}

/** Flikar överst på informationssidorna: Hjälp, Om Kuggfri och Integritet. */
export function InfoTabs() {
  const pathname = usePathname();
  const active = PAGES[current(pathname)]!.href;
  return (
    <nav aria-label={sv.shell.infoNav} className="mx-auto mb-8 flex max-w-3xl">
      <SegmentedControl<Href> label={sv.shell.infoNav} value={active} size="sm" segments={PAGES.map((p) => ({ value: p.href, label: p.label, href: p.href }))} />
    </nav>
  );
}

/** Föregående och nästa informationssida längst ner. */
export function InfoPager() {
  const pathname = usePathname();
  const i = current(pathname);
  const prev = i > 0 ? PAGES[i - 1] : null;
  const next = i < PAGES.length - 1 ? PAGES[i + 1] : null;
  const cls =
    "group flex min-h-16 flex-1 flex-col justify-center rounded-lg bg-surface px-5 py-3 transition-colors hover:bg-surface-2 border border-line dark:border-transparent";
  return (
    <nav aria-label={sv.shell.infoPager} className="mx-auto mt-12 flex max-w-3xl flex-col gap-3 sm:flex-row">
      {prev ? (
        <Link href={prev.href} className={cls}>
          <span className="text-xs font-semibold text-muted">{sv.shell.previous}</span>
          <span className="inline-flex items-center gap-2 font-bold">
            <ArrowLeft size={16} aria-hidden className="transition-transform duration-200 group-hover:-translate-x-0.5" />
            {prev.label}
          </span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
      {next ? (
        <Link href={next.href} className={`${cls} items-end text-right`}>
          <span className="text-xs font-semibold text-muted">{sv.shell.next}</span>
          <span className="inline-flex items-center gap-2 font-bold">
            {next.label}
            <ArrowRight size={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
    </nav>
  );
}
