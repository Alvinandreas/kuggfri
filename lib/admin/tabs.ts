import { ClipboardCheck, Flag, Layers, LayoutDashboard, ScrollText, Settings2, Upload, type LucideIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import { routes } from "@/lib/routes";
import type { SidebarTabKey } from "@/lib/admin/sidebar-tabs";

/** Räknarna en adminflik kan visa; lib/admin/nav.ts hämtar dem för den låsta kursen. */
export type AdminTabCounter = "pendingDrafts" | "openReports";

export type AdminTab = {
  /** Nyckeln som Admininställningar döljer fliken med (lib/admin/sidebar-tabs.ts). */
  key: SidebarTabKey;
  label: string;
  icon: LucideIcon;
  href: (deckId: string) => string;
  /** Aktiv bara på exakt href (och also), inte på undersidor. */
  exact?: boolean;
  /** Fler sökvägar där fliken räknas som aktiv, med undersidor. */
  also?: (deckId: string) => string[];
  /** Räknare till höger i sidomenyn, och vad den betyder (tooltip och skärmläsartext). */
  counter?: { key: AdminTabCounter; label: (n: number) => string };
};

/**
 * Kursens adminflikar i sidomenyns ordning, med namnen ur ordlistan i det valda språket.
 * Sidomenyn (components/layout/Sidebar.tsx) bygger sina poster av listan, och lib/admin/nav.ts
 * hämtar räknarna som flikarna visar.
 */
export const adminTabs = (sv: Dict): readonly AdminTab[] => [
  { key: "oversikt", label: sv.admin.tabOverview, icon: LayoutDashboard, href: routes.admin.deck, exact: true, also: (id) => [routes.admin.stats(id)] },
  { key: "innehall", label: sv.admin.tabContent, icon: Layers, href: routes.admin.content, also: (id) => [routes.admin.categoryPrefix(id), routes.admin.cardPrefix(id)] },
  { key: "granskning", label: sv.admin.tabReview, icon: ClipboardCheck, href: (id) => routes.admin.review(id), counter: { key: "pendingDrafts", label: sv.shell.pendingDrafts } },
  { key: "tentor", label: sv.admin.tabExams, icon: ScrollText, href: routes.admin.exams },
  { key: "felrapporter", label: sv.admin.tabReports, icon: Flag, href: routes.admin.reports, counter: { key: "openReports", label: sv.shell.openReports } },
  { key: "importera", label: sv.admin.tabImport, icon: Upload, href: routes.admin.import },
  { key: "installningar", label: sv.admin.tabSettings, icon: Settings2, href: routes.admin.settings },
];
