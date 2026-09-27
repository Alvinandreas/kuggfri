"use client";

import { sv } from "@/lib/i18n/sv";
import { DUGGA_SIZES, type DuggaSettings, type DuggaSize } from "@/lib/study/dugga";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ToggleRow } from "@/components/ui/Toggle";
import { cx } from "@/components/ui/cx";

/**
 * Duggans regler: antal frågor, ledtrådar och tidtagning. Samma block på kurssidan och i
 * Dugga-dialogen på hemsidan, så att valen ser likadana ut överallt.
 */
export function DuggaSettingsFields({
  value,
  onChange,
  available,
  className,
}: {
  value: DuggaSettings;
  onChange: (settings: DuggaSettings) => void;
  /** Hur många kort urvalet har innan duggans tak, för alternativet "Alla (N)". */
  available: number;
  className?: string;
}) {
  // En segmentväljare i stället för en rullgardin: fyra korta val syns direkt, och den
  // fungerar även inne i en dialog (rullgardinens lista ritas utanför dialogen).
  const segments = DUGGA_SIZES.map((n) => ({ value: String(n), label: n === "alla" ? sv.dugga.questionsAll(available) : String(n) }));
  return (
    <div className={cx("grid gap-3 rounded-lg bg-surface-2 p-4", className)} data-testid="dugga-settings">
      <p className="font-bold">{sv.dugga.settingsTitle}</p>
      <div>
        <p className="mb-1.5 text-sm font-semibold">{sv.dugga.questions}</p>
        <div data-testid="dugga-size">
          <SegmentedControl
            label={sv.dugga.questions}
            size="sm"
            value={String(value.size)}
            onChange={(v) => onChange({ ...value, size: (v === "alla" ? "alla" : Number(v)) as DuggaSize })}
            segments={segments}
            tone="raised"
          />
        </div>
      </div>
      <ToggleRow title={sv.dugga.hints} description={sv.dugga.hintsHelp} checked={value.hints} onChange={(v) => onChange({ ...value, hints: v })} />
      <ToggleRow title={sv.dugga.timer} description={sv.dugga.timerHelp} checked={value.timer} onChange={(v) => onChange({ ...value, timer: v })} />
    </div>
  );
}
