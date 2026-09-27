"use client";

import { useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { drawReadiness, shareReadiness, type ReadinessCard } from "@/lib/share/readiness-image";
import { Button } from "@/components/ui/Button";

/**
 * "Dela din beredskap": ritar en bild av hur stor del av kursen studenten kan och delar
 * den (eller laddar ner den). Allt sker i webbläsaren; inget skickas till oss.
 */
export function ShareReadiness({ card, showHelp = true }: { card: ReadinessCard; showHelp?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas || !drawReadiness(canvas, card)) return;
    const result = await shareReadiness(canvas, card);
    setNotice(result === "shared" ? sv.deck.shareReadinessShared : result === "downloaded" ? sv.deck.shareReadinessDone : sv.errors.generic);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Button variant="secondary" size="sm" onClick={share} data-testid="share-readiness">
        <Share2 size={15} aria-hidden />
        {sv.deck.shareReadiness}
      </Button>
      {showHelp || notice ? (
        <span role={notice ? "status" : undefined} className="text-muted">
          {notice ?? sv.deck.shareReadinessHelp}
        </span>
      ) : null}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
