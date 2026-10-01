import { cx } from "@/components/ui/cx";

export function GradeBadge({ grade, size = "lg", testId }: { grade: string; size?: "lg" | "sm"; testId?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-full font-extrabold",
        size === "lg" ? "h-20 min-w-20 px-5 text-4xl" : "h-9 min-w-9 px-2.5 text-lg",
        grade === "U" ? "bg-surface-3 text-fg" : "bg-accent text-accent-fg",
      )}
      data-testid={testId}
    >
      {grade}
    </span>
  );
}
