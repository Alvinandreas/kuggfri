import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDeckBySlug } from "@/lib/content/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { isStudyMode, type StudyMode } from "@/lib/progress/types";
import { parseSelection } from "@/lib/study/selection";
import { StudySession } from "@/components/study/StudySession";
import { sv } from "@/lib/i18n/sv";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getDeckBySlug(slug);
  return { title: data ? `${data.deck.title} – ${sv.deck.start}` : sv.deck.start };
}

export default async function StudyPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [data, user] = await Promise.all([getDeckBySlug(slug), getCurrentUser()]);
  if (!data) notFound();

  const rawMode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  const mode: StudyMode = isStudyMode(rawMode) ? rawMode : "fsrs";
  const selection = parseSelection(query.urval);

  return (
    <StudySession
      key={`${mode}-${JSON.stringify(selection)}`}
      deck={{ id: data.deck.id, slug: data.deck.slug, title: data.deck.title }}
      categories={data.categories.map((c) => ({ id: c.id, title: c.title }))}
      cards={data.cards.map((c) => ({
        id: c.id,
        category_id: c.category_id,
        front: c.front,
        back: c.back,
        hint: c.hint,
        sort_order: c.sort_order,
      }))}
      mode={mode}
      selection={selection}
      userId={user?.id ?? null}
    />
  );
}
