"use client";

import Link from "next/link";
import { sv } from "@/lib/i18n/sv";
import type { StudyMode } from "@/lib/progress/types";
import type { StudyPrefs } from "@/lib/progress/prefs";
import type { DeckPlan } from "@/lib/study/deck-plan";
import { DAILY_NEW_CHOICES, estimateMinutes } from "@/lib/study/plan";
import { Button, buttonClass } from "@/components/ui/Button";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Select } from "@/components/ui/Select";

const MODES = [
  ["fsrs", sv.deck.modeFsrs, sv.deck.modeFsrsHelp],
  ["tricky", sv.deck.modeTricky, sv.deck.modeTrickyHelp],
  ["free", sv.deck.modeFree, sv.deck.modeFreeHelp],
  ["random", sv.deck.modeRandom, sv.deck.modeRandomHelp],
  ["exam", sv.deck.modeExam, sv.deck.modeExamHelp],
] as const satisfies readonly (readonly [StudyMode, string, string])[];

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
    <section aria-labelledby="lage-rubrik" className="order-2 grid gap-4 rounded-lg border border-line bg-surface p-5 shadow-card">
      <h2 id="lage-rubrik" className="text-lg font-semibold">
        {sv.deck.chooseMode}
      </h2>
      <fieldset className="grid gap-2">
        <legend className="sr-only">{sv.deck.chooseMode}</legend>
        {MODES.map(([value, label, help]) => (
          <label
            key={value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              mode === value ? "border-accent bg-accent-soft" : "border-line bg-bg hover:border-line-strong"
            }`}
          >
            <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => onMode(value)} className="mt-1 accent-[var(--accent)]" />
            <span>
              <span className="block font-medium">{label}</span>
              <span className="block text-sm text-muted">{help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {mode !== "random" ? (
        <div className="grid gap-2 rounded-lg border border-line bg-bg p-3" data-testid="selection-summary">
          <p className="text-sm font-medium">{sv.deck.summaryTitle}</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTitles.length === 0 ? (
              <span className="text-sm text-muted">{sv.deck.summaryAll}</span>
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
          <Link href={plan.startHref} className={buttonClass("primary", "lg")} data-testid="start-session">
            {sv.deck.start}
          </Link>
        ) : (
          <Button size="lg" disabled data-testid="start-session">
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
          <Link href={plan.moreHref} className="text-center text-sm text-accent underline underline-offset-2" data-testid="start-more">
            {sv.summary.continueNew(moreNew)}
          </Link>
        ) : null}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-fg">{sv.deck.dailyGoal}</summary>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1">
            <span className="sr-only">{sv.deck.dailyGoal}</span>
            <Select fit value={String(prefs.dailyNew)} onChange={(e) => onPrefs({ ...prefs, dailyNew: Number(e.target.value) })} data-testid="daily-new">
              {DAILY_NEW_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {sv.deck.newCards(n)} per dag
                </option>
              ))}
            </Select>
            <span className="text-xs text-muted">{sv.deck.dailyGoalHelp}</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={prefs.weekdaysOnly}
              onChange={(e) => onPrefs({ ...prefs, weekdaysOnly: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block">{sv.deck.weekdaysOnly}</span>
              <span className="block text-xs text-muted">{sv.deck.weekdaysOnlyHelp}</span>
            </span>
          </label>
        </div>
      </details>
    </section>
  );
}
