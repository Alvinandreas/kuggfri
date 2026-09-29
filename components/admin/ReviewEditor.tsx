"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { buildOptions, initialAlternatives, initialTrueFalse, type OptionDraft } from "@/lib/admin/card-form";
import { LIMITS } from "@/lib/admin/limits";
import type { ReviewArea, ReviewCard } from "@/lib/admin/review";
import { CARD_KINDS, CARD_KIND_DESCRIPTION, CARD_KIND_LABEL, isAutoGraded, validateKind, type CardKind, type CardOption } from "@/lib/cards/kinds";
import { Button } from "@/components/ui/Button";
import { ChoiceCard } from "@/components/ui/Choice";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { OptionsEditor } from "./CardEditor";
import { ReviewCardFace, questionLabel } from "./ReviewCardFace";

/** Det redigeraren lämnar ifrån sig. */
export type ReviewEdit = {
  category_id: string | null;
  front: string;
  back: string;
  hint: string;
  kind: CardKind;
  options: CardOption[] | null;
};

type Props = {
  card: ReviewCard;
  areas: ReviewArea[];
  /** Spara (approve false) eller Spara och godkänn (approve true). Ger ett felmeddelande eller null. */
  onSave: (edit: ReviewEdit, approve: boolean) => Promise<string | null>;
  onCancel: () => void;
  /** Visa Spara och godkänn (inte för ett kort som redan är granskat och oflaggat). */
  canApprove: boolean;
};

/**
 * Redigering direkt i granskningen: uppgiftstyp, område, fråga, alternativ med rätt och fel,
 * svar och ledtråd, med en förhandsvisning av kortet som studenten ser det. Källan ändras inte
 * här (den hör till källgranskningen). Ctrl+Enter sparar och godkänner, Esc avbryter.
 */
export function ReviewEditor({ card, areas, onSave, onCancel, canApprove }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [hint, setHint] = useState(card.hint ?? "");
  const [kind, setKind] = useState<CardKind>(card.kind);
  const [categoryId, setCategoryId] = useState(card.category_id ?? "");
  const [alternatives, setAlternatives] = useState<OptionDraft[]>(() => initialAlternatives(card.kind, card.options));
  const [trueFalse, setTrueFalse] = useState<boolean | null>(() => initialTrueFalse(card.kind, card.options));
  const [pending, setPending] = useState<"save" | "approve" | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approveNext = useRef(canApprove);

  const auto = isAutoGraded(kind);
  const options = buildOptions(kind, alternatives, trueFalse);
  const issues = [...(!front.trim() ? [sv.common.required] : []), ...validateKind(kind, options)];

  async function submit(approve: boolean) {
    setAttempted(true);
    if (issues.length > 0 || !back.trim()) {
      setError(`${sv.admin.fixErrors} ${[...validateKind(kind, options), ...(!front.trim() || !back.trim() ? [sv.common.required] : [])].join(" ")}`);
      return;
    }
    setError(null);
    setPending(approve ? "approve" : "save");
    const message = await onSave({ category_id: categoryId || null, front, back, hint, kind, options }, approve).catch(() => sv.errors.generic);
    setPending(null);
    if (message) setError(message);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    // En rullgardin (Select) hanterar själv Enter och Esc; händelsen bubblar hit genom portalen.
    if (e.defaultPrevented) return;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit(canApprove);
    } else if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      // Enter i ett enradsfält (ledtråden) ska inte skicka formuläret av misstag.
      e.preventDefault();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        void submit(approveNext.current);
      }}
      onKeyDown={onKeyDown}
      className="grid grid-cols-[minmax(0,1fr)] gap-5"
      data-testid="review-editor"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 @5xl:grid-cols-2">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6 dark:border-transparent">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="granska-typ" className="mb-1.5 block text-sm font-semibold">
                {sv.granskning.kind}
              </label>
              <Select<CardKind>
                id="granska-typ"
                value={kind}
                onChange={setKind}
                options={CARD_KINDS.map((k) => ({ value: k, label: CARD_KIND_LABEL[k] }))}
                data-testid="review-edit-kind"
              />
              <p className="mt-1.5 text-xs text-muted">{CARD_KIND_DESCRIPTION[kind]}</p>
            </div>
            <div>
              <label htmlFor="granska-omrade" className="mb-1.5 block text-sm font-semibold">
                {sv.granskning.area}
              </label>
              <Select
                id="granska-omrade"
                value={categoryId}
                onChange={setCategoryId}
                options={[...areas.map((a) => ({ value: a.id, label: a.title })), { value: "", label: sv.granskning.noArea }]}
                data-testid="review-edit-area"
              />
            </div>
          </div>

          <TextArea
            label={questionLabel(kind)}
            hint={sv.admin.markdownHelp}
            mono
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={auto ? 3 : 4}
            maxLength={LIMITS.front}
            autoFocus
            className="[&_textarea]:field-sizing-content [&_textarea]:max-h-[50dvh]"
            data-testid="review-edit-front"
          />

          {kind === "sant-falskt" ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-sm font-semibold">{sv.granskning.trueFalseLabel}</legend>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceCard name="granska-sant-falskt" title={sv.admin.trueLabel} checked={trueFalse === true} onChange={() => setTrueFalse(true)} />
                <ChoiceCard name="granska-sant-falskt" title={sv.admin.falseLabel} checked={trueFalse === false} onChange={() => setTrueFalse(false)} />
              </div>
            </fieldset>
          ) : null}

          {kind === "alternativ" ? <OptionsEditor items={alternatives} onChange={setAlternatives} /> : null}

          <TextArea
            label={auto ? sv.granskning.explanation : sv.granskning.answer}
            hint={auto ? sv.granskning.explanationHelp : undefined}
            mono
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={auto ? 4 : 6}
            maxLength={LIMITS.back}
            className="[&_textarea]:field-sizing-content [&_textarea]:max-h-[60dvh]"
            data-testid="review-edit-back"
          />
          <TextField label={sv.granskning.hintLabel} value={hint} onChange={(e) => setHint(e.target.value)} maxLength={LIMITS.hint} data-testid="review-edit-hint" />

          {attempted && issues.length > 0 ? (
            <ul role="alert" className="grid gap-1 rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 @5xl:sticky @5xl:top-6">
          <p className="text-sm font-semibold text-subtle">{sv.granskning.preview}</p>
          <ReviewCardFace front={front} back={back} hint={hint || null} kind={kind} options={options} compact />
        </div>
      </div>

      <div className="sticky bottom-3 z-20" data-testid="review-editor-actions">
        <div className="grid gap-2 rounded-lg border border-line bg-surface p-2.5 shadow-pop dark:border-line-strong">
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {canApprove ? (
              <Button type="submit" disabled={pending !== null} onClick={() => (approveNext.current = true)} data-testid="review-save-approve">
                <Check size={17} aria-hidden />
                {pending === "approve" ? sv.granskning.saving : sv.granskning.saveAndApprove}
              </Button>
            ) : null}
            <Button
              type="submit"
              variant={canApprove ? "secondary" : "primary"}
              disabled={pending !== null}
              onClick={() => (approveNext.current = false)}
              data-testid="review-save"
            >
              {pending === "save" ? sv.granskning.saving : sv.granskning.save}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={pending !== null}>
              {sv.common.cancel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
