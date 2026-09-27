import type { CSSProperties } from "react";
import Link from "next/link";
import { cx } from "@/components/ui/cx";

type Props = {
  label: string;
  value: string;
  sub?: string;
  help?: string;
  /** Gör hela blocket klickbart. Länken ligger i dd:t eftersom en <dl> bara får innehålla div/dt/dd. */
  href?: string;
  testId?: string;
  /** Inne i ett annat block: en nivå ljusare yta (surface-2) i stället för ett eget block. */
  inset?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * Nyckeltal i en <dl> för examinatorns vyer: neutralt block, liten etikett och stort tal.
 * Etiketten är subtle på surface men muted på surface-2, där subtle inte når 4,5:1 i mörkt läge.
 */
export function StatBlock({ label, value, sub, help, href, testId, inset = false, className, style }: Props) {
  return (
    <div
      style={style}
      className={cx(
        "relative flex flex-col",
        inset ? "rounded-md bg-surface-2 p-4" : "rounded-lg border border-line bg-surface p-5 dark:border-transparent",
        href && (inset ? "transition-colors hover:bg-surface-3" : "transition-colors hover:bg-surface-2"),
        className,
      )}
    >
      <dt className={cx("text-xs font-semibold", inset ? "text-muted" : "text-subtle")} title={help}>
        {label}
      </dt>
      <dd className="mt-2 text-3xl font-extrabold leading-none tracking-tight tabular-nums" data-testid={testId}>
        {href ? (
          <Link href={href} className="after:absolute after:inset-0 after:rounded-lg">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
      {sub ? <dd className="mt-2 text-xs text-muted">{sub}</dd> : null}
    </div>
  );
}
