"use client";

import { useCallback, useEffect, useState, type CSSProperties, type RefObject } from "react";

const GAP = 6;

/**
 * Fast position för en popup under (eller, om det inte får plats, över) en knapp.
 * Popupen renderas i en portal, så den klipps inte av scrollytor, och följer knappen
 * när sidan scrollas eller fönstret ändrar storlek. Samma bredd som knappen som minst.
 */
export function useAnchoredPopup(triggerRef: RefObject<HTMLElement | null>, open: boolean, estimatedHeight = 280): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const below = vh - r.bottom;
    const up = below < Math.min(estimatedHeight, 240) && r.top > below;
    const s: Record<string, string | number> = {
      left: Math.max(8, Math.min(r.left, vw - Math.max(r.width, 200) - 8)),
      minWidth: r.width,
      maxHeight: Math.max(160, (up ? r.top : below) - GAP - 12),
      "--pop-origin": up ? "left bottom" : "left top",
      "--pop-y": up ? "6px" : "-6px",
    };
    if (up) s.bottom = vh - r.top + GAP;
    else s.top = r.bottom + GAP;
    setStyle(s as CSSProperties);
  }, [triggerRef, estimatedHeight]);

  useEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return style;
}
