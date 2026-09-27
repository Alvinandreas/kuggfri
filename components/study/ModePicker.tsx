"use client";

import { BookOpenText, CalendarClock, GraduationCap, Shuffle, Star, Target, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { sv } from "@/lib/i18n/sv";
import type { StudyMode } from "@/lib/progress/types";
import type { DeckPlan } from "@/lib/study/deck-plan";
import { CardHeader } from "@/components/ui/Card";
import { OptionTile } from "@/components/ui/Choice";

/** Lägena på kurssidan. "starred" är fri repetition av de stjärnmärkta korten. */
export type PickerMode = StudyMode | "starred";

const MODES: ReadonlyArray<{ value: PickerMode; title: string; short: string; icon: ComponentType<LucideProps> }> = [
  { value: "fsrs", title: sv.deck.modeFsrs, short: sv.deck.modeFsrsShort, icon: CalendarClock },
  { value: "tricky", title: sv.deck.modeTricky, short: sv.deck.modeTrickyShort, icon: Target },
  { value: "free", title: sv.deck.modeFree, short: sv.deck.modeFreeShort, icon: BookOpenText },
  { value: "random", title: sv.deck.modeRandom, short: sv.deck.modeRandomShort, icon: Shuffle },
  { value: "exam", title: sv.deck.modeExam, short: sv.deck.modeExamShort, icon: GraduationCap },
  { value: "starred", title: sv.deck.modeStarred, short: sv.deck.modeStarredShort, icon: Star },
];

type Props = {
  mode: PickerMode;
  onMode: (mode: PickerMode) => void;
  /** Planen för varje läge med nuvarande urval: ger siffran på varje ruta. */
  plans: Record<PickerMode, DeckPlan>;
  progressReady: boolean;
  totalCards: number;
};

function meta(mode: PickerMode, plan: DeckPlan, progressReady: boolean, totalCards: number): string {
  if (!progressReady && (mode === "fsrs" || mode === "tricky")) return " ";
  switch (mode) {
    case "fsrs":
      return plan.nothingDue ? sv.deck.metaDone : sv.deck.metaToday(plan.sessionCards);
    case "tricky":
      return sv.deck.summaryTricky(plan.selectionCount);
    case "random":
      return sv.home.cards(totalCards);
    case "exam":
      return sv.deck.metaExam(plan.selectionCount);
    case "starred":
      return sv.deck.metaStarred(plan.selectionCount);
    default:
      return sv.home.cards(plan.selectionCount);
  }
}

/** Lägena som stora rutor: vad passet blir, och hur mycket det innehåller just nu. */
export function ModePicker({ mode, onMode, plans, progressReady, totalCards }: Props) {
  return (
    <section aria-labelledby="lage-rubrik" className="anim-fade-up" style={{ ["--i" as string]: 1 }}>
      <CardHeader id="lage-rubrik" title={sv.deck.chooseMode} spacing="sm" />
      <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="mode-picker">
        <legend className="sr-only">{sv.deck.chooseMode}</legend>
        {MODES.map((m) => (
          <OptionTile
            key={m.value}
            name="mode"
            value={m.value}
            checked={mode === m.value}
            onChange={() => onMode(m.value)}
            icon={m.icon}
            title={m.title}
            description={m.short}
            meta={meta(m.value, plans[m.value], progressReady, totalCards)}
          />
        ))}
      </fieldset>
    </section>
  );
}
