"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, FolderInput, Trash2 } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { firstLine } from "@/lib/text/first-line";
import { deleteCardAction, moveCardsToCategoryAction, reorderCardsAction } from "@/lib/admin/actions";
import { mergeSubsetOrder } from "@/lib/admin/card-form";
import { SOURCE_TAGS, SOURCE_TAG_LABEL, countBySourceTag, matchesSource, type SourceFilter } from "@/lib/admin/sources";
import type { CardRow } from "@/lib/supabase/database.types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { Toast } from "@/components/ui/Toast";
import { KindBadge, ReviewStatusBadge } from "./KindBadge";
import { SourceBadges } from "./SourceBadges";
import { SortableList, rowActionClass } from "./SortableList";

type Props = {
  deckId: string;
  cards: CardRow[];
  /** Alla områden i decket, för "Flytta till område". */
  categories?: { id: string; title: string }[];
  /** Området som listan visar (null = utan område); det väljs inte som mål. */
  currentCategoryId?: string | null;
};

export function CardList({ deckId, cards, categories = [], currentCategoryId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CardRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [source, setSource] = useState<SourceFilter>("alla");
  const sourceCounts = useMemo(() => countBySourceTag(cards), [cards]);
  const shown = useMemo(() => cards.filter((c) => matchesSource(c, source)), [cards, source]);

  // Markeringen gäller bara kort som fortfarande finns i listan (efter flytt eller borttagning).
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(cards.map((c) => c.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [cards]);

  function handle(promise: Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    startTransition(async () => {
      const result = await promise;
      if (!result.ok) setError(result.error ?? sv.errors.generic);
      else {
        setError(null);
        onOk?.();
        router.refresh();
      }
    });
  }

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function moveTo(categoryId: string | null, title: string) {
    const ids = [...selected];
    handle(moveCardsToCategoryAction(deckId, ids, categoryId), () => {
      setSelected(new Set());
      setToast({ id: Date.now(), text: sv.admin.cardsMoved(ids.length, title) });
    });
  }

  if (cards.length === 0)
    return (
      <Card padding="lg" className="text-muted">
        {sv.admin.noCardsInCategory}
      </Card>
    );

  const allSelected = shown.length > 0 && shown.every((c) => selected.has(c.id));
  const sourceOptions = SOURCE_TAGS.filter((t) => sourceCounts[t] > 0 || t === source);
  const targets = categories.filter((c) => c.id !== currentCategoryId);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3" data-testid="admin-card-list">
      <div className="flex min-h-10 flex-wrap items-center gap-2 text-sm" data-testid="card-selection-bar">
        <label
          className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full px-2 font-semibold text-muted hover:text-fg"
          ref={(el) => {
            // Delvis markerad lista: kryssrutan visar ett streck (indeterminate finns bara som egenskap).
            const input = el?.querySelector("input");
            if (input) input.indeterminate = selected.size > 0 && !allSelected;
          }}
        >
          <Checkbox checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((c) => c.id)) : new Set())} />
          {selected.size > 0 ? sv.admin.selectedCount(selected.size) : sv.admin.selectAll}
        </label>
        {selected.size > 0 ? (
          <>
            <Menu
              label={sv.admin.moveToArea}
              width="18rem"
              trigger={(props) => (
                <Button {...props} variant="secondary" size="sm" disabled={pending} data-testid="move-to-area">
                  <FolderInput size={15} aria-hidden />
                  {sv.admin.moveToArea}
                  <ChevronDown size={14} aria-hidden />
                </Button>
              )}
            >
              {targets.map((c) => (
                <MenuItem key={c.id} onSelect={() => moveTo(c.id, c.title)}>
                  {c.title}
                </MenuItem>
              ))}
              {currentCategoryId !== null ? (
                <>
                  {targets.length > 0 ? <MenuSeparator /> : null}
                  <MenuItem onSelect={() => moveTo(null, sv.admin.uncategorized)}>{sv.admin.uncategorized}</MenuItem>
                </>
              ) : null}
            </Menu>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              {sv.admin.clearSelection}
            </Button>
          </>
        ) : null}
        {sourceOptions.length > 1 || source !== "alla" ? (
          <Select<SourceFilter>
            size="sm"
            fit
            label={sv.admin.sourceFilter}
            value={source}
            onChange={setSource}
            options={[{ value: "alla", label: `${sv.admin.sourceAll} (${cards.length})` }, ...sourceOptions.map((t) => ({ value: t, label: `${SOURCE_TAG_LABEL[t]} (${sourceCounts[t]})` }))]}
            className="ml-auto min-w-44"
            data-testid="card-source-filter"
          />
        ) : null}
      </div>

      <SortableList
        items={shown}
        label={sv.admin.cards}
        onReorder={(ids) => handle(reorderCardsAction(deckId, source === "alla" ? ids : mergeSubsetOrder(cards.map((c) => c.id), ids)))}
        href={(card) => `/admin/deck/${deckId}/kort/${card.id}`}
        hrefLabel={(card) => firstLine(card.front)}
        linkTestId="admin-card-front"
        renderItem={(card) => (
          <div className="flex min-w-0 items-center justify-between gap-3">
            <Checkbox
              checked={selected.has(card.id)}
              onChange={(e) => toggle(card.id, e.target.checked)}
              aria-label={sv.admin.selectCard(firstLine(card.front))}
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{firstLine(card.front)}</p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted">
                <KindBadge kind={card.kind} compact />
                <ReviewStatusBadge status={card.review_status} />
                <SourceBadges source={card.source} original={card.original} max={2} className="shrink-0 flex-nowrap max-sm:hidden" />
                {card.is_active || card.review_status ? null : <Badge tone="outline">{sv.admin.inactive}</Badge>}
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
      <Toast message={toast?.text ?? null} id={toast?.id} onClose={() => setToast(null)} duration={5000} />
    </div>
  );
}
