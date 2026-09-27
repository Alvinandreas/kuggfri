"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { createCategoryAction, deleteCategoryAction, reorderCategoriesAction, updateCategoryAction } from "@/lib/admin/actions";
import type { CategoryRow } from "@/lib/supabase/database.types";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { inputClass } from "@/components/ui/TextField";
import { cx } from "@/components/ui/cx";
import { SortableList, rowActionClass } from "./SortableList";

export type CategoryCounts = { total: number; inactive: number };

type Props = {
  deckId: string;
  categories: CategoryRow[];
  counts: Record<string, CategoryCounts>;
  uncategorized: CategoryCounts;
};

/**
 * Adminens ingång till innehållet: kategorierna i deckets ordning, med antal kort.
 * Klick på namnet öppnar kategorins kortlista. Byt namn, ta bort och ordna om görs här.
 */
export function CategoryOverview({ deckId, categories, counts, uncategorized }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const colorIndex = categoryColorIndex(categories);

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

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3" data-testid="admin-category-list">
      <p className="text-sm text-muted">{sv.admin.categoriesHelp}</p>
      {categories.length === 0 ? <p className="text-sm text-muted">{sv.admin.noCategoriesYet}</p> : null}
      <SortableList
        items={categories}
        label={sv.admin.categories}
        onReorder={(ids) => handle(reorderCategoriesAction(deckId, ids))}
        href={(c) => `/admin/deck/${deckId}/kategori/${c.id}`}
        hrefLabel={(c) => c.title}
        linkTestId="admin-category-link"
        renderItem={(c) => (
          <CategoryRowView
            category={c}
            colorIndex={colorIndex.get(c.id) ?? 0}
            counts={counts[c.id] ?? { total: 0, inactive: 0 }}
            pending={pending}
            onRename={(title) => handle(updateCategoryAction(c.id, deckId, title))}
            onDelete={() => setDeleting(c)}
          />
        )}
      />
      {uncategorized.total > 0 ? (
        <Link
          href={`/admin/deck/${deckId}/kategori/ingen`}
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
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
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
    </div>
  );
}

function countLabel(c: CategoryCounts): string {
  const base = sv.admin.cardCount(c.total);
  return c.inactive > 0 ? `${base} · ${sv.admin.inactiveCount(c.inactive)}` : base;
}

function CategoryRowView({
  category,
  colorIndex,
  counts,
  pending,
  onRename,
  onDelete,
}: {
  category: CategoryRow;
  colorIndex: number;
  counts: CategoryCounts;
  pending: boolean;
  onRename: (title: string) => void;
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
      <div className="flex min-w-0 flex-1 items-center gap-x-3">
        <CategoryTag title={category.title} colorIndex={colorIndex} size="md" className="min-w-0 truncate" />
        <span className="shrink-0 whitespace-nowrap text-sm text-muted">{countLabel(counts)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={() => setEditing(true)} disabled={pending} aria-label={`${sv.admin.rename}: ${category.title}`} title={sv.admin.rename} className={rowActionClass}>
          <Pencil size={15} aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">{sv.admin.rename}</span>
        </button>
        <button type="button" onClick={onDelete} disabled={pending} aria-label={`${sv.admin.deleteCategory}: ${category.title}`} title={sv.common.delete} className={rowActionClass}>
          <Trash2 size={15} aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">{sv.common.delete}</span>
        </button>
      </div>
    </div>
  );
}
