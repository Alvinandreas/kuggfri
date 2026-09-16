import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { CardEditor } from "@/components/admin/CardEditor";

export const metadata: Metadata = { title: sv.admin.newCard };

export default async function NewCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{sv.admin.newCard}</h1>
      <CardEditor deckId={data.deck.id} categories={data.categories.map((c) => ({ id: c.id, title: c.title }))} />
    </div>
  );
}
