import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { ImportPanel } from "@/components/admin/ImportPanel";
import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: sv.admin.importTitle };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">{sv.admin.importTitle}</h2>
        <a
          href={`/admin/deck/${data.deck.id}/export`}
          download={`${data.deck.slug}.json`}
          title={sv.admin.exportHelp}
          className={buttonClass("outline", "sm")}
        >
          <Download size={15} aria-hidden />
          {sv.admin.export}
        </a>
      </div>
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
