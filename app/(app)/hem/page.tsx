import type { Metadata } from "next";
import { sv } from "@/lib/i18n/sv";
import { getDeckBySlug, getPublishedDecks } from "@/lib/content/queries";
import { getCurrentProfile } from "@/lib/supabase/server";
import { HomeDashboard, type HomeDeck } from "@/components/home/HomeDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: sv.dashboard.title };

/** Hemsidan för inloggade: hur plugget går, dagens pass och kurserna. */
export default async function HomePage() {
  const [session, summaries] = await Promise.all([getCurrentProfile(), getPublishedDecks()]);
  const full = await Promise.all(summaries.map((d) => getDeckBySlug(d.slug)));
  const decks: HomeDeck[] = full.flatMap((d) =>
    d
      ? [
          {
            id: d.deck.id,
            slug: d.deck.slug,
            title: d.deck.title,
            course_code: d.deck.course_code,
            exam_date: d.deck.exam_date,
            categories: d.categories.map((c) => ({ id: c.id, title: c.title })),
            cards: d.cards.map((c) => ({ id: c.id, category_id: c.category_id, sort_order: c.sort_order })),
          },
        ]
      : [],
  );
  const displayName = session?.profile?.display_name?.trim() ?? "";
  const firstName = displayName.split(/\s+/)[0] ?? "";

  return <HomeDashboard userId={session?.user.id ?? null} firstName={firstName} decks={decks} />;
}
