import type { ReactNode } from "react";
import { cx } from "./cx";

/** En tangent i en kortkommandoförklaring ("G godkänn"). Diskret, i samma ton som piller. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cx("inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-line-strong bg-surface-2 px-1.5 font-mono text-[11px] font-semibold text-fg", className)}>
      {children}
    </kbd>
  );
}
