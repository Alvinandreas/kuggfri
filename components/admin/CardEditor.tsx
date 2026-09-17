"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { saveCardAction } from "@/lib/admin/actions";
import type { CardRow } from "@/lib/supabase/database.types";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { Markdown } from "@/components/markdown/Markdown";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Button, LinkButton } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

const textareaClass = "w-full rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-sm text-fg";

type Props = {
  deckId: string;
  categories: { id: string; title: string }[];
  card?: CardRow;
  /** Förvald kategori för ett nytt kort (från kategorisidan). */
  initialCategoryId?: string | null;
  /** Dit "Tillbaka" och "Spara och stäng" leder. */
  backHref?: string;
};

/** Kortredigerare med live-förhandsvisning av markdown och KaTeX. */
export function CardEditor({ deckId, categories, card, initialCategoryId = null, backHref }: Props) {
  const closeHref = backHref ?? `/admin/deck/${deckId}/innehall`;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [hint, setHint] = useState(card?.hint ?? "");
  const [categoryId, setCategoryId] = useState(card?.category_id ?? initialCategoryId ?? "");
  const [closeAfter, setCloseAfter] = useState(false);
  const colorIndex = categoryColorIndex(categories);
  const previewCategory = categories.find((c) => c.id === categoryId) ?? null;
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
        if (closeAfter) router.push(closeHref);
        else if (!card) router.push(`/admin/deck/${deckId}/kort/${result.data.id}`);
        else router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <p className="text-sm text-muted">{sv.admin.markdownHelp}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
            <span>{sv.admin.front}</span>
            <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={5} required maxLength={5000} className={textareaClass} data-testid="card-front" />
          </label>
          <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
            <span>{sv.admin.back}</span>
            <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={12} required maxLength={20000} className={textareaClass} data-testid="card-back" />
          </label>
          <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
            <span>{sv.admin.hint}</span>
            <input value={hint} onChange={(e) => setHint(e.target.value)} maxLength={500} className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-fg" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
              <span>{sv.admin.category}</span>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">{sv.admin.noCategory}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              {sv.admin.active}
            </label>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4 lg:sticky lg:top-4 lg:self-start">
          <div>
            <p className="text-sm font-medium">{sv.admin.preview}</p>
            <p className="text-xs text-muted">{sv.admin.previewHelp}</p>
          </div>
          {[
            { label: sv.study.front, text: front, key: "front" },
            { label: sv.study.back, text: back, key: "back" },
          ].map((side) => (
            <div
              key={side.key}
              className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6"
              aria-label={`${sv.admin.preview}: ${side.label}`}
              data-testid={`preview-${side.key}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                {previewCategory ? (
                  <CategoryTag title={previewCategory.title} colorIndex={colorIndex.get(previewCategory.id) ?? 0} size="md" />
                ) : (
                  <span className="text-xs text-muted">{sv.admin.noCategory}</span>
                )}
                <span className="text-xs uppercase tracking-wide text-muted">{side.label}</span>
              </div>
              <Markdown text={side.text || "…"} variant="card" />
              {side.key === "front" && hint.trim() ? (
                <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">
                  {sv.study.hint}: {hint}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {message ? (
        <p role="status" className={`text-sm ${message.ok ? "text-accent" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} data-testid="card-save" onClick={() => setCloseAfter(false)}>
          {pending ? sv.admin.saving : sv.common.save}
        </Button>
        <Button type="submit" variant="secondary" disabled={pending} data-testid="card-save-close" onClick={() => setCloseAfter(true)}>
          {sv.admin.saveAndClose}
        </Button>
        <LinkButton href={closeHref} variant="ghost">
          {sv.common.back}
        </LinkButton>
      </div>
    </form>
  );
}
