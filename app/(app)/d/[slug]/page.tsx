import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDeckBySlug } from "@/lib/content/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { DeckOverview } from "@/components/study/DeckOverview";
import { sv } from "@/lib/i18n/sv";
import { isStudyMode } from "@/lib/progress/types";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getDeckBySlug(slug);
  if (!data) return { title: "Deck" };
  const description = data.deck.description ?? sv.deck.totalCards(data.cards.length);
  return {
    title: data.deck.title,
    description,
    openGraph: { title: data.deck.title, description },
  };
}

export default async function DeckPage({ params, searchParams }: { params: Params; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  // ?lage=exam&omrade=<id>: förvalt läge och område, från genvägar på hemsidan och i radardialogen.
  const rawMode = Array.isArray(query.lage) ? query.lage[0] : query.lage;
  const rawArea = Array.isArray(query.omrade) ? query.omrade[0] : query.omrade;
  const [data, user] = await Promise.all([getDeckBySlug(slug), getCurrentUser()]);
  if (!data) notFound();

  return (
    <>
      {!data.deck.is_published ? (
        <p role="status" className="mb-6 rounded-lg border border-line-strong bg-surface-2 px-5 py-3.5 text-sm font-medium dark:border-transparent" data-testid="unpublished-banner">
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
        cards={data.cards.map((c) => ({
          id: c.id,
          category_id: c.category_id,
          sort_order: c.sort_order,
          front: c.front,
          original: c.original ?? false,
          // Passets inställningar: Uppgiftstyper filtrerar på typen, ledtrådsvalet visas bara om kort har ledtråd.
          kind: c.kind ?? "sjalvskattning",
          hasHint: !!c.hint,
        }))}
        userId={user?.id ?? null}
        initialMode={isStudyMode(rawMode) ? rawMode : "fsrs"}
        initialAreaId={rawArea && data.categories.some((c) => c.id === rawArea) ? rawArea : null}
      />
    </>
  );
}
