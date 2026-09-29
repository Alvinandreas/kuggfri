import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx";

/**
 * Utfällbar sektion på det inbyggda <details>-elementet (tangentbord och skärmläsare
 * gratis). Pilen vrids när den är öppen; innehållet tonar in.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
  "data-testid": testId,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <details open={defaultOpen} className={cx("ui-disclosure group", className)} data-testid={testId}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-2 font-semibold text-fg [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        {/* Pilen följer sin egen <details>, inte en yttre öppen Disclosure (group-open träffar alla förfäder). */}
        <ChevronDown size={17} aria-hidden className="shrink-0 text-muted transition-transform duration-200 [details[open]>summary>&]:rotate-180" />
      </summary>
      <div className="anim-fade-in pb-1 pt-2">{children}</div>
    </details>
  );
}
