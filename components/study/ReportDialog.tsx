"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { reportCardAction } from "@/lib/study/report-actions";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";

type Props = {
  open: boolean;
  cardId: string;
  onClose: () => void;
};

/**
 * "Rapportera fel på kortet": en liten dialog med textfält och valfri kontakt.
 * Byggd på Modal (<dialog>) så att fokus fångas och Escape stänger. Tangentbordsgenvägarna
 * i studieläget är avstängda medan en dialog är öppen.
 */
export function ReportDialog({ open, cardId, onClose }: Props) {
  const formId = useId();
  const doneRef = useRef<HTMLParagraphElement>(null);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  // Varje öppning börjar med ett tomt formulär. Nollställs när dialogen stängts (den är då
  // redan dold), så att förra kvittensen inte hinner blinka till vid nästa öppning.
  useEffect(() => {
    if (open) return;
    setMessage("");
    setError(null);
    setDone(false);
  }, [open]);

  // Skicka-knappen försvinner när rapporten skickats: flytta fokus till kvittensen i stället
  // för att tappa det. Dialogens kryss ("Stäng") är enda knappen därefter.
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await reportCardAction({ cardId, message, contact });
      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sv.report.title}
      locked={pending}
      footer={
        done ? undefined : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              {sv.common.cancel}
            </Button>
            <Button type="submit" form={formId} disabled={pending || message.trim().length < 3} data-testid="report-submit">
              {sv.report.send}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p
          ref={doneRef}
          tabIndex={-1}
          role="status"
          className="mt-2 rounded-lg bg-accent-soft px-4 py-3 text-sm font-medium text-accent-ink"
          data-testid="report-done"
        >
          {sv.report.sent}
        </p>
      ) : (
        <form
          id={formId}
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className="text-muted">{sv.report.help}</p>
          <TextArea
            label={sv.report.message}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={3}
            maxLength={1000}
            rows={4}
            data-testid="report-message"
          />
          <TextField
            label={sv.report.contact}
            type="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={200}
            autoComplete="email"
            data-testid="report-contact"
          />
          {error ? <ErrorBanner className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</ErrorBanner> : null}
        </form>
      )}
    </Modal>
  );
}
