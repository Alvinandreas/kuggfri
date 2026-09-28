import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getAdminContext } from "@/lib/admin/access";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { getHistoryMeta, type HistoryMeta } from "@/lib/admin/history-queries";
import { differsFromPublished } from "@/lib/admin/history";
import { DEFAULT_REVIEW_FILTER, REVIEW_BUCKETS, reviewRelevant, type ReviewCard, type ReviewFilter } from "@/lib/admin/review";
import { isCardKind } from "@/lib/cards/kinds";
import { ReviewWorkspace } from "@/components/admin/ReviewWorkspace";

type Params = Promise<{ id: string }>;
type Search = Promise<{ omrade?: string; typ?: string; status?: string; andringar?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  return { title: data ? `${sv.admin.reviewTitle}: ${data.deck.title}` : sv.admin.reviewTitle };
}

/**
 * Granskningen: förslag (utkast) som väntar, avvisade förslag och kort som godkänts det
 * senaste dygnet. Filtret kan förväljas via adressen (?omrade=, ?typ=, ?status=, ?andringar=1),
 * så att innehållsöversikten kan länka rakt till ett områdes utkast.
 *
 * Historiken i sammandrag (antal versioner och senast publicerade version) hämtas för korten i
 * granskningen, så att ändringar av publicerade kort kan visas mot det studenterna såg.
 */
export default async function ReviewPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [ctx, data] = await Promise.all([getAdminContext(), getDeckForAdmin(id)]);
  if (!ctx) forbidden();
  if (!data) notFound();

  const now = Date.now();
  const relevant = reviewRelevant(data.cards, now);
  const history: HistoryMeta = await getHistoryMeta(
    data.deck.id,
    relevant.map((c) => c.id),
  ).catch(() => ({ counts: {}, published: {} }));
  // Bara versioner som skiljer sig från kortet räknas som ändringar av publicerade kort (ett
  // godkännande som ångrats lämnar en publicerad version med samma innehåll i historiken).
  const published = Object.fromEntries(
    relevant.flatMap((c) => {
      const v = history.published[c.id];
      return v && differsFromPublished(v, c) ? [[c.id, v] as const] : [];
    }),
  );
  const cards: ReviewCard[] = relevant.map((c) => ({
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
    published_before: c.id in published,
  }));

  const areaIds = new Set(data.categories.map((c) => c.id));
  const filter: ReviewFilter = {
    bucket: (REVIEW_BUCKETS as readonly string[]).includes(search.status ?? "") ? (search.status as ReviewFilter["bucket"]) : DEFAULT_REVIEW_FILTER.bucket,
    area: search.omrade === "ingen" || (search.omrade && areaIds.has(search.omrade)) ? search.omrade : "alla",
    kind: isCardKind(search.typ) ? search.typ : "alla",
    changesOnly: search.andringar === "1",
  };

  return (
    <ReviewWorkspace
      deckId={data.deck.id}
      areas={data.categories.map((c) => ({ id: c.id, title: c.title }))}
      cards={cards}
      initialFilter={filter}
      historyCounts={history.counts}
      publishedVersions={published}
      userId={ctx.userId}
      now={now}
    />
  );
}
