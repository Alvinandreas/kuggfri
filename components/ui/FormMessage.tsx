import type { ReactNode } from "react";
import { cx } from "./cx";

type Props = {
  /** Grön text när det gick, röd annars. */
  ok: boolean;
  children: ReactNode;
  /** Utan roll blir det "status" när det gick och "alert" vid fel. */
  role?: "status" | "alert";
  /** Klasserna före färgen. */
  className?: string;
  okClassName?: string;
  errorClassName?: string;
  "data-testid"?: string;
};

/** Statusraden under ett formulär eller en handling. */
export function FormMessage({
  ok,
  children,
  role,
  className = "text-sm font-medium",
  okClassName = "text-accent",
  errorClassName = "text-danger",
  "data-testid": testId,
}: Props) {
  return (
    <p role={role ?? (ok ? "status" : "alert")} className={cx(className, ok ? okClassName : errorClassName)} data-testid={testId}>
      {children}
    </p>
  );
}
