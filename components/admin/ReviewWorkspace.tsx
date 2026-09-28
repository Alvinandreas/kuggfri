"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Inbox, MessageSquareWarning, Pencil, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { firstLine } from "@/lib/text/first-line";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { moveCardsToCategoryAction, type ActionResult } from "@/lib/admin/actions";
import { approveCardsAction, rejectCardAction, restoreReviewAction, setCardKindAction, type ReviewSnapshot } from "@/lib/admin/review-actions";
import {
  approvalIssues,
  countByArea,
  filterReviewCards,
  groupByArea,
  nextAfterDecision,
  reviewBucket,
  reviewProgress,
  step,
  type ReviewArea,
  type ReviewBucket,
  type ReviewCard,
  type ReviewFilter,
} from "@/lib/admin/review";
import { CARD_KINDS, CARD_KIND_DESCRIPTION, CARD_KIND_LABEL, isAutoGraded, trueFalseAnswer, validateKind, type CardKind } from "@/lib/cards/kinds";
import { Button, IconButton, LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Disclosure } from "@/components/ui/Disclosure";
import { Kbd } from "@/components/ui/Kbd";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/components/ui/cx";
import { CardEditor, type SavedCard } from "./CardEditor";
import { CardPreview } from "./CardPreview";
import { KindBadge, ReviewStatusBadge } from "./KindBadge";

type Props = {
  deckId: string;
  areas: ReviewArea[];
  cards: ReviewCard[];
  initialFilter: ReviewFilter;
  /** Den inloggade granskaren (reviewed_by i den optimistiska uppdateringen). */
  userId: string;
  /** Serverns klocka vid renderingen, så att server och klient delar in korten likadant. */
  now: number;
};

type ToastState = { id: number; text: string; undo?: () => void; tone?: "default" | "danger" };

const snapshot = (c: ReviewCard): ReviewSnapshot => ({
  id: c.id,
  review_status: c.review_status,
  review_note: c.review_note,
  is_active: c.is_active,
  reviewed_by: c.reviewed_by,
  reviewed_at: c.reviewed_at,
});

/** Tangenter räknas inte medan man skriver eller står i en lista, meny eller dialog. */
const TYPING_SELECTOR = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="menu"], dialog';

/**
 * Granskningsvyn: gå igenom många förslag snabbt. Vänster filter, förlopp och listan per
 * område; höger kortet som studenten ser det, metadata och besluten. Besluten syns direkt
 * (optimistiskt) och rullas tillbaka om servern säger nej; det senaste går att ångra.
 */
export function ReviewWorkspace({ deckId, areas, cards: serverCards, initialFilter, userId, now: serverNow }: Props) {
  const [cards, setCards] = useState(serverCards);
  const [now, setNow] = useState(serverNow);
  const [filter, setFilter] = useState(initialFilter);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ kind?: CardKind } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const inFlight = useRef(new Map<string, number>());
  const listRef = useRef<HTMLDivElement>(null);
  // Senaste korten för Ångra-knappen, vars funktion skapades vid en tidigare rendering.
  const latestCards = useRef(cards);
  useEffect(() => {
    latestCards.current = cards;
  });

  // Nya data från servern (efter en åtgärd revalideras sidan). Kort med en åtgärd på väg
  // behåller sitt lokala läge, så att ett snabbt andra beslut inte blinkar tillbaka.
  useEffect(() => {
    setCards((prev) => {
      const local = new Map(prev.map((c) => [c.id, c] as const));
      const busy = (id: string) => (inFlight.current.get(id) ?? 0) > 0;
      const merged = serverCards.map((c) => (busy(c.id) ? (local.get(c.id) ?? c) : c));
      const seen = new Set(serverCards.map((c) => c.id));
      for (const c of prev) if (busy(c.id) && !seen.has(c.id)) merged.push(c);
      return merged;
    });
    setNow((n) => Math.max(n, serverNow));
  }, [serverCards, serverNow]);

  const colorIndex = useMemo(() => categoryColorIndex(areas), [areas]);
  const areaTitle = useCallback((id: string | null) => (id ? (areas.find((a) => a.id === id)?.title ?? sv.admin.uncategorized) : sv.admin.uncategorized), [areas]);
  const visible = useMemo(() => filterReviewCards(cards, filter, areas, now), [cards, filter, areas, now]);
  const visibleIds = useMemo(() => visible.map((c) => c.id), [visible]);
  const groups = useMemo(() => groupByArea(visible, areas), [visible, areas]);
  const current = visible.find((c) => c.id === currentId) ?? visible[0] ?? null;
  const position = current ? visibleIds.indexOf(current.id) : -1;
  const progress = reviewProgress(cards, filter, now);
  const bucketCounts = useMemo(() => {
    const count = (bucket: ReviewBucket) => filterReviewCards(cards, { ...filter, bucket }, areas, now).length;
    return { vantar: count("vantar"), avvisade: count("avvisade"), godkanda: count("godkanda") } satisfies Record<ReviewBucket, number>;
  }, [cards, filter, areas, now]);
  const pendingTotal = cards.filter((c) => c.review_status === "utkast").length;
  const issues = current ? approvalIssues(current) : [];
  const currentBucket = current ? reviewBucket(current, now) : null;

  // Byter kort: stäng redigering och avvisning, visa det nya kortet i listan.
  useEffect(() => {
    setEditing(null);
    setRejecting(false);
    setRejectNote("");
    setNotice(null);
    if (!current) return;
    listRef.current?.querySelector<HTMLElement>(`[data-review-id="${current.id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Hjälpare för optimistiska uppdateringar
  // -------------------------------------------------------------------------

  function mark(ids: string[], delta: 1 | -1) {
    for (const id of ids) inFlight.current.set(id, (inFlight.current.get(id) ?? 0) + delta);
  }

  /** Sätter korten och, om advance, går vidare från det aktuella kortet till nästa i listan. */
  function commit(next: ReviewCard[], opts: { advance?: boolean; at?: number } = {}) {
    const t = opts.at ?? now;
    const after = filterReviewCards(next, filter, areas, t).map((c) => c.id);
    setCards(next);
    setNow(t);
    if (!current) return;
    if (opts.advance || !after.includes(current.id)) setCurrentId(nextAfterDecision(visibleIds, after, current.id));
  }

  function patch(list: ReviewCard[], ids: readonly string[], fn: (c: ReviewCard) => ReviewCard): ReviewCard[] {
    const set = new Set(ids);
    return list.map((c) => (set.has(c.id) ? fn(c) : c));
  }

  /** Kör en serveråtgärd; misslyckas den körs revert och felet visas. */
  async function run<T>(ids: string[], action: () => Promise<ActionResult<T>>, revert: () => void): Promise<T | null> {
    mark(ids, 1);
    try {
      const result = await action();
      if (result.ok) return result.data;
      revert();
      setToast({ id: Date.now(), text: result.error, tone: "danger" });
      return null;
    } catch {
      revert();
      setToast({ id: Date.now(), text: sv.errors.generic, tone: "danger" });
      return null;
    } finally {
      mark(ids, -1);
    }
  }

  function restoreLocal(snaps: ReviewSnapshot[]) {
    const byId = new Map(snaps.map((s) => [s.id, s] as const));
    setCards((prev) => prev.map((c) => (byId.has(c.id) ? { ...c, ...byId.get(c.id)! } : c)));
  }

  function undoDecision(snaps: ReviewSnapshot[]) {
    setToast(null);
    const before = latestCards.current.filter((c) => snaps.some((s) => s.id === c.id)).map(snapshot);
    restoreLocal(snaps);
    setCurrentId(snaps[0]?.id ?? null);
    void run(snaps.map((s) => s.id), () => restoreReviewAction(deckId, snaps), () => restoreLocal(before)).then((ok) => {
      if (ok !== null) setToast({ id: Date.now(), text: sv.admin.reviewUndone });
    });
  }

  // -------------------------------------------------------------------------
  // Beslut
  // -------------------------------------------------------------------------

  function approve(ids: string[], label: string) {
    if (ids.length === 0) return;
    const snaps = cards.filter((c) => ids.includes(c.id)).map(snapshot);
    const at = Date.now();
    const reviewedAt = new Date(at).toISOString();
    commit(
      patch(cards, ids, (c) => ({ ...c, review_status: null, is_active: true, reviewed_by: userId, reviewed_at: reviewedAt })),
      { advance: true, at },
    );
    setToast({ id: at, text: label, undo: () => undoDecision(snaps) });
    void run(ids, () => approveCardsAction(deckId, ids), () => restoreLocal(snaps)).then((data) => {
      if (!data || data.skipped.length === 0) return;
      restoreLocal(snaps.filter((s) => data.skipped.includes(s.id)));
      setToast({ id: Date.now(), text: sv.admin.reviewSkipped(data.skipped.length), tone: "danger" });
    });
  }

  function approveCurrent() {
    if (!current || currentBucket === "godkanda") return;
    if (issues.length > 0) {
      setNotice(`${sv.admin.reviewCannotApprove} ${issues.join(" ")}`);
      return;
    }
    approve([current.id], sv.admin.reviewApproved(firstLine(current.front, { maxLength: 60 })));
  }

  function reject(note: string) {
    if (!current) return;
    const snaps = [snapshot(current)];
    const at = Date.now();
    const text = note.trim();
    commit(
      patch(cards, [current.id], (c) => ({ ...c, review_status: "avvisad", review_note: text || null, is_active: false, reviewed_by: userId, reviewed_at: new Date(at).toISOString() })),
      { advance: true, at },
    );
    setRejecting(false);
    setRejectNote("");
    setToast({ id: at, text: sv.admin.reviewRejected(firstLine(current.front, { maxLength: 60 })), undo: () => undoDecision(snaps) });
    void run([current.id], () => rejectCardAction(deckId, current.id, text), () => restoreLocal(snaps));
  }

  function moveCurrent(categoryId: string | null) {
    if (!current || current.category_id === categoryId) return;
    const card = current;
    const from = card.category_id;
    const setArea = (area: string | null) => setCards((prev) => patch(prev, [card.id], (c) => ({ ...c, category_id: area })));
    commit(patch(cards, [card.id], (c) => ({ ...c, category_id: categoryId })));
    setToast({
      id: Date.now(),
      text: sv.admin.reviewMoved(areaTitle(categoryId)),
      undo: () => {
        setToast(null);
        setArea(from);
        setCurrentId(card.id);
        void run([card.id], () => moveCardsToCategoryAction(deckId, [card.id], from), () => setArea(categoryId));
      },
    });
    void run([card.id], () => moveCardsToCategoryAction(deckId, [card.id], categoryId), () => setArea(from));
  }

  function changeKind(kind: CardKind) {
    if (!current || current.kind === kind) return;
    const card = current;
    // Vändkort: inga alternativ. Automaträttat: behåll alternativen om de håller för den
    // nya typen, annars får granskaren fylla i dem i redigeraren.
    const options = !isAutoGraded(kind) ? null : validateKind(kind, card.options).length === 0 ? card.options : null;
    if (isAutoGraded(kind) && (options === null || (kind === "sant-falskt" && trueFalseAnswer(options) === null))) {
      setEditing({ kind });
      setNotice(sv.admin.reviewKindNeedsEdit);
      return;
    }
    const prev = { kind: card.kind, options: card.options };
    const setKind = (k: CardKind, o: ReviewCard["options"]) => setCards((list) => patch(list, [card.id], (c) => ({ ...c, kind: k, options: o })));
    commit(patch(cards, [card.id], (c) => ({ ...c, kind, options })));
    setToast({
      id: Date.now(),
      text: sv.admin.reviewKindChanged(CARD_KIND_LABEL[kind]),
      undo: () => {
        setToast(null);
        setKind(prev.kind, prev.options);
        setCurrentId(card.id);
        void run([card.id], () => setCardKindAction(deckId, card.id, prev.kind, prev.options), () => setKind(kind, options));
      },
    });
    void run([card.id], () => setCardKindAction(deckId, card.id, kind, options), () => setKind(prev.kind, prev.options));
  }

  function onSaved(saved: SavedCard) {
    commit(patch(cards, [saved.id], (c) => ({ ...c, ...saved, is_active: c.review_status ? false : saved.is_active })));
    setEditing(null);
    setNotice(null);
    setToast({ id: Date.now(), text: sv.admin.reviewSaved });
  }

  const go = (delta: -1 | 1) => setCurrentId(step(visibleIds, current?.id ?? null, delta));

  // -------------------------------------------------------------------------
  // Kortkommandon: G godkänn, A avvisa, R redigera, J/K eller pilar, Ctrl+Z ångra
  // -------------------------------------------------------------------------

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      if (toast?.undo) {
        e.preventDefault();
        toast.undo();
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || editing || rejecting || bulkOpen) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === "j" || key === "ArrowDown" || key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (key === "k" || key === "ArrowUp" || key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (!current) return;
    else if (key === "g") {
      e.preventDefault();
      approveCurrent();
    } else if (key === "a") {
      e.preventDefault();
      setRejecting(true);
    } else if (key === "r") {
      e.preventDefault();
      setEditing({});
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(TYPING_SELECTOR) || document.querySelector("dialog[open]")) return;
      keyHandler.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // -------------------------------------------------------------------------
  // Vy
  // -------------------------------------------------------------------------

  if (cards.length === 0) return <EmptyState deckId={deckId} />;

  const bulkCandidates = filter.bucket === "godkanda" ? [] : visible;
  const bulkValid = bulkCandidates.filter((c) => approvalIssues(c).length === 0);
  const bulkInvalid = bulkCandidates.length - bulkValid.length;
  const filtersActive = filter.area !== "alla" || filter.kind !== "alla";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start" data-testid="review-workspace">
      {/* Filter och förlopp */}
      <Card padding="md" className="grid gap-4 lg:col-start-1 lg:row-start-1">
        <div className="-mx-1 overflow-x-auto px-1">
          <SegmentedControl<ReviewBucket>
            label={sv.admin.reviewStatusFilter}
            size="sm"
            value={filter.bucket}
            onChange={(bucket) => setFilter((f) => ({ ...f, bucket }))}
            segments={[
              { value: "vantar", label: `${sv.admin.reviewBucketPending} ${bucketCounts.vantar}` },
              { value: "avvisade", label: `${sv.admin.reviewBucketRejected} ${bucketCounts.avvisade}` },
              { value: "godkanda", label: `${sv.admin.reviewBucketApprovedShort} ${bucketCounts.godkanda}` },
            ]}
          />
        </div>
        {filter.bucket === "godkanda" ? <p className="-mt-2 text-xs text-muted">{sv.admin.reviewBucketApproved}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <Select
            size="sm"
            label={sv.admin.reviewAreaFilter}
            value={filter.area}
            onChange={(area) => setFilter((f) => ({ ...f, area }))}
            options={[
              { value: "alla", label: sv.admin.reviewAllAreas },
              ...areas.map((a) => ({ value: a.id, label: a.title })),
              { value: "ingen", label: sv.admin.uncategorized },
            ]}
            data-testid="review-area-filter"
          />
          <Select<ReviewFilter["kind"]>
            size="sm"
            label={sv.admin.reviewKindFilter}
            value={filter.kind}
            onChange={(kind) => setFilter((f) => ({ ...f, kind }))}
            options={[{ value: "alla", label: sv.admin.reviewAllKinds }, ...CARD_KINDS.map((k) => ({ value: k, label: CARD_KIND_LABEL[k] }))]}
            data-testid="review-kind-filter"
          />
        </div>
        <div data-testid="review-progress">
          <p className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-semibold">{sv.admin.reviewProgress(progress.done, progress.total)}</span>
            {progress.total > 0 ? <span className="text-xs text-muted tabular-nums">{Math.round((progress.done / progress.total) * 100)} %</span> : null}
          </p>
          <ProgressBar value={progress.total ? progress.done / progress.total : 0} label={sv.admin.reviewProgressLabel} />
        </div>
        {bulkCandidates.length > 1 ? (
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} data-testid="review-approve-all">
            <CheckCheck size={15} aria-hidden />
            {sv.admin.reviewApproveAll(bulkValid.length)}
          </Button>
        ) : null}
      </Card>

      {/* Kortet */}
      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1" data-testid="review-main">
        {current ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">{sv.admin.reviewPosition(position + 1, visible.length)}</h2>
                <ReviewStatusBadge status={current.review_status} approved={currentBucket === "godkanda"} />
              </div>
              <div className="flex items-center gap-1">
                <IconButton label={sv.admin.reviewPrev} variant="outline" size="sm" onClick={() => go(-1)} disabled={position <= 0} aria-keyshortcuts="K ArrowLeft" data-testid="review-prev">
                  <ArrowLeft size={16} aria-hidden />
                </IconButton>
                <IconButton label={sv.admin.reviewNext} variant="outline" size="sm" onClick={() => go(1)} disabled={position >= visible.length - 1} aria-keyshortcuts="J ArrowRight" data-testid="review-next">
                  <ArrowRight size={16} aria-hidden />
                </IconButton>
              </div>
            </div>

            <Card padding="md" className="grid gap-4" data-testid="review-meta">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="granska-omrade" className="mb-1.5 block text-sm font-semibold">
                    {sv.admin.category}
                  </label>
                  <Select
                    id="granska-omrade"
                    size="sm"
                    value={current.category_id ?? ""}
                    onChange={(v) => moveCurrent(v || null)}
                    disabled={editing !== null}
                    options={[...areas.map((a) => ({ value: a.id, label: a.title })), { value: "", label: sv.admin.noCategory }]}
                    data-testid="review-area"
                  />
                </div>
                <div>
                  <label htmlFor="granska-typ" className="mb-1.5 block text-sm font-semibold">
                    {sv.admin.kind}
                  </label>
                  <Select<CardKind>
                    id="granska-typ"
                    size="sm"
                    value={editing?.kind ?? current.kind}
                    onChange={changeKind}
                    disabled={editing !== null}
                    options={CARD_KINDS.map((k) => ({ value: k, label: CARD_KIND_LABEL[k] }))}
                    data-testid="review-kind"
                  />
                  <p className="mt-1 text-xs text-muted">{CARD_KIND_DESCRIPTION[editing?.kind ?? current.kind]}</p>
                </div>
              </div>
              <dl className="grid gap-1 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold">{sv.admin.sourceShort}:</dt>
                  <dd className={current.source ? "min-w-0 break-words" : "text-muted"}>{current.source ?? sv.admin.reviewNoSource}</dd>
                </div>
                {current.reviewed_at && current.review_status !== "utkast" ? (
                  <div className="text-muted" suppressHydrationWarning>
                    {sv.admin.reviewReviewedAt(formatWhen(current.reviewed_at))}
                  </div>
                ) : null}
              </dl>
              {current.review_note ? (
                <div className="flex gap-3 rounded-md bg-surface-2 px-4 py-3 text-sm">
                  <MessageSquareWarning size={17} aria-hidden className="mt-0.5 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <p className="font-semibold">{sv.admin.reviewPrevNote}</p>
                    <p className="whitespace-pre-wrap break-words text-muted">{current.review_note}</p>
                  </div>
                </div>
              ) : null}
            </Card>

            {notice ? (
              <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {notice}
              </p>
            ) : null}

            {editing ? (
              <CardEditor
                key={`${current.id}-${editing.kind ?? current.kind}`}
                deckId={deckId}
                categories={areas}
                card={current}
                initialKind={editing.kind}
                onSaved={onSaved}
                onCancel={() => {
                  setEditing(null);
                  setNotice(null);
                }}
                stacked
              />
            ) : (
              <>
                <div className="anim-fade-in" key={current.id}>
                  <p className="mb-2 text-sm font-semibold text-subtle">{sv.admin.reviewAsStudent}</p>
                  <CardPreview
                    front={current.front}
                    back={current.back}
                    hint={current.hint}
                    kind={current.kind}
                    options={current.options}
                    area={current.category_id ? { title: areaTitle(current.category_id), colorIndex: colorIndex.get(current.category_id) ?? 0 } : null}
                    compact
                  />
                </div>

                {issues.length > 0 && currentBucket !== "godkanda" ? (
                  <div role="note" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
                    <p className="font-semibold">{sv.admin.reviewCannotApprove}</p>
                    <ul className="mt-1 list-disc pl-5">
                      {issues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {rejecting ? (
                  <Card padding="md" className="anim-fade-up grid gap-3" data-testid="review-reject-panel">
                    <TextArea
                      label={sv.admin.reviewRejectNote}
                      hint={sv.admin.reviewRejectNoteHelp}
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          reject(rejectNote);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setRejecting(false);
                        }
                      }}
                      data-testid="review-reject-note"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="danger" onClick={() => reject(rejectNote)} data-testid="review-reject-confirm">
                        <X size={16} aria-hidden />
                        {sv.admin.reviewRejectConfirm}
                      </Button>
                      <Button variant="ghost" onClick={() => setRejecting(false)}>
                        {sv.common.cancel}
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {currentBucket !== "godkanda" ? (
                      <Button onClick={approveCurrent} disabled={issues.length > 0} aria-keyshortcuts="G" data-testid="review-approve">
                        <Check size={17} aria-hidden />
                        {sv.admin.reviewApprove}
                      </Button>
                    ) : null}
                    <Button variant="danger" onClick={() => setRejecting(true)} aria-keyshortcuts="A" data-testid="review-reject">
                      <X size={17} aria-hidden />
                      {sv.admin.reviewReject}
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing({})} aria-keyshortcuts="R" data-testid="review-edit">
                      <Pencil size={16} aria-hidden />
                      {sv.admin.reviewEdit}
                    </Button>
                  </div>
                )}
                <Shortcuts />
              </>
            )}
          </>
        ) : (
          <Card padding="lg" className="grid justify-items-start gap-3" data-testid="review-empty">
            {filter.bucket === "vantar" && pendingTotal === 0 ? (
              <>
                <Inbox size={28} aria-hidden className="text-muted" />
                <p className="text-lg font-bold">{sv.admin.reviewEmpty}</p>
                <p className="text-sm text-muted">{sv.admin.reviewEmptyHelp}</p>
                <LinkButton href={`/admin/deck/${deckId}/innehall`} variant="outline" size="sm">
                  {sv.admin.reviewToContent}
                </LinkButton>
              </>
            ) : (
              <>
                <p className="font-semibold">{sv.admin.reviewNoMatch}</p>
                {filtersActive ? (
                  <Button variant="outline" size="sm" onClick={() => setFilter((f) => ({ ...f, area: "alla", kind: "alla" }))}>
                    {sv.admin.reviewShowAll}
                  </Button>
                ) : null}
              </>
            )}
          </Card>
        )}
      </div>

      {/* Listan per område */}
      {visible.length > 0 ? (
        <Card padding="none" className="lg:sticky lg:top-6 lg:col-start-1 lg:row-start-2">
          <div ref={listRef} className="max-h-80 overflow-y-auto px-3 py-2 lg:max-h-[calc(100dvh-26rem)]" data-testid="review-list">
            <p className="sr-only">{sv.admin.reviewList}</p>
            {groups.map((g) => (
              <Disclosure
                key={g.areaId ?? "ingen"}
                defaultOpen
                summary={
                  <span className="flex min-w-0 items-center gap-2">
                    {g.areaId ? <CategoryTag title={g.title ?? ""} colorIndex={colorIndex.get(g.areaId) ?? 0} /> : <span className="text-sm">{sv.admin.uncategorized}</span>}
                    <span className="text-xs font-medium text-muted tabular-nums">{g.cards.length}</span>
                  </span>
                }
              >
                <ul className="grid gap-0.5">
                  {g.cards.map((c) => {
                    const active = c.id === current?.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          data-review-id={c.id}
                          aria-current={active ? "true" : undefined}
                          onClick={() => setCurrentId(c.id)}
                          className={cx(
                            "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150",
                            active ? "bg-inverse text-inverse-fg" : "hover:bg-surface-2",
                          )}
                        >
                          <KindBadge kind={c.kind} compact />
                          <span className="min-w-0 flex-1 truncate">{firstLine(c.front, { maxLength: 120 }) || "…"}</span>
                          {approvalIssues(c).length > 0 && c.review_status !== null ? (
                            <span title={sv.admin.reviewCannotApprove} className="h-2 w-2 shrink-0 rounded-full bg-danger" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Disclosure>
            ))}
          </div>
        </Card>
      ) : null}

      <BulkApproveDialog
        open={bulkOpen}
        counts={countByArea(bulkValid, areas)}
        total={bulkValid.length}
        invalid={bulkInvalid}
        areaTitle={areaTitle}
        onCancel={() => setBulkOpen(false)}
        onConfirm={() => {
          setBulkOpen(false);
          approve(
            bulkValid.map((c) => c.id),
            sv.admin.reviewApprovedMany(bulkValid.length),
          );
          setCurrentId(null);
        }}
      />
      <Toast
        message={toast?.text ?? null}
        id={toast?.id}
        tone={toast?.tone}
        action={toast?.undo ? { label: sv.admin.reviewUndo, onClick: toast.undo } : undefined}
        onClose={() => setToast(null)}
        duration={toast?.undo ? 10000 : 5000}
      />
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" });
}

/** Kortkommandona, diskret under knapparna. Döljs på pekskärmar utan tangentbord (sm och uppåt syns de). */
function Shortcuts() {
  const items: [string[], string][] = [
    [["G"], sv.admin.reviewShortcutApprove],
    [["A"], sv.admin.reviewShortcutReject],
    [["R"], sv.admin.reviewShortcutEdit],
    [["J", "K"], sv.admin.reviewShortcutNav],
    [["Ctrl", "Z"], sv.admin.reviewShortcutUndo],
  ];
  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted sm:flex" aria-label={sv.admin.reviewShortcuts} role="note">
      {items.map(([keys, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          {keys.map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
          {label}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ deckId }: { deckId: string }) {
  return (
    <Card padding="lg" className="anim-fade-up grid justify-items-start gap-3" data-testid="review-empty">
      <Inbox size={28} aria-hidden className="text-muted" />
      <CardHeader title={sv.admin.reviewEmpty} description={sv.admin.reviewEmptyHelp} spacing="none" />
      <LinkButton href={`/admin/deck/${deckId}/innehall`} variant="outline" size="sm">
        {sv.admin.reviewToContent}
      </LinkButton>
    </Card>
  );
}

function BulkApproveDialog({
  open,
  counts,
  total,
  invalid,
  areaTitle,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  counts: { areaId: string | null; count: number }[];
  total: number;
  invalid: number;
  areaTitle: (id: string | null) => string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={sv.admin.reviewApproveAllTitle}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {sv.common.cancel}
          </Button>
          <Button onClick={onConfirm} disabled={total === 0} data-testid="review-approve-all-confirm">
            {sv.admin.reviewApproveAllConfirm(total)}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-muted">{sv.admin.reviewApproveAllBody(total)}</p>
        {counts.length > 0 ? (
          <ul className="grid gap-1 text-sm" data-testid="review-approve-all-counts">
            {counts.map((c) => (
              <li key={c.areaId ?? "ingen"} className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2">
                <span className="min-w-0 truncate font-medium">{areaTitle(c.areaId)}</span>
                <span className="shrink-0 tabular-nums text-muted">{sv.admin.cardCount(c.count)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {invalid > 0 ? <p className="text-sm font-medium text-danger">{sv.admin.reviewApproveAllInvalid(invalid)}</p> : null}
      </div>
    </Modal>
  );
}
