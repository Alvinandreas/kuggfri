"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { addExaminerAction, removeExaminerAction } from "@/lib/admin/actions";
import type { DeckExaminer } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/time/format";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const inputClass = "h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-fg";

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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-lg border border-line bg-surface p-5">
      {examiners.length === 0 ? (
        <p className="text-sm text-muted">{sv.admin.noExaminers}</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2" data-testid="examiner-list">
          {examiners.map((x) => (
            <li key={x.user_id ?? x.email} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-bg px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{x.display_name ? `${x.display_name} · ` : ""}</span>
                <span className="break-all">{x.email}</span>
                {x.pending ? <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{sv.admin.examinerPending}</span> : null}
                <span className="block text-xs text-muted">{formatDateTime(x.created_at)}</span>
              </div>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => setRemoving(x)}>
                {sv.admin.removeExaminer}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAdd} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
          <span>{sv.admin.examinerEmail}</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} data-testid="examiner-email" autoComplete="off" />
        </label>
        <Button type="submit" disabled={pending} data-testid="examiner-add">
          {sv.admin.addExaminer}
        </Button>
      </form>
      {message ? (
        <p role="status" className={`text-sm ${message.ok ? "text-accent" : "text-danger"}`}>
          {message.text}
        </p>
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
    </div>
  );
}
