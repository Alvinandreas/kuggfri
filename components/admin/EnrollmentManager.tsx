"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { addEnrollmentsAction, removeEnrollmentsAction } from "@/lib/admin/actions";
import type { DeckEnrollment } from "@/lib/admin/queries";
import { parseRoster } from "@/lib/enrollment/parse";
import { formatDateTime } from "@/lib/time/format";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Disclosure } from "@/components/ui/Disclosure";
import { FormMessage } from "@/components/ui/FormMessage";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/cx";
import { StatBlock } from "./StatBlock";

/** Så många rader visas i listan och i förhandsvisningen innan sökningen behövs. */
const SHOWN = 200;

/**
 * Kursens deltagarlista: lägg till i klump (fil eller inklistrat, läst i webbläsaren av
 * lib/enrollment/parse.ts), se listan och ta bort enstaka adresser. Bara adresserna skickas
 * till servern; namnen i filen visas i förhandsvisningen men sparas aldrig.
 */
export function EnrollmentManager({ deckId, entries }: { deckId: string; entries: DeckEnrollment[] }) {
  const sv = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const existing = useMemo(() => new Set(entries.map((e) => e.email)), [entries]);
  const roster = useMemo(() => (text.trim() ? parseRoster(text) : null), [text]);
  const fresh = useMemo(() => (roster ? roster.entries.filter((e) => !existing.has(e.email)) : []), [roster, existing]);
  const already = roster ? roster.entries.length - fresh.length : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? entries.filter((e) => e.email.includes(q)) : entries;
  }, [entries, search]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
    setMessage(null);
    e.target.value = "";
  }

  function onAdd() {
    const emails = fresh.map((e) => e.email);
    startTransition(async () => {
      const res = await addEnrollmentsAction(deckId, emails);
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setMessage({ ok: true, text: sv.admin.enrollDone(res.data.added, res.data.linked) });
      setText("");
      setFileName(null);
      router.refresh();
    });
  }

  function onRemove() {
    const email = removing;
    if (!email) return;
    startTransition(async () => {
      const res = await removeEnrollmentsAction(deckId, [email]);
      setMessage(res.ok ? { ok: true, text: sv.admin.enrollRemoved } : { ok: false, text: res.error });
      setRemoving(null);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <section aria-labelledby="lagg-till" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h2 id="lagg-till" className="text-lg font-bold tracking-tight">
          {sv.admin.enrollAddTitle}
        </h2>
        <Card padding="lg" className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <p className="text-sm text-muted">{sv.admin.enrollAddHelp}</p>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-sm">
            <span className="font-semibold">{sv.admin.enrollFile}</span>
            {/* Webbläsarens egen filknapp har engelsk text; en egen knapp med filfältet dolt i sig. */}
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <label className={cx(buttonClass("secondary", "sm"), "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent")}>
                <Upload size={15} aria-hidden />
                {sv.admin.enrollChooseFile}
                <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" onChange={onFile} data-testid="enroll-file" className="sr-only" />
              </label>
              <span className="min-w-0 truncate text-muted">{fileName ?? sv.admin.enrollNoFile}</span>
            </div>
          </div>
          <TextArea
            label={sv.admin.enrollPaste}
            mono
            rows={6}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setMessage(null);
            }}
            placeholder={"anna.andersson@chalmers.se\nbo.berg@chalmers.se"}
            data-testid="enroll-text"
          />

          {roster ? (
            <div className="anim-fade-up grid grid-cols-[minmax(0,1fr)] gap-4" data-testid="enroll-preview">
              <dl className="grid grid-cols-3 gap-3">
                <StatBlock inset label={sv.admin.enrollNew} value={fresh.length} testId="enroll-new" />
                <StatBlock inset label={sv.admin.enrollExisting} value={already} />
                <StatBlock inset label={sv.admin.enrollProblems} value={roster.problems.length} testId="enroll-problems" />
              </dl>
              {roster.duplicates > 0 ? <p className="text-sm text-muted">{sv.admin.enrollDuplicates(roster.duplicates)}</p> : null}
              {roster.problems.length > 0 ? (
                <div className="rounded-md bg-danger-soft px-4 py-3 text-sm">
                  <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
                    {roster.problems.slice(0, 20).map((p) => (
                      <li key={`${p.line}-${p.text}`} className="break-all">
                        <span className="font-semibold">{sv.admin.enrollRow(p.line)}:</span> {p.text || "–"}{" "}
                        <span className="text-muted">({p.reason === "ingen-adress" ? sv.admin.enrollNoAddress : sv.admin.enrollInvalidAddress})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {fresh.length > 0 ? (
                <Disclosure summary={`${sv.admin.enrollNew} (${fresh.length})`}>
                  <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-line text-sm">
                    {fresh.slice(0, SHOWN).map((e) => (
                      <li key={e.email} className="flex flex-wrap items-baseline gap-x-3 py-2">
                        <span className="break-all">{e.email}</span>
                        {e.name ? <span className="text-muted">{e.name}</span> : null}
                      </li>
                    ))}
                  </ul>
                  {fresh.length > SHOWN ? <p className="pt-2 text-xs text-muted">{sv.admin.enrollShowing(SHOWN, fresh.length)}</p> : null}
                </Disclosure>
              ) : null}
              <div>
                <Button onClick={onAdd} disabled={pending || fresh.length === 0} data-testid="enroll-confirm">
                  {fresh.length === 0 ? sv.admin.enrollNothing : sv.admin.enrollConfirm(fresh.length)}
                </Button>
              </div>
            </div>
          ) : null}
          {message ? (
            <FormMessage role="status" ok={message.ok} data-testid="enroll-message">
              {message.text}
            </FormMessage>
          ) : null}
        </Card>
      </section>

      <section aria-labelledby="listan" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h2 id="listan" className="text-lg font-bold tracking-tight">
          {sv.admin.enrollListTitle} ({entries.length})
        </h2>
        {entries.length === 0 ? (
          <Card padding="lg">
            <p className="text-sm text-muted">{sv.admin.enrollEmpty}</p>
          </Card>
        ) : (
          <Card padding="lg" className="grid grid-cols-[minmax(0,1fr)] gap-4">
            <TextField label={sv.admin.enrollSearch} type="search" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" data-testid="enroll-search" />
            {filtered.length === 0 ? (
              <p className="text-sm text-muted">{sv.admin.enrollNoMatch}</p>
            ) : (
              <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-line text-sm" data-testid="enroll-list">
                {filtered.slice(0, SHOWN).map((e) => (
                  <li key={e.email} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="break-all font-medium">{e.email}</span>
                      {e.registered === null ? null : <Badge tone={e.registered ? "accent" : "outline"}>{e.registered ? sv.admin.enrollHasAccount : sv.admin.enrollNoAccount}</Badge>}
                      <span className="text-xs text-muted">{sv.admin.enrollAddedOn(formatDateTime(e.created_at, sv.meta.locale))}</span>
                    </div>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => setRemoving(e.email)}>
                      {sv.admin.enrollRemove}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {filtered.length > SHOWN ? <p className="text-xs text-muted">{sv.admin.enrollShowing(SHOWN, filtered.length)}</p> : null}
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={removing !== null}
        title={sv.admin.enrollRemoveTitle}
        body={removing ? sv.admin.enrollRemoveConfirm(removing) : ""}
        danger
        busy={pending}
        onConfirm={onRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
