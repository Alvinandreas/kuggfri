"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { deleteDeckAction, saveDeckAction, setDeckPublishedAction } from "@/lib/admin/actions";
import type { DeckRow } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const inputClass = "h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-fg";
const textareaClass = "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-fg";

export function DeckForm({ deck, canDelete = true }: { deck?: DeckRow; canDelete?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [published, setPublished] = useState(deck?.is_published ?? false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveDeckAction({
        id: deck?.id,
        slug: String(fd.get("slug") ?? ""),
        title: String(fd.get("title") ?? ""),
        description: String(fd.get("description") ?? ""),
        course_code: String(fd.get("course_code") ?? ""),
        source_credit: String(fd.get("source_credit") ?? ""),
      });
      if (result.ok) {
        setMessage({ ok: true, text: sv.admin.saved });
        if (!deck) router.push(`/admin/deck/${result.data.id}`);
        else router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  function setPublishedTo(next: boolean) {
    if (!deck) return;
    startTransition(async () => {
      const result = await setDeckPublishedAction(deck.id, next);
      if (result.ok) {
        setPublished(next);
        setMessage({ ok: true, text: next ? sv.admin.publishedNow : sv.admin.unpublishedNow });
        router.refresh();
      } else setMessage({ ok: false, text: result.error });
      setConfirmUnpublish(false);
    });
  }

  function togglePublish() {
    if (!deck) return;
    if (published) setConfirmUnpublish(true);
    else setPublishedTo(true);
  }

  function onDelete() {
    if (!deck) return;
    startTransition(async () => {
      const result = await deleteDeckAction(deck.id);
      if (result.ok) router.push("/admin/deck");
      else setMessage({ ok: false, text: result.error });
      setConfirmDelete(false);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
          <span>{sv.admin.deckTitle}</span>
          <input name="title" required defaultValue={deck?.title ?? ""} className={inputClass} data-testid="deck-title" />
        </label>
        <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
          <span>{sv.admin.slug}</span>
          <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={deck?.slug ?? ""} className={inputClass} data-testid="deck-slug" />
          <span className="text-xs text-muted">{sv.admin.slugHelp}</span>
        </label>
        <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
          <span>{sv.admin.courseCode}</span>
          <input name="course_code" defaultValue={deck?.course_code ?? ""} className={inputClass} />
        </label>
      </div>
      <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
        <span>{sv.admin.description}</span>
        <textarea name="description" rows={2} defaultValue={deck?.description ?? ""} className={textareaClass} />
      </label>
      <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
        <span>{sv.admin.sourceCredit}</span>
        <textarea name="source_credit" rows={3} defaultValue={deck?.source_credit ?? ""} className={textareaClass} />
      </label>

      {message ? (
        <p role="status" className={`text-sm ${message.ok ? "text-accent" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending} data-testid="deck-save">
          {pending ? sv.admin.saving : sv.common.save}
        </Button>
        {deck ? (
          <>
            <Button type="button" variant="secondary" onClick={togglePublish} disabled={pending} data-testid="deck-publish">
              {published ? sv.admin.unpublish : sv.admin.publish}
            </Button>
            <span className={`text-sm ${published ? "text-accent" : "text-muted"}`}>{published ? sv.admin.published : sv.admin.unpublished}</span>
            <span className="flex-1" />
            {canDelete ? (
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDelete(true)} disabled={pending}>
                {sv.admin.deleteDeck}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {deck ? (
        <>
          <ConfirmDialog
            open={confirmDelete}
            title={sv.admin.deleteDeck}
            body={sv.admin.deleteDeckConfirm(deck.title)}
            danger
            requireWord={deck.title}
            requireWordLabel={sv.admin.deleteDeckWord(deck.title)}
            busy={pending}
            onConfirm={onDelete}
            onCancel={() => setConfirmDelete(false)}
          />
          <ConfirmDialog
            open={confirmUnpublish}
            title={sv.admin.unpublishTitle}
            body={sv.admin.unpublishConfirm}
            confirmLabel={sv.admin.unpublish}
            danger
            busy={pending}
            onConfirm={() => setPublishedTo(false)}
            onCancel={() => setConfirmUnpublish(false)}
          />
        </>
      ) : null}
    </form>
  );
}
