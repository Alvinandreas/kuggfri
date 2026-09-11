import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getCardForAdmin, getDeckForAdmin } from "@/lib/admin/queries";
import { CardEditor } from "@/components/admin/CardEditor";

export const metadata: Metadata = { title: sv.admin.editCard };

export default async function EditCardPage({ params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { id, cardId } = await params;
  const [data, card] = await Promise.all([getDeckForAdmin(id), getCardForAdmin(cardId)]);
  if (!data || !card || card.deck_id !== data.deck.id) notFound();
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{sv.admin.editCard}</h1>
      <CardEditor deckId={data.deck.id} categories={data.categories.map((c) => ({ id: c.id, title: c.title }))} card={card} />
    </div>
  );
}
