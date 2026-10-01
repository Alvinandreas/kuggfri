import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/lib/admin/access";
import { DeckForm } from "@/components/admin/DeckForm";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.admin.newDeck };
}

/** Bara global admin kan skapa deck; en examinator får 403. */
export default async function NewDeckPage() {
  const sv = await getT();
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) forbidden();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="anim-fade-up text-3xl font-extrabold tracking-tight sm:text-4xl">{sv.admin.newDeck}</h1>
      <DeckForm />
    </div>
  );
}
