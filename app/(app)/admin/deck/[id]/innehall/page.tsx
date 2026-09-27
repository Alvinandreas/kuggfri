import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { CategoryOverview, type CategoryCounts } from "@/components/admin/CategoryOverview";
import { Download, Plus } from "lucide-react";
import { LinkButton, buttonClass } from "@/components/ui/Button";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  return { title: data ? `${sv.admin.tabContent}: ${data.deck.title}` : sv.admin.tabContent };
}

/** Innehållet: kategorier i deckets ordning, med antal kort. */
export default async function AdminContentPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const { deck, categories, cards } = data;

  const counts: Record<string, CategoryCounts> = {};
  const uncategorized: CategoryCounts = { total: 0, inactive: 0 };
  for (const card of cards) {
    const bucket = card.category_id ? (counts[card.category_id] ??= { total: 0, inactive: 0 }) : uncategorized;
    bucket.total++;
    if (!card.is_active) bucket.inactive++;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">{sv.admin.categories}</h2>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/admin/deck/${deck.id}/kort/ny`} size="sm">
            <Plus size={16} aria-hidden />
            {sv.admin.newCard}
          </LinkButton>
          <a href={`/admin/deck/${deck.id}/export`} download={`${deck.slug}.json`} className={buttonClass("outline", "sm")}>
            <Download size={15} aria-hidden />
            {sv.admin.export}
          </a>
        </div>
      </div>
      <CategoryOverview deckId={deck.id} categories={categories} counts={counts} uncategorized={uncategorized} />
    </div>
  );
}
