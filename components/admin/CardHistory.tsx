"use client";

import { useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { changedFields, exactTime, isPublished, relativeTime, restoreValues, versionStatus, type CardVersion, type VersionContent, type VersionStatus } from "@/lib/admin/history";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Modal } from "@/components/ui/Modal";
import { KindBadge } from "./KindBadge";
import { VersionDiff } from "./VersionDiff";

type Props = {
  /** Versionerna nyast först; null medan de hämtas. */
  versions: CardVersion[] | null;
  /** Antal versioner innan de hämtats (rubriken). */
  count?: number;
  /** Kunde inte hämtas; onRetry försöker igen. */
  error?: boolean;
  onRetry?: () => void;
  /** Kortets nuvarande innehåll. */
  current: VersionContent;
  areaTitle: (id: string | null) => string;
  now: number;
  /** Återställer versionen (nummer n); dialogen väntar tills den är klar. */
  onRestore: (version: CardVersion, n: number) => Promise<void>;
  defaultOpen?: boolean;
};

const statusTone: Record<VersionStatus, "neutral" | "strong" | "accent" | "danger" | "outline"> = {
  publicerad: "accent",
  utkast: "strong",
  avvisad: "danger",
  inaktiv: "outline",
};

export function StatusBadge({ status }: { status: VersionStatus }) {
  return <Badge tone={statusTone[status]}>{sv.admin.historyStatus[status]}</Badge>;
}

/**
 * Kortets historik som hopfällbar sektion: tidigare versioner nyast först, med vem som ersatte
 * dem och när, skillnaden mot nuvarande version och en knapp för att återställa (med
 * bekräftelse som visar vad som ändras).
 */
export function CardHistory({ versions, count, error = false, onRetry, current, areaTitle, now, onRestore, defaultOpen = false }: Props) {
  const [confirming, setConfirming] = useState<{ version: CardVersion; n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const total = versions?.length ?? count ?? 0;

  async function confirm() {
    if (!confirming) return;
    setBusy(true);
    try {
      await onRestore(confirming.version, confirming.n);
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  const target = confirming ? restoreValues(confirming.version) : null;
  const hides = target !== null && isPublished(current) && !isPublished(target);
  const shows = target !== null && !isPublished(current) && isPublished(target);

  return (
    <>
      <Disclosure
        defaultOpen={defaultOpen}
        data-testid="card-history"
        summary={
          <span className="inline-flex items-center gap-2">
            <History size={16} aria-hidden className="text-muted" />
            {sv.admin.historyTitle(total)}
          </span>
        }
      >
        <div className="grid gap-3">
          <p className="text-sm text-muted">{sv.admin.historyHelp}</p>
          {error ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span role="alert" className="font-medium text-danger">
                {sv.admin.historyError}
              </span>
              {onRetry ? (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  {sv.admin.historyRetry}
                </Button>
              ) : null}
            </div>
          ) : versions === null ? (
            <p className="text-sm text-muted" aria-busy="true">
              {sv.admin.historyLoading}
            </p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted">{sv.admin.historyEmpty}</p>
          ) : (
            <ol className="grid gap-2" data-testid="card-history-list">
              {versions.map((v, i) => {
                const n = versions.length - i;
                const same = changedFields(v, current).length === 0;
                return (
                  <li key={v.id} className="grid gap-2 rounded-md border border-line px-4 py-3" data-testid="card-history-version">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="font-semibold">{sv.admin.historyVersion(n)}</span>
                        <StatusBadge status={versionStatus(v)} />
                        {v.kind !== current.kind ? <KindBadge kind={v.kind} /> : null}
                        {v.category_id !== current.category_id ? <Badge tone="outline">{areaTitle(v.category_id)}</Badge> : null}
                      </div>
                      {same ? null : (
                        <Button variant="outline" size="sm" onClick={() => setConfirming({ version: v, n })} aria-label={sv.admin.historyRestoreLabel(n)} data-testid="card-history-restore">
                          <RotateCcw size={14} aria-hidden />
                          {sv.admin.historyRestore}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      <time dateTime={v.replaced_at} title={exactTime(v.replaced_at)} suppressHydrationWarning>
                        {sv.admin.historyReplaced(relativeTime(v.replaced_at, now), v.author)}
                      </time>
                    </p>
                    {same ? (
                      <p className="text-sm text-muted">{sv.admin.historySame}</p>
                    ) : (
                      <Disclosure defaultOpen={i === 0} summary={<span className="text-sm">{sv.admin.historyChangedSince}</span>}>
                        <VersionDiff before={v} after={current} areaTitle={areaTitle} />
                      </Disclosure>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </Disclosure>

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        locked={busy}
        size="lg"
        title={confirming ? sv.admin.historyRestoreTitle(confirming.n) : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>
              {sv.common.cancel}
            </Button>
            <Button onClick={confirm} disabled={busy} data-testid="card-history-restore-confirm">
              <RotateCcw size={15} aria-hidden />
              {busy ? sv.admin.historyRestoring : sv.admin.historyRestoreConfirm}
            </Button>
          </>
        }
      >
        {target ? (
          <div className="grid gap-4">
            <p className="text-muted">{sv.admin.historyRestoreBody}</p>
            {hides || shows ? (
              <p role="note" className="rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {hides ? sv.admin.historyRestoreHides : sv.admin.historyRestoreShows}
              </p>
            ) : null}
            <p className="text-sm font-semibold">{sv.admin.historyRestoreChanges}</p>
            <VersionDiff before={current} after={target} areaTitle={areaTitle} mode="split" labels={{ before: sv.admin.historyNow, after: sv.admin.historyAfterRestore }} />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
