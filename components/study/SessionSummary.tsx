"use client";

import { ArrowLeft, ArrowRight, Zap } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { firstLine } from "@/lib/text/first-line";
import { percent } from "@/lib/text/percent";
import type { SessionSummary as Summary } from "@/lib/fsrs/session";
import { SELF_RATINGS, type StudyMode } from "@/lib/progress/types";
import { formatRelative } from "@/lib/time/format";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/stats/StatTile";
import { ratingClass } from "./RatingButtons";
import { CategoryTag } from "@/components/ui/CategoryTag";
import type { StudyCard, TodaySummary } from "./types";
import { routes } from "@/lib/routes";

type Props = {
  summary: Summary;
  cardsById: Map<string, StudyCard>;
  categories: { id: string; title: string }[];
  colorIndex: Map<string, number>;
  mode: StudyMode;
  nextDue: { date: Date; count: number } | null;
  today: TodaySummary | null;
  deckSlug: string;
  onPrevious?: () => void;
  /** Duggans tid ("4:07") när tidtagning var vald. */
  duration?: string | null;
  /** Ett pass till med samma läge, urval och inställningar, eller null. */
  againHref?: string | null;
};

const barClass: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-rate-1",
  2: "bg-rate-2",
  3: "bg-rate-3",
  4: "bg-rate-4",
  5: "bg-rate-5",
};

export function SessionSummary({ summary, cardsById, categories, colorIndex, mode, nextDue, today, deckSlug, onPrevious, duration = null, againHref = null }: Props) {
  const max = Math.max(1, ...SELF_RATINGS.map((r) => summary.distribution[r]));
  const categoryTitle = (id: string | null) => (id ? (categories.find((c) => c.id === id)?.title ?? null) : null);
  const done = today?.done ?? false;
  // Ett Plugga vidare-pass som tog slut med dagen klar: egen rubrik, ingen "Klar för i dag" igen.
  const extraDone = done && (today?.extraPass ?? false);
  const offerExtra = !!today?.extraHref;
  const isExam = mode === "exam";
  const examOk = summary.distribution[4] + summary.distribution[5];
  const examPct = percent(examOk, summary.reviewed);

  return (
    <div className="mx-auto grid w-full max-w-[44rem] gap-6" data-testid="session-summary" data-done={done}>
      <header className={done ? "done-pop" : undefined}>
        <div className="flex items-center gap-3">
          {done ? (
            <span aria-hidden="true" className="done-mark inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          ) : null}
          <h1 className="text-3xl font-extrabold tracking-tight">{isExam ? sv.summary.examTitle : extraDone ? sv.summary.extraTitle : done ? sv.summary.doneTitle : sv.summary.title}</h1>
        </div>
        <p className="mt-2 text-lg text-muted" data-testid="summary-reviewed">
          {extraDone ? sv.summary.extraBody : done ? sv.summary.doneBody : sv.summary.reviewed(summary.reviewed)}
        </p>
        {isExam ? (
          <Card padding="lg" className="mt-5 grid gap-1" data-testid="exam-result">
            <p className="text-5xl font-extrabold tracking-tight tabular-nums">
              {examPct}
              <span className="text-2xl text-muted"> %</span>
            </p>
            <p className="mt-1 font-semibold">{sv.summary.examScore(examOk, summary.reviewed)}</p>
            {duration ? (
              <p className="font-semibold text-muted" data-testid="exam-duration">
                {sv.dugga.duration(duration)}
              </p>
            ) : null}
            <p className="text-sm text-muted">{sv.summary.examNote}</p>
          </Card>
        ) : null}
        {done ? <p className="sr-only">{sv.summary.reviewed(summary.reviewed)}</p> : null}
      </header>

      {today ? (
        <dl className="grid grid-cols-3 gap-3" data-testid="today-tiles">
          <StatTile label={sv.summary.tileToday} value={`${today.reviewsToday}`} sub={sv.summary.tileTodaySub(summary.reviewed)} tone="teal" />
          <StatTile
            label={sv.summary.tileStreak}
            value={`${today.streak}`}
            sub={today.freezeUsedRecently ? sv.summary.freezeUsed : sv.summary.freezesLeft(today.freezesLeft)}
            tone="navy"
          />
          <StatTile label={sv.summary.tileKnown} help={sv.summary.tileKnownHelp} value={`${today.known}`} sub={`av ${today.total}`} tone="green" />
        </dl>
      ) : null}

      {offerExtra && today?.extraHref ? (
        <section aria-labelledby="plugga-vidare" className="anim-fade-up grid gap-4 rounded-lg bg-accent-soft p-5 sm:p-6" data-testid="extra-offer">
          <div className="flex gap-3">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
              <Zap size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="plugga-vidare" className="text-lg font-bold tracking-tight text-accent-ink">
                {sv.summary.extraHeading}
              </h2>
              <p className="mt-1 text-sm text-fg">{sv.summary.extraOffer(today.extraCount)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <LinkButton href={today.extraHref} size="lg" data-testid="continue-extra">
              {sv.summary.extraButton}
              <ArrowRight size={18} aria-hidden />
            </LinkButton>
            {today.continueHref ? (
              <LinkButton href={today.continueHref} variant="outline" size="lg" className="bg-surface" data-testid="continue-new">
                {sv.summary.continueNew(today.continueCount)}
              </LinkButton>
            ) : null}
          </div>
        </section>
      ) : null}

      <Card padding="lg" role="region" aria-labelledby="fordelning" className="anim-fade-up" style={{ ["--i" as string]: 1 }}>
        <h2 id="fordelning" className="text-lg font-bold tracking-tight">
          {sv.summary.distribution}
        </h2>
        <ol className="mt-4 grid gap-3">
          {SELF_RATINGS.map((r) => {
            const n = summary.distribution[r];
            return (
              <li key={r} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-xs font-bold text-fg ${ratingClass[r]}`}>{r}</span>
                  {sv.study.rate[r]}
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                  <span className={`block h-full rounded-full ${barClass[r]}`} style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{n}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card padding="lg" role="region" aria-labelledby="behover-arbete" className="anim-fade-up" style={{ ["--i" as string]: 2 }}>
        <h2 id="behover-arbete" className="text-lg font-bold tracking-tight">
          {sv.summary.needsWork}
        </h2>
        {summary.needsWork.length === 0 ? (
          <p className="mt-2 text-muted">{sv.summary.needsWorkEmpty}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-subtle">
                  <th scope="col" className="py-2.5 pr-3 font-semibold">
                    {sv.summary.colQuestion}
                  </th>
                  <th scope="col" className="py-2.5 pr-3 font-semibold">
                    {sv.deck.selectionCategory}
                  </th>
                  <th scope="col" className="py-2.5 text-right font-semibold">
                    {sv.summary.colRating}
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.needsWork.slice(0, 10).map(({ cardId, rating }) => {
                  const card = cardsById.get(cardId);
                  const title = categoryTitle(card?.category_id ?? null);
                  return (
                    <tr key={cardId} className="border-b border-line last:border-b-0">
                      <td className="py-3 pr-3 align-middle font-medium">{firstLine(card?.front ?? "")}</td>
                      <td className="py-3 pr-3 align-middle">
                        {title && card?.category_id ? <CategoryTag title={title} colorIndex={colorIndex.get(card.category_id) ?? 0} /> : <span className="text-muted">–</span>}
                      </td>
                      <td className="py-3 text-right align-middle">
                        <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-xs font-bold text-fg ${ratingClass[rating]}`}>
                          {rating}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Duggans resultatruta säger redan hur svaren räknas in i schemat. */}
      {isExam ? null : (
        <Card padding="lg" role="region" aria-labelledby="nasta" className="anim-fade-up" style={{ ["--i" as string]: 3 }}>
          <h2 id="nasta" className="text-lg font-bold tracking-tight">
            {sv.summary.nextDue}
          </h2>
          <p className="mt-2 text-muted" data-testid="next-due">
            {nextDue ? sv.summary.nextDueCount(nextDue.count, formatRelative(nextDue.date)) : sv.summary.nextDueNone}
            {/* Övriga lägen räknas också in i schemat: säg det, så att ingen tror att passet var bortkastat. */}
            {mode === "fsrs" ? null : (
              <>
                {" "}
                {mode === "tricky" ? sv.summary.trickyModeNote : mode === "random" ? sv.summary.randomModeNote : sv.summary.freeModeNote}
              </>
            )}
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <LinkButton href={routes.deck(deckSlug)} variant={offerExtra ? "secondary" : "primary"} size="lg">
          {sv.summary.backToDeck}
        </LinkButton>
        {againHref ? (
          <LinkButton href={againHref} variant="secondary" size="lg" data-testid="again">
            {isExam ? sv.summary.againExam : sv.summary.again}
          </LinkButton>
        ) : null}
        {today?.passHref ? (
          <LinkButton href={today.passHref} variant="secondary" size="lg" data-testid="continue-pass">
            {sv.summary.continuePass(today.passCount)}
          </LinkButton>
        ) : today?.continueHref && !offerExtra ? (
          <LinkButton href={today.continueHref} variant="secondary" size="lg" data-testid="continue-new">
            {sv.summary.continueNew(today.continueCount)}
          </LinkButton>
        ) : (
          <LinkButton href={routes.home()} variant="secondary" size="lg">
            {sv.summary.home}
          </LinkButton>
        )}
        {onPrevious ? (
          <Button variant="ghost" size="lg" onClick={onPrevious}>
            <ArrowLeft size={18} aria-hidden />
            {sv.study.previous}
          </Button>
        ) : null}
      </div>
      {today?.continueHref && !today.passHref && !offerExtra ? <p className="-mt-3 text-sm text-muted">{sv.summary.continueHelp}</p> : null}
    </div>
  );
}
