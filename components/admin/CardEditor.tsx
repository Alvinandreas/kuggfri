"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { saveCardAction } from "@/lib/admin/actions";
import type { CardRow } from "@/lib/supabase/database.types";
import { Markdown } from "@/components/markdown/Markdown";
import { Button, LinkButton } from "@/components/ui/Button";

const textareaClass = "w-full rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-sm text-fg";

type Props = {
  deckId: string;
  categories: { id: string; title: string }[];
  card?: CardRow;
};

/** Kortredigerare med live-förhandsvisning av markdown och KaTeX. */
export function CardEditor({ deckId, categories, card }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [hint, setHint] = useState(card?.hint ?? "");
  const [categoryId, setCategoryId] = useState(card?.category_id ?? "");
  const [isActive, setIsActive] = useState(card?.is_active ?? true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveCardAction({
        id: card?.id,
        deck_id: deckId,
        category_id: categoryId || null,
        front,
        back,
        hint,
        is_active: isActive,
      });
      if (result.ok) {
        setMessage({ ok: true, text: sv.admin.saved });
        if (!card) router.push(`/admin/deck/${deckId}/kort/${result.data.id}`);
        else router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <p className="text-sm text-muted">{sv.admin.markdownHelp}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span>{sv.admin.front}</span>
            <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={5} required className={textareaClass} data-testid="card-front" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>{sv.admin.back}</span>
            <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={12} required className={textareaClass} data-testid="card-back" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>{sv.admin.hint}</span>
            <input value={hint} onChange={(e) => setHint(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-fg" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span>{sv.admin.category}</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-10 rounded-md border border-line-strong bg-surface px-3 text-fg">
                <option value="">{sv.admin.noCategory}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              {sv.admin.active}
            </label>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <p className="text-sm font-medium">{sv.admin.preview}</p>
          <div className="rounded-lg border border-line bg-surface p-5" aria-label={`${sv.admin.preview}: ${sv.admin.front}`}>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">{sv.study.front}</p>
            <Markdown text={front || "…"} />
          </div>
          <div className="rounded-lg border border-line bg-surface p-5" aria-label={`${sv.admin.preview}: ${sv.admin.back}`}>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">{sv.study.back}</p>
            <Markdown text={back || "…"} />
          </div>
        </div>
      </div>

      {message ? (
        <p role="status" className={`text-sm ${message.ok ? "text-accent" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} data-testid="card-save">
          {pending ? sv.admin.saving : sv.common.save}
        </Button>
        <LinkButton href={`/admin/deck/${deckId}`} variant="secondary">
          {sv.common.back}
        </LinkButton>
      </div>
    </form>
  );
}
