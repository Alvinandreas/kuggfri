import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getAdminContext } from "@/lib/admin/access";
import { DeckForm } from "@/components/admin/DeckForm";

export const metadata: Metadata = { title: sv.admin.newDeck };

/** Bara global admin kan skapa deck; en examinator får 403. */
export default async function NewDeckPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) forbidden();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{sv.admin.newDeck}</h1>
      <DeckForm />
    </div>
  );
}
