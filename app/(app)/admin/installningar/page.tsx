import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/lib/admin/access";
import { getHiddenTabs } from "@/lib/admin/sidebar-tabs-queries";
import { SidebarTabsSettings } from "@/components/admin/SidebarTabsSettings";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.admin.globalSettings };
}

/** Admininställningar: bara global admin (examinatorer får 403). Nås från profilmenyn och adminens undermeny. */
export default async function GlobalSettingsPage() {
  const [sv, ctx, hidden] = await Promise.all([getT(), getAdminContext(), getHiddenTabs()]);
  if (!ctx?.isAdmin) forbidden();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{sv.admin.globalSettings}</h1>
      <SidebarTabsSettings hidden={hidden} />
    </div>
  );
}
