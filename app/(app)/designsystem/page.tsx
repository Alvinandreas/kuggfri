import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/lib/admin/access";
import { Showcase } from "@/components/designsystem/Showcase";

export const metadata: Metadata = { title: "Designsystem" };

/** Intern granskningsyta för komponenterna. Bara för global admin. */
export default async function DesignSystemPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) notFound();
  return <Showcase />;
}
