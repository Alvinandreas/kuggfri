import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { canEditDeck, getAdminContext } from "@/lib/admin/access";
import { countOpenReports, getDeckForAdmin } from "@/lib/admin/queries";
import { DeckTabs } from "@/components/admin/DeckTabs";

type Params = Promise<{ id: string }>;

/**
 * Gemensamt skal för allt som rör ett deck: rubrik, status, flikar.
 * Åtkomsten avgörs här (admin eller examinator för just detta deck).
 */
export default async function DeckLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!canEditDeck(ctx, id)) forbidden();
  // Båda beror bara på id, så de kan hämtas samtidigt.
  const [data, openReports] = await Promise.all([getDeckForAdmin(id), countOpenReports(id)]);
  if (!data) notFound();
  const { deck, categories, cards } = data;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{deck.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            {deck.course_code ? <span>{deck.course_code}</span> : null}
            {deck.course_code ? <span aria-hidden="true">·</span> : null}
            <span>{sv.admin.cardCount(cards.length)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {categories.length} {sv.admin.categories.toLowerCase()}
            </span>
            <span aria-hidden="true">·</span>
            <span className={deck.is_published ? "inline-flex items-center gap-1 text-accent" : "inline-flex items-center gap-1"}>
              <span className={`inline-block h-2 w-2 rounded-full ${deck.is_published ? "bg-accent" : "bg-line-strong"}`} aria-hidden="true" />
              {deck.is_published ? sv.admin.published : sv.admin.unpublished}
            </span>
          </p>
        </div>
        <Link href={`/d/${deck.slug}`} className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-surface-2">
          {sv.admin.viewDeck} →
        </Link>
      </div>
      <DeckTabs deckId={deck.id} openReports={openReports} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
