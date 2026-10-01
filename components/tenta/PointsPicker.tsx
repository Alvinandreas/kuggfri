"use client";

import { useT } from "@/lib/i18n/client";
import { formatPoints } from "@/lib/tentor/session";
import { Select } from "@/components/ui/Select";
import { cx } from "@/components/ui/cx";

/**
 * Val av poäng (rättningsläget och Tänk om): en rad runda knappar, eller en rullgardin när
 * stegen är för många för att få plats.
 */
export function PointsPicker({
  values,
  value,
  onChange,
  label,
  testId,
  disabled = false,
  size = "md",
}: {
  values: number[];
  value: number | undefined;
  onChange: (v: number) => void;
  label: string;
  testId: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const sv = useT();
  if (values.length > 13) {
    return (
      <div className="max-w-[12rem]" data-testid={testId}>
        <Select
          value={value === undefined ? "" : String(value)}
          onChange={(s) => s !== "" && onChange(Number(s))}
          options={[{ value: "", label: sv.tenta.choose }, ...values.map((v) => ({ value: String(v), label: formatPoints(v, sv.meta.locale) }))]}
          label={label}
          size="sm"
        />
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5" data-testid={testId}>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cx(
            "inline-flex items-center justify-center rounded-full border font-semibold tabular-nums transition-colors disabled:opacity-60",
            size === "sm" ? "h-8 min-w-9 px-2.5 text-sm" : "h-11 min-w-12 px-3.5 text-[0.95rem]",
            value === v ? "border-inverse bg-inverse text-inverse-fg" : "border-line-strong bg-surface hover:bg-surface-2",
          )}
          data-testid={`${testId}-${v}`}
        >
          {formatPoints(v, sv.meta.locale)}
        </button>
      ))}
    </div>
  );
}
