"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import {
  MODE_SETTINGS,
  ORDER_CHOICES,
  SESSION_SIZES,
  type KindFilter,
  type SessionOrder,
  type SessionSettings,
  type SessionSize,
  type SettingsMode,
} from "@/lib/study/session-settings";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ToggleRow } from "@/components/ui/Toggle";
import { cx } from "@/components/ui/cx";

function Segment({ title, help, testId, children }: { title: string; help?: string; testId: string; children: ReactNode }) {
  return (
    <div data-testid={testId}>
      <p className="mb-1.5 text-sm font-semibold">{title}</p>
      {children}
      {help ? <p className="mt-1.5 text-sm text-muted">{help}</p> : null}
    </div>
  );
}

/**
 * Inställningar för passet: samma block för alla lägen, med de val som hör till läget
 * (lib/study/session-settings.ts). Segmentväljare för antal och ordning, reglage för
 * resten. Används i Ditt pass på kurssidan och i Dugga-dialogen på hemsidan.
 */
export function SessionSettingsFields({
  mode,
  value,
  onChange,
  available,
  hintCards,
  kindsOffered = true,
  className,
}: {
  mode: SettingsMode;
  value: SessionSettings;
  onChange: (settings: SessionSettings) => void;
  /** Kort i urvalet innan antalet begränsas (schemalagt: dagens kort), för "Alla (N)". */
  available: number;
  /** Kort i urvalet som har en ledtråd. Utan sådana visas inte ledtrådsvalet (utom i duggan). */
  hintCards: number;
  /** Uppgiftstyper visas bara när urvalet har både vändkort och flerval. */
  kindsOffered?: boolean;
  className?: string;
}) {
  const sv = useT();
  const ORDER_LABEL: Record<SessionOrder, string> = {
    standard: sv.passSettings.orderStandard,
    kurs: sv.passSettings.orderCourse,
    slump: sv.passSettings.orderRandom,
    omrade: sv.passSettings.byArea,
  };
  const KIND_LABEL: Record<KindFilter, string> = {
    alla: sv.passSettings.kindsAll,
    vand: sv.passSettings.kindsFlip,
    flerval: sv.passSettings.kindsQuiz,
  };
  const keys = MODE_SETTINGS[mode];
  const set = (patch: Partial<SessionSettings>) => onChange({ ...value, ...patch });
  const t = sv.passSettings;
  const isExam = mode === "exam";
  // En segmentväljare i stället för en rullgardin: fyra korta val syns direkt, och den
  // fungerar även inne i en dialog (rullgardinens lista ritas utanför dialogen).
  const sizeSegments = SESSION_SIZES.map((n) => ({
    value: String(n),
    label: n === "alla" ? (mode === "fsrs" ? t.sizeToday(available) : t.sizeAll(available)) : String(n),
  }));
  const orders = ORDER_CHOICES[mode];

  return (
    <div className={cx("grid gap-3 rounded-lg bg-surface-2 p-4", className)} data-testid="session-settings" data-mode={mode}>
      <p className="font-bold">{sv.dugga.settingsTitle}</p>
      {keys.map((key) => {
        switch (key) {
          case "size":
            return (
              <Segment key={key} title={isExam ? sv.dugga.questions : t.size} help={mode === "fsrs" ? t.sizeTodayHelp : undefined} testId="settings-size">
                <SegmentedControl
                  label={isExam ? sv.dugga.questions : t.size}
                  size="sm"
                  value={String(value.size)}
                  onChange={(v) => set({ size: (v === "alla" ? "alla" : Number(v)) as SessionSize })}
                  segments={sizeSegments}
                  tone="raised"
                />
              </Segment>
            );
          case "newCards":
            return <ToggleRow key={key} title={t.newCards} description={t.newCardsHelp} checked={value.newCards} onChange={(v) => set({ newCards: v })} />;
          case "order":
            if (orders.length === 3) {
              return (
                <Segment key={key} title={t.order} help={t.orderHelp} testId="settings-order">
                  <SegmentedControl
                    label={t.order}
                    size="sm"
                    value={value.order}
                    onChange={(v) => set({ order: v })}
                    segments={orders.map((o) => ({ value: o, label: ORDER_LABEL[o] }))}
                    tone="raised"
                  />
                </Segment>
              );
            }
            // Två ordningar blir ett reglage: på = den ordning som inte är standard (schemat),
            // eller standardordningen (kluriga: svåraste först).
            return mode === "fsrs" ? (
              <ToggleRow key={key} title={t.byArea} description={t.byAreaHelp} checked={value.order === "omrade"} onChange={(v) => set({ order: v ? "omrade" : "standard" })} />
            ) : (
              <ToggleRow key={key} title={t.hardestFirst} description={t.hardestFirstHelp} checked={value.order === "standard"} onChange={(v) => set({ order: v ? "standard" : "slump" })} />
            );
          case "kinds":
            return !kindsOffered ? null : (
              <Segment key={key} title={t.kinds} help={t.kindsHelp} testId="settings-kinds">
                <SegmentedControl
                  label={t.kinds}
                  size="sm"
                  value={value.kinds}
                  onChange={(v) => set({ kinds: v })}
                  segments={(["alla", "vand", "flerval"] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                  tone="raised"
                />
              </Segment>
            );
          case "unseen":
            return <ToggleRow key={key} title={t.unseen} description={t.unseenHelp} checked={value.unseen} onChange={(v) => set({ unseen: v })} />;
          case "followAreas":
            return <ToggleRow key={key} title={t.followAreas} description={t.followAreasHelp} checked={value.followAreas} onChange={(v) => set({ followAreas: v })} />;
          case "hints":
            return isExam || hintCards > 0 ? (
              <ToggleRow key={key} title={sv.dugga.hints} description={sv.dugga.hintsHelp} checked={value.hints} onChange={(v) => set({ hints: v })} />
            ) : null;
          case "timer":
            return <ToggleRow key={key} title={sv.dugga.timer} description={sv.dugga.timerHelp} checked={value.timer} onChange={(v) => set({ timer: v })} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
