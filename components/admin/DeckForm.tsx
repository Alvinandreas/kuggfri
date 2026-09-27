"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { deleteDeckAction, saveDeckAction, setDeckPublishedAction } from "@/lib/admin/actions";
import type { DeckRow } from "@/lib/supabase/database.types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";

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
        exam_date: String(fd.get("exam_date") ?? ""),
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
    <Card padding="lg">
      <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label={sv.admin.deckTitle} name="title" required maxLength={200} defaultValue={deck?.title ?? ""} data-testid="deck-title" />
          <TextField
            label={sv.admin.slug}
            hint={sv.admin.slugHelp}
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={deck?.slug ?? ""}
            data-testid="deck-slug"
          />
          <TextField label={sv.admin.courseCode} name="course_code" maxLength={50} defaultValue={deck?.course_code ?? ""} />
          <TextField
            label={sv.admin.examDate}
            hint={sv.admin.examDateHelp}
            name="exam_date"
            type="date"
            defaultValue={deck?.exam_date ?? ""}
            data-testid="deck-exam-date"
          />
        </div>
        <TextArea label={sv.admin.description} name="description" rows={2} maxLength={2000} defaultValue={deck?.description ?? ""} />
        <TextArea label={sv.admin.sourceCredit} name="source_credit" rows={3} maxLength={2000} defaultValue={deck?.source_credit ?? ""} />

        {message ? (
          <p role="status" className={`text-sm font-medium ${message.ok ? "text-accent" : "text-danger"}`}>
            {message.text}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <Button type="submit" disabled={pending} data-testid="deck-save">
            {pending ? sv.admin.saving : sv.common.save}
          </Button>
          {deck ? (
            <>
              <Button type="button" variant="secondary" onClick={togglePublish} disabled={pending} data-testid="deck-publish">
                {published ? sv.admin.unpublish : sv.admin.publish}
              </Button>
              <Badge tone={published ? "accent" : "neutral"} className="ml-1">
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${published ? "bg-accent-ink" : "bg-muted"}`} />
                {published ? sv.admin.published : sv.admin.unpublished}
              </Badge>
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
    </Card>
  );
}
