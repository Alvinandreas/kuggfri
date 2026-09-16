import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { ImportPanel } from "@/components/admin/ImportPanel";

export const metadata: Metadata = { title: sv.admin.importTitle };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {sv.admin.importTitle}: {data.deck.title}
      </h1>
      <ImportPanel
        deckId={data.deck.id}
        existingCards={data.cards.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          hint: c.hint,
          category_id: c.category_id,
          sort_order: c.sort_order,
        }))}
        existingCategories={data.categories.map((c) => ({ id: c.id, title: c.title }))}
      />
    </div>
  );
}
