"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { deleteReportAction, setReportStatusAction } from "@/lib/admin/actions";
import type { AdminReport } from "@/lib/admin/queries";
import { firstLine } from "@/lib/text/first-line";
import { formatDateTime } from "@/lib/time/format";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { routes } from "@/lib/routes";

export function ReportList({ deckId, reports }: { deckId: string; reports: AdminReport[] }) {
  const sv = useT();
  const { pending, error, run } = useActionRunner();
  const [deleting, setDeleting] = useState<string | null>(null);

  if (reports.length === 0)
    return (
      <Card padding="lg" className="text-muted">
        {sv.admin.reportsNone}
      </Card>
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {reports.map((r) => {
          const open = r.status === "open";
          // Öppna rapporter är fyllda block; åtgärdade är bara konturer, så att de öppna syns först.
          return (
            <li
              key={r.id}
              data-testid="report-row"
              className={cx(
                "grid gap-3 rounded-lg border p-5",
                open ? "border-line bg-surface dark:border-transparent" : "border-line-strong/70 bg-transparent",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Badge tone={open ? "accent" : "neutral"}>{open ? sv.admin.reportStatusOpen : sv.admin.reportStatusResolved}</Badge>
                <span className="text-muted">{formatDateTime(r.created_at, sv.meta.locale)}</span>
              </div>
              <p className="text-sm">
                <span className="text-muted">{sv.admin.reportCard}: </span>
                <Link href={routes.admin.card(deckId, r.card_id)} className="font-semibold underline decoration-line-strong underline-offset-2 hover:decoration-fg">
                  {firstLine(r.card_front)}
                </Link>
              </p>
              <p className="whitespace-pre-wrap rounded-md bg-surface-2 px-4 py-3 text-sm">{r.message}</p>
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
                <Button size="sm" variant="danger" disabled={pending} onClick={() => setDeleting(r.id)}>
                  {sv.admin.reportDelete}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        title={sv.admin.reportDelete}
        body={sv.admin.reportDeleteConfirm}
        danger
        busy={pending}
        onConfirm={() => {
          const id = deleting;
          if (!id) return;
          run(() => deleteReportAction(id, deckId));
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
