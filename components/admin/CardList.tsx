"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { deleteCardAction, reorderCardsAction } from "@/lib/admin/actions";
import type { CardRow, CategoryRow } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SortableList } from "./SortableList";

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? text;
  return line.replace(/^[#*\-\s]+/, "").trim();
}

export function CardList({ deckId, cards, categories }: { deckId: string; cards: CardRow[]; categories: CategoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CardRow | null>(null);
  const categoryTitle = new Map(categories.map((c) => [c.id, c.title] as const));

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
    <div className="grid gap-3" data-testid="admin-card-list">
      <p className="text-sm text-muted">{sv.admin.reorderHelp}</p>
      <SortableList
        items={cards}
        label={sv.admin.cards}
        onReorder={(ids) => handle(reorderCardsAction(deckId, ids))}
        renderItem={(card) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/admin/deck/${deckId}/kort/${card.id}`} className="block truncate font-medium hover:underline" data-testid="admin-card-front">
                {firstLine(card.front)}
              </Link>
              <p className="truncate text-xs text-muted">
                {card.category_id ? (categoryTitle.get(card.category_id) ?? sv.admin.noCategory) : sv.admin.noCategory}
                {card.is_active ? "" : ` · ${sv.admin.inactive}`}
                {card.hint ? ` · ${sv.study.hint}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(card)} disabled={pending} aria-label={`${sv.admin.deleteCard}: ${firstLine(card.front)}`}>
              {sv.common.delete}
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
