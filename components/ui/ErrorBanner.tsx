import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** "note" för en varning som inte ska läsas upp direkt. */
  role?: "alert" | "note";
  /** Ersätter standardklasserna helt. */
  className?: string;
};

/** Den röda felbannern i listor, formulär och dialoger. */
export function ErrorBanner({ children, role = "alert", className = "rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger" }: Props) {
  return (
    <p role={role} className={className}>
      {children}
    </p>
  );
}
