"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { saveCardAction } from "@/lib/admin/actions";
import { fixErrorsMessage, savedCardFields } from "@/lib/admin/card-form";
import { LIMITS } from "@/lib/admin/limits";
import type { CardKind } from "@/lib/cards/kinds";
import type { CardRow } from "@/lib/supabase/database.types";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxField } from "@/components/ui/Choice";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/cx";
import { CardPreview } from "./CardPreview";
import { IssueList, KindSelect, TrueFalseField } from "./KindFields";
import { ReviewStatusBadge } from "./KindBadge";
import { OptionsEditor } from "./OptionsEditor";
import { useCardForm } from "./useCardForm";
import { routes } from "@/lib/routes";

/** Det som sparades, så att en inbäddad redigerare (granskningen) kan uppdatera sin lista. */
export type SavedCard = Pick<CardRow, "id" | "category_id" | "front" | "back" | "hint" | "kind" | "options" | "source" | "is_active">;

/** Det redigeraren läser från ett befintligt kort. */
export type EditableCard = SavedCard & Pick<CardRow, "review_status">;

type Props = {
  deckId: string;
  categories: { id: string; title: string }[];
  card?: EditableCard;
  /** Förvalt område för ett nytt kort (från områdessidan). */
  initialCategoryId?: string | null;
  /** Dit "Tillbaka" och "Spara och stäng" leder. */
  backHref?: string;
  /**
   * Inbäddat läge (granskningen): ingen navigering, knapparna blir Spara och Avbryt,
   * och den som bäddar in får veta vad som sparades.
   */
  onSaved?: (card: SavedCard) => void;
  onCancel?: () => void;
  /** Starta med en annan typ än kortets (granskningen byter typ via redigeraren). */
  initialKind?: CardKind;
  /**
   * Inbäddad yta (granskningen): förhandsvisningen hamnar bredvid formuläret när ytan själv är
   * bred nog (containerfråga), annars under det.
   */
  stacked?: boolean;
};

/** Kortredigerare med uppgiftstyp, svarsalternativ och live-förhandsvisning (markdown och KaTeX). */
export function CardEditor({ deckId, categories, card, initialCategoryId = null, backHref, onSaved, onCancel, initialKind, stacked = false }: Props) {
  const inline = onSaved !== undefined;
  const closeHref = backHref ?? routes.admin.content(deckId);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const { form, setFront, setBack, setHint, setKind, setAlternatives, setTrueFalse, options, auto, kindIssues: issues } = useCardForm(card, initialKind);
  const { front, back, hint, kind, alternatives, trueFalse } = form;
  const [source, setSource] = useState(card?.source ?? "");
  const [categoryId, setCategoryId] = useState(card?.category_id ?? initialCategoryId ?? "");
  const [isActive, setIsActive] = useState(card?.is_active ?? true);
  const [closeAfter, setCloseAfter] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const colorIndex = categoryColorIndex(categories);
  const previewCategory = categories.find((c) => c.id === categoryId) ?? null;
  const reviewStatus = card?.review_status ?? null;
  const frontLabel = kind === "sant-falskt" ? sv.admin.statement : kind === "begrepp" ? sv.admin.concept : kind === "alternativ" ? sv.admin.question : sv.admin.front;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (issues.length > 0) {
      setMessage({ ok: false, text: fixErrorsMessage(issues) });
      return;
    }
    startTransition(async () => {
      const result = await saveCardAction({
        id: card?.id,
        deck_id: deckId,
        category_id: categoryId || null,
        front,
        back,
        hint,
        is_active: isActive,
        kind,
        options,
        source,
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setMessage({ ok: true, text: sv.admin.saved });
      if (inline) {
        onSaved({
          id: result.data.id,
          category_id: categoryId || null,
          ...savedCardFields(form),
          source: source.trim() || null,
          is_active: reviewStatus ? false : isActive,
        });
      } else if (closeAfter) router.push(closeHref);
      else if (!card) router.push(routes.admin.card(deckId, result.data.id));
      else router.refresh();
    });
  }

  function onFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    // Ctrl/Cmd+Enter sparar var man än står i formuläret; Esc avbryter i inbäddat läge.
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    } else if (e.key === "Escape" && inline && onCancel) {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} onKeyDown={onFormKeyDown} className={cx("grid grid-cols-[minmax(0,1fr)] gap-6", stacked && "@container")} data-testid="card-editor">
      <div className={cx("grid gap-6", stacked ? "@4xl:grid-cols-2 @4xl:items-start" : "lg:grid-cols-2 lg:items-start")}>
        <Card padding="lg" className="grid grid-cols-[minmax(0,1fr)] gap-5">
          {reviewStatus || !card ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-4 py-3 text-sm text-muted" data-testid="card-review-notice">
              <ReviewStatusBadge status={reviewStatus ?? "utkast"} />
              <span>{!card ? sv.admin.newCardNotice : reviewStatus === "utkast" ? sv.admin.draftNotice : sv.admin.rejectedNotice}</span>
            </div>
          ) : null}

          <KindSelect id="kort-typ" label={sv.admin.kind} value={kind} onChange={setKind} data-testid="card-kind" />

          <p className="text-sm text-muted">{sv.admin.markdownHelp}</p>
          <TextArea
            label={frontLabel}
            mono
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={auto ? 4 : 5}
            required
            autoFocus={inline}
            maxLength={LIMITS.front}
            data-testid="card-front"
          />

          {kind === "sant-falskt" ? <TrueFalseField name="sant-falskt" legend={sv.admin.trueFalseLabel} value={trueFalse} onChange={setTrueFalse} /> : null}

          {kind === "alternativ" ? <OptionsEditor items={alternatives} onChange={setAlternatives} /> : null}

          {attempted && issues.length > 0 ? <IssueList issues={issues} /> : null}

          <TextArea
            label={auto ? sv.admin.explanation : sv.admin.back}
            hint={auto ? sv.admin.explanationHelp : undefined}
            mono
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={auto ? 6 : 12}
            required
            maxLength={LIMITS.back}
            data-testid="card-back"
          />
          <TextField label={sv.admin.hint} value={hint} onChange={(e) => setHint(e.target.value)} maxLength={LIMITS.hint} />
          {/* Källor kan vara långa (flera hänvisningar med semikolon): rutan växer så att allt syns. */}
          <TextArea
            label={sv.admin.source}
            hint={sv.admin.sourceHelp}
            value={source}
            onChange={(e) => setSource(e.target.value.replace(/\r?\n/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) e.preventDefault();
            }}
            rows={1}
            maxLength={LIMITS.source}
            className="[&_textarea]:field-sizing-content [&_textarea]:min-h-12! [&_textarea]:resize-none"
            data-testid="card-source"
          />
          {/* Området får all bredd som kryssrutan inte behöver: i halva bredden klipptes långa
              områdesnamn ("Materialgrupper och e..."). */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0">
              <label htmlFor="kort-omrade" className="mb-1.5 block text-sm font-semibold">
                {sv.admin.category}
              </label>
              <Select
                id="kort-omrade"
                value={categoryId}
                onChange={setCategoryId}
                options={[{ value: "", label: sv.admin.noCategory }, ...categories.map((c) => ({ value: c.id, label: c.title }))]}
              />
            </div>
            {/* Ett nytt kort och ett kort i granskningen blir aktiva först när de godkänts. */}
            {reviewStatus || !card ? null : (
              <div className="flex min-h-12 items-center">
                <CheckboxField label={sv.admin.active} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              </div>
            )}
          </div>
        </Card>

        <div className={cx("grid grid-cols-[minmax(0,1fr)] content-start gap-4", stacked ? "@4xl:sticky @4xl:top-6" : "lg:sticky lg:top-6")}>
          <div>
            <p className="text-sm font-semibold text-subtle">{sv.admin.preview}</p>
            <p className="text-sm text-muted">{sv.admin.previewHelp}</p>
          </div>
          <CardPreview
            front={front}
            back={back}
            hint={hint}
            kind={kind}
            options={options}
            area={previewCategory ? { title: previewCategory.title, colorIndex: colorIndex.get(previewCategory.id) ?? 0 } : null}
          />
        </div>
      </div>

      {message ? (
        <FormMessage role="status" ok={message.ok}>
          {message.text}
        </FormMessage>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} data-testid="card-save" onClick={() => setCloseAfter(false)}>
          {pending ? sv.admin.saving : sv.common.save}
        </Button>
        {inline ? (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {sv.common.cancel}
          </Button>
        ) : (
          <>
            <Button type="submit" variant="secondary" disabled={pending} data-testid="card-save-close" onClick={() => setCloseAfter(true)}>
              {sv.admin.saveAndClose}
            </Button>
            <LinkButton href={closeHref} variant="ghost">
              {sv.common.back}
            </LinkButton>
          </>
        )}
      </div>
    </form>
  );
}
