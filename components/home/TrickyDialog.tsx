"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";
import { planDeckSession } from "@/lib/study/deck-plan";
import { estimateMinutes } from "@/lib/study/plan";
import type { CategoryStats, SelectableCard } from "@/lib/study/selection";
import { tagBgClass } from "@/lib/ui/tag-colors";
import { StatTile } from "@/components/stats/StatTile";
import { ActionRow } from "@/components/ui/ActionRow";
import { Checkbox } from "@/components/ui/Choice";
import { Modal } from "@/components/ui/Modal";
import { cx } from "@/components/ui/cx";

type Props = {
  open: boolean;
  onClose: () => void;
  deck: { slug: string; exam_date: string | null };
  cards: readonly SelectableCard[];
  categories: readonly { id: string; title: string; colorIndex: number }[];
  categoryStats: readonly CategoryStats[];
  progress: ProgressMap | null;
  reviews: readonly ReviewEntry[];
  dailyNew: number;
};

/**
 * Genvägen Kluriga kort på hemsidan, öppnad: hur många kluriga kort det finns (och varför
 * de räknas som kluriga), vilka områden de ligger i, och en knapp som startar passet
 * direkt. Områdena går att bocka ur; planeringen är densamma som på kurssidan.
 */
export function TrickyDialog({ open, onClose, deck, cards, categories, categoryStats, progress, reviews, dailyNew }: Props) {
  const statsById = useMemo(() => new Map(categoryStats.map((s) => [s.categoryId, s] as const)), [categoryStats]);
  // Områden som har något klurigt att ta; de andra visas men går inte att välja.
  const selectable = useMemo(() => categories.filter((c) => (statsById.get(c.id)?.tricky ?? 0) > 0).map((c) => c.id), [categories, statsById]);
  const [picked, setPicked] = useState<string[]>(selectable);

  // Varje gång dialogen öppnas börjar den med alla områden valda.
  useEffect(() => {
    if (open) setPicked(selectable);
  }, [open, selectable]);

  // Alla valda = hela kursen (då följer även kort utan kategori med), annars bara de valda.
  const allPicked = picked.length === selectable.length;
  const plan = useMemo(
    () => planDeckSession({ deck, cards, progress, reviews, mode: "tricky", selectedIds: allPicked ? [] : picked, dailyNew }),
    [deck, cards, progress, reviews, picked, allPicked, dailyNew],
  );

  const count = plan.selectionCount;
  const weak = plan.selectionCards.filter((c) => {
    const rating = progress?.[c.id]?.self_rating;
    return rating != null && rating <= 2;
  }).length;
  const unseen = count - weak;
  const minutes = estimateMinutes(count);
  const none = picked.length === 0 || count === 0;

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : selectable.filter((x) => x === id || prev.includes(x))));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sv.deck.modeTricky}
      size="md"
      // Startknappen står fast längst ner, så den syns även när listan med områden är lång.
      footer={
        none ? (
          <p className="w-full rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted" role="status">
            {sv.quick.trickyNone}
          </p>
        ) : (
          <ActionRow href={plan.startHref} icon={Target} title={sv.quick.trickyStart} meta={sv.quick.startMeta(count, minutes)} primary data-testid="tricky-start" />
        )
      }
    >
      <div className="grid gap-6" data-testid="tricky-dialog">
        <p className="text-muted">{sv.quick.trickyLead}</p>

        <dl className="grid grid-cols-3 gap-3">
          <StatTile label={sv.quick.weak} value={`${weak}`} sub={sv.quick.cardsOf(weak, count)} tone="teal" />
          <StatTile label={sv.quick.unseen} value={`${unseen}`} sub={sv.quick.cardsOf(unseen, count)} tone="navy" />
          <StatTile label={sv.quick.time} value={sv.quick.minutes(minutes)} sub={sv.quick.about} tone="green" />
        </dl>

        <section aria-labelledby="kluriga-omraden" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h3 id="kluriga-omraden" className="font-bold">
                {sv.quick.areas}
              </h3>
              <p className="text-sm text-muted">{sv.quick.areasHelp}</p>
            </div>
            {!allPicked ? (
              <button type="button" onClick={() => setPicked(selectable)} className="text-sm font-semibold text-accent hover:underline">
                {sv.quick.selectAll}
              </button>
            ) : null}
          </div>
          <ul className="grid gap-1.5" data-testid="tricky-areas">
            {categories.map((c) => {
              const s = statsById.get(c.id);
              const tricky = s?.tricky ?? 0;
              const enabled = tricky > 0;
              const checked = picked.includes(c.id);
              return (
                <li key={c.id}>
                  <label
                    className={cx(
                      "flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150",
                      enabled ? "cursor-pointer" : "cursor-not-allowed opacity-45",
                      checked ? "bg-accent-soft/60" : "bg-surface-2/60 hover:bg-surface-2",
                    )}
                  >
                    <Checkbox checked={checked} disabled={!enabled} onChange={() => toggle(c.id)} />
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tagBgClass(c.colorIndex)}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-semibold">{c.title}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">{sv.quick.areaCount(s?.weak ?? 0, tricky - (s?.weak ?? 0))}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <Link href={`/d/${deck.slug}?lage=tricky`} className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-accent hover:underline">
          {sv.quick.onCoursePage}
          <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </Modal>
  );
}
