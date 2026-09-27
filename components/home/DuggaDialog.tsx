"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";
import { planDeckSession } from "@/lib/study/deck-plan";
import { DEFAULT_DUGGA, duggaExamSize, duggaQuery, type DuggaSettings } from "@/lib/study/dugga";
import { estimateMinutes } from "@/lib/study/plan";
import type { SelectableCard } from "@/lib/study/selection";
import { StatTile } from "@/components/stats/StatTile";
import { DuggaSettingsFields } from "@/components/study/DuggaSettingsFields";
import { ActionRow } from "@/components/ui/ActionRow";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Modal } from "@/components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  deck: { slug: string; exam_date: string | null };
  cards: readonly SelectableCard[];
  categories: readonly { id: string; title: string; colorIndex: number }[];
  progress: ProgressMap | null;
  reviews: readonly ReviewEntry[];
  dailyNew: number;
};

/**
 * Genvägen Dugga på hemsidan, öppnad: duggans regler (antal frågor, ledtrådar, tidtagning),
 * vad den kommer att testa, och en knapp som startar den direkt. Rutorna överst följer
 * valen, så man ser vad man får innan man trycker.
 */
export function DuggaDialog({ open, onClose, deck, cards, categories, progress, reviews, dailyNew }: Props) {
  const [dugga, setDugga] = useState<DuggaSettings>(DEFAULT_DUGGA);

  // Varje gång dialogen öppnas börjar den med standardreglerna, som på kurssidan.
  useEffect(() => {
    if (open) setDugga(DEFAULT_DUGGA);
  }, [open]);

  const plan = useMemo(
    () => planDeckSession({ deck, cards, progress, reviews, mode: "exam", selectedIds: [], dailyNew, examSize: duggaExamSize(dugga.size) }),
    [deck, cards, progress, reviews, dailyNew, dugga.size],
  );
  const available = plan.selectionCards.length;
  const count = plan.selectionCount;
  const minutes = estimateMinutes(count);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sv.deck.modeExam}
      size="md"
      // Startknappen står fast längst ner och sammanfattar reglerna som gäller just nu.
      footer={
        <ActionRow
          href={`${plan.startHref}${duggaQuery(dugga)}`}
          icon={GraduationCap}
          title={sv.dugga.start}
          meta={sv.quick.duggaStartMeta(count, minutes, dugga.hints)}
          primary
          data-testid="dugga-start"
        />
      }
    >
      <div className="grid gap-6" data-testid="dugga-dialog">
        <p className="text-muted">{sv.quick.duggaLead}</p>

        <dl className="grid grid-cols-3 gap-3">
          <StatTile label={sv.quick.questions} value={`${count}`} sub={sv.quick.questionsFrom(available)} tone="green" />
          <StatTile label={sv.quick.time} value={sv.quick.minutes(minutes)} sub={dugga.timer ? sv.quick.timerOn : sv.quick.timerOff} tone="navy" />
          <StatTile label={sv.quick.hints} value={dugga.hints ? sv.quick.hintsOn : sv.quick.hintsOff} sub={sv.quick.hintsSub} tone="teal" />
        </dl>

        <DuggaSettingsFields value={dugga} onChange={setDugga} available={available} />

        {categories.length > 0 ? (
          <section aria-labelledby="dugga-omraden" className="grid gap-2">
            <h3 id="dugga-omraden" className="font-bold">
              {sv.quick.drawnFrom}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <CategoryTag key={c.id} title={c.title} colorIndex={c.colorIndex} />
              ))}
            </div>
            <p className="text-sm text-muted">{sv.quick.drawnFromHelp(categories.length)}</p>
          </section>
        ) : null}

        <Link href={`/d/${deck.slug}?lage=exam`} className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-accent hover:underline">
          {sv.quick.onCoursePage}
          <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </Modal>
  );
}
