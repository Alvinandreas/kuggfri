"use client";

import { useActionState, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { deleteAccountAction, updateDisplayNameAction, type AuthResult } from "@/lib/auth/actions";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Props = { userId: string; email: string; displayName: string };

export function AccountPanel({ userId, email, displayName }: Props) {
  const [nameState, nameAction, namePending] = useActionState(
    async (_prev: AuthResult | null, fd: FormData) => updateDisplayNameAction(fd),
    null,
  );
  const store = useProgressStore(userId);
  const [confirm, setConfirm] = useState<"delete" | "resetAll" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    try {
      if (confirm === "delete") {
        // Vid lyckad radering svarar servern med en redirect; då finns inget resultat att läsa.
        const result = await deleteAccountAction();
        if (result && !result.ok) setNotice(result.error);
      } else if (confirm === "resetAll" && store) {
        await store.resetAll();
        setNotice(sv.deck.resetDone);
      }
    } catch {
      setNotice(sv.errors.generic);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{sv.account.title}</h1>

      <section className="grid gap-4 rounded-lg border border-line bg-surface p-5">
        <dl className="text-sm">
          <dt className="text-muted">{sv.account.email}</dt>
          <dd className="font-medium">{email}</dd>
        </dl>
        <form action={nameAction} className="grid gap-2">
          <label htmlFor="display_name" className="text-sm">
            {sv.account.displayName}
          </label>
          <div className="flex gap-2">
            <input
              id="display_name"
              name="display_name"
              defaultValue={displayName}
              maxLength={80}
              className="h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-fg"
            />
            <Button type="submit" variant="secondary" disabled={namePending}>
              {sv.account.save}
            </Button>
          </div>
          {nameState ? (
            <p role="status" className={`text-sm ${nameState.ok ? "text-accent" : "text-danger"}`}>
              {nameState.ok ? nameState.message : nameState.error}
            </p>
          ) : null}
        </form>
      </section>

      <section className="grid gap-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{sv.account.dataTitle}</h2>
        <p className="text-sm text-muted">{sv.account.downloadHelp}</p>
        <div>
          <a href="/api/konto/export" download="plugget-data.json" className="inline-flex h-11 items-center rounded-md border border-line-strong bg-surface px-4 font-medium hover:bg-surface-2">
            {sv.account.download}
          </a>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{sv.account.resetTitle}</h2>
        <p className="text-sm text-muted">{sv.deck.resetAllHelp}</p>
        <div>
          <Button variant="danger" onClick={() => setConfirm("resetAll")} disabled={!store}>
            {sv.deck.resetAll}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-danger/40 p-5">
        <h2 className="text-lg font-semibold">{sv.account.deleteTitle}</h2>
        <p className="text-sm text-muted">{sv.account.deleteHelp}</p>
        <div>
          <Button variant="danger" onClick={() => setConfirm("delete")} data-testid="delete-account">
            {sv.account.delete}
          </Button>
        </div>
      </section>

      {notice ? (
        <p role="status" className="text-sm text-accent">
          {notice}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? sv.account.deleteConfirmTitle : sv.deck.resetConfirmTitle}
        body={confirm === "delete" ? sv.account.deleteConfirm : sv.deck.resetAllConfirm}
        danger
        busy={busy}
        requireWord={confirm === "delete" ? "RADERA" : undefined}
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
