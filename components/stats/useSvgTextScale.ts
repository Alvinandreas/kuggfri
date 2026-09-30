"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Diagrammen ritas i en fast viewBox och skalas med sin behållare. Utan kompensation följer
 * texten med: axeletiketterna blev 7 px på en telefon och 17 px i ett brett kort på desktop.
 * Kroken mäter den ritade bredden och ger en faktor (viewBox-bredd / ritad bredd) som texten
 * multipliceras med, så att etiketterna håller ungefär samma storlek i pixlar överallt.
 * Före första mätningen (servern) är faktorn 1, som förut.
 */
export function useSvgTextScale(viewBoxWidth: number, { min = 0.6, max = 1.6 } = {}) {
  const ref = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setScale(Math.min(max, Math.max(min, viewBoxWidth / width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewBoxWidth, min, max]);
  return [ref, scale] as const;
}
