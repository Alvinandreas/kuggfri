"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { deleteCardAction, reorderCardsAction } from "@/lib/admin/actions";
import type { CardRow } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SortableList } from "./SortableList";

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? text;
  return line.replace(/^[#*\-\s]+/, "").trim();
}

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

  if (cards.length === 0) return <p className="text-muted">{sv.admin.importNothing}</p>;

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
              <p className="truncate font-medium">{firstLine(card.front)}</p>
              <p className="truncate text-xs text-muted">
                {card.is_active ? "" : `${sv.admin.inactive} · `}
                {firstLine(card.back)}
                {card.hint ? ` · ${sv.study.hint}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(card)} disabled={pending} aria-label={`${sv.admin.deleteCard}: ${firstLine(card.front)}`} title={sv.common.delete} className="shrink-0 whitespace-nowrap">
              <span className="hidden sm:inline">{sv.common.delete}</span>
              <span className="sm:hidden" aria-hidden="true">
                ✕
              </span>
            </Button>
          </div>
        )}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
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
