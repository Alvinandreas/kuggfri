"use client";

import { useActionState, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { deleteAccountAction, updateDisplayNameAction, type AuthResult } from "@/lib/auth/actions";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type DeckRef = { id: string; slug: string; title: string };
type Props = { userId: string; email: string; displayName: string; decks: DeckRef[] };
type Pending = { kind: "delete" } | { kind: "resetAll" } | { kind: "resetSchedule" } | { kind: "resetDeck"; deck: DeckRef };

export function AccountPanel({ userId, email, displayName, decks }: Props) {
  const [nameState, nameAction, namePending] = useActionState(
    async (_prev: AuthResult | null, fd: FormData) => updateDisplayNameAction(fd),
    null,
  );
  const store = useProgressStore(userId);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onConfirm() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "delete") {
        // Vid lyckad radering svarar servern med en redirect; då finns inget resultat att läsa.
        const result = await deleteAccountAction();
        if (result && !result.ok) setNotice(result.error);
      } else if (store) {
        if (pending.kind === "resetAll") await store.resetAll();
        else if (pending.kind === "resetSchedule") await store.resetSchedule(null, null);
        else await store.resetDeck(pending.deck.id, []);
        setNotice(sv.deck.resetDone);
      }
    } catch {
      setNotice(sv.errors.generic);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const dialog = (() => {
    switch (pending?.kind) {
      case "delete":
        return { title: sv.account.deleteConfirmTitle, body: sv.account.deleteConfirm, danger: true, word: "RADERA" };
      case "resetAll":
        return { title: sv.deck.resetConfirmTitle, body: sv.deck.resetAllConfirm, danger: true, word: undefined };
      case "resetSchedule":
        return { title: sv.deck.resetConfirmTitle, body: sv.deck.resetScheduleConfirm(sv.deck.selectionAll.toLowerCase()), danger: false, word: undefined };
      case "resetDeck":
        return { title: sv.deck.resetConfirmTitle, body: sv.deck.resetDeckConfirm(pending.deck.title), danger: true, word: undefined };
      default:
        return { title: "", body: "", danger: false, word: undefined };
    }
  })();

  return (
    <div className="mx-auto grid w-full max-w-[44rem] gap-8">
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

      <section className="grid gap-3 rounded-lg border border-line bg-surface p-5" aria-labelledby="nollstall-rubrik">
        <h2 id="nollstall-rubrik" className="text-lg font-semibold">
          {sv.account.resetTitle}
        </h2>
        <p className="text-sm text-muted">{sv.account.resetHelp}</p>
        {decks.length === 0 ? (
          <p className="text-sm text-muted">{sv.account.noDecks}</p>
        ) : (
          <ul className="grid gap-2">
            {decks.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-b-0">
                <span className="font-medium">{d.title}</span>
                <Button variant="danger" size="sm" onClick={() => setPending({ kind: "resetDeck", deck: d })} disabled={!store} data-testid={`reset-deck-${d.slug}`}>
                  {sv.account.resetDeckNamed(d.title)}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" size="sm" onClick={() => setPending({ kind: "resetSchedule" })} disabled={!store} data-testid="reset-schedule">
            {sv.account.resetScheduleAll}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setPending({ kind: "resetAll" })} disabled={!store} data-testid="reset-all">
            {sv.deck.resetAll}
          </Button>
        </div>
        <p className="text-xs text-muted">{sv.deck.resetScheduleHelp}</p>
      </section>

      <section className="grid gap-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{sv.account.dataTitle}</h2>
        <p className="text-sm text-muted">{sv.account.downloadHelp}</p>
        <div>
          <a href="/api/konto/export" download="kuggfri-data.json" className="inline-flex h-11 items-center rounded-md border border-line-strong bg-surface px-4 font-medium hover:bg-surface-2">
            {sv.account.download}
          </a>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-danger/40 p-5">
        <h2 className="text-lg font-semibold">{sv.account.deleteTitle}</h2>
        <p className="text-sm text-muted">{sv.account.deleteHelp}</p>
        <div>
          <Button variant="danger" onClick={() => setPending({ kind: "delete" })} data-testid="delete-account">
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
        open={pending !== null}
        title={dialog.title}
        body={dialog.body}
        danger={dialog.danger}
        busy={busy}
        requireWord={dialog.word}
        onConfirm={onConfirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
