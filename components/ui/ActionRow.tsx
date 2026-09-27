import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, type LucideProps } from "lucide-react";
import { cx } from "./cx";

type Props = {
  href: string;
  icon: ComponentType<LucideProps>;
  title: string;
  /** Rad under rubriken, t.ex. "12 kort · cirka 3 min". */
  meta?: ReactNode;
  /** Den viktigaste raden i en lista: grön ikon och lite tyngre yta. */
  primary?: boolean;
  onClick?: () => void;
  "data-testid"?: string;
};

/**
 * En klickbar handling i en lista: ikon, rubrik, en rad om vad som händer och en pil.
 * Används där man ska kunna hoppa rakt in i något (plugga ett område, ta kluriga kort).
 */
export function ActionRow({ href, icon: Icon, title, meta, primary = false, onClick, ...rest }: Props) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cx(
        "group flex min-h-16 items-center gap-4 rounded-lg px-4 py-3 transition-[background-color,transform] duration-150 active:scale-[0.99]",
        primary ? "bg-accent-soft hover:bg-accent-soft/70" : "bg-surface-2 hover:bg-surface-3",
      )}
      {...rest}
    >
      <span
        className={cx(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
          primary ? "bg-accent text-accent-fg" : "bg-surface text-fg dark:bg-surface-3",
        )}
      >
        <Icon size={19} strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("block font-bold", primary && "text-accent-ink")}>{title}</span>
        {meta ? <span className="block text-sm text-muted">{meta}</span> : null}
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

/** En lista med ActionRow, med jämna mellanrum. */
export function ActionList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("grid gap-2", className)}>{children}</div>;
}
