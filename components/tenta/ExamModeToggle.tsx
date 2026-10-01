"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { setExamModeOpenAction } from "@/lib/tentor/actions";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { ToggleRow } from "@/components/ui/Toggle";

/** Reglaget i kursens inställningar: tentaläget öppet eller låst för studenterna. */
export function ExamModeToggle({ deckId, open: initial }: { deckId: string; open: boolean }) {
  const sv = useT();
  const router = useRouter();
  const [open, setOpen] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function change(next: boolean) {
    setOpen(next);
    setMessage(null);
    startTransition(async () => {
      const res = await setExamModeOpenAction(deckId, next);
      if (res.ok) {
        setMessage({ ok: true, text: next ? sv.tenta.modeOpened : sv.tenta.modeLocked });
        router.refresh();
      } else {
        setOpen(!next);
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  return (
    <Card data-testid="exam-mode-toggle">
      <ToggleRow title={sv.tenta.modeToggle} description={sv.tenta.modeToggleHelp} checked={open} onChange={change} disabled={pending} />
      {message ? (
        <FormMessage ok={message.ok} className="mt-2 text-sm font-medium" okClassName="text-accent-ink">
          {message.text}
        </FormMessage>
      ) : null}
    </Card>
  );
}
