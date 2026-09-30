"use client";

import type { DuggaSettings } from "@/lib/study/dugga";
import { defaultSettings } from "@/lib/study/session-settings";
import { SessionSettingsFields } from "./SessionSettingsFields";

/**
 * Duggans inställningar (antal frågor, ledtrådar, tidtagning) för Dugga-dialogen på
 * hemsidan: samma block som i Ditt pass på kurssidan, så att valen ser likadana ut överallt.
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
  return (
    <SessionSettingsFields
      mode="exam"
      value={{ ...defaultSettings("exam"), ...value }}
      onChange={(s) => onChange({ size: s.size, hints: s.hints, timer: s.timer })}
      available={available}
      hintCards={0}
      className={className}
    />
  );
}
