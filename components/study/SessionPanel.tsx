"use client";

import Link from "next/link";
import { ArrowRight, Info, Star } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { StudyMode } from "@/lib/progress/types";
import type { PickerMode } from "./ModePicker";
import type { StudyPrefs } from "@/lib/progress/prefs";
import type { DeckPlan } from "@/lib/study/deck-plan";
import { DAILY_NEW_CHOICES, estimateMinutes } from "@/lib/study/plan";
import { DUGGA_SIZES, duggaQuery, type DuggaSettings, type DuggaSize } from "@/lib/study/dugga";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Disclosure } from "@/components/ui/Disclosure";
import { Select } from "@/components/ui/Select";
import { ToggleRow } from "@/components/ui/Toggle";

const DAILY_OPTIONS = DAILY_NEW_CHOICES.map((n) => ({ value: String(n), label: `${sv.deck.newCards(n)} per dag` }));

const MODE_TITLES: Record<PickerMode, string> = {
  starred: sv.deck.modeStarred,
  fsrs: sv.deck.modeFsrs,
  tricky: sv.deck.modeTricky,
  free: sv.deck.modeFree,
  random: sv.deck.modeRandom,
  exam: sv.deck.modeExam,
};

type Props = {
  /** Valt läge på kurssidan (Stjärnmärkta körs som fri repetition). */
  pick: PickerMode;
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
  dugga: DuggaSettings;
  onDugga: (settings: DuggaSettings) => void;
  starredCount: number;
  onShowStarred: () => void;
};

/**
 * Ditt pass: vad som startar när man trycker på knappen (läge, urval, antal kort och tid),
 * och passets inställningar. Står fast i höger kolumn på desktop.
 */
export function SessionPanel({
  pick,
  mode,
  plan,
  selectedTitles,
  colorIndex,
  progressReady,
  firstVisit,
  totalCards,
  prefs,
  onPrefs,
  dugga,
  onDugga,
  starredCount,
  onShowStarred,
}: Props) {
  const { selectionCount, nothingDue, canStart, finalReview, sessionDue, sessionNew, sessionCards, moreNew } = plan;
  const firstCount = Math.min(prefs.dailyNew, totalCards);
  const isDugga = mode === "exam";
  // Duggans regler och stjärnfiltret följer med i adressen till passet.
  const isStarred = pick === "starred";
  const suffix = `${isDugga ? duggaQuery(dugga) : ""}${isStarred ? "&stjarnor=1" : ""}`;
  // Hur många kort urvalet har innan duggans tak, för alternativet "Alla (N)".
  const available = plan.selectionCards.length;
  const sizeOptions = DUGGA_SIZES.map((n) => ({ value: String(n), label: n === "alla" ? sv.dugga.questionsAll(available) : sv.dugga.questionsOption(n) }));

  return (
    <Card padding="lg" className="order-2 grid gap-5 lg:order-none" aria-labelledby="pass-rubrik" role="region">
      <CardHeader id="pass-rubrik" title={sv.deck.yourSession} action={<Badge tone="accent">{MODE_TITLES[pick]}</Badge>} spacing="none" />

      {firstVisit ? (
        <div className="flex gap-3 rounded-lg bg-surface-2 p-4 text-sm" data-testid="first-visit">
          <Info size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="font-semibold">{sv.deck.firstVisitTitle}</p>
            <p className="mt-0.5 text-muted">{sv.deck.firstVisitBody(firstCount, estimateMinutes(firstCount))}</p>
          </div>
        </div>
      ) : null}

      {isStarred ? (
        <button
          type="button"
          onClick={onShowStarred}
          className="flex items-center gap-3 rounded-lg bg-surface-2 p-4 text-left transition-colors hover:bg-surface-3"
          data-testid="show-starred"
        >
          <Star size={18} aria-hidden fill="currentColor" style={{ color: "var(--chart-3)" }} className="shrink-0" />
          <span className="font-semibold">{starredCount === 0 ? sv.session.starredTitle : sv.session.starredShow(starredCount)}</span>
        </button>
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

      {isDugga ? (
        <div className="grid gap-3 rounded-lg bg-surface-2 p-4" data-testid="dugga-settings">
          <p className="font-bold">{sv.dugga.settingsTitle}</p>
          <div>
            <p className="mb-1.5 text-sm font-semibold">{sv.dugga.questions}</p>
            <Select
              label={sv.dugga.questions}
              value={String(dugga.size)}
              onChange={(v) => onDugga({ ...dugga, size: (v === "alla" ? "alla" : Number(v)) as DuggaSize })}
              options={sizeOptions}
              data-testid="dugga-size"
            />
          </div>
          <ToggleRow title={sv.dugga.hints} description={sv.dugga.hintsHelp} checked={dugga.hints} onChange={(v) => onDugga({ ...dugga, hints: v })} />
          <ToggleRow title={sv.dugga.timer} description={sv.dugga.timerHelp} checked={dugga.timer} onChange={(v) => onDugga({ ...dugga, timer: v })} />
        </div>
      ) : null}

      <div className="grid gap-2">
        {canStart ? (
          <Link href={`${plan.startHref}${suffix}`} className={buttonClass("primary", "lg", "w-full")} data-testid="start-session">
            {isDugga ? sv.dugga.start : sv.deck.start}
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
          <Link href={`${plan.moreHref}${suffix}`} className={buttonClass("outline", "md", "w-full")} data-testid="start-more">
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
