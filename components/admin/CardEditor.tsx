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
import { Card } from "@/components/ui/Card";
import { CheckboxField } from "@/components/ui/Choice";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";

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
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card padding="lg" className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <p className="text-sm text-muted">{sv.admin.markdownHelp}</p>
          <TextArea
            label={sv.admin.front}
            mono
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={5}
            required
            maxLength={5000}
            data-testid="card-front"
          />
          <TextArea
            label={sv.admin.back}
            mono
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={12}
            required
            maxLength={20000}
            data-testid="card-back"
          />
          <TextField label={sv.admin.hint} value={hint} onChange={(e) => setHint(e.target.value)} maxLength={500} />
          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <div>
              <label htmlFor="kort-kategori" className="mb-1.5 block text-sm font-semibold">
                {sv.admin.category}
              </label>
              <Select
                id="kort-kategori"
                label={sv.admin.category}
                value={categoryId}
                onChange={setCategoryId}
                options={[{ value: "", label: sv.admin.noCategory }, ...categories.map((c) => ({ value: c.id, label: c.title }))]}
              />
            </div>
            <div className="flex min-h-12 items-center">
              <CheckboxField label={sv.admin.active} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4 lg:sticky lg:top-6">
          <div>
            <p className="text-sm font-semibold text-subtle">{sv.admin.preview}</p>
            <p className="text-sm text-muted">{sv.admin.previewHelp}</p>
          </div>
          {/* Samma form som studentens kort: ytan, kategoritaggen och sidans namn överst. */}
          {[
            { label: sv.study.front, text: front, key: "front" },
            { label: sv.study.back, text: back, key: "back" },
          ].map((side) => (
            <section
              key={side.key}
              className={`flex min-h-48 flex-col rounded-lg border bg-surface p-5 shadow-card sm:p-7 ${side.key === "back" ? "border-accent/40" : "border-line"}`}
              aria-label={`${sv.admin.preview}: ${side.label}`}
              data-testid={`preview-${side.key}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                {previewCategory ? (
                  <CategoryTag title={previewCategory.title} colorIndex={colorIndex.get(previewCategory.id) ?? 0} size="lg" />
                ) : (
                  <span className="text-xs text-muted">{sv.admin.noCategory}</span>
                )}
                <span className="shrink-0 text-xs uppercase tracking-wide text-muted">{side.label}</span>
              </div>
              <div className={`flex flex-1 py-2 ${side.key === "front" ? "text-center" : ""}`}>
                <Markdown text={side.text || "…"} variant="card" className="m-auto w-full" />
              </div>
              {side.key === "front" && hint.trim() ? (
                <p className="mt-4 border-t border-line pt-3 text-center text-sm">
                  <span className="font-medium text-muted">{sv.study.hint}: </span>
                  {hint}
                </p>
              ) : null}
            </section>
          ))}
        </div>
      </div>

      {message ? (
        <p role="status" className={`text-sm font-medium ${message.ok ? "text-accent" : "text-danger"}`}>
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
