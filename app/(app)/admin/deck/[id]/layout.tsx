import { forbidden, notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { canEditDeck, getAdminContext } from "@/lib/admin/access";
import { countOpenReports, getDeckForAdmin } from "@/lib/admin/queries";
import { DeckTabs } from "@/components/admin/DeckTabs";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";

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
      <div className="anim-fade-up flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{deck.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {deck.course_code ? <Badge tone="outline">{deck.course_code}</Badge> : null}
            <span>{sv.admin.cardCount(cards.length)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {categories.length} {sv.admin.categories.toLowerCase()}
            </span>
            <Badge tone={deck.is_published ? "accent" : "neutral"} className="ml-1">
              <span className={`h-1.5 w-1.5 rounded-full ${deck.is_published ? "bg-accent-ink" : "bg-muted"}`} aria-hidden="true" />
              {deck.is_published ? sv.admin.published : sv.admin.unpublished}
            </Badge>
          </p>
        </div>
        <LinkButton href={`/d/${deck.slug}`} variant="outline" size="sm">
          {sv.admin.viewDeck}
          <ArrowUpRight size={15} aria-hidden />
        </LinkButton>
      </div>
      <DeckTabs deckId={deck.id} openReports={openReports} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
