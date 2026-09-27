import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Liten etikett som dyker upp över (eller under) en knapp vid hovring och tangentbordsfokus,
 * som Knowts ikonknappar. Knappen själv bär sitt tillgängliga namn (aria-label); etiketten
 * är bara visuell och döljs för skärmläsare så att namnet inte läses två gånger.
 */
export function Tooltip({ label, children, side = "top", className }: { label: string; children: ReactNode; side?: "top" | "bottom"; className?: string }) {
  return (
    <span className={cx("group/tt relative inline-flex", className)}>
      {children}
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-inverse px-2.5 py-1.5 text-xs font-semibold text-inverse-fg opacity-0 shadow-pop transition-[opacity,translate] duration-150 ease-out",
          "group-hover/tt:opacity-100 group-has-[:focus-visible]/tt:opacity-100",
          side === "top" ? "bottom-full mb-2 translate-y-1 group-hover/tt:translate-y-0 group-has-[:focus-visible]/tt:translate-y-0" : "top-full mt-2 -translate-y-1 group-hover/tt:translate-y-0 group-has-[:focus-visible]/tt:translate-y-0",
        )}
      >
        {label}
      </span>
    </span>
  );
}
