"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Combine, Pencil, Plus, Trash2 } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { createCategoryAction, deleteCategoryAction, mergeCategoryAction, reorderCategoriesAction, updateCategoryAction } from "@/lib/admin/actions";
import type { CategoryRow } from "@/lib/supabase/database.types";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Toast } from "@/components/ui/Toast";
import { inputClass } from "@/components/ui/TextField";
import { cx } from "@/components/ui/cx";
import { SortableList, rowActionClass } from "./SortableList";
import { routes } from "@/lib/routes";

/**
 * total och inactive räknar granskade kort, drafts utkast som väntar på granskning och
 * all alla kort i området (även avvisade förslag), det som flyttas vid en sammanslagning.
 */
export type CategoryCounts = { total: number; inactive: number; drafts: number; all: number };

type Props = {
  deckId: string;
  categories: CategoryRow[];
  counts: Record<string, CategoryCounts>;
  uncategorized: CategoryCounts;
};

/**
 * Adminens ingång till innehållet: områdena i deckets ordning, med antal kort.
 * Klick på namnet öppnar områdets kortlista. Byt namn, slå ihop, ta bort och ordna om görs här.
 */
export function CategoryOverview({ deckId, categories, counts, uncategorized }: Props) {
  const { pending, error, handle } = useActionRunner();
  const [newTitle, setNewTitle] = useState("");
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [merging, setMerging] = useState<CategoryRow | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const colorIndex = categoryColorIndex(categories);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3" data-testid="admin-category-list">
      <p className="text-sm text-muted">{sv.admin.categoriesHelp}</p>
      {categories.length === 0 ? <p className="text-sm text-muted">{sv.admin.noCategoriesYet}</p> : null}
      <SortableList
        items={categories}
        label={sv.admin.categories}
        onReorder={(ids) => handle(reorderCategoriesAction(deckId, ids))}
        href={(c) => routes.admin.category(deckId, c.id)}
        hrefLabel={(c) => c.title}
        linkTestId="admin-category-link"
        renderItem={(c) => (
          <CategoryRowView
            category={c}
            colorIndex={colorIndex.get(c.id) ?? 0}
            counts={counts[c.id] ?? { total: 0, inactive: 0, drafts: 0, all: 0 }}
            pending={pending}
            onRename={(title) => handle(updateCategoryAction(c.id, deckId, title))}
            onMerge={categories.length > 1 ? () => setMerging(c) : undefined}
            onDelete={() => setDeleting(c)}
          />
        )}
      />
      {uncategorized.all > 0 ? (
        <Link
          href={routes.admin.category(deckId, "ingen")}
          className="group flex min-h-14 items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-2 transition-colors duration-150 hover:bg-surface-2"
        >
          <span className="font-semibold">{sv.admin.uncategorized}</span>
          <span className="text-sm text-muted">{countLabel(uncategorized)}</span>
          <ChevronRight size={17} aria-hidden className="ml-auto text-muted transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newTitle.trim()) return;
          handle(createCategoryAction(deckId, newTitle));
          setNewTitle("");
        }}
        className="mt-1 flex gap-2"
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={sv.admin.categoryTitle}
          aria-label={sv.admin.categoryTitle}
          className={cx(inputClass, "h-11")}
        />
        <Button type="submit" variant="secondary" disabled={pending || !newTitle.trim()} className="shrink-0">
          <Plus size={17} aria-hidden />
          {sv.admin.newCategory}
        </Button>
      </form>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <ConfirmDialog
        open={deleting !== null}
        title={sv.admin.deleteCategory}
        body={sv.admin.deleteCategoryConfirm}
        danger
        busy={pending}
        onConfirm={() => {
          if (deleting) handle(deleteCategoryAction(deleting.id, deckId));
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
      <MergeDialog
        from={merging}
        categories={categories}
        counts={counts}
        busy={pending}
        onCancel={() => setMerging(null)}
        onConfirm={(into) => {
          const from = merging;
          if (!from) return;
          handle(mergeCategoryAction(deckId, from.id, into.id), () => setToast({ id: Date.now(), text: sv.admin.mergeAreaDone(into.title) }));
          setMerging(null);
        }}
      />
      <Toast message={toast?.text ?? null} id={toast?.id} onClose={() => setToast(null)} duration={5000} />
    </div>
  );
}

/** Bekräftelsen för "Slå ihop med…": välj området korten flyttas till och se vad som händer. */
function MergeDialog({
  from,
  categories,
  counts,
  busy,
  onCancel,
  onConfirm,
}: {
  from: CategoryRow | null;
  categories: CategoryRow[];
  counts: Record<string, CategoryCounts>;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (into: CategoryRow) => void;
}) {
  const targets = categories.filter((c) => c.id !== from?.id);
  const [intoId, setIntoId] = useState("");
  const into = targets.find((c) => c.id === intoId) ?? targets[0] ?? null;
  const n = from ? (counts[from.id]?.all ?? 0) : 0;
  return (
    <Modal
      open={from !== null}
      onClose={onCancel}
      title={from ? sv.admin.mergeAreaTitle(from.title) : sv.admin.mergeArea}
      size="sm"
      locked={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {sv.common.cancel}
          </Button>
          <Button onClick={() => into && onConfirm(into)} disabled={busy || !into} data-testid="merge-area-confirm">
            {sv.admin.mergeAreaConfirm}
          </Button>
        </>
      }
    >
      {from && into ? (
        <div className="grid gap-4">
          <div>
            <label htmlFor="sla-ihop-med" className="mb-1.5 block text-sm font-semibold">
              {sv.admin.mergeAreaInto}
            </label>
            <Select id="sla-ihop-med" value={into.id} onChange={setIntoId} options={targets.map((c) => ({ value: c.id, label: c.title }))} />
          </div>
          <p className="text-muted">{sv.admin.mergeAreaBody(n, from.title, into.title)}</p>
        </div>
      ) : (
        <p className="text-muted">{sv.admin.mergeAreaNoTarget}</p>
      )}
    </Modal>
  );
}

function countLabel(c: CategoryCounts): string {
  const parts = [sv.admin.cardCount(c.total)];
  if (c.inactive > 0) parts.push(sv.admin.inactiveCount(c.inactive));
  if (c.drafts > 0) parts.push(sv.admin.draftCount(c.drafts));
  return parts.join(", ");
}

function CategoryRowView({
  category,
  colorIndex,
  counts,
  pending,
  onRename,
  onMerge,
  onDelete,
}: {
  category: CategoryRow;
  colorIndex: number;
  counts: CategoryCounts;
  pending: boolean;
  onRename: (title: string) => void;
  /** Saknas när det inte finns något annat område att slå ihop med. */
  onMerge?: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(category.title);

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && title.trim() !== category.title) onRename(title);
          setEditing(false);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label={sv.admin.categoryTitle}
          maxLength={200}
          className={cx(inputClass, "h-10")}
          autoFocus
        />
        <Button type="submit" size="sm" disabled={pending || !title.trim()} className="shrink-0">
          {sv.common.save}
        </Button>
        <button
          type="button"
          onClick={() => {
            setTitle(category.title);
            setEditing(false);
          }}
          className={rowActionClass}
        >
          {sv.common.cancel}
        </button>
      </form>
    );
  }

  return (
    <div className="flex min-h-9 items-center justify-between gap-2">
      {/* Smalt: namnet och antalen under varandra, så att inget trycks ihop bredvid knapparna. */}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-x-3">
        <CategoryTag title={category.title} colorIndex={colorIndex} size="md" className="min-w-0 max-w-full truncate" />
        <span className="text-sm text-muted sm:shrink-0 sm:whitespace-nowrap">{countLabel(counts)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={() => setEditing(true)} disabled={pending} aria-label={`${sv.admin.rename}: ${category.title}`} title={sv.admin.rename} className={rowActionClass}>
          <Pencil size={15} aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">{sv.admin.rename}</span>
        </button>
        {onMerge ? (
          <button type="button" onClick={onMerge} disabled={pending} aria-label={sv.admin.mergeAreaLabel(category.title)} title={sv.admin.mergeArea} className={rowActionClass}>
            <Combine size={15} aria-hidden className="sm:hidden" />
            <span className="hidden sm:inline">{sv.admin.mergeArea}</span>
          </button>
        ) : null}
        <button type="button" onClick={onDelete} disabled={pending} aria-label={`${sv.admin.deleteCategory}: ${category.title}`} title={sv.common.delete} className={rowActionClass}>
          <Trash2 size={15} aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">{sv.common.delete}</span>
        </button>
      </div>
    </div>
  );
}
