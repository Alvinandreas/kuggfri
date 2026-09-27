import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getCardForAdmin, getDeckForAdmin } from "@/lib/admin/queries";
import { CardEditor } from "@/components/admin/CardEditor";

export const metadata: Metadata = { title: sv.admin.editCard };

export default async function EditCardPage({ params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { id, cardId } = await params;
  const [data, card] = await Promise.all([getDeckForAdmin(id), getCardForAdmin(cardId)]);
  if (!data || !card || card.deck_id !== data.deck.id) notFound();
  const category = card.category_id ? (data.categories.find((c) => c.id === card.category_id) ?? null) : null;
  const backHref = `/admin/deck/${data.deck.id}/kategori/${category ? category.id : "ingen"}`;
  const siblings = data.cards.filter((c) => c.category_id === card.category_id);
  const index = siblings.findIndex((c) => c.id === card.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <nav aria-label={sv.admin.breadcrumb} className="text-sm text-muted">
        <Link href={`/admin/deck/${data.deck.id}/innehall`} className="hover:text-fg">
          {sv.admin.tabContent}
        </Link>
        {" › "}
        <Link href={backHref} className="hover:text-fg">
          {category ? category.title : sv.admin.uncategorized}
        </Link>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          {sv.admin.editCard}
          {index >= 0 ? <span className="ml-2 text-base font-normal text-muted">{sv.admin.cardPosition(index + 1, siblings.length)}</span> : null}
        </h2>
        <div className="flex gap-1 text-sm">
          {prev ? (
            <Link href={`/admin/deck/${data.deck.id}/kort/${prev.id}`} className="rounded-md border border-line-strong bg-surface px-3 py-1.5 hover:bg-surface-2">
              ← {sv.admin.prevCard}
            </Link>
          ) : null}
          {next ? (
            <Link href={`/admin/deck/${data.deck.id}/kort/${next.id}`} className="rounded-md border border-line-strong bg-surface px-3 py-1.5 hover:bg-surface-2">
              {sv.admin.nextCard} →
            </Link>
          ) : null}
        </div>
      </div>
      <CardEditor deckId={data.deck.id} categories={data.categories.map((c) => ({ id: c.id, title: c.title }))} card={card} backHref={backHref} />
    </div>
  );
}
