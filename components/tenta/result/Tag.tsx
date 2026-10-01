import { cx } from "@/components/ui/cx";

export function Tag({ tone, children }: { tone: "right" | "wrong" | "mine"; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
        tone === "right" ? "bg-accent text-accent-fg" : tone === "wrong" ? "bg-danger text-white dark:text-bg" : "bg-surface-3 text-fg",
      )}
    >
      {children}
    </span>
  );
}
