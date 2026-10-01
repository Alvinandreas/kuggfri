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
import { DuggaSettingsFields } from "@/components/study/DuggaSettingsFields";
import { ActionRow } from "@/components/ui/ActionRow";
import { Modal } from "@/components/ui/Modal";
import { routes } from "@/lib/routes";

type Props = {
  open: boolean;
  onClose: () => void;
  deck: { slug: string; exam_date: string | null };
  cards: readonly SelectableCard[];
  progress: ProgressMap | null;
  reviews: readonly ReviewEntry[];
  dailyNew: number;
};

/**
 * Genvägen Dugga på hemsidan, öppnad: frågor ur hela kursen, duggans regler (antal frågor,
 * ledtrådar, tidtagning) och en knapp som startar den direkt. Startknappen sammanfattar
 * reglerna som gäller just nu.
 */
export function DuggaDialog({ open, onClose, deck, cards, progress, reviews, dailyNew }: Props) {
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

        <DuggaSettingsFields value={dugga} onChange={setDugga} available={available} />

        <Link href={routes.deck(deck.slug, { lage: "exam" })} className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-accent hover:underline">
          {sv.quick.onCoursePage}
          <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </Modal>
  );
}
