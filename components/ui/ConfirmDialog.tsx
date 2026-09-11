"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { Button } from "./Button";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Om satt måste användaren skriva exakt detta ord för att bekräfta. */
  requireWord?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Bekräftelsedialog byggd på det inbyggda <dialog>-elementet:
 * fokus fångas, Escape stänger och fokus återgår till utlösaren.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = sv.common.confirm,
  cancelLabel = sv.common.cancel,
  danger = false,
  requireWord,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const [word, setWord] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setWord("");
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const canConfirm = !busy && (!requireWord || word.trim() === requireWord);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onCancel();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-lg border border-line bg-surface p-0 text-fg shadow-card backdrop:bg-black/40"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-muted">
          {body}
        </p>
        {requireWord ? (
          <label className="mt-4 block text-sm">
            <span className="text-muted">{sv.account.deleteConfirmWord}</span>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoComplete="off"
              className="mt-1 h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-fg"
            />
          </label>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={!canConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
