"use client";

import type { Dict, Lang } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import type { CardKind } from "@/lib/cards/kinds";
import type { SourceTag } from "@/lib/admin/sources";

export type ReviewLang = Lang;

/** Granskningens texter i det valda språket, i den form granskningens komponenter använder. */
export type ReviewText = {
  lang: Lang;
  g: Dict["granskning"];
  kind: Record<CardKind, string>;
  source: Record<SourceTag, string>;
  admin: {
    alternativesHelp: string;
    markdownHelp: string;
    reviewSkipped: (n: number) => string;
    original: string;
    originalHelp: string;
    sourceOriginalHelp: string;
    sourceNoneHelp: string;
    trueWord: string;
    falseWord: string;
  };
  common: { cancel: string; close: string; error: string };
};

function reviewText(t: Dict): ReviewText {
  return {
    lang: t.meta.lang === "en" ? "en" : "sv",
    g: t.granskning,
    kind: t.cardKind.label,
    source: t.sourceTags,
    admin: {
      alternativesHelp: t.admin.alternativesHelp,
      markdownHelp: t.admin.markdownHelp,
      reviewSkipped: t.admin.reviewSkipped,
      original: t.admin.original,
      originalHelp: t.admin.originalHelp,
      sourceOriginalHelp: t.admin.sourceOriginalHelp,
      sourceNoneHelp: t.admin.sourceNoneHelp,
      trueWord: t.admin.trueLabel,
      falseWord: t.admin.falseLabel,
    },
    common: { cancel: t.common.cancel, close: t.common.close, error: t.errors.generic },
  };
}

/** Granskningens texter i det valda språket. */
export function useReviewT(): ReviewText {
  return reviewText(useT());
}
