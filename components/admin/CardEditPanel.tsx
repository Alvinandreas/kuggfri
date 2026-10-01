"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { restoreCardVersionAction } from "@/lib/admin/history-actions";
import { contentOf, type CardVersion } from "@/lib/admin/history";
import type { CardRow } from "@/lib/supabase/database.types";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { CardEditor } from "./CardEditor";
import { CardHistory } from "./CardHistory";

type Props = {
  deckId: string;
  categories: { id: string; title: string }[];
  card: CardRow;
  backHref: string;
  /** Kortets tidigare versioner, nyast först. */
  versions: CardVersion[];
  /** Serverns klocka vid renderingen (relativ tid utan hydreringsfel). */
  now: number;
};

type ToastState = { id: number; text: string; undo?: () => void; tone?: "default" | "danger" };

/**
 * Kortredigeringssidans innehåll: redigeraren och under den kortets historik. En återställd
 * version laddar om sidan och startar om redigeraren med det nya innehållet; toasten har Ångra.
 */
export function CardEditPanel({ deckId, categories, card, backHref, versions, now }: Props) {
  const sv = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editorKey, setEditorKey] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  // Efter en återställning: starta om redigeraren när det nya kortet kommit från servern.
  const remount = useRef(false);
  useEffect(() => {
    if (!remount.current) return;
    remount.current = false;
    setEditorKey((k) => k + 1);
  }, [card.updated_at]);

  const areaTitle = useCallback((id: string | null) => (id ? (categories.find((c) => c.id === id)?.title ?? sv.admin.uncategorized) : sv.admin.uncategorized), [categories, sv]);

  const restore = useCallback(
    async (versionId: number, doneText: string, allowUndo: boolean) => {
      const result = await restoreCardVersionAction(deckId, card.id, versionId).catch(() => null);
      if (!result || !result.ok) {
        setToast({ id: Date.now(), text: result && !result.ok ? result.error : sv.errors.generic, tone: "danger" });
        return;
      }
      if (result.data.undoVersionId === null) {
        setToast({ id: Date.now(), text: sv.admin.historyUnchanged });
        return;
      }
      const undoId = result.data.undoVersionId;
      remount.current = true;
      startTransition(() => router.refresh());
      setToast({
        id: Date.now(),
        text: doneText,
        undo: allowUndo
          ? () => {
              setToast(null);
              void restore(undoId, sv.admin.reviewUndone, false);
            }
          : undefined,
      });
    },
    [card.id, deckId, router, sv],
  );

  return (
    <>
      <CardEditor key={editorKey} deckId={deckId} categories={categories} card={card} backHref={backHref} />
      <Card padding="md">
        <CardHistory
          versions={versions}
          current={contentOf(card)}
          areaTitle={areaTitle}
          now={now}
          onRestore={(v, n) => restore(v.id, sv.admin.historyRestored(n), true)}
        />
      </Card>
      <Toast
        message={toast?.text ?? null}
        id={toast?.id}
        tone={toast?.tone}
        action={toast?.undo ? { label: sv.admin.reviewUndo, onClick: toast.undo } : undefined}
        onClose={() => setToast(null)}
        duration={toast?.undo ? 10000 : 5000}
      />
    </>
  );
}
