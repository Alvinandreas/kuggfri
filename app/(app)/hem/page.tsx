import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getDeckBySlug, getPublishedDecks } from "@/lib/content/queries";
import { getCurrentProfile } from "@/lib/supabase/server";
import { HomeDashboard, type HomeDeck } from "@/components/home/HomeDashboard";
import { toHomeDeck } from "@/lib/content/view-models";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.dashboard.title };
}

/** Hemsidan för inloggade: hur plugget går, dagens pass och kurserna. */
export default async function HomePage() {
  const [session, summaries] = await Promise.all([getCurrentProfile(), getPublishedDecks()]);
  const full = await Promise.all(summaries.map((d) => getDeckBySlug(d.slug)));
  const decks: HomeDeck[] = full.flatMap((d) => (d ? [toHomeDeck(d)] : []));
  const displayName = session?.profile?.display_name?.trim() ?? "";
  const firstName = displayName.split(/\s+/)[0] ?? "";

  return <HomeDashboard userId={session?.user.id ?? null} firstName={firstName} decks={decks} />;
}
