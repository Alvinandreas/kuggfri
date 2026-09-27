"use client";

import { useId, type ReactNode } from "react";
import { cx } from "./cx";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Tillgängligt namn när ingen synlig etikett är kopplad. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
};

/** Av/på-reglage. På: fylld pill (vit i mörkt läge) med kulan till höger. */
export function Toggle({ checked, onChange, label, labelledBy, describedBy, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 ease-out disabled:opacity-50",
        checked ? "border-inverse bg-inverse" : "border-line-strong bg-surface-3",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "h-5 w-5 rounded-full shadow-sm transition-transform duration-200 ease-out",
          checked ? "translate-x-[1.35rem] bg-inverse-fg" : "translate-x-[0.2rem] bg-bg",
        )}
      />
    </button>
  );
}

type ToggleRowProps = Omit<ToggleProps, "labelledBy" | "label" | "describedBy"> & {
  title: ReactNode;
  description?: ReactNode;
};

/** En inställningsrad: text till vänster, reglage till höger (som Knowts "Flashcards Options"). */
export function ToggleRow({ title, description, ...toggle }: ToggleRowProps) {
  const titleId = useId();
  const descId = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p id={titleId} className="font-medium">
          {title}
        </p>
        {description ? (
          <p id={descId} className="text-sm text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <Toggle {...toggle} labelledBy={titleId} describedBy={description ? descId : undefined} />
    </div>
  );
}
