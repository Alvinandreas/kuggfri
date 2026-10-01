"use client";

import Link from "next/link";
import { ArrowRight, CircleCheckBig, Info, Star } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { StudyMode } from "@/lib/progress/types";
import type { PickerMode } from "./ModePicker";
import type { DeckPlan } from "@/lib/study/deck-plan";
import { estimateMinutes } from "@/lib/study/plan";
import { settingsQuery, type SessionSettings } from "@/lib/study/session-settings";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { SessionSettingsFields } from "./SessionSettingsFields";

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
  /** Inställningarna för det valda läget (antal, ordning, ledtrådar …). */
  settings: SessionSettings;
  onSettings: (settings: SessionSettings) => void;
  /** Kort i passets urval som har en ledtråd: styr om ledtrådsvalet visas. */
  hintCards: number;
  /** Kursen har både vändkort och flerval: då går uppgiftstyperna att välja. */
  kindsOffered: boolean;
  starredCount: number;
  onShowStarred: () => void;
};

/**
 * Ditt pass: vad som startar när man trycker på knappen (läge, urval, antal kort och tid),
 * och lägets inställningar. Nya kort per dag och vardagsrytmen ställs in under Konto. Står
 * fast i höger kolumn på desktop.
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
  settings,
  onSettings,
  hintCards,
  kindsOffered,
  starredCount,
  onShowStarred,
}: Props) {
  const { selectionCount, nothingDue, canStart, finalReview, sessionDue, sessionNew, sessionCards, moreNew } = plan;
  // Dagens schemalagda pass är klart: erbjud Plugga vidare i stället för en död Starta-knapp.
  const offerExtra = mode === "fsrs" && nothingDue && plan.canExtra;
  // Det första passet i det valda urvalet (inte hela dagsmålet när bara ett område är valt).
  const firstCount = sessionCards > 0 ? sessionCards : Math.min(dailyNew, totalCards);
  const isDugga = mode === "exam";
  // Inställningarna och stjärnfiltret följer med i adressen till passet.
  const isStarred = pick === "starred";
  const suffix = `${settingsQuery(pick, settings)}${isStarred ? "&stjarnor=1" : ""}`;
  // Slumpläget går genom hela kursen, om inte studenten valt att följa de ikryssade områdena.
  const showSelection = mode !== "random" || settings.followAreas;

  return (
    <Card padding="lg" className="order-2 grid gap-5 lg:order-none" aria-labelledby="pass-rubrik" role="region">
      <CardHeader id="pass-rubrik" title={sv.deck.yourSession} action={<Badge tone="accent">{MODE_TITLES[pick]}</Badge>} spacing="none" />

      {firstVisit && mode === "fsrs" ? (
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

      {showSelection ? (
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
            {/* Urvalet före inställningen Antal kort; hur många passet tar står vid Starta. */}
            {mode === "tricky" ? sv.deck.summaryTricky(plan.selectionCards.length) : sv.deck.summaryCards(plan.selectionCards.length)}
            {progressReady && mode !== "tricky" ? `, ${sv.deck.summaryLearned(plan.selectionLearned)}` : ""}
          </p>
        </div>
      ) : null}

      <SessionSettingsFields mode={pick} value={settings} onChange={onSettings} available={plan.availableCount} hintCards={hintCards} kindsOffered={kindsOffered} />

      {offerExtra ? (
        <div className="flex gap-3 rounded-lg bg-accent-soft p-4 text-sm" data-testid="extra-panel">
          <CircleCheckBig size={18} aria-hidden className="mt-0.5 shrink-0 text-accent-ink" />
          <div>
            <p className="font-semibold text-accent-ink">{sv.deck.extraTitle}</p>
            <p className="mt-0.5 text-fg">{sv.deck.extraBody(plan.extraCount)}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        {offerExtra ? (
          <Link href={`${plan.extraHref}${suffix}`} className={buttonClass("primary", "lg", "w-full")} data-testid="start-extra">
            {sv.deck.extraStart}
            <ArrowRight size={18} aria-hidden />
          </Link>
        ) : canStart ? (
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
              ? offerExtra
                ? sv.deck.extraInfo
                : sv.deck.nothingDue
              : sv.deck.sessionPlan(sessionDue, finalReview ? selectionCount : sessionNew, estimateMinutes(sessionCards))
            : selectionCount === 0
              ? isStarred
                ? sv.deck.noStarred
                : sv.deck.noCardsSelected
              : `${sv.home.cards(selectionCount)}, cirka ${estimateMinutes(selectionCount)} min`}
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
