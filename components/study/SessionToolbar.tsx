"use client";

import { Flag, Info, Volume2, VolumeX } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { useSoundEnabled } from "@/lib/ui/sound";
import { IconButton } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Ikonmenyn under skattningsknapparna: instruktioner, ljud av/på och felrapport. Varje
 * knapp har en etikett som visas vid hovring och fokus.
 */
export function SessionToolbar({ onInfo, onReport, canReport }: { onInfo: () => void; onReport: () => void; canReport: boolean }) {
  const [soundOn, setSoundOn] = useSoundEnabled();
  return (
    <div role="toolbar" aria-label={sv.session.toolbar} className="flex items-center justify-center gap-2">
      <Tooltip label={sv.session.info}>
        <IconButton label={sv.session.info} variant="secondary" onClick={onInfo} data-testid="session-info">
          <Info size={18} aria-hidden />
        </IconButton>
      </Tooltip>
      <Tooltip label={soundOn ? sv.session.soundOn : sv.session.soundOff}>
        <IconButton
          label={soundOn ? sv.session.soundOn : sv.session.soundOff}
          variant="secondary"
          onClick={() => setSoundOn(!soundOn)}
          aria-pressed={!soundOn}
          data-testid="session-sound"
        >
          {soundOn ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
        </IconButton>
      </Tooltip>
      {canReport ? (
        <Tooltip label={sv.session.report}>
          <IconButton label={sv.session.report} variant="secondary" onClick={onReport} data-testid="report-open">
            <Flag size={17} aria-hidden />
          </IconButton>
        </Tooltip>
      ) : null}
    </div>
  );
}
