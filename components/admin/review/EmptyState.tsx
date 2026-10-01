import { CheckCheck, FlagTriangleRight, Inbox } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { ReviewTab } from "@/lib/admin/review";

/** En tom flik: rubrik, en förklaring och flikens ikon. */
export function EmptyState({ tab }: { tab: ReviewTab }) {
  const [title, help] =
    tab === "att-granska"
      ? [sv.granskning.emptyToReview, sv.granskning.emptyToReviewHelp]
      : tab === "granskade"
        ? [sv.granskning.emptyReviewed, sv.granskning.emptyReviewedHelp]
        : [sv.granskning.emptyFlagged, sv.granskning.emptyFlaggedHelp];
  const Icon = tab === "att-granska" ? CheckCheck : tab === "flaggade" ? FlagTriangleRight : Inbox;
  return (
    <div className="anim-fade-up grid justify-items-start gap-2 rounded-lg border border-line bg-surface p-6 sm:p-8 dark:border-transparent" data-testid="review-empty">
      <Icon size={26} aria-hidden className="text-muted" />
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-prose text-sm text-muted">{help}</p>
    </div>
  );
}
