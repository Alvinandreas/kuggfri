import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDeckBySlug } from "@/lib/content/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { DeckOverview } from "@/components/study/DeckOverview";

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
    <DeckOverview
      deck={{
        id: data.deck.id,
        slug: data.deck.slug,
        title: data.deck.title,
        description: data.deck.description,
        course_code: data.deck.course_code,
        source_credit: data.deck.source_credit,
      }}
      categories={data.categories.map((c) => ({ id: c.id, title: c.title }))}
      cards={data.cards.map((c) => ({ id: c.id, category_id: c.category_id, sort_order: c.sort_order }))}
      userId={user?.id ?? null}
    />
  );
}
