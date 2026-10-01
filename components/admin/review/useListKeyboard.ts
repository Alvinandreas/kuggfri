"use client";

import { useEffect } from "react";
import type { ReviewCard } from "@/lib/admin/review";
import { shouldIgnoreShortcut } from "@/lib/ui/keyboard";

/** Tangenter räknas inte i fält, listor, menyer och dialoger. */
const LIST_TYPING_SELECTOR = 'input, textarea, [role="combobox"], [role="listbox"], [role="menu"], dialog';

/**
 * Listan: J/K och pilarna flyttar mellan raderna, Enter öppnar (länkarnas eget beteende).
 * Bara när inget kort är öppet (current null).
 */
export function useListKeyboard(current: ReviewCard | null) {
  useEffect(() => {
    if (current) return;
    const onKey = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e, { handled: true, modifiers: true, selector: LIST_TYPING_SELECTOR, openDialog: true })) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const rows = [...document.querySelectorAll<HTMLElement>("[data-review-row]")];
      const i = rows.findIndex((r) => r === document.activeElement);
      // Pilarna rullar sidan som vanligt tills en rad har fokus.
      const down = key === "j" || (key === "ArrowDown" && i !== -1);
      const up = key === "k" || (key === "ArrowUp" && i !== -1);
      if ((!down && !up) || rows.length === 0) return;
      if (i === -1 && up) return;
      e.preventDefault();
      const to = i === -1 ? 0 : Math.max(0, Math.min(rows.length - 1, i + (down ? 1 : -1)));
      rows[to]?.focus();
      rows[to]?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);
}
