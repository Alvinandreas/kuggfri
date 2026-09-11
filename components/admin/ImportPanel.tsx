"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { importCardsAction } from "@/lib/admin/actions";
import { diffImport, type ExistingCard, type ExistingCategory } from "@/lib/import/diff";
import { parseImport, type ImportParseResult } from "@/lib/import/parse-import";
import { Button, LinkButton } from "@/components/ui/Button";

type Props = { deckId: string; existingCards: ExistingCard[]; existingCategories: ExistingCategory[] };

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? text;
  return line.replace(/^[#*\-\s]+/, "").trim();
}

function truncate(text: string, n = 120): string {
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

export function ImportPanel({ deckId, existingCards, existingCategories }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ImportParseResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const diff = useMemo(() => (parsed ? diffImport(parsed.cards, existingCards, existingCategories) : null), [parsed, existingCards, existingCategories]);
  const errors = useMemo(() => [...(parsed?.errors ?? []), ...(diff?.errors ?? [])], [parsed, diff]);
  const toImport = diff ? diff.create.length + diff.update.length : 0;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    setParsed(parseImport(content));
    setResult(null);
  }

  function preview() {
    setParsed(parseImport(text));
    setResult(null);
  }

  function confirm() {
    if (!parsed) return;
    startTransition(async () => {
      const r = await importCardsAction(deckId, parsed.cards);
      if (r.ok) {
        setResult({ ok: true, text: sv.admin.importDone(r.data.created + r.data.updated) });
        setParsed(null);
        setText("");
        router.refresh();
      } else {
        setResult({ ok: false, text: r.error });
      }
    });
  }

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted">{sv.admin.importHelp}</p>
      <p className="text-sm text-muted">{sv.admin.importMatchHelp}</p>

      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span>{sv.admin.importFile}</span>
          <input type="file" accept=".csv,.json,text/csv,application/json,text/plain" onChange={onFile} data-testid="import-file" className="text-sm" />
        </label>
        <label className="grid gap-1 text-sm">
          <span>{sv.admin.importPaste}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-sm text-fg"
            data-testid="import-text"
          />
        </label>
        <div>
          <Button variant="secondary" onClick={preview} disabled={!text.trim()} data-testid="import-preview">
            {sv.admin.importParse}
          </Button>
        </div>
      </div>

      {errors.length > 0 ? (
        <section aria-labelledby="importfel" className="rounded-lg border border-danger/40 bg-danger-soft p-4">
          <h2 id="importfel" className="font-semibold text-danger">
            {sv.admin.importErrors} ({errors.length})
          </h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {errors.slice(0, 50).map((e, i) => (
              <li key={i}>
                {e.row > 0 ? `${sv.admin.importRow(e.row)}: ` : ""}
                {e.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {diff ? (
        <section aria-labelledby="diff" className="grid gap-4" data-testid="import-diff">
          <h2 id="diff" className="text-lg font-semibold">
            {sv.admin.preview}
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-md border border-line bg-surface p-3">
              <dt className="text-muted">{sv.admin.importDiffNew}</dt>
              <dd className="text-xl font-semibold" data-testid="diff-new">
                {diff.create.length}
              </dd>
            </div>
            <div className="rounded-md border border-line bg-surface p-3">
              <dt className="text-muted">{sv.admin.importDiffUpdated}</dt>
              <dd className="text-xl font-semibold" data-testid="diff-updated">
                {diff.update.length}
              </dd>
            </div>
            <div className="rounded-md border border-line bg-surface p-3">
              <dt className="text-muted">{sv.admin.importDiffUnchanged}</dt>
              <dd className="text-xl font-semibold">{diff.unchanged.length}</dd>
            </div>
            <div className="rounded-md border border-line bg-surface p-3">
              <dt className="text-muted">{sv.admin.importDiffNewCategories}</dt>
              <dd className="text-xl font-semibold">{diff.newCategories.length}</dd>
            </div>
          </dl>

          {diff.newCategories.length > 0 ? (
            <p className="text-sm">
              <span className="font-medium">{sv.admin.importDiffNewCategories}:</span> {diff.newCategories.join(", ")}
            </p>
          ) : null}

          {diff.create.length > 0 ? (
            <details open className="rounded-lg border border-line bg-surface p-4">
              <summary className="cursor-pointer font-medium">
                {sv.admin.importDiffNew} ({diff.create.length})
              </summary>
              <ul className="mt-3 grid gap-2 text-sm">
                {diff.create.map((c) => (
                  <li key={c.row} className="border-b border-line pb-2">
                    <p className="font-medium">{truncate(firstLine(c.front))}</p>
                    <p className="text-muted">{truncate(c.back)}</p>
                    {c.category ? <p className="text-xs text-muted">{c.category}</p> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {diff.update.length > 0 ? (
            <details open className="rounded-lg border border-line bg-surface p-4">
              <summary className="cursor-pointer font-medium">
                {sv.admin.importDiffUpdated} ({diff.update.length})
              </summary>
              <ul className="mt-3 grid gap-3 text-sm">
                {diff.update.map((u) => (
                  <li key={u.id} className="border-b border-line pb-3">
                    <p className="font-medium">{truncate(firstLine(u.before.front))}</p>
                    {u.changedFields.map((field) => (
                      <div key={field} className="mt-1 grid gap-1 sm:grid-cols-2">
                        <p className="rounded bg-danger-soft px-2 py-1">
                          <span className="text-xs uppercase text-muted">{sv.admin.importBefore} · {field}</span>
                          <br />
                          {truncate(String(u.before[field] ?? "–"))}
                        </p>
                        <p className="rounded bg-accent-soft px-2 py-1">
                          <span className="text-xs uppercase text-muted">{sv.admin.importAfter} · {field}</span>
                          <br />
                          {truncate(String(u.after[field] ?? "–"))}
                        </p>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={confirm} disabled={pending || toImport === 0} data-testid="import-confirm">
              {toImport === 0 ? sv.admin.importNothing : sv.admin.importConfirm(toImport)}
            </Button>
            <LinkButton href={`/admin/deck/${deckId}`} variant="secondary">
              {sv.common.back}
            </LinkButton>
          </div>
        </section>
      ) : null}

      {result ? (
        <p role="status" className={`text-sm ${result.ok ? "text-accent" : "text-danger"}`} data-testid="import-result">
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
