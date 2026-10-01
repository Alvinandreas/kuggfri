"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { addExaminerAction, removeExaminerAction } from "@/lib/admin/actions";
import type { DeckExaminer } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/time/format";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormMessage } from "@/components/ui/FormMessage";
import { TextField } from "@/components/ui/TextField";

/** Admins verktyg för att ge och ta ifrån examinatorsrätt på ett deck. */
export function ExaminerManager({ deckId, examiners }: { deckId: string; examiners: DeckExaminer[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<DeckExaminer | null>(null);

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addExaminerAction(deckId, email);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      if (result.data.status === "exists") return setMessage({ ok: false, text: sv.admin.examinerExists });
      setMessage({ ok: true, text: result.data.status === "invited" ? sv.admin.examinerInvited : sv.admin.examinerAdded });
      setEmail("");
      router.refresh();
    });
  }

  function onRemove() {
    const target = removing;
    if (!target) return;
    startTransition(async () => {
      const result = await removeExaminerAction(deckId, target.user_id ? { userId: target.user_id } : { email: target.email });
      if (!result.ok) setMessage({ ok: false, text: result.error });
      else setMessage(null);
      setRemoving(null);
      router.refresh();
    });
  }

  return (
    <Card padding="lg" className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {examiners.length === 0 ? (
        <p className="text-sm text-muted">{sv.admin.noExaminers}</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2" data-testid="examiner-list">
          {examiners.map((x) => (
            <li key={x.user_id ?? x.email} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-2 px-4 py-3 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={x.display_name || x.email} size={36} />
                <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                  {x.display_name ? <span className="font-semibold">{x.display_name}</span> : null}
                  <span className="break-all text-muted">{x.email}</span>
                  {x.pending ? (
                    <Badge tone="outline" className="ml-2">
                      {sv.admin.examinerPending}
                    </Badge>
                  ) : null}
                  <span className="block text-xs text-muted">{formatDateTime(x.created_at)}</span>
                </div>
              </div>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setRemoving(x)}>
                {sv.admin.removeExaminer}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <TextField
          label={sv.admin.examinerEmail}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="examiner-email"
          autoComplete="off"
        />
        <Button type="submit" size="lg" disabled={pending} data-testid="examiner-add">
          {sv.admin.addExaminer}
        </Button>
      </form>
      {message ? (
        <FormMessage role="status" ok={message.ok}>
          {message.text}
        </FormMessage>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        title={sv.admin.removeExaminer}
        body={removing ? sv.admin.examinerRemoveConfirm(removing.email) : ""}
        danger
        busy={pending}
        onConfirm={onRemove}
        onCancel={() => setRemoving(null)}
      />
    </Card>
  );
}
