import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
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
 * Ett stort val i ett rutnät (lägena på kurssidan, i Quizlets och Knowts anda): ikon, rubrik,
 * kort förklaring och en siffra som säger vad valet ger just nu ("92 kort i dag"). Under
 * ytan en vanlig radioknapp, så tangentbord, formulär och skärmläsare fungerar som vanligt.
 */
export function OptionTile({
  icon: Icon,
  title,
  description,
  meta,
  className,
  ...rest
}: InputProps & { icon: ComponentType<LucideProps>; title: string; description?: ReactNode; meta?: ReactNode }) {
  return (
    <label
      className={cx(
        "group relative flex cursor-pointer flex-col gap-3 rounded-lg border-2 bg-surface p-5 transition-[border-color,background-color,transform] duration-150",
        "hover:-translate-y-0.5 hover:bg-surface-2 dark:bg-surface-2/60 dark:hover:bg-surface-2",
        "border-line has-[:checked]:border-accent has-[:checked]:bg-accent-soft/50 dark:border-transparent dark:has-[:checked]:border-accent dark:has-[:checked]:bg-accent-soft/40",
        "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/20 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        className,
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-surface-2 text-fg transition-colors group-has-[:checked]:bg-accent group-has-[:checked]:text-accent-fg dark:bg-surface-3">
          <Icon size={20} strokeWidth={2} aria-hidden />
        </span>
        {/* Radioknappen: visuellt en diskret markering i hörnet, semantiskt valet självt. */}
        <input type="radio" className="ui-radio mt-1" aria-label={title} {...rest} />
      </span>
      <span className="min-w-0">
        <span className="block font-bold tracking-tight">{title}</span>
        {description ? <span className="mt-1 block text-sm text-muted">{description}</span> : null}
      </span>
      {meta ? <span className="mt-auto text-sm font-semibold text-fg">{meta}</span> : null}
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
