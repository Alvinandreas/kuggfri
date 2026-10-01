"use client";

import { usePathname } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { routes } from "@/lib/routes";

const PAGES = [
  { href: routes.help(), label: (sv: Dict) => sv.shell.help },
  { href: routes.about(), label: (sv: Dict) => sv.shell.about },
  { href: routes.privacy(), label: (sv: Dict) => sv.shell.privacy },
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
  const sv = useT();
  const pathname = usePathname();
  const active = PAGES[current(pathname)]!.href;
  return (
    <nav aria-label={sv.shell.infoNav} className="mx-auto mb-8 flex max-w-3xl">
      <SegmentedControl<Href> label={sv.shell.infoNav} value={active} size="sm" segments={PAGES.map((p) => ({ value: p.href, label: p.label(sv), href: p.href }))} />
    </nav>
  );
}
