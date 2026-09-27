import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

/*
  Kryssrutor och radioknappar är de inbyggda elementen (tangentbord, formulär och
  skärmläsare fungerar som vanligt), bara omstylade via .ui-check och .ui-radio i
  globals.css. Klickytan är hela etiketten.
*/

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function Checkbox({ className, ...rest }: InputProps) {
  return <input type="checkbox" className={cx("ui-check", className)} {...rest} />;
}

export function Radio({ className, ...rest }: InputProps) {
  return <input type="radio" className={cx("ui-radio", className)} {...rest} />;
}

/** Kryssruta med etikett och valfri förklaring. */
export function CheckboxField({ label, description, className, ...rest }: InputProps & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-3 py-1", className)}>
      <Checkbox className="mt-0.5" {...rest} />
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {description ? <span className="block text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/**
 * Ett val som ett eget block (lägesväljaren inför ett pass): radioknapp, rubrik och
 * förklaring, och en grön ram runt det valda. Hela blocket är klickbart.
 */
export function ChoiceCard({
  title,
  description,
  className,
  ...rest
}: InputProps & { title: ReactNode; description?: ReactNode }) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-lg border-2 border-transparent bg-surface-2 p-4 transition-[border-color,background-color] duration-150 hover:bg-surface-3",
        "has-[:checked]:border-accent has-[:checked]:bg-accent-soft/60 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/15",
        className,
      )}
    >
      <Radio className="mt-0.5" {...rest} />
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        {description ? <span className="mt-0.5 block text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
