import { forbidden, notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { canEditDeck, getAdminContext } from "@/lib/admin/access";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

type Params = Promise<{ id: string }>;

/**
 * Gemensamt skal för allt som rör ett deck: rubrik och status. Adminsidorna nås från
 * sidomenyn (Översikt, Innehåll, Granskning och så vidare), så här finns ingen egen flikrad
 * (Alvins beslut 30 sep). Åtkomsten avgörs här (admin eller examinator för just detta deck).
 */
export default async function DeckLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!canEditDeck(ctx, id)) forbidden();
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const { deck, categories, cards } = data;
  // Förslag (utkast och avvisade) räknas inte som kursens kort förrän de godkänts.
  const courseCards = cards.filter((c) => c.review_status === null);
  const cardCount = courseCards.length;
  const inactiveCount = courseCards.filter((c) => !c.is_active).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="anim-fade-up flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{deck.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted" data-testid="deck-meta">
            {deck.course_code ? <Badge tone="outline">{deck.course_code}</Badge> : null}
            <span>
              {[sv.admin.cardCount(cardCount), inactiveCount > 0 ? sv.admin.inactiveCount(inactiveCount) : null, sv.admin.categoryCount(categories.length)]
                .filter(Boolean)
                .join(", ")}
            </span>
            <Badge tone={deck.is_published ? "accent" : "neutral"}>
              <span className={`h-1.5 w-1.5 rounded-full ${deck.is_published ? "bg-accent-ink" : "bg-muted"}`} aria-hidden="true" />
              {deck.is_published ? sv.admin.published : sv.admin.unpublished}
            </Badge>
          </p>
        </div>
        <LinkButton href={routes.deck(deck.slug)} variant="outline" size="sm">
          {sv.admin.viewDeck}
          <ArrowUpRight size={15} aria-hidden />
        </LinkButton>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
