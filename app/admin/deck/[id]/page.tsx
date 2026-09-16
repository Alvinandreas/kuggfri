import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { countOpenReports, getDeckForAdmin } from "@/lib/admin/queries";
import { DeckForm } from "@/components/admin/DeckForm";
import { CategoryOverview, type CategoryCounts } from "@/components/admin/CategoryOverview";
import { LinkButton } from "@/components/ui/Button";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  return { title: data ? `${sv.admin.editDeck}: ${data.deck.title}` : sv.admin.editDeck };
}

export default async function AdminDeckPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const { deck, categories, cards } = data;
  const openReports = await countOpenReports(deck.id);

  const counts: Record<string, CategoryCounts> = {};
  const uncategorized: CategoryCounts = { total: 0, inactive: 0 };
  for (const card of cards) {
    const bucket = card.category_id ? (counts[card.category_id] ??= { total: 0, inactive: 0 }) : uncategorized;
    bucket.total++;
    if (!card.is_active) bucket.inactive++;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{deck.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {sv.admin.cardCount(cards.length)} · {categories.length} {sv.admin.categories.toLowerCase()} ·{" "}
            {deck.is_published ? sv.admin.published : sv.admin.unpublished}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/admin/deck/${deck.id}/kort/ny`} size="sm">
            {sv.admin.newCard}
          </LinkButton>
          <LinkButton href={`/admin/deck/${deck.id}/import`} variant="secondary" size="sm">
            {sv.admin.import}
          </LinkButton>
          <a
            href={`/admin/deck/${deck.id}/export`}
            download={`${deck.slug}.json`}
            className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-surface-2"
          >
            {sv.admin.export}
          </a>
          <LinkButton href={`/admin/deck/${deck.id}/statistik`} variant="secondary" size="sm">
            {sv.admin.stats}
          </LinkButton>
          <LinkButton href={`/admin/deck/${deck.id}/rapporter`} variant="secondary" size="sm">
            {sv.admin.reports}
            {openReports > 0 ? ` (${openReports})` : ""}
          </LinkButton>
          <Link href={`/d/${deck.slug}`} className="inline-flex h-9 items-center px-2 text-sm text-muted hover:text-fg">
            {sv.admin.viewDeck}
          </Link>
        </div>
      </div>

      <section aria-labelledby="deck-form" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <h2 id="deck-form" className="text-lg font-semibold">
          {sv.admin.deckSettings}
        </h2>
        <DeckForm deck={deck} />
      </section>
      <section aria-labelledby="kategorier" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <h2 id="kategorier" className="text-lg font-semibold">
          {sv.admin.categories}
        </h2>
        <CategoryOverview deckId={deck.id} categories={categories} counts={counts} uncategorized={uncategorized} />
      </section>

    </div>
  );
}
