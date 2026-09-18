import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDeckBySlug } from "@/lib/content/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { DeckOverview } from "@/components/study/DeckOverview";
import { sv } from "@/lib/i18n/sv";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getDeckBySlug(slug);
  return { title: data?.deck.title ?? "Deck" };
}

export default async function DeckPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [data, user] = await Promise.all([getDeckBySlug(slug), getCurrentUser()]);
  if (!data) notFound();

  return (
    <>
      {!data.deck.is_published ? (
        <p role="status" className="mb-6 rounded-lg border border-line-strong bg-surface-2 px-4 py-3 text-sm" data-testid="unpublished-banner">
          {sv.admin.unpublishedBanner}
        </p>
      ) : null}
    <DeckOverview
      deck={{
        id: data.deck.id,
        slug: data.deck.slug,
        title: data.deck.title,
        description: data.deck.description,
        course_code: data.deck.course_code,
        source_credit: data.deck.source_credit,
        exam_date: data.deck.exam_date,
      }}
      categories={data.categories.map((c) => ({ id: c.id, title: c.title }))}
      cards={data.cards.map((c) => ({ id: c.id, category_id: c.category_id, sort_order: c.sort_order }))}
      userId={user?.id ?? null}
    />
    </>
  );
}
