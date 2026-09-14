"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { createCategoryAction, deleteCategoryAction, reorderCategoriesAction, updateCategoryAction } from "@/lib/admin/actions";
import type { CategoryRow } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SortableList } from "./SortableList";

const inputClass = "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-fg";

export function CategoryManager({ deckId, categories }: { deckId: string; categories: CategoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

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
    <div className="grid gap-3">
      <p className="text-sm text-muted">{sv.admin.reorderHelp}</p>
      <SortableList
        items={categories}
        label={sv.admin.categories}
        onReorder={(ids) => handle(reorderCategoriesAction(deckId, ids))}
        renderItem={(c) => (
          <CategoryRowEditor
            category={c}
            pending={pending}
            onSave={(title) => handle(updateCategoryAction(c.id, deckId, title))}
            onDelete={() => setDeleting(c)}
          />
        )}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newTitle.trim()) return;
          handle(createCategoryAction(deckId, newTitle));
          setNewTitle("");
        }}
        className="flex gap-2"
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={sv.admin.categoryTitle}
          aria-label={sv.admin.categoryTitle}
          className={inputClass}
        />
        <Button type="submit" variant="secondary" size="sm" disabled={pending || !newTitle.trim()}>
          {sv.admin.newCategory}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-danger">
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

function CategoryRowEditor({
  category,
  pending,
  onSave,
  onDelete,
}: {
  category: CategoryRow;
  pending: boolean;
  onSave: (title: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(category.title);
  const dirty = title.trim() !== category.title;
  return (
    <div className="flex items-center gap-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label={sv.admin.categoryTitle} className={inputClass} />
      <Button variant="secondary" size="sm" disabled={!dirty || pending} onClick={() => onSave(title)} className="shrink-0 whitespace-nowrap">
        {sv.common.save}
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending} aria-label={`${sv.admin.deleteCategory}: ${category.title}`} className="shrink-0 whitespace-nowrap">
        {sv.common.delete}
      </Button>
    </div>
  );
}
