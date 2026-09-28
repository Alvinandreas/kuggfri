import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { getCardForAdmin, getDeckForAdmin } from "@/lib/admin/queries";
import { getCardHistory } from "@/lib/admin/history-queries";
import { CardEditPanel } from "@/components/admin/CardEditPanel";
import { OriginalBadge } from "@/components/admin/KindBadge";
import { SourceList } from "@/components/admin/SourceBadges";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: sv.admin.editCard };

export default async function EditCardPage({ params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { id, cardId } = await params;
  const [data, card] = await Promise.all([getDeckForAdmin(id), getCardForAdmin(cardId)]);
  if (!data || !card || card.deck_id !== data.deck.id) notFound();
  const versions = await getCardHistory(data.deck.id, card.id).catch(() => []);
  const category = card.category_id ? (data.categories.find((c) => c.id === card.category_id) ?? null) : null;
  const backHref = `/admin/deck/${data.deck.id}/kategori/${category ? category.id : "ingen"}`;
  const siblings = data.cards.filter((c) => c.category_id === card.category_id);
  const index = siblings.findIndex((c) => c.id === card.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <nav aria-label={sv.admin.breadcrumb} className="flex min-w-0 items-center gap-1 text-sm text-muted">
        <Link href={`/admin/deck/${data.deck.id}/innehall`} className="inline-flex min-h-8 items-center gap-1 rounded-full font-semibold hover:text-fg">
          {sv.admin.tabContent}
        </Link>
        <ChevronRight size={15} aria-hidden className="shrink-0 text-subtle" />
        <Link href={backHref} className="flex min-h-8 min-w-0 items-center rounded-full font-semibold hover:text-fg">
          <span className="truncate">{category ? category.title : sv.admin.uncategorized}</span>
        </Link>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">
            {sv.admin.editCard}
            {index >= 0 ? <span className="ml-2 text-base font-medium tracking-normal text-muted">{sv.admin.cardPosition(index + 1, siblings.length)}</span> : null}
          </h2>
          {card.original ? <OriginalBadge /> : null}
        </div>
        <div className="flex gap-2">
          {prev ? (
            <LinkButton href={`/admin/deck/${data.deck.id}/kort/${prev.id}`} variant="outline" size="sm">
              <ArrowLeft size={15} aria-hidden />
              {sv.admin.prevCard}
            </LinkButton>
          ) : null}
          {next ? (
            <LinkButton href={`/admin/deck/${data.deck.id}/kort/${next.id}`} variant="outline" size="sm">
              {sv.admin.nextCard}
              <ArrowRight size={15} aria-hidden />
            </LinkButton>
          ) : null}
        </div>
      </div>
      <Card padding="md" data-testid="card-sources">
        <CardHeader title={sv.admin.sourcesTitle} as="h3" spacing="sm" />
        <SourceList source={card.source} original={card.original} />
      </Card>
      <CardEditPanel
        deckId={data.deck.id}
        categories={data.categories.map((c) => ({ id: c.id, title: c.title }))}
        card={card}
        backHref={backHref}
        versions={versions}
        now={Date.now()}
      />
    </div>
  );
}
