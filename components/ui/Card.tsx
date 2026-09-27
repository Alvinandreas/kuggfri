import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cx } from "./cx";

const surface = "rounded-lg bg-surface border border-line dark:border-transparent";
const pads = { none: "", sm: "p-4", md: "p-5", lg: "p-6 sm:p-7" };
type Pad = keyof typeof pads;

type CardProps = HTMLAttributes<HTMLDivElement> & { padding?: Pad };

/** Grundblocket: en rundad yta ett steg ljusare än duken. Ingen kant i mörkt läge. */
export function Card({ padding = "md", className, ...rest }: CardProps) {
  return <div className={cx(surface, pads[padding], className)} {...rest} />;
}

type CardLinkProps = {
  href: string;
  padding?: Pad;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  "data-testid"?: string;
};

/** Klickbart block (kurskort, resurser). Lyfter lätt och ljusnar vid hovring. */
export function CardLink({ href, padding = "md", className, style, children, ...rest }: CardLinkProps) {
  return (
    <Link
      href={href}
      style={style}
      className={cx(
        surface,
        pads[padding],
        "group block transition-[background-color,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2 active:translate-y-0 focus-visible:rounded-lg",
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

/** Rubrik för en sektion av block ("Mina kurser"). */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-4 flex items-end justify-between gap-3", className)}>
      <h2 className="text-xl font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
