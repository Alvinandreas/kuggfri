import type { ReactNode } from "react";
import { cx } from "./cx";

type Tone = "neutral" | "strong" | "accent" | "danger" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  strong: "bg-inverse text-inverse-fg",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
  outline: "border border-line-strong text-muted",
};

/** Liten pill för status och etiketter ("Inga uppgifter", "3 kvar", "Ny"). */
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}
