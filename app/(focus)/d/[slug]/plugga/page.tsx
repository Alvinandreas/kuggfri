import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDeckBySlug } from "@/lib/content/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { parsePassQuery } from "@/lib/study/session-queue";
import { toCategoryOption, toStudyCard } from "@/lib/content/view-models";
import { StudySession } from "@/components/study/StudySession";
import { sv } from "@/lib/i18n/sv";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getDeckBySlug(slug);
  return { title: data ? sv.study.pageTitle(data.deck.title) : sv.deck.start };
}

export default async function StudyPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [data, user] = await Promise.all([getDeckBySlug(slug), getCurrentUser()]);
  if (!data) notFound();

  // Läge, urval, inställningar och fortsättningar (nya=, vidare=, tak=, pass=) ur adressen.
  // Ett gammalt original=1 (det borttagna valet Bara originalkorten) ignoreras.
  const req = parsePassQuery(query);

  return (
    <StudySession
      key={`${req.mode}-${JSON.stringify(req.selection)}-${req.extraNew ?? ""}-${JSON.stringify(req.settings)}-${req.onlyStarred}-${req.extra}-${req.max ?? ""}-${req.pass}`}
      deck={{ id: data.deck.id, slug: data.deck.slug, title: data.deck.title, exam_date: data.deck.exam_date }}
      extraNew={req.extraNew}
      extra={req.extra}
      max={req.max}
      pass={req.pass}
      settingsMode={req.settingsMode}
      settings={req.settings}
      onlyStarred={req.onlyStarred}
      categories={data.categories.map(toCategoryOption)}
      cards={data.cards.map(toStudyCard)}
      mode={req.mode}
      selection={req.selection}
      userId={user?.id ?? null}
    />
  );
}
