"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { Dict } from "@/lib/i18n";
import { SIDEBAR_TAB_GROUPS, type SidebarTabKey } from "@/lib/admin/sidebar-tabs";
import { saveHiddenTabsAction } from "@/lib/admin/sidebar-tabs-actions";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Toast } from "@/components/ui/Toast";
import { ToggleRow } from "@/components/ui/Toggle";

/** Flikens namn i sidomenyn, samma text som där. */
export function sidebarTabLabel(sv: Dict, key: SidebarTabKey): string {
  const labels: Record<SidebarTabKey, string> = {
    hem: sv.shell.home,
    statistik: sv.shell.myStats,
    kurser: sv.shell.courses,
    kurssidan: sv.shell.coursePage,
    tentalaget: sv.shell.examMode,
    oversikt: sv.admin.tabOverview,
    innehall: sv.admin.tabContent,
    granskning: sv.admin.tabReview,
    tentor: sv.admin.tabExams,
    felrapporter: sv.admin.tabReports,
    deltagare: sv.admin.tabEnrollments,
    importera: sv.admin.tabImport,
    installningar: sv.admin.tabSettings,
    "alla-kurser": sv.shell.allCourses,
    designsystem: sv.shell.designSystem,
    hjalp: sv.shell.help,
    om: sv.shell.about,
    integritet: sv.shell.privacy,
  };
  return labels[key];
}

/**
 * Sidomenyns flikar med ett reglage var: på = visas, av = dold för alla. Varje ändring sparas
 * direkt (lib/admin/sidebar-tabs-actions.ts) och sidomenyn uppdateras.
 */
export function SidebarTabsSettings({ hidden: initial }: { hidden: SidebarTabKey[] }) {
  const sv = useT();
  const { pending, error, handle } = useActionRunner();
  const [hidden, setHidden] = useState<ReadonlySet<SidebarTabKey>>(() => new Set(initial));
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const groupLabel = { study: sv.shell.sectionStudy, admin: sv.shell.sectionAdmin, info: sv.admin.sidebarGroupInfo } as const;

  function toggle(key: SidebarTabKey, show: boolean) {
    const next = new Set(hidden);
    if (show) next.delete(key);
    else next.add(key);
    setHidden(next);
    handle(saveHiddenTabsAction([...next]), () => setToast({ id: Date.now(), text: sv.admin.sidebarSaved }));
  }

  return (
    <Card padding="lg" data-testid="sidebar-tabs-settings">
      <CardHeader title={sv.admin.sidebarTitle} description={sv.admin.sidebarHelp} />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <p className="text-sm font-semibold" data-testid="sidebar-hidden-count">
        {sv.admin.sidebarHiddenCount(hidden.size)}
      </p>
      <div className="mt-2 grid gap-x-10 md:grid-cols-3">
        {SIDEBAR_TAB_GROUPS.map(({ group, keys }) => (
          <section key={group} aria-label={groupLabel[group]} className="mt-4">
            <h3 className="text-xs font-semibold text-subtle">{groupLabel[group]}</h3>
            <div className="divide-y divide-line">
              {keys.map((key) => (
                <ToggleRow key={key} title={sidebarTabLabel(sv, key)} checked={!hidden.has(key)} disabled={pending} onChange={(show) => toggle(key, show)} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <Toast message={toast?.text ?? null} id={toast?.id} onClose={() => setToast(null)} />
    </Card>
  );
}
