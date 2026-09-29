"use client";

import { useMemo } from "react";
import { BookOpenText, CalendarClock, GraduationCap, Target } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";
import { planDeckSession } from "@/lib/study/deck-plan";
import { estimateMinutes } from "@/lib/study/plan";
import type { CategoryStats, SelectableCard } from "@/lib/study/selection";
import { percent } from "@/lib/text/percent";
import { tagBgClass } from "@/lib/ui/tag-colors";
import { ActionList, ActionRow } from "@/components/ui/ActionRow";
import { Modal } from "@/components/ui/Modal";
import { StatTile } from "./StatTile";

type Props = {
  open: boolean;
  onClose: () => void;
  deck: { slug: string; exam_date: string | null };
  cards: readonly SelectableCard[];
  category: { id: string; title: string; colorIndex: number } | null;
  stats: CategoryStats | undefined;
  progress: ProgressMap | null;
  reviews: readonly ReviewEntry[];
  dailyNew: number;
};

/**
 * Ett område i radardiagrammet, öppnat: hur det går (inlärda, kan nu, kluriga) och
 * genvägar till ett pass på bara det området. Samma planering som kurssidan, så antal
 * kort och länkar stämmer med vad passet sedan innehåller.
 */
export function CategoryFocusDialog({ open, onClose, deck, cards, category, stats, progress, reviews, dailyNew }: Props) {
  const plans = useMemo(() => {
    if (!category) return null;
    const base = { deck, cards, progress, reviews, selectedIds: [category.id], dailyNew };
    return {
      fsrs: planDeckSession({ ...base, mode: "fsrs" }),
      tricky: planDeckSession({ ...base, mode: "tricky" }),
      free: planDeckSession({ ...base, mode: "free" }),
    };
  }, [category, deck, cards, progress, reviews, dailyNew]);

  const total = stats?.total ?? 0;
  const learnedPct = total === 0 ? 0 : ((stats?.learned ?? 0) / total) * 100;
  const partialPct = total === 0 ? 0 : ((stats?.partial ?? 0) / total) * 100;

  return (
    <Modal open={open && category !== null} onClose={onClose} title={category?.title ?? ""} size="md">
      {category && plans ? (
        <div className="grid grid-cols-1 gap-6" data-testid="category-focus">
          <p className="flex items-start gap-3 text-sm text-muted">
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${tagBgClass(category.colorIndex)}`} aria-hidden />
            <span>
              {sv.home.cards(total)}
              {stats && stats.studied === 0 ? `. ${sv.focus.notStarted}` : null}
            </span>
          </p>

          <dl className="grid grid-cols-3 gap-3">
            <StatTile label={sv.focus.learned} value={`${stats?.learned ?? 0}`} sub={sv.focus.cardsOf(stats?.learned ?? 0, total)} tone="green" />
            <StatTile label={sv.focus.known} value={`${percent(stats?.known ?? 0, total)} %`} sub={sv.focus.knownSub} tone="navy" />
            <StatTile label={sv.focus.tricky} value={`${stats?.tricky ?? 0}`} sub={sv.focus.cardsOf(stats?.tricky ?? 0, total)} tone="teal" />
          </dl>

          <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
            <div className="h-full bg-chart-1 transition-[width] duration-700 ease-out" style={{ width: `${learnedPct}%` }} />
            <div className="h-full bg-chart-1/35 transition-[width] duration-700 ease-out" style={{ width: `${partialPct}%` }} />
          </div>

          <ActionList>
            <ActionRow
              href={plans.fsrs.canStart ? plans.fsrs.startHref : plans.fsrs.moreNew > 0 ? plans.fsrs.moreHref : plans.free.startHref}
              icon={CalendarClock}
              title={sv.focus.studyArea}
              meta={plans.fsrs.canStart ? sv.focus.studyAreaMeta(plans.fsrs.sessionCards, estimateMinutes(plans.fsrs.sessionCards)) : sv.focus.studyAreaDone}
              primary
              data-testid="focus-study"
            />
            {plans.tricky.selectionCount > 0 ? (
              <ActionRow
                href={plans.tricky.startHref}
                icon={Target}
                title={sv.focus.trickyArea}
                meta={`${sv.deck.summaryTricky(plans.tricky.selectionCount)}, cirka ${estimateMinutes(plans.tricky.selectionCount)} min`}
              />
            ) : null}
            <ActionRow
              href={plans.free.startHref}
              icon={BookOpenText}
              title={sv.focus.freeArea}
              meta={`${sv.home.cards(plans.free.selectionCount)}. ${sv.deck.modeFreeShort}`}
            />
            <ActionRow href={`/d/${deck.slug}?lage=exam&omrade=${encodeURIComponent(category.id)}`} icon={GraduationCap} title={sv.focus.examArea} meta={sv.dugga.areaMeta} />
          </ActionList>
        </div>
      ) : null}
    </Modal>
  );
}
