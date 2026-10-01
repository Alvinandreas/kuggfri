"use client";

import { CheckCheck, FlagTriangleRight, Inbox, Undo2 } from "lucide-react";
import type { ReviewTab } from "@/lib/admin/review";
import { useReviewT } from "./ReviewLanguage";

/** En tom flik: rubrik, en förklaring och flikens ikon. */
export function EmptyState({ tab }: { tab: ReviewTab }) {
  const g = useReviewT().g;
  const [title, help] =
    tab === "att-granska"
      ? [g.emptyToReview, g.emptyToReviewHelp]
      : tab === "granskade"
        ? [g.emptyReviewed, g.emptyReviewedHelp]
        : tab === "ur-rotation"
          ? [g.emptyRemoved, g.emptyRemovedHelp]
          : [g.emptyFlagged, g.emptyFlaggedHelp];
  const Icon = tab === "att-granska" ? CheckCheck : tab === "flaggade" ? FlagTriangleRight : tab === "ur-rotation" ? Undo2 : Inbox;
  return (
    <div className="anim-fade-up grid justify-items-start gap-2 rounded-lg border border-line bg-surface p-6 sm:p-8 dark:border-transparent" data-testid="review-empty">
      <Icon size={26} aria-hidden className="text-muted" />
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-prose text-sm text-muted">{help}</p>
    </div>
  );
}
