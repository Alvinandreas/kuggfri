"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { firstLine } from "@/lib/text/first-line";
import { deleteCardAction, reorderCardsAction } from "@/lib/admin/actions";
import type { CardRow } from "@/lib/supabase/database.types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SortableList, rowActionClass } from "./SortableList";

export function CardList({ deckId, cards }: { deckId: string; cards: CardRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CardRow | null>(null);

  function handle(promise: Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await promise;
      if (!result.ok) setError(result.error ?? sv.errors.generic);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  if (cards.length === 0)
    return (
      <Card padding="lg" className="text-muted">
        {sv.admin.noCardsInCategory}
      </Card>
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3" data-testid="admin-card-list">
      <SortableList
        items={cards}
        label={sv.admin.cards}
        onReorder={(ids) => handle(reorderCardsAction(deckId, ids))}
        href={(card) => `/admin/deck/${deckId}/kort/${card.id}`}
        hrefLabel={(card) => firstLine(card.front)}
        linkTestId="admin-card-front"
        renderItem={(card) => (
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{firstLine(card.front)}</p>
              <p className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-muted">
                {card.is_active ? null : <Badge tone="outline">{sv.admin.inactive}</Badge>}
                <span className="truncate">
                  {firstLine(card.back)}
                  {card.hint ? ` · ${sv.study.hint}` : ""}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleting(card)}
              disabled={pending}
              aria-label={`${sv.admin.deleteCard}: ${firstLine(card.front)}`}
              title={sv.common.delete}
              className={rowActionClass}
            >
              <Trash2 size={15} aria-hidden className="sm:hidden" />
              <span className="hidden sm:inline">{sv.common.delete}</span>
            </button>
          </div>
        )}
      />
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        title={sv.admin.deleteCard}
        body={sv.admin.deleteCardConfirm}
        danger
        busy={pending}
        onConfirm={() => {
          if (deleting) handle(deleteCardAction(deleting.id, deckId));
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
