import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/lib/admin/access";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { getHistoryMeta, type HistoryMeta } from "@/lib/admin/history-queries";
import { differsFromPublished } from "@/lib/admin/history";
import { reviewRelevant, reviewTab, type ReviewCard } from "@/lib/admin/review";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewInbox } from "@/components/admin/ReviewInbox";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const sv = await getT();
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  return { title: data ? `${sv.granskning.title}: ${data.deck.title}` : sv.granskning.title };
}

/**
 * Granskningen: en inkorg med flikarna Att granska, Granskade och Flaggade (se lib/admin/review).
 * Flik, öppet kort, filter och sökning står i adressen (?flik=, ?kort=, ?omrade=, ?typ=, ?kalla=,
 * ?ursprung=, ?sok=) och läses av klienten, så att vyerna går att länka och bakåtknappen fungerar.
 *
 * För kort under Att granska som ändrar ett tidigare publicerat kort (rättade originalkort) hämtas
 * den senast publicerade versionen, som Återställ originalet går tillbaka till. Granskarnas namn hämtas med
 * deck_reviewer_names (profiler är annars bara läsbara för sin ägare).
 */
export default async function ReviewPage({ params }: { params: Params }) {
  const { id } = await params;
  const [ctx, data] = await Promise.all([getAdminContext(), getDeckForAdmin(id)]);
  if (!ctx) forbidden();
  if (!data) notFound();

  const relevant = reviewRelevant(data.cards);
  const pending = relevant.filter((c) => reviewTab(c) === "att-granska");
  const supabase = await createSupabaseServerClient();
  const [history, names] = await Promise.all([
    getHistoryMeta(
      data.deck.id,
      pending.map((c) => c.id),
    ).catch((): HistoryMeta => ({ counts: {}, published: {} })),
    supabase.rpc("deck_reviewer_names", { p_deck_id: data.deck.id }).then(
      ({ data: rows }) => rows ?? [],
      () => [],
    ),
  ]);

  const cards: ReviewCard[] = relevant.map((c) => {
    const published = c.review_status !== "avvisad" && !c.reviewed_at ? history.published[c.id] : undefined;
    return {
      id: c.id,
      category_id: c.category_id,
      front: c.front,
      back: c.back,
      hint: c.hint,
      kind: c.kind,
      options: c.options,
      is_active: c.is_active,
      review_status: c.review_status,
      review_note: c.review_note,
      reviewed_by: c.reviewed_by,
      reviewed_at: c.reviewed_at,
      source: c.source,
      sort_order: c.sort_order,
      created_at: c.created_at,
      original: c.original,
      flag_note: c.flag_note,
      flagged_at: c.flagged_at,
      flagged_by: c.flagged_by,
      translation_en: c.translation_en ?? null,
      // Bara versioner som skiljer sig från kortet räknas (ett godkännande som ångrats lämnar en
      // publicerad version med samma innehåll i historiken).
      published_version_id: published && differsFromPublished(published, c) ? published.id : null,
    };
  });

  const reviewerNames: Record<string, string> = Object.fromEntries(names.map((n) => [n.user_id, n.display_name] as const));

  return (
    <ReviewInbox
      deckId={data.deck.id}
      areas={data.categories.map((c) => ({ id: c.id, title: c.title, title_en: c.title_en ?? null }))}
      cards={cards}
      reviewerNames={reviewerNames}
      userId={ctx.userId}
      now={Date.now()}
    />
  );
}
