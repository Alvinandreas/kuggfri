"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { deleteReportAction, setReportStatusAction } from "@/lib/admin/actions";
import type { AdminReport } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/time/format";
import { Button } from "@/components/ui/Button";

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? text;
  return line.replace(/^[#*\-\s]+/, "").trim();
}

export function ReportList({ deckId, reports }: { deckId: string; reports: AdminReport[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? sv.errors.generic);
      router.refresh();
    });
  }

  if (reports.length === 0) return <p className="text-muted">{sv.admin.reportsNone}</p>;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {reports.map((r) => {
          const open = r.status === "open";
          return (
            <li
              key={r.id}
              data-testid="report-row"
              className={`grid gap-2 rounded-lg border p-4 ${open ? "border-line-strong bg-surface" : "border-line bg-surface-2/50"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${open ? "bg-accent-soft text-fg" : "bg-surface-2 text-muted"}`}>
                  {open ? sv.admin.reportStatusOpen : sv.admin.reportStatusResolved}
                </span>
                <span className="text-muted">{formatDateTime(r.created_at)}</span>
              </div>
              <p className="text-sm">
                <span className="text-muted">{sv.admin.reportCard}: </span>
                {r.card ? (
                  <Link href={`/admin/deck/${deckId}/kort/${r.card.id}`} className="font-medium underline underline-offset-2 decoration-line-strong hover:decoration-fg">
                    {firstLine(r.card.front)}
                  </Link>
                ) : (
                  <span className="text-muted">–</span>
                )}
              </p>
              <p className="whitespace-pre-wrap rounded-md bg-bg px-3 py-2 text-sm">{r.message}</p>
              <p className="text-sm text-muted">
                {sv.admin.reportContact}: {r.contact ? r.contact : sv.admin.reportAnonymous}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={open ? "primary" : "secondary"}
                  disabled={pending}
                  onClick={() => run(() => setReportStatusAction(r.id, deckId, open ? "resolved" : "open"))}
                >
                  {open ? sv.admin.reportResolve : sv.admin.reportReopen}
                </Button>
                <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deleteReportAction(r.id, deckId))}>
                  {sv.admin.reportDelete}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
