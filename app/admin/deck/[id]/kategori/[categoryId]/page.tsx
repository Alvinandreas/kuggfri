import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { CardList } from "@/components/admin/CardList";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { LinkButton } from "@/components/ui/Button";

type Params = Promise<{ id: string; categoryId: string }>;

/** "ingen" = korten som saknar kategori. */
const NONE = "ingen";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, categoryId } = await params;
  const data = await getDeckForAdmin(id);
  const title = categoryId === NONE ? sv.admin.uncategorized : data?.categories.find((c) => c.id === categoryId)?.title;
  return { title: title ? `${title} – ${sv.admin.cards}` : sv.admin.cards };
}

export default async function AdminCategoryPage({ params }: { params: Params }) {
  const { id, categoryId } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const { deck, categories } = data;
  const category = categoryId === NONE ? null : (categories.find((c) => c.id === categoryId) ?? null);
  if (categoryId !== NONE && !category) notFound();

  const cards = data.cards.filter((c) => (category ? c.category_id === category.id : c.category_id === null));
  const inactive = cards.filter((c) => !c.is_active).length;
  const colorIndex = categoryColorIndex(categories);
  const newHref = `/admin/deck/${deck.id}/kort/ny${category ? `?kategori=${category.id}` : ""}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <nav aria-label={sv.admin.breadcrumb} className="text-sm text-muted">
        <Link href={`/admin/deck/${deck.id}/innehall`} className="hover:text-fg">
          ← {sv.admin.tabContent}
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">
            {category ? (
              <CategoryTag title={category.title} colorIndex={colorIndex.get(category.id) ?? 0} size="lg" />
            ) : (
              sv.admin.uncategorized
            )}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {sv.admin.cardCount(cards.length)}
            {inactive > 0 ? ` · ${sv.admin.inactiveCount(inactive)}` : ""}
            {category ? ` · ${sv.admin.categoryPosition(categories.findIndex((c) => c.id === category.id) + 1, categories.length)}` : ""}
          </p>
        </div>
        <LinkButton href={newHref} size="sm">
          {sv.admin.newCardInCategory}
        </LinkButton>
      </div>

      <p className="text-sm text-muted">{sv.admin.categoryCardsHelp}</p>
      <CardList deckId={deck.id} cards={cards} />
    </div>
  );
}
