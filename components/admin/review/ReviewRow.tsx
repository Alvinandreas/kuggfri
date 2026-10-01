"use client";

import type { MouseEvent } from "react";
import { FlagTriangleRight } from "lucide-react";
import { firstLine } from "@/lib/text/first-line";
import { tagBgClass } from "@/lib/ui/tag-colors";
import type { ReviewCard, ReviewTab } from "@/lib/admin/review";
import { sourceTags } from "@/lib/admin/sources";
import type { CardKind } from "@/lib/cards/kinds";
import { englishFlag } from "@/lib/cards/translation";
import { cx } from "@/components/ui/cx";
import { KIND_ICON } from "../KindBadge";
import { useReviewT } from "./ReviewLanguage";

/** En rad i inkorgen: frågans första rad och, under den, område, uppgiftstyp och källa. */
export function ReviewRow({
  card,
  tab,
  href,
  onClick,
  showArea,
  areaTitle,
  areaColor,
  rightLabel,
}: {
  card: ReviewCard;
  tab: ReviewTab;
  href: string;
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void;
  showArea: boolean;
  areaTitle: (id: string | null) => string;
  areaColor: (id: string) => number;
  rightLabel: string;
}) {
  const t = useReviewT();
  const KindIcon = KIND_ICON[card.kind as CardKind];
  const tags = sourceTags(card);
  const flagEnglish = t.lang === "en" ? englishFlag(card) : null;
  return (
    <a
      href={href}
      onClick={onClick}
      data-review-row={card.id}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2"
      // Fokusramen (globalt, :focus-visible) inuti raden, så att listans kant inte klipper den.
      style={{ outlineOffset: "-2px" }}
    >
      <span className="min-w-0">
        <span className="line-clamp-2 break-words font-medium sm:line-clamp-1" lang={t.lang === "en" && card.translation_en ? "en" : undefined}>
          {firstLine(t.lang === "en" && card.translation_en ? card.translation_en.front : card.front, { maxLength: 200 }) || "…"}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {showArea ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span aria-hidden className={cx("h-2 w-2 shrink-0 rounded-full", card.category_id ? tagBgClass(areaColor(card.category_id)) : "bg-line-strong")} />
              <span className="truncate">{areaTitle(card.category_id)}</span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <KindIcon size={12} aria-hidden />
            {t.kind[card.kind]}
          </span>
          <span className="inline-flex items-center gap-1">{tags.map((tag) => t.source[tag]).join(", ")}</span>
        </span>
        {card.flag_note && tab !== "ur-rotation" ? (
          <span className="mt-1.5 flex items-start gap-1.5 text-sm">
            <FlagTriangleRight size={14} aria-hidden className="mt-0.5 shrink-0 text-chart-3" />
            <span className="line-clamp-2 break-words">
              {tab === "flaggade" ? null : <span className="font-semibold">{t.g.flaggedBadge}: </span>}
              <span lang={flagEnglish ? "en" : t.lang === "en" ? "sv" : undefined}>{flagEnglish ?? card.flag_note}</span>
            </span>
          </span>
        ) : null}
      </span>
      <span className="whitespace-nowrap pt-0.5 text-xs text-muted tabular-nums">{rightLabel}</span>
    </a>
  );
}
