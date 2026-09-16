import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { countOpenReports, getDeckForAdmin } from "@/lib/admin/queries";
import { DeckForm } from "@/components/admin/DeckForm";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { CardList } from "@/components/admin/CardList";
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

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{deck.title}</h1>
        <div className="flex flex-wrap gap-2">
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
          {sv.admin.editDeck}
        </h2>
        <DeckForm deck={deck} />
      </section>

      <section aria-labelledby="kategorier" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <h2 id="kategorier" className="text-lg font-semibold">
          {sv.admin.categories}
        </h2>
        <CategoryManager deckId={deck.id} categories={categories} />
      </section>

      <section aria-labelledby="kort" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="flex items-center justify-between">
          <h2 id="kort" className="text-lg font-semibold">
            {sv.admin.cards} ({cards.length})
          </h2>
          <LinkButton href={`/admin/deck/${deck.id}/kort/ny`} size="sm">
            {sv.admin.newCard}
          </LinkButton>
        </div>
        <CardList deckId={deck.id} cards={cards} categories={categories} />
      </section>
    </div>
  );
}
