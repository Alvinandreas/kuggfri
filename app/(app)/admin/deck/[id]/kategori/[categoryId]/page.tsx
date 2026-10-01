import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { getLang, getT } from "@/lib/i18n/server";
import { areaName } from "@/lib/admin/display";
import { localizeCard } from "@/lib/content/localize";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { CardList } from "@/components/admin/CardList";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { LinkButton } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

type Params = Promise<{ id: string; categoryId: string }>;

/** "ingen" = korten som saknar område. */
const NONE = "ingen";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const sv = await getT();
  const { id, categoryId } = await params;
  const data = await getDeckForAdmin(id);
  const title = categoryId === NONE ? sv.admin.uncategorized : data?.categories.find((c) => c.id === categoryId)?.title;
  return { title: title ? `${title}: ${sv.admin.cards}` : sv.admin.cards };
}

export default async function AdminCategoryPage({ params }: { params: Params }) {
  const sv = await getT();
  const lang = await getLang();
  const { id, categoryId } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const { deck, categories } = data;
  const category = categoryId === NONE ? null : (categories.find((c) => c.id === categoryId) ?? null);
  if (categoryId !== NONE && !category) notFound();

  const cards = data.cards.filter((c) => (category ? c.category_id === category.id : c.category_id === null));
  // Samma räkning som på Innehåll: kursens kort (utan förslag), varav inaktiva, och utkasten för sig.
  const courseCards = cards.filter((c) => c.review_status === null).length;
  const inactive = cards.filter((c) => !c.is_active && c.review_status === null).length;
  const drafts = cards.filter((c) => c.review_status === "utkast").length;
  const colorIndex = categoryColorIndex(categories);
  const newHref = routes.admin.newCard(deck.id, { kategori: category?.id });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <nav aria-label={sv.admin.breadcrumb} className="text-sm text-muted">
        <Link href={routes.admin.content(deck.id)} className="inline-flex min-h-8 items-center gap-1 rounded-full font-semibold hover:text-fg">
          <ArrowLeft size={15} aria-hidden />
          {sv.admin.tabContent}
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">
            {category ? (
              <CategoryTag title={areaName(category, lang)} colorIndex={colorIndex.get(category.id) ?? 0} size="lg" />
            ) : (
              sv.admin.uncategorized
            )}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {[
              sv.admin.cardCount(courseCards),
              inactive > 0 ? sv.admin.inactiveCount(inactive) : null,
              drafts > 0 ? sv.admin.draftCount(drafts) : null,
              category ? sv.admin.categoryPosition(categories.findIndex((c) => c.id === category.id) + 1, categories.length) : null,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
        <LinkButton href={newHref} size="sm">
          <Plus size={16} aria-hidden />
          {category ? sv.admin.newCardInCategory : sv.admin.newCard}
        </LinkButton>
      </div>

      {cards.length > 0 ? <p className="text-sm text-muted">{sv.admin.categoryCardsHelp}</p> : null}
      <CardList deckId={deck.id} cards={cards.map((c) => localizeCard(c, lang))} categories={categories.map((c) => ({ id: c.id, title: areaName(c, lang) }))} currentCategoryId={category?.id ?? null} />
    </div>
  );
}
