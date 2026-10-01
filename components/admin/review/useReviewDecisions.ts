"use client";

import type { Dispatch, SetStateAction } from "react";
import { firstLine } from "@/lib/text/first-line";
import type { ActionResult } from "@/lib/admin/action-helpers";
import {
  approveCardsAction,
  flagCardAction,
  rejectCardAction,
  resolveFlagAction,
  restoreReviewAction,
  saveReviewCardAction,
  type ReviewSnapshot,
} from "@/lib/admin/review-actions";
import { rejectCorrectionAction, restoreCardVersionAction } from "@/lib/admin/history-actions";
import {
  NO_FLAG,
  approvalIssues,
  approvedPatch,
  cleanFlagNote,
  nextAfterDecision,
  rejectedPatch,
  reviewList,
  reviewTab,
  type ReviewArea,
  type ReviewCard,
  type ReviewFilter,
  type ReviewTab,
} from "@/lib/admin/review";
import type { ReviewStatus } from "../ReviewCardView";
import type { ReviewEdit } from "../ReviewEditor";
import { patchList, type useOptimisticDecisions } from "./useOptimisticDecisions";
import type { View } from "./useReviewView";
import type { ReviewText } from "./ReviewLanguage";

const snapshot = (c: ReviewCard): ReviewSnapshot => ({
  id: c.id,
  review_status: c.review_status,
  review_note: c.review_note,
  is_active: c.is_active,
  reviewed_by: c.reviewed_by,
  reviewed_at: c.reviewed_at,
  flag_note: c.flag_note,
  flagged_at: c.flagged_at,
  flagged_by: c.flagged_by,
});

const label = (c: ReviewCard) => firstLine(c.front, { maxLength: 60 });

type Options = {
  deckId: string;
  /** Den inloggade granskaren. */
  userId: string;
  areas: ReviewArea[];
  /** Fliken, filtret och listan som visas nu (beslutet går vidare till nästa kort i den). */
  tab: ReviewTab;
  filter: ReviewFilter;
  listIds: string[];
  navigate: (next: Partial<View>, mode?: "push" | "replace") => void;
  setStatus: Dispatch<SetStateAction<ReviewStatus | null>>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  /** Korten och sparandet (useOptimisticDecisions). */
  decisions: ReturnType<typeof useOptimisticDecisions>;
  /** Texterna i granskningens språk. */
  t: ReviewText;
};

/**
 * Granskningens beslut: godkänn, flagga, åtgärda, ta ur rotation (eller återställ originalet),
 * sätt tillbaka i rotation, spara en redigering och ångra.
 * Funktionerna skapas på nytt vid varje rendering (som när de låg i komponenten), så att de ser
 * renderingens kort, flik och lista; det som ska vara färskt efter en väntan läses ur latestCards.
 */
export function useReviewDecisions({ deckId, userId, areas, tab, filter, listIds, navigate, setStatus, setEditing, decisions, t }: Options) {
  const { cards, setCards, setNow, latestCards, mark, run, restoreLocal } = decisions;

  /**
   * Sätter de nya korten och, om kortet lämnar listan, går vidare till nästa kort i samma lista
   * (eller tillbaka till listan när inget kort är kvar).
   */
  function commit(next: ReviewCard[], card: ReviewCard, at: number) {
    setCards(next);
    setNow(at);
    const after = reviewList(next, tab, filter, areas).map((c) => c.id);
    if (after.includes(card.id)) return;
    navigate({ tab, cardId: nextAfterDecision(listIds, after, card.id) }, "replace");
  }

  function undoDecision(snaps: ReviewSnapshot[]) {
    setStatus(null);
    const before = latestCards.current.filter((c) => snaps.some((s) => s.id === c.id)).map(snapshot);
    restoreLocal(snaps);
    const first = snaps[0];
    if (first) {
      const restored = { ...latestCards.current.find((c) => c.id === first.id)!, ...first };
      navigate({ tab: reviewTab(restored) ?? tab, cardId: first.id }, "replace");
    }
    void run(
      snaps.map((s) => s.id),
      () => restoreReviewAction(deckId, snaps),
      () => restoreLocal(before),
    ).then((ok) => {
      if (ok !== null) setStatus({ id: Date.now(), text: t.g.undone });
    });
  }

  function approve(card: ReviewCard) {
    if (approvalIssues(card).length > 0) return;
    const snaps = [snapshot(card)];
    const at = Date.now();
    const reviewedAt = new Date(at).toISOString();
    commit(
      patchList(cards, card.id, (c) => ({ ...c, ...approvedPatch(userId, reviewedAt) })),
      card,
      at,
    );
    setStatus({ id: at, text: t.g.approved(label(card)), undo: () => undoDecision(snaps) });
    void run([card.id], () => approveCardsAction(deckId, [card.id]), () => restoreLocal(snaps)).then((data) => {
      if (!data || data.skipped.length === 0) return;
      restoreLocal(snaps);
      setStatus({ id: Date.now(), text: t.admin.reviewSkipped(data.skipped.length), tone: "danger" });
    });
  }

  function flag(card: ReviewCard, note: string) {
    const text = cleanFlagNote(note);
    if (!text) return;
    const snaps = [snapshot(card)];
    const at = Date.now();
    const changing = Boolean(card.flag_note);
    commit(
      patchList(cards, card.id, (c) => ({ ...c, flag_note: text, flagged_at: new Date(at).toISOString(), flagged_by: userId })),
      card,
      at,
    );
    setStatus({ id: at, text: changing ? t.g.flagUpdated : t.g.flagged(label(card)), undo: () => undoDecision(snaps) });
    void run([card.id], () => flagCardAction(deckId, card.id, text), () => restoreLocal(snaps));
  }

  function resolve(card: ReviewCard) {
    const snaps = [snapshot(card)];
    const at = Date.now();
    commit(
      patchList(cards, card.id, (c) => ({ ...c, ...NO_FLAG })),
      card,
      at,
    );
    setStatus({ id: at, text: t.g.resolved(label(card)), undo: () => undoDecision(snaps) });
    void run([card.id], () => resolveFlagAction(deckId, card.id), () => restoreLocal(snaps));
  }

  /**
   * Tar kortet ur rotation, eller (restore) återställer originalet för ett rättat originalkort:
   * den senast publicerade versionen gäller igen, godkänd av granskaren.
   */
  function reject(card: ReviewCard, note: string, mode: "remove" | "restore" = "remove") {
    const snaps = [snapshot(card)];
    const at = Date.now();
    const reviewedAt = new Date(at).toISOString();
    const text = note.trim();
    const versionId = mode === "restore" ? card.published_version_id : null;
    if (typeof versionId === "number") {
      // En rättelse av ett publicerat kort: tillbaka till den publicerade versionen, som
      // servern skickar tillbaka (innehållet finns inte här).
      const before = card;
      commit(
        patchList(cards, card.id, (c) => ({ ...c, ...approvedPatch(userId, reviewedAt), review_note: text || null, published_version_id: null })),
        card,
        at,
      );
      const pending = run(
        [card.id],
        () => rejectCorrectionAction(deckId, card.id, versionId, text),
        () => setCards((prev) => patchList(prev, before.id, () => before)),
      );
      void pending.then((data) => {
        if (data) setCards((prev) => patchList(prev, before.id, (c) => ({ ...c, ...data.content, reviewed_at: data.reviewedAt })));
      });
      setStatus({
        id: at,
        text: t.g.correctionRejected(label(card)),
        undo: () => {
          setStatus(null);
          void pending.then((data) => {
            if (!data) return;
            setCards((prev) => patchList(prev, before.id, () => before));
            navigate({ tab: reviewTab(before) ?? tab, cardId: before.id }, "replace");
            void run(
              [before.id],
              async (): Promise<ActionResult> => {
                if (data.undoVersionId !== null) {
                  const restored = await restoreCardVersionAction(deckId, before.id, data.undoVersionId);
                  if (!restored.ok) return restored;
                }
                return restoreReviewAction(deckId, [snapshot(before)]);
              },
              () => undefined,
            ).then((ok) => {
              if (ok !== null) setStatus({ id: Date.now(), text: t.g.undone });
            });
          });
        },
      });
      return;
    }
    commit(
      patchList(cards, card.id, (c) => ({ ...c, ...rejectedPatch(userId, reviewedAt, text) })),
      card,
      at,
    );
    setStatus({ id: at, text: t.g.rejected(label(card)), undo: () => undoDecision(snaps) });
    void run([card.id], () => rejectCardAction(deckId, card.id, text), () => restoreLocal(snaps));
  }

  /** Sätter tillbaka ett kort som tagits ur rotation: i rotation igen och ogranskat. */
  function putBack(card: ReviewCard) {
    const snaps = [snapshot(card)];
    const at = Date.now();
    const back = { review_status: null, review_note: null, is_active: true, reviewed_by: null, reviewed_at: null } as const;
    commit(
      patchList(cards, card.id, (c) => ({ ...c, ...back })),
      card,
      at,
    );
    setStatus({ id: at, text: t.g.putBackDone(label(card)), undo: () => undoDecision(snaps) });
    void run([card.id], () => restoreReviewAction(deckId, [{ ...snapshot(card), ...back }]), () => restoreLocal(snaps));
  }

  async function saveEdit(card: ReviewCard, edit: ReviewEdit, approveAfter: boolean): Promise<string | null> {
    mark([card.id], 1);
    try {
      const result = await saveReviewCardAction(deckId, { id: card.id, ...edit }, approveAfter).catch(() => null);
      if (!result) return t.common.error;
      if (!result.ok) return result.error;
      const at = Date.now();
      const content = {
        category_id: edit.category_id,
        front: edit.front.trim(),
        back: edit.back.trim(),
        hint: edit.hint.trim() || null,
        kind: result.data.kind,
        options: result.data.options,
      };
      if (approveAfter && result.data.reviewedAt) {
        const reviewedAt = result.data.reviewedAt;
        setEditing(false);
        commit(
          patchList(latestCards.current, card.id, (c) => ({ ...c, ...content, ...approvedPatch(userId, reviewedAt) })),
          card,
          at,
        );
        setStatus({ id: at, text: t.g.savedApproved(firstLine(content.front, { maxLength: 60 })) });
      } else {
        // Ändrat innehåll granskas igen (databasens trigger cards_review_reset gör samma sak).
        const changed = (c: ReviewCard) =>
          c.front !== content.front || c.back !== content.back || (c.hint ?? null) !== content.hint || c.kind !== content.kind || JSON.stringify(c.options) !== JSON.stringify(content.options);
        setCards((prev) => patchList(prev, card.id, (c) => ({ ...c, ...content, ...(changed(c) ? { reviewed_at: null, reviewed_by: null } : {}) })));
        setEditing(false);
        setStatus({ id: at, text: t.g.saved });
      }
      return null;
    } finally {
      mark([card.id], -1);
    }
  }

  return { approve, flag, resolve, reject, putBack, saveEdit };
}
