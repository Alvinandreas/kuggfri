"use client";

import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { inputClass } from "./TextField";
import { cx } from "./cx";

/** Klasserna för en textruta, för ställen som behöver ett eget <textarea>. */
export const textareaClass = cx(inputClass, "min-h-28 resize-y py-3 leading-relaxed");

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  labelAction?: ReactNode;
  /** Monospace för markdown och formler, där tecknen behöver synas exakt. */
  mono?: boolean;
};

/** Etikett, textruta, hjälptext och fel, kopplade för skärmläsare. Samma form som TextField. */
export function TextArea({ label, hint, error, labelAction, mono = false, id, className, ...rest }: Props) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const hintId = `${areaId}-hint`;
  const errorId = `${areaId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={areaId} className="text-sm font-semibold">
          {label}
        </label>
        {labelAction}
      </div>
      <textarea
        id={areaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(textareaClass, mono && "font-mono text-[0.9rem]")}
        {...rest}
      />
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
