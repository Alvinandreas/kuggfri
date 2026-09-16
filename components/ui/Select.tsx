import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Sätt om selecten ska fylla hela bredden (standard) eller bara sitt innehåll. */
  fit?: boolean;
};

/**
 * Enhetlig rullgardinsmeny: samma höjd, kant och hörn som textfälten, egen pil i stället
 * för webbläsarens. Själva listan som fälls ut är webbläsarens egen men följer temat via
 * color-scheme i globals.css.
 */
export function Select({ className = "", fit = false, ...rest }: Props) {
  return (
    <span className={`relative inline-block ${fit ? "" : "w-full"} ${className}`.trim()}>
      <select
        {...rest}
        className={
          "h-11 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-line-strong bg-surface py-0 pl-3 pr-9 text-fg " +
          "transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        }
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </span>
  );
}
