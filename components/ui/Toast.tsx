"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { cx } from "./cx";

type Props = {
  /** Meddelandet; null = ingen toast. Ett nytt värde (eller ny id) startar om nedräkningen. */
  message: ReactNode | null;
  /** Byts för varje ny händelse, även om texten är densamma. */
  id?: string | number;
  /** T.ex. en Ångra-knapp. */
  action?: { label: string; onClick: () => void };
  onClose: () => void;
  /** Millisekunder innan den försvinner av sig själv; 0 = stannar. */
  duration?: number;
  tone?: "default" | "danger";
};

/**
 * Liten bekräftelse längst ner på skärmen ("Godkänt: … Ångra"). Läses upp artigt för
 * skärmläsare, tonar in underifrån och försvinner av sig själv efter en stund.
 */
export function Toast({ message, id, action, onClose, duration = 8000, tone = "default" }: Props) {
  const visible = message !== null && message !== undefined && message !== false;
  // Senaste onClose utan att starta om nedräkningen vid varje rendering hos föräldern.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!visible || duration <= 0) return;
    const t = window.setTimeout(() => close.current(), duration);
    return () => window.clearTimeout(t);
  }, [visible, id, duration]);

  return (
    <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
      {visible ? (
        <div
          key={id}
          role="status"
          className={cx(
            "anim-fade-up pointer-events-auto flex max-w-[min(94vw,36rem)] items-center gap-3 rounded-full py-2 pl-5 pr-2 text-sm font-medium shadow-pop",
            tone === "danger" ? "bg-danger text-accent-fg" : "bg-inverse text-inverse-fg",
          )}
        >
          <span className="min-w-0 truncate">{message}</span>
          {action ? (
            <button
              type="button"
              onClick={action.onClick}
              className="shrink-0 rounded-full px-3 py-1.5 font-bold underline-offset-2 transition-colors duration-150 hover:bg-white/15 hover:underline dark:hover:bg-black/10"
            >
              {action.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label={sv.common.close}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-70 transition-[opacity,background-color] duration-150 hover:bg-white/15 hover:opacity-100 dark:hover:bg-black/10"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
