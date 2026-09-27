"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { StudyMode } from "@/lib/progress/types";
import type { StudyPrefs } from "@/lib/progress/prefs";
import type { DeckPlan } from "@/lib/study/deck-plan";
import { DAILY_NEW_CHOICES, estimateMinutes } from "@/lib/study/plan";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { ChoiceCard } from "@/components/ui/Choice";
import { Disclosure } from "@/components/ui/Disclosure";
import { Select } from "@/components/ui/Select";
import { ToggleRow } from "@/components/ui/Toggle";

const MODES = [
  ["fsrs", sv.deck.modeFsrs, sv.deck.modeFsrsHelp],
  ["tricky", sv.deck.modeTricky, sv.deck.modeTrickyHelp],
  ["free", sv.deck.modeFree, sv.deck.modeFreeHelp],
  ["random", sv.deck.modeRandom, sv.deck.modeRandomHelp],
  ["exam", sv.deck.modeExam, sv.deck.modeExamHelp],
] as const satisfies readonly (readonly [StudyMode, string, string])[];

const DAILY_OPTIONS = DAILY_NEW_CHOICES.map((n) => ({ value: String(n), label: `${sv.deck.newCards(n)} per dag` }));

type Props = {
  mode: StudyMode;
  onMode: (mode: StudyMode) => void;
  plan: DeckPlan;
  /** Valda kategorier, i kursens ordning. Tom lista betyder hela kursen. */
  selectedTitles: { id: string; title: string }[];
  colorIndex: Map<string, number>;
  /** Falskt innan progress laddats: då visas inget om vad studenten redan kan. */
  progressReady: boolean;
  prefs: StudyPrefs;
  onPrefs: (prefs: StudyPrefs) => void;
};

/** Höger kolumn på kurssidan: välj läge, se vad passet innehåller, starta. */
export function SessionPanel({ mode, onMode, plan, selectedTitles, colorIndex, progressReady, prefs, onPrefs }: Props) {
  const { selectionCount, nothingDue, canStart, finalReview, sessionDue, sessionNew, sessionCards, moreNew } = plan;

  return (
    <Card padding="lg" className="order-2 grid gap-5" aria-labelledby="lage-rubrik" role="region">
      <CardHeader id="lage-rubrik" title={sv.deck.chooseMode} spacing="none" />
      <fieldset className="grid gap-2">
        <legend className="sr-only">{sv.deck.chooseMode}</legend>
        {MODES.map(([value, label, help]) => (
          <ChoiceCard key={value} name="mode" value={value} checked={mode === value} onChange={() => onMode(value)} title={label} description={help} />
        ))}
      </fieldset>

      {mode !== "random" ? (
        <div className="grid gap-2 rounded-lg bg-surface-2 p-4" data-testid="selection-summary">
          <p className="text-sm font-semibold text-subtle">{sv.deck.summaryTitle}</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTitles.length === 0 ? (
              <span className="font-medium">{sv.deck.summaryAll}</span>
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

      <Disclosure summary={sv.deck.dailyGoal} className="border-t border-line pt-3 text-sm">
        <div className="grid gap-3">
          <div>
            <Select label={sv.deck.dailyGoal} value={String(prefs.dailyNew)} onChange={(v) => onPrefs({ ...prefs, dailyNew: Number(v) })} options={DAILY_OPTIONS} data-testid="daily-new" />
            <p className="mt-1.5 text-sm text-muted">{sv.deck.dailyGoalHelp}</p>
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
