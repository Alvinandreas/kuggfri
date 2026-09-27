"use client";

import { useActionState, useState } from "react";
import { Download } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { deleteAccountAction, updateDisplayNameAction, updateEmailPrefsAction, updatePasswordAction, type AuthResult } from "@/lib/auth/actions";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { inputClass } from "@/components/ui/TextField";
import { ThemeSwitcher } from "@/components/ui/ThemeToggle";
import { ToggleRow } from "@/components/ui/Toggle";
import { cx } from "@/components/ui/cx";

type DeckRef = { id: string; slug: string; title: string };
type Props = {
  userId: string;
  email: string;
  displayName: string;
  decks: DeckRef[];
  /** Efter återställningslänk: lyft fram lösenordsbytet. */
  focusPassword?: boolean;
  reminderEmail?: boolean;
  digestEmail?: boolean;
  /** Examinatorer och admin ser även veckobrevets reglage. */
  isExaminer?: boolean;
};
type Pending = { kind: "delete" } | { kind: "resetAll" } | { kind: "resetSchedule" } | { kind: "resetDeck"; deck: DeckRef };
/** Besked efter en bekräftad handling, visat i det block handlingen hör till. */
type Notice = { text: string; ok: boolean; where: "reset" | "delete" };

/** Svaret från ett formulär: grönt när det gick, rött annars. */
function FormStatus({ state }: { state: AuthResult | null }) {
  if (!state) return null;
  return (
    <p role="status" className={cx("text-sm font-medium", state.ok ? "text-accent" : "text-danger")}>
      {state.ok ? state.message : state.error}
    </p>
  );
}

function NoticeText({ notice }: { notice: Notice }) {
  return (
    <p role="status" className={cx("text-sm font-medium", notice.ok ? "text-accent" : "text-danger")}>
      {notice.text}
    </p>
  );
}

export function AccountPanel({ userId, email, displayName, decks, focusPassword = false, reminderEmail = false, digestEmail = true, isExaminer = false }: Props) {
  const [nameState, nameAction, namePending] = useActionState(
    async (_prev: AuthResult | null, fd: FormData) => updateDisplayNameAction(fd),
    null,
  );
  const [prefsState, prefsAction, prefsPending] = useActionState(
    async (_prev: AuthResult | null, fd: FormData) => updateEmailPrefsAction(fd),
    null,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    async (_prev: AuthResult | null, fd: FormData) => updatePasswordAction(fd),
    null,
  );
  const store = useProgressStore(userId);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Reglagen är knappar, inte formulärfält: värdet skickas i dolda fält med samma namn
  // och värde ("on") som kryssrutorna hade, så servern läser formuläret som förut.
  const [reminderOn, setReminderOn] = useState(reminderEmail);
  const [digestOn, setDigestOn] = useState(digestEmail);

  async function onConfirm() {
    if (!pending) return;
    const where = pending.kind === "delete" ? "delete" : "reset";
    setBusy(true);
    try {
      if (pending.kind === "delete") {
        // Vid lyckad radering svarar servern med en redirect; då finns inget resultat att läsa.
        const result = await deleteAccountAction();
        if (result && !result.ok) setNotice({ text: result.error, ok: false, where });
      } else if (store) {
        if (pending.kind === "resetAll") await store.resetAll();
        else if (pending.kind === "resetSchedule") await store.resetSchedule({ deckId: null, cardIds: null });
        // Kontosidan nås bara inloggad, så det är alltid kontolagret som svarar: deckId räcker.
        else await store.resetDeck({ deckId: pending.deck.id, cardIds: [] });
        setNotice({ text: sv.deck.resetDone, ok: true, where });
      }
    } catch {
      setNotice({ text: sv.errors.generic, ok: false, where });
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

  const shownName = displayName.trim();

  return (
    <div className="mx-auto grid w-full max-w-[46rem] gap-5">
      <header className="anim-fade-up mb-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{sv.account.title}</h1>
      </header>

      {/* Profil: vem du är inloggad som, och namnet som syns i appen. */}
      <Card padding="lg" className="anim-fade-up grid gap-6" style={{ ["--i" as string]: 1 }}>
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={shownName || email} size={56} />
          <div className="min-w-0">
            {shownName ? <p className="truncate text-lg font-bold tracking-tight">{shownName}</p> : null}
            <dl className="min-w-0 text-sm">
              <dt className={shownName ? "sr-only" : "text-muted"}>{sv.account.email}</dt>
              <dd className={cx("truncate", shownName ? "text-muted" : "font-semibold")}>{email}</dd>
            </dl>
          </div>
        </div>
        <form action={nameAction} className="grid gap-2">
          <label htmlFor="display_name" className="text-sm font-semibold">
            {sv.account.displayName}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="display_name" name="display_name" defaultValue={displayName} maxLength={80} className={cx(inputClass, "h-12 min-w-0 flex-1")} />
            <Button type="submit" variant="outline" disabled={namePending}>
              {sv.account.save}
            </Button>
          </div>
          <FormStatus state={nameState} />
        </form>
      </Card>

      <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: 2 }} role="region" aria-labelledby="paminnelser-rubrik">
        <CardHeader id="paminnelser-rubrik" title={sv.account.remindersTitle} description={sv.account.remindersHelp} />
        <form action={prefsAction} className="-mt-2 grid gap-4">
          <div className="divide-y divide-line">
            <div data-testid="reminder-email">
              {reminderOn ? <input type="hidden" name="reminder_email" value="on" /> : null}
              <ToggleRow title={sv.account.reminderEmail} description={sv.account.reminderEmailHelp} checked={reminderOn} onChange={setReminderOn} />
            </div>
            {isExaminer ? (
              <div data-testid="digest-email">
                <input type="hidden" name="digest_form" value="1" />
                {digestOn ? <input type="hidden" name="digest_email" value="on" /> : null}
                <ToggleRow title={sv.account.digestEmail} description={sv.account.digestEmailHelp} checked={digestOn} onChange={setDigestOn} />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="submit" variant="outline" disabled={prefsPending} data-testid="save-email-prefs">
              {sv.account.save}
            </Button>
            <FormStatus state={prefsState} />
          </div>
        </form>
      </Card>

      <Card padding="lg" className="anim-fade-up flex flex-wrap items-center justify-between gap-4" style={{ ["--i" as string]: 3 }} role="region" aria-labelledby="tema-rubrik">
        <h2 id="tema-rubrik" className="text-lg font-bold tracking-tight">
          {sv.theme.label}
        </h2>
        <ThemeSwitcher />
      </Card>

      <Card
        padding="lg"
        className={cx("anim-fade-up", focusPassword && "ring-2 ring-accent")}
        style={{ ["--i" as string]: 4 }}
        role="region"
        aria-labelledby="losenord-rubrik"
      >
        <CardHeader id="losenord-rubrik" title={sv.account.passwordTitle} description={sv.account.passwordHelp} />
        {focusPassword ? (
          <p role="status" className="mb-5 rounded-md bg-accent-soft px-4 py-3 text-sm font-medium text-accent-ink" data-testid="set-new-password-banner">
            {sv.account.setNewPasswordBanner}
          </p>
        ) : null}
        {/* Nyckeln byts vid lyckad ändring så att fältet töms. */}
        <form action={passwordAction} className="grid gap-2" key={passwordState?.ok ? "saved" : "edit"}>
          <label htmlFor="new_password" className="text-sm font-semibold">
            {sv.account.newPassword}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="new_password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus={focusPassword}
              aria-describedby="new_password-hint"
              className={cx(inputClass, "h-12 min-w-0 flex-1")}
            />
            <Button type="submit" disabled={passwordPending} data-testid="save-password">
              {sv.account.savePassword}
            </Button>
          </div>
          <p id="new_password-hint" className="text-sm text-muted">
            {sv.auth.passwordHelp}
          </p>
          <FormStatus state={passwordState} />
        </form>
      </Card>

      <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: 5 }} role="region" aria-labelledby="nollstall-rubrik">
        <CardHeader id="nollstall-rubrik" title={sv.account.resetTitle} description={sv.account.resetHelp} />
        <div className="grid gap-4">
          {decks.length === 0 ? (
            <p className="text-sm text-muted">{sv.account.noDecks}</p>
          ) : (
            <ul className="divide-y divide-line">
              {decks.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0">
                  <span className="min-w-0 font-semibold">{d.title}</span>
                  <Button variant="danger" size="sm" onClick={() => setPending({ kind: "resetDeck", deck: d })} disabled={!store} data-testid={`reset-deck-${d.slug}`}>
                    <span className="whitespace-normal">{sv.account.resetDeckNamed(d.title)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 rounded-md bg-surface-2 p-4">
            <p className="text-sm text-muted">{sv.deck.resetScheduleHelp}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setPending({ kind: "resetSchedule" })} disabled={!store} data-testid="reset-schedule">
                <span className="whitespace-normal">{sv.account.resetScheduleAll}</span>
              </Button>
              <Button variant="danger" size="sm" onClick={() => setPending({ kind: "resetAll" })} disabled={!store} data-testid="reset-all">
                <span className="whitespace-normal">{sv.deck.resetAll}</span>
              </Button>
            </div>
          </div>
          {notice?.where === "reset" ? <NoticeText notice={notice} /> : null}
        </div>
      </Card>

      <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: 6 }} role="region" aria-labelledby="data-rubrik">
        <CardHeader id="data-rubrik" title={sv.account.dataTitle} description={sv.account.downloadHelp} />
        <a href="/api/konto/export" download="kuggfri-data.json" className={buttonClass("outline", "md")}>
          <Download size={17} aria-hidden />
          <span className="whitespace-normal">{sv.account.download}</span>
        </a>
      </Card>

      {/* Farozonen: egen röd kant i båda lägena, så att den inte smälter ihop med blocken ovan. */}
      <section
        className="anim-fade-up rounded-lg border border-danger/40 bg-surface p-6 sm:p-7"
        style={{ ["--i" as string]: 7 }}
        aria-labelledby="radera-rubrik"
      >
        <CardHeader id="radera-rubrik" title={sv.account.deleteTitle} description={sv.account.deleteHelp} />
        <div className="grid justify-items-start gap-4">
          <Button variant="danger" onClick={() => setPending({ kind: "delete" })} data-testid="delete-account">
            {sv.account.delete}
          </Button>
          {notice?.where === "delete" ? <NoticeText notice={notice} /> : null}
        </div>
      </section>

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
