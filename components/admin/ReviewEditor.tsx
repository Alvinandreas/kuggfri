"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { cardFormValues, fixErrorsMessage, requiredIssues } from "@/lib/admin/card-form";
import { LIMITS } from "@/lib/admin/limits";
import { useT } from "@/lib/i18n/client";
import type { ReviewArea, ReviewCard } from "@/lib/admin/review";
import type { CardKind, CardOption } from "@/lib/cards/kinds";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { IssueList, KindSelect, TrueFalseField } from "./KindFields";
import { OptionsEditor } from "./OptionsEditor";
import { ReviewCardFace, questionLabel } from "./ReviewCardFace";
import { useCardForm } from "./useCardForm";
import { useReviewT } from "./review/ReviewLanguage";

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
  const t = useReviewT();
  const sv = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const { form, setFront, setBack, setHint, setKind, setAlternatives, setTrueFalse, options, auto, kindIssues } = useCardForm(card);
  const { front, back, hint, kind, alternatives, trueFalse } = form;
  const [categoryId, setCategoryId] = useState(card.category_id ?? "");
  const [pending, setPending] = useState<"save" | "approve" | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approveNext = useRef(canApprove);

  const issues = [...requiredIssues(sv, front), ...kindIssues];

  async function submit(approve: boolean) {
    setAttempted(true);
    if (issues.length > 0 || !back.trim()) {
      setError(fixErrorsMessage(sv, [...kindIssues, ...requiredIssues(sv, front, back)]));
      return;
    }
    setError(null);
    setPending(approve ? "approve" : "save");
    const message = await onSave({ category_id: categoryId || null, ...cardFormValues(form) }, approve).catch(() => t.common.error);
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
            <KindSelect id="granska-typ" label={t.g.kind} value={kind} onChange={setKind} compact data-testid="review-edit-kind" />
            <div>
              <label htmlFor="granska-omrade" className="mb-1.5 block text-sm font-semibold">
                {t.g.area}
              </label>
              <Select
                id="granska-omrade"
                value={categoryId}
                onChange={setCategoryId}
                options={[...areas.map((a) => ({ value: a.id, label: t.lang === "en" && a.title_en ? a.title_en : a.title })), { value: "", label: t.g.noArea }]}
                data-testid="review-edit-area"
              />
            </div>
          </div>

          <TextArea
            label={questionLabel(kind, t)}
            hint={t.admin.markdownHelp}
            mono
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={auto ? 3 : 4}
            maxLength={LIMITS.front}
            autoFocus
            className="[&_textarea]:field-sizing-content [&_textarea]:max-h-[50dvh]"
            data-testid="review-edit-front"
          />

          {kind === "sant-falskt" ? <TrueFalseField name="granska-sant-falskt" legend={t.g.trueFalseLabel} value={trueFalse} onChange={setTrueFalse} /> : null}

          {kind === "alternativ" ? <OptionsEditor items={alternatives} onChange={setAlternatives} /> : null}

          <TextArea
            label={auto ? t.g.explanation : t.g.answer}
            hint={auto ? t.g.explanationHelp : undefined}
            mono
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={auto ? 4 : 6}
            maxLength={LIMITS.back}
            className="[&_textarea]:field-sizing-content [&_textarea]:max-h-[60dvh]"
            data-testid="review-edit-back"
          />
          <TextField label={t.g.hintLabel} value={hint} onChange={(e) => setHint(e.target.value)} maxLength={LIMITS.hint} data-testid="review-edit-hint" />

          {attempted && issues.length > 0 ? <IssueList issues={issues} /> : null}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 @5xl:sticky @5xl:top-6">
          <p className="text-sm font-semibold text-subtle">{t.g.preview}</p>
          <ReviewCardFace front={front} back={back} hint={hint || null} kind={kind} options={options} compact />
        </div>
      </div>

      <div className="sticky bottom-3 z-20" data-testid="review-editor-actions">
        <div className="grid gap-2 rounded-lg border border-line bg-surface p-2.5 shadow-pop dark:border-line-strong">
          {error ? <ErrorBanner className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</ErrorBanner> : null}
          <div className="flex flex-wrap items-center gap-2">
            {canApprove ? (
              <Button type="submit" disabled={pending !== null} onClick={() => (approveNext.current = true)} data-testid="review-save-approve">
                <Check size={17} aria-hidden />
                {pending === "approve" ? t.g.saving : t.g.saveAndApprove}
              </Button>
            ) : null}
            <Button
              type="submit"
              variant={canApprove ? "secondary" : "primary"}
              disabled={pending !== null}
              onClick={() => (approveNext.current = false)}
              data-testid="review-save"
            >
              {pending === "save" ? t.g.saving : t.g.save}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={pending !== null}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
