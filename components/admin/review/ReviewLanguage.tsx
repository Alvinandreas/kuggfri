"use client";

import { useId, useTransition } from "react";
import { Languages } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";
import type { CardKind } from "@/lib/cards/kinds";
import type { SourceTag } from "@/lib/admin/sources";
import { Toggle } from "@/components/ui/Toggle";

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

/** Granskningens texter och en funktion som byter språk (det byter för hela tjänsten). */
export function useReviewText(): [ReviewText, (lang: Lang) => void] {
  const t = useT();
  const [, setLang] = useLang();
  return [reviewText(t), setLang];
}

/** Granskningens texter i det valda språket. */
export function useReviewT(): ReviewText {
  return reviewText(useT());
}

/**
 * Reglaget English: hela tjänsten på engelska för den som slår på det (bara den här
 * webbläsaren). Visas för admin och examinatorer; studenterna ser alltid svenska.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const t = useT();
  const [lang, setLang] = useLang();
  const [pending, startTransition] = useTransition();
  const id = useId();
  return (
    <div className={className} title={t.meta.languageHelp} data-testid="review-language">
      <span className="inline-flex items-center gap-2 text-sm font-semibold">
        <Languages size={16} aria-hidden className="text-muted" />
        <span id={id}>{t.meta.language}</span>
        <Toggle checked={lang === "en"} disabled={pending} onChange={(on) => startTransition(() => setLang(on ? "en" : "sv"))} labelledBy={id} />
      </span>
    </div>
  );
}
