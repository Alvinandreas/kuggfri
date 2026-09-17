"use client";

import { sv } from "@/lib/i18n/sv";
import { firstLine } from "@/lib/text/first-line";
import type { SessionSummary as Summary } from "@/lib/fsrs/session";
import { SELF_RATINGS, type StudyMode } from "@/lib/progress/types";
import { formatRelative } from "@/lib/time/format";
import { Button, LinkButton } from "@/components/ui/Button";
import { ratingClass } from "./RatingButtons";
import { CategoryTag } from "@/components/ui/CategoryTag";
import type { StudyCard } from "./StudySession";

type Props = {
  summary: Summary;
  cardsById: Map<string, StudyCard>;
  categories: { id: string; title: string }[];
  colorIndex: Map<string, number>;
  mode: StudyMode;
  nextDue: { date: Date; count: number } | null;
  deckSlug: string;
  onPrevious?: () => void;
};

const barClass: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-rate-1",
  2: "bg-rate-2",
  3: "bg-rate-3",
  4: "bg-rate-4",
  5: "bg-rate-5",
};

export function SessionSummary({ summary, cardsById, categories, colorIndex, mode, nextDue, deckSlug, onPrevious }: Props) {
  const max = Math.max(1, ...SELF_RATINGS.map((r) => summary.distribution[r]));
  const categoryTitle = (id: string | null) => (id ? (categories.find((c) => c.id === id)?.title ?? null) : null);

  return (
    <div className="mx-auto grid w-full max-w-[44rem] gap-6" data-testid="session-summary">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{sv.summary.title}</h1>
        <p className="mt-1 text-muted" data-testid="summary-reviewed">
          {sv.summary.reviewed(summary.reviewed)}
        </p>
      </header>

      <section aria-labelledby="fordelning" className="rounded-lg border border-line bg-surface p-5">
        <h2 id="fordelning" className="text-lg font-semibold">
          {sv.summary.distribution}
        </h2>
        <ol className="mt-3 grid gap-2">
          {SELF_RATINGS.map((r) => {
            const n = summary.distribution[r];
            return (
              <li key={r} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3 text-sm">
                <span>
                  {r} – {sv.study.rate[r]}
                </span>
                <span className="h-3 overflow-hidden rounded bg-surface-2" aria-hidden="true">
                  <span className={`block h-full rounded ${barClass[r]}`} style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-muted">{n}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="behover-arbete" className="rounded-lg border border-line bg-surface p-5">
        <h2 id="behover-arbete" className="text-lg font-semibold">
          {sv.summary.needsWork}
        </h2>
        {summary.needsWork.length === 0 ? (
          <p className="mt-2 text-muted">{sv.summary.needsWorkEmpty}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {sv.summary.colQuestion}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {sv.deck.selectionCategory}
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
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
                      <td className="py-2.5 pr-3 align-middle">{firstLine(card?.front ?? "")}</td>
                      <td className="py-2.5 pr-3 align-middle">
                        {title && card?.category_id ? <CategoryTag title={title} colorIndex={colorIndex.get(card.category_id) ?? 0} /> : <span className="text-muted">–</span>}
                      </td>
                      <td className="py-2.5 text-right align-middle">
                        <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-semibold text-fg ${ratingClass[rating]}`}>
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
      </section>

      <section aria-labelledby="nasta" className="rounded-lg border border-line bg-surface p-5">
        <h2 id="nasta" className="text-lg font-semibold">
          {sv.summary.nextDue}
        </h2>
        <p className="mt-2 text-muted" data-testid="next-due">
          {mode !== "fsrs"
            ? sv.summary.freeModeNote
            : nextDue
              ? sv.summary.nextDueCount(nextDue.count, formatRelative(nextDue.date))
              : sv.summary.nextDueNone}
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <LinkButton href={`/d/${deckSlug}`} variant="primary">
          {sv.summary.backToDeck}
        </LinkButton>
        <LinkButton href="/" variant="secondary">
          {sv.summary.home}
        </LinkButton>
        {onPrevious ? (
          <Button variant="ghost" onClick={onPrevious}>
            {sv.study.previous}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
