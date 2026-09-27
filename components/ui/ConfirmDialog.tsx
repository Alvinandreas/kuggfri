"use client";

import { useEffect, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { TextField } from "./TextField";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Om satt måste användaren skriva exakt detta ord för att bekräfta. */
  requireWord?: string;
  /** Etikett för fältet ovan; standard: kontosidans text. */
  requireWordLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Bekräftelse före något som inte går att ångra. Bygger på Modal: fokus fångas, Esc stänger. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = sv.common.confirm,
  cancelLabel = sv.common.cancel,
  danger = false,
  requireWord,
  requireWordLabel,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const [word, setWord] = useState("");
  useEffect(() => {
    if (open) setWord("");
  }, [open]);

  const canConfirm = !busy && (!requireWord || word.trim() === requireWord);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      locked={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={!canConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-muted">{body}</p>
      {requireWord ? (
        <TextField
          className="mt-5"
          label={requireWordLabel ?? sv.account.deleteConfirmWord}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          autoComplete="off"
        />
      ) : null}
    </Modal>
  );
}
