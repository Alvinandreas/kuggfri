import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { countOpenReports, getDeckForAdmin, getDeckOverviewStats } from "@/lib/admin/queries";
import { CourseOverview } from "@/components/admin/CourseOverview";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  return { title: data ? `${sv.admin.overviewTitle}: ${data.deck.title}` : sv.admin.overviewTitle };
}

/** Deckets startsida i admin: kursöversikten. */
export default async function AdminDeckPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const { deck, categories, cards } = data;
  const [stats, openReports] = await Promise.all([getDeckOverviewStats(deck.id), countOpenReports(deck.id)]);
  const counts = new Map<string, number>();
  for (const c of cards) if (c.category_id && c.is_active) counts.set(c.category_id, (counts.get(c.category_id) ?? 0) + 1);

  return (
    <CourseOverview
      deckId={deck.id}
      stats={stats}
      categories={categories.map((c) => ({ id: c.id, title: c.title, cardCount: counts.get(c.id) ?? 0 }))}
      openReports={openReports}
    />
  );
}
