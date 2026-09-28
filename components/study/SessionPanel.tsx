"use client";

import Link from "next/link";
import { ArrowRight, Info, Star } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { StudyMode } from "@/lib/progress/types";
import type { PickerMode } from "./ModePicker";
import type { DeckPlan } from "@/lib/study/deck-plan";
import { estimateMinutes } from "@/lib/study/plan";
import { duggaQuery, type DuggaSettings } from "@/lib/study/dugga";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ToggleRow } from "@/components/ui/Toggle";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { DuggaSettingsFields } from "./DuggaSettingsFields";

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
  /** Nya kort per dag (ställs in under Konto), för hälsningen vid första besöket. */
  dailyNew: number;
  dugga: DuggaSettings;
  onDugga: (settings: DuggaSettings) => void;
  starredCount: number;
  onShowStarred: () => void;
  /** Valet "Bara originalkorten", eller null när kursen inte har både original och nya kort. */
  original: { count: number; on: boolean; onChange: (next: boolean) => void } | null;
};

/**
 * Ditt pass: vad som startar när man trycker på knappen (läge, urval, antal kort och tid),
 * och duggans regler. Nya kort per dag och vardagsrytmen ställs in under Konto. Står fast
 * i höger kolumn på desktop.
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
  dailyNew,
  dugga,
  onDugga,
  starredCount,
  onShowStarred,
  original,
}: Props) {
  const { selectionCount, nothingDue, canStart, finalReview, sessionDue, sessionNew, sessionCards, moreNew } = plan;
  const firstCount = Math.min(dailyNew, totalCards);
  const isDugga = mode === "exam";
  // Duggans regler och stjärnfiltret följer med i adressen till passet.
  const isStarred = pick === "starred";
  const suffix = `${isDugga ? duggaQuery(dugga) : ""}${isStarred ? "&stjarnor=1" : ""}${original?.on ? "&original=1" : ""}`;

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

      {original ? (
        <div className="-my-1 border-t border-line pt-2" data-testid="only-original">
          <ToggleRow
            title={sv.deck.onlyOriginal}
            description={sv.deck.onlyOriginalHelp(original.count)}
            checked={original.on}
            onChange={original.onChange}
          />
        </div>
      ) : null}

      {isDugga ? <DuggaSettingsFields value={dugga} onChange={onDugga} available={plan.selectionCards.length} /> : null}

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

    </Card>
  );
}
