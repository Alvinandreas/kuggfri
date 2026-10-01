"use client";

import { useId } from "react";
import { Languages } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { adminEn, cardKindEn, granskningEn, sourceTagEn, type GranskningText } from "@/lib/i18n/en/granskning";
import type { CardKind } from "@/lib/cards/kinds";
import { CARD_KIND_LABEL } from "@/lib/cards/kinds";
import { SOURCE_TAG_LABEL, type SourceTag } from "@/lib/admin/sources";
import { createBrowserSetting } from "@/lib/ui/browser-setting";
import { Toggle } from "@/components/ui/Toggle";

export type ReviewLang = "sv" | "en";

/** Språket i granskningen sparas i webbläsaren: en examinator som läser engelska slipper slå på det varje gång. */
const langSetting = createBrowserSetting<ReviewLang>(
  "kuggfri:granskning-sprak:v1",
  "sv",
  (raw) => (raw === "en" ? "en" : "sv"),
  (value) => (value === "sv" ? null : value),
);

export type ReviewText = {
  lang: ReviewLang;
  g: GranskningText;
  kind: Record<CardKind, string>;
  source: Record<SourceTag, string>;
  admin: typeof adminEn;
  common: { cancel: string; close: string; error: string };
};

const SV: ReviewText = {
  lang: "sv",
  g: sv.granskning,
  kind: CARD_KIND_LABEL,
  source: SOURCE_TAG_LABEL,
  admin: {
    alternativesHelp: sv.admin.alternativesHelp,
    markdownHelp: sv.admin.markdownHelp,
    reviewSkipped: sv.admin.reviewSkipped,
    original: sv.admin.original,
    originalHelp: sv.admin.originalHelp,
    sourceOriginalHelp: sv.admin.sourceOriginalHelp,
    sourceNoneHelp: sv.admin.sourceNoneHelp,
    trueWord: "Sant",
    falseWord: "Falskt",
  },
  common: { cancel: sv.common.cancel, close: sv.common.close, error: sv.errors.generic },
};

const EN: ReviewText = {
  lang: "en",
  g: granskningEn,
  kind: cardKindEn,
  source: sourceTagEn,
  admin: adminEn,
  common: { cancel: "Cancel", close: "Close", error: "Something went wrong. Please try again." },
};

/** Granskningens texter i det valda språket, och en funktion som byter språk. */
export function useReviewText(): [ReviewText, (lang: ReviewLang) => void] {
  const [lang, setLang] = langSetting.useSetting();
  return [lang === "en" ? EN : SV, setLang];
}

/** Granskningens texter i det valda språket (för komponenter som inte byter språk själva). */
export function useReviewT(): ReviewText {
  return useReviewText()[0];
}

/** Reglaget English: korten och granskningen på engelska. Bara i admin; studenterna ser alltid svenska. */
export function LanguageToggle({ className }: { className?: string }) {
  const [t, setLang] = useReviewText();
  const id = useId();
  return (
    <div className={className} title={t.g.languageHelp} data-testid="review-language">
      <span className="inline-flex items-center gap-2 text-sm font-semibold">
        <Languages size={16} aria-hidden className="text-muted" />
        <span id={id}>{t.g.language}</span>
        <Toggle checked={t.lang === "en"} onChange={(on) => setLang(on ? "en" : "sv")} labelledBy={id} />
      </span>
    </div>
  );
}
