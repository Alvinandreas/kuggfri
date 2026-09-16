"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { reportCardAction } from "@/lib/study/report-actions";
import { Button } from "@/components/ui/Button";

type Props = {
  open: boolean;
  cardId: string;
  onClose: () => void;
};

/**
 * "Rapportera fel på kortet": en liten dialog med textfält och valfri kontakt.
 * Byggd på <dialog> så att fokus fångas och Escape stänger. Tangentbordsgenvägarna
 * i studieläget är avstängda medan en dialog är öppen.
 */
export function ReportDialog({ open, cardId, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setMessage("");
      setError(null);
      setDone(false);
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await reportCardAction({ cardId, message, contact });
      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !pending) onClose();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-lg border border-line bg-surface p-0 text-fg shadow-card backdrop:bg-black/40"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {sv.report.title}
        </h2>
        {done ? (
          <>
            <p role="status" className="mt-3 rounded-md bg-accent-soft px-3 py-2 text-sm" data-testid="report-done">
              {sv.report.sent}
            </p>
            <div className="mt-5 flex justify-end">
              <Button onClick={onClose}>{sv.common.close}</Button>
            </div>
          </>
        ) : (
          <form
            className="mt-2 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <p className="text-sm text-muted">{sv.report.help}</p>
            <label className="grid gap-1 text-sm">
              <span>{sv.report.message}</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={3}
                maxLength={1000}
                rows={4}
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-fg"
                data-testid="report-message"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{sv.report.contact}</span>
              <input
                type="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={200}
                autoComplete="email"
                className="h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-fg"
                data-testid="report-contact"
              />
            </label>
            {error ? (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                {sv.common.cancel}
              </Button>
              <Button type="submit" disabled={pending || message.trim().length < 3} data-testid="report-submit">
                {sv.report.send}
              </Button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
