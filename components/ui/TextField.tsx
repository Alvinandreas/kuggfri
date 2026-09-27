"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

/** Klasserna för ett fält, för de ställen som behöver ett eget <input> eller <textarea>. */
export const inputClass =
  "w-full rounded-md border border-transparent bg-surface-2 px-4 text-fg placeholder:text-subtle transition-[border-color,background-color,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-danger";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Något till höger om etiketten, t.ex. "Glömt lösenordet?". */
  labelAction?: ReactNode;
};

/** Etikett, fält, hjälptext och felmeddelande, kopplade till varandra för skärmläsare. */
export function TextField({ label, hint, error, labelAction, id, className, ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-semibold">
          {label}
        </label>
        {labelAction}
      </div>
      <input id={inputId} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cx(inputClass, "h-12")} {...rest} />
      {hint && !error ? (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
