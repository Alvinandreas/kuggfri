import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getDeckBySlug, getMyDecks } from "@/lib/content/queries";
import { getCurrentProfile } from "@/lib/supabase/server";
import { MyStatsDashboard } from "@/components/mystats/MyStatsDashboard";
import type { HomeDeck } from "@/components/home/HomeDashboard";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.myStats.title };
}

/** Min statistik: rekord, rytm, skattningar och milstolpar över alla publicerade kurser. */
export default async function MyStatsPage() {
  const [session, summaries] = await Promise.all([getCurrentProfile(), getMyDecks()]);
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

  return <MyStatsDashboard userId={session?.user.id ?? null} decks={decks} />;
}
