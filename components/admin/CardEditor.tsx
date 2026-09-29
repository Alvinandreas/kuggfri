"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { saveCardAction } from "@/lib/admin/actions";
import { buildOptions, initialAlternatives, initialTrueFalse, moveItem, newOptionKey, type OptionDraft } from "@/lib/admin/card-form";
import { LIMITS } from "@/lib/admin/limits";
import { CARD_KINDS, CARD_KIND_DESCRIPTION, CARD_KIND_LABEL, isAutoGraded, validateKind, type CardKind } from "@/lib/cards/kinds";
import type { CardRow } from "@/lib/supabase/database.types";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { Button, IconButton, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, CheckboxField, ChoiceCard } from "@/components/ui/Choice";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { TextField, inputClass } from "@/components/ui/TextField";
import { cx } from "@/components/ui/cx";
import { CardPreview } from "./CardPreview";
import { ReviewStatusBadge } from "./KindBadge";

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
  const closeHref = backHref ?? `/admin/deck/${deckId}/innehall`;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [hint, setHint] = useState(card?.hint ?? "");
  const [source, setSource] = useState(card?.source ?? "");
  const [categoryId, setCategoryId] = useState(card?.category_id ?? initialCategoryId ?? "");
  const [kind, setKind] = useState<CardKind>(initialKind ?? card?.kind ?? "sjalvskattning");
  const [alternatives, setAlternatives] = useState<OptionDraft[]>(() => initialAlternatives(card?.kind ?? "sjalvskattning", card?.options ?? null));
  const [trueFalse, setTrueFalse] = useState<boolean | null>(() => initialTrueFalse(card?.kind ?? "sjalvskattning", card?.options ?? null));
  const [isActive, setIsActive] = useState(card?.is_active ?? true);
  const [closeAfter, setCloseAfter] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const colorIndex = categoryColorIndex(categories);
  const previewCategory = categories.find((c) => c.id === categoryId) ?? null;
  const reviewStatus = card?.review_status ?? null;
  const auto = isAutoGraded(kind);
  const options = buildOptions(kind, alternatives, trueFalse);
  const issues = validateKind(kind, options);
  const frontLabel = kind === "sant-falskt" ? sv.admin.statement : kind === "begrepp" ? sv.admin.concept : kind === "alternativ" ? sv.admin.question : sv.admin.front;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (issues.length > 0) {
      setMessage({ ok: false, text: `${sv.admin.fixErrors} ${issues.join(" ")}` });
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
          front: front.trim(),
          back: back.trim(),
          hint: hint.trim() || null,
          kind,
          options,
          source: source.trim() || null,
          is_active: reviewStatus ? false : isActive,
        });
      } else if (closeAfter) router.push(closeHref);
      else if (!card) router.push(`/admin/deck/${deckId}/kort/${result.data.id}`);
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

          <div>
            <label htmlFor="kort-typ" className="mb-1.5 block text-sm font-semibold">
              {sv.admin.kind}
            </label>
            <Select
              id="kort-typ"
              value={kind}
              onChange={setKind}
              options={CARD_KINDS.map((k) => ({ value: k, label: CARD_KIND_LABEL[k] }))}
              data-testid="card-kind"
            />
            <p className="mt-1.5 text-sm text-muted">{CARD_KIND_DESCRIPTION[kind]}</p>
          </div>

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

          {kind === "sant-falskt" ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-sm font-semibold">{sv.admin.trueFalseLabel}</legend>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceCard name="sant-falskt" title={sv.admin.trueLabel} checked={trueFalse === true} onChange={() => setTrueFalse(true)} />
                <ChoiceCard name="sant-falskt" title={sv.admin.falseLabel} checked={trueFalse === false} onChange={() => setTrueFalse(false)} />
              </div>
            </fieldset>
          ) : null}

          {kind === "alternativ" ? <OptionsEditor items={alternatives} onChange={setAlternatives} /> : null}

          {attempted && issues.length > 0 ? (
            <ul role="alert" className="grid gap-1 rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}

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
          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <div>
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
        <p role="status" className={`text-sm font-medium ${message.ok ? "text-accent" : "text-danger"}`}>
          {message.text}
        </p>
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

/** Redigerbar lista med svarsalternativ: text, rätt/fel, flytta och ta bort. Används också i granskningen. */
export function OptionsEditor({ items, onChange }: { items: OptionDraft[]; onChange: (next: OptionDraft[]) => void }) {
  const update = (key: string, patch: Partial<OptionDraft>) => onChange(items.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  return (
    <fieldset className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2" data-testid="card-options">
      <legend className="mb-1 text-sm font-semibold">{sv.admin.alternatives}</legend>
      <p className="-mt-1 mb-1 text-sm text-muted">{sv.admin.alternativesHelp}</p>
      <ol className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {items.map((o, i) => (
          <li key={o.key} className={cx("flex items-start gap-2 rounded-md border-2 p-1.5 pl-3 transition-colors duration-150", o.correct ? "border-accent/60 bg-accent-soft/40" : "border-transparent bg-surface-2")}>
            <label className="flex h-10 shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold">
              <Checkbox checked={o.correct} onChange={(e) => update(o.key, { correct: e.target.checked })} aria-label={`${sv.admin.correctOption}: ${sv.admin.alternativeLabel(i + 1)}`} />
              <span aria-hidden className="hidden w-8 sm:inline">
                {sv.admin.correctOption}
              </span>
            </label>
            {/* Växer med texten, så att långa alternativ går att läsa i sin helhet. Ett alternativ är
                en rad: Enter infogar ingen radbrytning (Ctrl+Enter sparar som i resten av formuläret). */}
            <textarea
              value={o.text}
              onChange={(e) => update(o.key, { text: e.target.value.replace(/\r?\n/g, " ") })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) e.preventDefault();
              }}
              rows={1}
              aria-label={sv.admin.alternativeLabel(i + 1)}
              placeholder={sv.admin.alternativeLabel(i + 1)}
              maxLength={LIMITS.optionText}
              className={cx(inputClass, "field-sizing-content min-h-10 min-w-0 flex-1 resize-none bg-surface! px-3 py-2 leading-snug dark:bg-surface-3!")}
            />
            <div className="flex h-10 shrink-0 items-center">
              <IconButton label={sv.admin.moveAlternativeUp(i + 1)} size="sm" onClick={() => onChange(moveItem(items, i, -1))} disabled={i === 0}>
                <ArrowUp size={15} aria-hidden />
              </IconButton>
              <IconButton label={sv.admin.moveAlternativeDown(i + 1)} size="sm" onClick={() => onChange(moveItem(items, i, 1))} disabled={i === items.length - 1}>
                <ArrowDown size={15} aria-hidden />
              </IconButton>
              <IconButton label={sv.admin.removeAlternative(i + 1)} size="sm" onClick={() => onChange(items.filter((x) => x.key !== o.key))} disabled={items.length <= 2}>
                <X size={15} aria-hidden />
              </IconButton>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, { key: newOptionKey(), text: "", correct: false }])}
          disabled={items.length >= LIMITS.maxOptions}
        >
          <Plus size={15} aria-hidden />
          {sv.admin.addAlternative}
        </Button>
      </div>
    </fieldset>
  );
}
