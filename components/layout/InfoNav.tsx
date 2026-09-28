"use client";

import { usePathname } from "next/navigation";
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

/** Flikar överst på informationssidorna: Hjälp, Om och Integritet. */
export function InfoTabs() {
  const pathname = usePathname();
  const active = PAGES[current(pathname)]!.href;
  return (
    <nav aria-label={sv.shell.infoNav} className="mx-auto mb-8 flex max-w-3xl">
      <SegmentedControl<Href> label={sv.shell.infoNav} value={active} size="sm" segments={PAGES.map((p) => ({ value: p.href, label: p.label, href: p.href }))} />
    </nav>
  );
}
