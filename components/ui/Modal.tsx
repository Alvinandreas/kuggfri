"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { IconButton } from "./Button";
import { cx } from "./cx";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Knappar eller länkar längst ner. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Hindrar stängning (Esc, klick utanför, krysset), t.ex. medan något sparas. */
  locked?: boolean;
};

const widths = { sm: "w-[min(94vw,26rem)]", md: "w-[min(94vw,34rem)]", lg: "w-[min(94vw,46rem)]" };

/**
 * Dialog på det inbyggda <dialog>-elementet: fokus fångas, Escape stänger och fokus
 * återgår till knappen som öppnade den. Tonar och glider in (se .ui-modal i globals.css).
 */
export function Modal({ open, onClose, title, children, footer, size = "md", locked = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
      className={cx("ui-modal m-auto max-h-[90dvh] rounded-xl bg-surface p-0 text-fg shadow-pop", widths[size])}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6 sm:px-8 sm:pt-7">
          <h2 id={titleId} className="text-2xl font-bold tracking-tight">
            {title}
          </h2>
          <IconButton label={sv.common.close} variant="outline" onClick={onClose} disabled={locked}>
            <X size={18} strokeWidth={2} aria-hidden />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-6 pb-6 sm:px-8">{children}</div>
        {footer ? <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end sm:px-8">{footer}</div> : null}
      </div>
    </dialog>
  );
}
