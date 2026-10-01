import { ClipboardCheck, Flag, Layers, LayoutDashboard, ScrollText, Settings2, Upload, type LucideIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import { routes } from "@/lib/routes";

/** Räknarna en adminflik kan visa; lib/admin/nav.ts hämtar dem för den låsta kursen. */
export type AdminTabCounter = "pendingDrafts" | "openReports";

export type AdminTab = {
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
  { label: sv.admin.tabOverview, icon: LayoutDashboard, href: routes.admin.deck, exact: true, also: (id) => [routes.admin.stats(id)] },
  { label: sv.admin.tabContent, icon: Layers, href: routes.admin.content, also: (id) => [routes.admin.categoryPrefix(id), routes.admin.cardPrefix(id)] },
  { label: sv.admin.tabReview, icon: ClipboardCheck, href: (id) => routes.admin.review(id), counter: { key: "pendingDrafts", label: sv.shell.pendingDrafts } },
  { label: sv.admin.tabExams, icon: ScrollText, href: routes.admin.exams },
  { label: sv.admin.tabReports, icon: Flag, href: routes.admin.reports, counter: { key: "openReports", label: sv.shell.openReports } },
  { label: sv.admin.tabImport, icon: Upload, href: routes.admin.import },
  { label: sv.admin.tabSettings, icon: Settings2, href: routes.admin.settings },
];
