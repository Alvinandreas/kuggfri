"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { firstLine } from "@/lib/text/first-line";
import { importCardsAction } from "@/lib/admin/actions";
import { diffImport, type ExistingCard, type ExistingCategory } from "@/lib/import/diff";
import { parseImport, type ImportParseResult } from "@/lib/import/parse-import";
import { Upload } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { TextArea } from "@/components/ui/TextArea";
import { cx } from "@/components/ui/cx";
import { StatBlock } from "./StatBlock";

type Props = { deckId: string; existingCards: ExistingCard[]; existingCategories: ExistingCategory[] };

function truncate(text: string, n = 120): string {
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

export function ImportPanel({ deckId, existingCards, existingCategories }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
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
    setFileName(file.name);
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
        setFileName(null);
        router.refresh();
      } else {
        setResult({ ok: false, text: r.error });
      }
    });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Card padding="lg" className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm text-muted">
          <p>{sv.admin.importHelp}</p>
          <p>{sv.admin.importMatchHelp}</p>
          <p>{sv.admin.importVisibleHelp}</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-sm">
          <span className="font-semibold">{sv.admin.importFile}</span>
          {/* Webbläsarens egen filknapp har engelsk text; en egen knapp med filfältet dolt i sig. */}
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <label className={cx(buttonClass("secondary", "sm"), "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent")}>
              <Upload size={15} aria-hidden />
              {sv.admin.importChooseFile}
              <input
                type="file"
                accept=".csv,.json,text/csv,application/json,text/plain"
                onChange={onFile}
                data-testid="import-file"
                className="sr-only"
              />
            </label>
            <span className="min-w-0 truncate text-muted">{fileName ?? sv.admin.importNoFile}</span>
          </div>
        </div>
        <TextArea label={sv.admin.importPaste} mono value={text} onChange={(e) => setText(e.target.value)} rows={8} data-testid="import-text" />
        <div>
          <Button variant="secondary" onClick={preview} disabled={!text.trim()} data-testid="import-preview">
            {sv.admin.importParse}
          </Button>
        </div>
      </Card>

      {errors.length > 0 ? (
        <section aria-labelledby="importfel" className="rounded-lg bg-danger-soft p-5 sm:p-6">
          <h2 id="importfel" className="font-bold text-danger">
            {sv.admin.importErrors} ({errors.length})
          </h2>
          <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
            {errors.slice(0, 50).map((e, i) => (
              <li key={i}>
                {e.row > 0 ? <span className="font-semibold">{sv.admin.importRow(e.row)}: </span> : null}
                {e.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {diff ? (
        <section aria-labelledby="diff" className="anim-fade-up grid grid-cols-[minmax(0,1fr)] gap-4" data-testid="import-diff">
          <h2 id="diff" className="text-xl font-bold tracking-tight">
            {sv.admin.preview}
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBlock label={sv.admin.importDiffNew} value={`${diff.create.length}`} testId="diff-new" />
            <StatBlock label={sv.admin.importDiffUpdated} value={`${diff.update.length}`} testId="diff-updated" />
            <StatBlock label={sv.admin.importDiffUnchanged} value={`${diff.unchanged.length}`} />
            <StatBlock label={sv.admin.importDiffNewCategories} value={`${diff.newCategories.length}`} />
          </dl>

          {diff.newCategories.length > 0 ? (
            <p className="text-sm">
              <span className="font-semibold">{sv.admin.importDiffNewCategories}:</span> {diff.newCategories.join(", ")}
            </p>
          ) : null}

          {diff.create.length > 0 ? (
            <Card padding="none" className="px-5 py-3">
              <Disclosure defaultOpen summary={`${sv.admin.importDiffNew} (${diff.create.length})`}>
                <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-line text-sm">
                  {diff.create.map((c) => (
                    <li key={c.row} className="py-2.5">
                      <p className="font-semibold">{truncate(firstLine(c.front))}</p>
                      <p className="text-muted">{truncate(c.back)}</p>
                      {c.category ? <p className="text-xs text-muted">{c.category}</p> : null}
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </Card>
          ) : null}

          {diff.update.length > 0 ? (
            <Card padding="none" className="px-5 py-3">
              <Disclosure defaultOpen summary={`${sv.admin.importDiffUpdated} (${diff.update.length})`}>
                <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-line text-sm">
                  {diff.update.map((u) => (
                    <li key={u.id} className="py-3">
                      <p className="font-semibold">{truncate(firstLine(u.before.front))}</p>
                      {u.changedFields.map((field) => (
                        <div key={field} className="mt-2 grid gap-2 sm:grid-cols-2">
                          <p className="rounded-md bg-danger-soft px-3 py-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                              {sv.admin.importBefore}: {field}
                            </span>
                            <br />
                            {truncate(String(u.before[field] ?? "–"))}
                          </p>
                          <p className="rounded-md bg-accent-soft px-3 py-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                              {sv.admin.importAfter}: {field}
                            </span>
                            <br />
                            {truncate(String(u.after[field] ?? "–"))}
                          </p>
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={confirm} disabled={pending || toImport === 0} data-testid="import-confirm">
              {toImport === 0 ? sv.admin.importNothing : sv.admin.importConfirm(toImport)}
            </Button>
            <Button variant="ghost" onClick={() => setParsed(null)} disabled={pending}>
              {sv.common.cancel}
            </Button>
          </div>
        </section>
      ) : null}

      {result ? (
        <p role="status" className={`text-sm font-medium ${result.ok ? "text-accent" : "text-danger"}`} data-testid="import-result">
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
