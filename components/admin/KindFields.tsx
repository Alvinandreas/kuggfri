import { sv } from "@/lib/i18n/sv";
import { CARD_KINDS, CARD_KIND_DESCRIPTION, CARD_KIND_LABEL, type CardKind } from "@/lib/cards/kinds";
import { ChoiceCard } from "@/components/ui/Choice";
import { Select } from "@/components/ui/Select";

/*
 * Typväljaren och typens fält, gemensamma för kortsidan (CardEditor) och granskningen
 * (ReviewEditor). Delarna är egna komponenter eftersom redigerarna har andra fält mellan dem;
 * Sant/Falskt och alternativen (OptionsEditor) ligger kvar som två egna platser i formuläret,
 * så att React ger fälten efter dem samma id som förut.
 */

const KIND_OPTIONS = CARD_KINDS.map((k) => ({ value: k, label: CARD_KIND_LABEL[k] }));

/** Rubrik, rullgardin och en beskrivning av vald uppgiftstyp. compact: mindre beskrivning (granskningen). */
export function KindSelect({
  id,
  label,
  value,
  onChange,
  compact = false,
  "data-testid": testId,
}: {
  id: string;
  label: string;
  value: CardKind;
  onChange: (kind: CardKind) => void;
  compact?: boolean;
  "data-testid": string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <Select<CardKind> id={id} value={value} onChange={onChange} options={KIND_OPTIONS} data-testid={testId} />
      <p className={compact ? "mt-1.5 text-xs text-muted" : "mt-1.5 text-sm text-muted"}>{CARD_KIND_DESCRIPTION[value]}</p>
    </div>
  );
}

/** Sant/Falskt-kortets rätta svar. */
export function TrueFalseField({ name, legend, value, onChange }: { name: string; legend: string; value: boolean | null; onChange: (value: boolean) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-semibold">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        <ChoiceCard name={name} title={sv.admin.trueLabel} checked={value === true} onChange={() => onChange(true)} />
        <ChoiceCard name={name} title={sv.admin.falseLabel} checked={value === false} onChange={() => onChange(false)} />
      </div>
    </fieldset>
  );
}

/** Felen som hindrar att kortet sparas, som en lista. */
export function IssueList({ issues }: { issues: readonly string[] }) {
  return (
    <ul role="alert" className="grid gap-1 rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
      {issues.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}
