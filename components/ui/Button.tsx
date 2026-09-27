import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

/**
 * primary: huvudhandlingen (grön). secondary: grå piller. outline: kantad piller ("Visa").
 * inverse: den vita pillern i mörkt läge (svart i ljust). ghost: bara text. danger: destruktivt.
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "inverse" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-center font-semibold select-none transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "bg-surface-2 text-fg hover:bg-surface-3",
  outline: "border border-line-strong text-fg hover:border-fg/40 hover:bg-surface-2",
  inverse: "bg-inverse text-inverse-fg hover:opacity-90",
  ghost: "text-fg hover:bg-surface-2",
  danger: "border border-danger/40 text-danger hover:bg-danger-soft",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 py-1.5 text-sm",
  md: "min-h-11 px-5 py-2 text-[0.95rem]",
  lg: "min-h-12 px-6 py-2.5 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

type LinkButtonProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
  "data-testid"?: string;
};

export function LinkButton({ href, variant = "primary", size = "md", className = "", children, prefetch, ...rest }: LinkButtonProps) {
  return (
    <Link href={href} prefetch={prefetch} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Krävs: knappen har ingen synlig text. */
  label: string;
  variant?: "ghost" | "outline" | "secondary";
  size?: "sm" | "md";
};

const iconVariants = {
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  outline: "border border-line-strong text-fg hover:bg-surface-2",
  secondary: "bg-surface-2 text-fg hover:bg-surface-3",
};

/** Rund knapp med bara en ikon (stäng, fäll ihop, meny). */
export function IconButton({ label, variant = "ghost", size = "md", className = "", type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${
        size === "sm" ? "h-8 w-8" : "h-10 w-10"
      } ${iconVariants[variant]} ${className}`.trim()}
      {...rest}
    />
  );
}
