import { useMemo, useState } from "react";
import { changeKind, formOptions, initialCardForm, type CardFormSource, type CardFormState, type OptionDraft } from "@/lib/admin/card-form";
import { isAutoGraded, validateKind, type CardKind } from "@/lib/cards/kinds";
import { useT } from "@/lib/i18n/client";

/**
 * Kortredigerarnas gemensamma formulärtillstånd (kortsidan och granskningen): fråga, svar,
 * ledtråd, typ, alternativ och Sant/Falskt-svar, med det som följer av dem (alternativen som
 * sparas, om typen rättas automatiskt och typens fel). Logiken finns i lib/admin/card-form.
 */
export function useCardForm(card?: CardFormSource, initialKind?: CardKind) {
  const sv = useT();
  const [form, setForm] = useState<CardFormState>(() => initialCardForm(card, initialKind));
  const setters = useMemo(
    () => ({
      setFront: (front: string) => setForm((f) => ({ ...f, front })),
      setBack: (back: string) => setForm((f) => ({ ...f, back })),
      setHint: (hint: string) => setForm((f) => ({ ...f, hint })),
      setKind: (kind: CardKind) => setForm((f) => changeKind(f, kind)),
      setAlternatives: (alternatives: OptionDraft[]) => setForm((f) => ({ ...f, alternatives })),
      setTrueFalse: (trueFalse: boolean | null) => setForm((f) => ({ ...f, trueFalse })),
    }),
    [],
  );
  const options = formOptions(form);
  return { form, ...setters, options, auto: isAutoGraded(form.kind), kindIssues: validateKind(form.kind, options, sv) };
}
