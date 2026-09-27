"use client";

import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { StudyMode } from "@/lib/progress/types";
import type { StudyPrefs } from "@/lib/progress/prefs";
import type { DeckPlan } from "@/lib/study/deck-plan";
import { DAILY_NEW_CHOICES, estimateMinutes } from "@/lib/study/plan";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Disclosure } from "@/components/ui/Disclosure";
import { Select } from "@/components/ui/Select";
import { ToggleRow } from "@/components/ui/Toggle";

const DAILY_OPTIONS = DAILY_NEW_CHOICES.map((n) => ({ value: String(n), label: `${sv.deck.newCards(n)} per dag` }));

const MODE_TITLES: Record<StudyMode, string> = {
  fsrs: sv.deck.modeFsrs,
  tricky: sv.deck.modeTricky,
  free: sv.deck.modeFree,
  random: sv.deck.modeRandom,
  exam: sv.deck.modeExam,
};

type Props = {
  mode: StudyMode;
  plan: DeckPlan;
  /** Valda kategorier, i kursens ordning. Tom lista betyder hela kursen. */
  selectedTitles: { id: string; title: string }[];
  colorIndex: Map<string, number>;
  /** Falskt innan progress laddats: då visas inget om vad studenten redan kan. */
  progressReady: boolean;
  /** Första besöket: ingen progress alls ännu. */
  firstVisit: boolean;
  totalCards: number;
  prefs: StudyPrefs;
  onPrefs: (prefs: StudyPrefs) => void;
};

/**
 * Ditt pass: vad som startar när man trycker på knappen (läge, urval, antal kort och tid),
 * och passets inställningar. Står fast i höger kolumn på desktop.
 */
export function SessionPanel({ mode, plan, selectedTitles, colorIndex, progressReady, firstVisit, totalCards, prefs, onPrefs }: Props) {
  const { selectionCount, nothingDue, canStart, finalReview, sessionDue, sessionNew, sessionCards, moreNew } = plan;
  const firstCount = Math.min(prefs.dailyNew, totalCards);

  return (
    <Card padding="lg" className="order-2 grid gap-5 lg:order-none" aria-labelledby="pass-rubrik" role="region">
      <CardHeader id="pass-rubrik" title={sv.deck.yourSession} action={<Badge tone="accent">{MODE_TITLES[mode]}</Badge>} spacing="none" />

      {firstVisit ? (
        <div className="flex gap-3 rounded-lg bg-surface-2 p-4 text-sm" data-testid="first-visit">
          <Info size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="font-semibold">{sv.deck.firstVisitTitle}</p>
            <p className="mt-0.5 text-muted">{sv.deck.firstVisitBody(firstCount, estimateMinutes(firstCount))}</p>
          </div>
        </div>
      ) : null}

      {mode !== "random" ? (
        <div className="grid gap-2" data-testid="selection-summary">
          <p className="text-sm font-semibold text-muted">{sv.deck.summaryTitle}</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTitles.length === 0 ? (
              <span className="font-semibold">{sv.deck.summaryAll}</span>
            ) : (
              selectedTitles.map((c) => <CategoryTag key={c.id} title={c.title} colorIndex={colorIndex.get(c.id) ?? 0} />)
            )}
          </div>
          <p className="text-sm text-muted">
            {mode === "tricky" ? sv.deck.summaryTricky(selectionCount) : sv.deck.summaryCards(selectionCount)}
            {progressReady && mode !== "tricky" ? ` · ${sv.deck.summaryLearned(plan.selectionLearned)}` : ""}
          </p>
        </div>
      ) : null}

      <div className="grid gap-2">
        {canStart ? (
          <Link href={plan.startHref} className={buttonClass("primary", "lg", "w-full")} data-testid="start-session">
            {sv.deck.start}
            <ArrowRight size={18} aria-hidden />
          </Link>
        ) : (
          <Button size="lg" disabled className="w-full" data-testid="start-session">
            {sv.deck.start}
          </Button>
        )}
        <span className="text-center text-sm text-muted" data-testid="start-info">
          {mode === "fsrs" && plan.newCardPlan
            ? nothingDue
              ? moreNew > 0
                ? sv.summary.doneTitle
                : sv.deck.nothingDue
              : sv.deck.sessionPlan(sessionDue, finalReview ? selectionCount : sessionNew, estimateMinutes(sessionCards))
            : `${sv.home.cards(selectionCount)} · cirka ${estimateMinutes(selectionCount)} min`}
        </span>
        {mode === "fsrs" && nothingDue && moreNew > 0 ? (
          <Link href={plan.moreHref} className={buttonClass("outline", "md", "w-full")} data-testid="start-more">
            {sv.summary.continueNew(moreNew)}
          </Link>
        ) : null}
      </div>

      <Disclosure summary={sv.deck.sessionSettings} className="border-t border-line pt-3 text-sm">
        <div className="grid gap-3">
          <div>
            <p className="mb-1.5 font-semibold">{sv.deck.dailyGoal}</p>
            <Select label={sv.deck.dailyGoal} value={String(prefs.dailyNew)} onChange={(v) => onPrefs({ ...prefs, dailyNew: Number(v) })} options={DAILY_OPTIONS} data-testid="daily-new" />
            <p className="mt-1.5 text-muted">{sv.deck.dailyGoalHelp}</p>
          </div>
          <ToggleRow
            title={sv.deck.weekdaysOnly}
            description={sv.deck.weekdaysOnlyHelp}
            checked={prefs.weekdaysOnly}
            onChange={(v) => onPrefs({ ...prefs, weekdaysOnly: v })}
          />
        </div>
      </Disclosure>
    </Card>
  );
}
