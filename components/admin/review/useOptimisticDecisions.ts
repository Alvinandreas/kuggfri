"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { sv } from "@/lib/i18n/sv";
import type { ActionResult } from "@/lib/admin/action-helpers";
import type { ReviewCard } from "@/lib/admin/review";
import type { ReviewSnapshot } from "@/lib/admin/review-actions";
import type { ReviewStatus } from "../ReviewCardView";

/** Listan med kortet id ersatt av fn(kortet). */
export function patchList(list: ReviewCard[], id: string, fn: (c: ReviewCard) => ReviewCard): ReviewCard[] {
  return list.map((c) => (c.id === id ? fn(c) : c));
}

/**
 * Korten med besluten som syns direkt (optimistiskt), och sparandet bakom dem: vilka kort som
 * har en åtgärd på väg (inFlight), hur många beslut som ännu inte sparats (saving, som varnar
 * innan man lämnar sidan), run som kör en serveråtgärd och rullar tillbaka om den misslyckas,
 * och restoreLocal som återställer kortens granskningsläge lokalt.
 */
export function useOptimisticDecisions(serverCards: ReviewCard[], serverNow: number, setStatus: Dispatch<SetStateAction<ReviewStatus | null>>) {
  const [cards, setCards] = useState(serverCards);
  const [now, setNow] = useState(serverNow);
  const inFlight = useRef(new Map<string, number>());
  // Beslut som ännu inte sparats på servern. Lämnar man sidan då kan beslutet gå förlorat,
  // så webbläsaren varnar tills allt är sparat.
  const [saving, setSaving] = useState(0);
  useEffect(() => {
    if (saving === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);
  const latestCards = useRef(cards);
  useEffect(() => {
    latestCards.current = cards;
  });

  // Nya data från servern (efter en åtgärd revalideras sidan). Kort med en åtgärd på väg
  // behåller sitt lokala läge, så att ett snabbt andra beslut inte blinkar tillbaka.
  useEffect(() => {
    setCards((prev) => {
      const local = new Map(prev.map((c) => [c.id, c] as const));
      const busy = (id: string) => (inFlight.current.get(id) ?? 0) > 0;
      const merged = serverCards.map((c) => (busy(c.id) ? (local.get(c.id) ?? c) : c));
      const seen = new Set(serverCards.map((c) => c.id));
      for (const c of prev) if (busy(c.id) && !seen.has(c.id)) merged.push(c);
      return merged;
    });
    setNow((n) => Math.max(n, serverNow));
  }, [serverCards, serverNow]);

  function mark(ids: string[], delta: 1 | -1) {
    for (const id of ids) inFlight.current.set(id, (inFlight.current.get(id) ?? 0) + delta);
    setSaving((n) => Math.max(0, n + delta * ids.length));
  }

  /** Kör en serveråtgärd; misslyckas den körs revert och felet visas. */
  async function run<T>(ids: string[], action: () => Promise<ActionResult<T>>, revert: () => void): Promise<T | null> {
    mark(ids, 1);
    try {
      const result = await action();
      if (result.ok) return result.data;
      revert();
      setStatus({ id: Date.now(), text: result.error, tone: "danger" });
      return null;
    } catch {
      revert();
      setStatus({ id: Date.now(), text: sv.errors.generic, tone: "danger" });
      return null;
    } finally {
      mark(ids, -1);
    }
  }

  function restoreLocal(snaps: ReviewSnapshot[]) {
    const byId = new Map(snaps.map((s) => [s.id, s] as const));
    setCards((prev) => prev.map((c) => (byId.has(c.id) ? { ...c, ...byId.get(c.id)! } : c)));
  }

  return { cards, setCards, now, setNow, inFlight, saving, latestCards, mark, run, restoreLocal };
}
