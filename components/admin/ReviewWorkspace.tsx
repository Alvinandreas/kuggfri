"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  GitCompareArrows,
  Inbox,
  ListFilter,
  MessageSquareWarning,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { firstLine } from "@/lib/text/first-line";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { moveCardsToCategoryAction, type ActionResult } from "@/lib/admin/actions";
import { approveCardsAction, rejectCardAction, restoreReviewAction, setCardKindAction, type ReviewSnapshot } from "@/lib/admin/review-actions";
import { rejectCorrectionAction, restoreCardVersionAction } from "@/lib/admin/history-actions";
import { contentOf, restoreValues, type CardVersion } from "@/lib/admin/history";
import {
  approvalIssues,
  countByArea,
  countPublishedChanges,
  filterReviewCards,
  groupReviewList,
  isPublishedChange,
  nextAfterDecision,
  reviewBucket,
  reviewProgress,
  step,
  type ReviewArea,
  type ReviewBucket,
  type ReviewCard,
  type ReviewFilter,
} from "@/lib/admin/review";
import { SOURCE_TAGS, SOURCE_TAG_LABEL, cardSources, countBySourceTag, type SourceFilter } from "@/lib/admin/sources";
import { CARD_KINDS, CARD_KIND_DESCRIPTION, CARD_KIND_LABEL, isAutoGraded, trueFalseAnswer, validateKind, type CardKind } from "@/lib/cards/kinds";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Disclosure } from "@/components/ui/Disclosure";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { cx } from "@/components/ui/cx";
import { CardEditor, type SavedCard } from "./CardEditor";
import { CardHistory } from "./CardHistory";
import { CardPreview } from "./CardPreview";
import { CorrectionCompare } from "./CorrectionCompare";
import { KindBadge } from "./KindBadge";
import { CorrectionNote, SourceBadges, SourceList } from "./SourceBadges";

type Props = {
  deckId: string;
  areas: ReviewArea[];
  cards: ReviewCard[];
  initialFilter: ReviewFilter;
  /** Antal tidigare versioner per kort (kort utan historik saknas). */
  historyCounts: Record<string, number>;
  /** Senast publicerade version per kort som någon gång varit publicerat (rättelser visas mot den). */
  publishedVersions: Record<string, CardVersion>;
  /** Den inloggade granskaren (reviewed_by i den optimistiska uppdateringen). */
  userId: string;
  /** Serverns klocka vid renderingen, så att server och klient delar in korten likadant. */
  now: number;
};

type StatusState = { id: number; text: string; undo?: () => void; tone?: "default" | "danger" };

/** Ett korts historik i granskningen: hämtad för ett visst antal versioner (count). */
type HistoryEntry = { count: number; versions: CardVersion[] | null; error: boolean };

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

/** Listkolumnens läge sparas per webbläsare (en bekvämlighet; vyn fungerar utan). */
const LIST_KEY = "kuggfri.granskning.lista";

/** Filtret i adressen, så att en filtrerad vy går att ladda om och dela. */
function filterQuery(f: ReviewFilter): string {
  const q = new URLSearchParams();
  if (f.bucket !== "vantar") q.set("status", f.bucket);
  if (f.area !== "alla") q.set("omrade", f.area);
  if (f.kind !== "alla") q.set("typ", f.kind);
  if (f.source && f.source !== "alla") q.set("kalla", f.source);
  if (f.changesOnly) q.set("andringar", "1");
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Granskningsvyn: gå igenom många förslag snabbt. Överst en filterrad (status, område, typ,
 * källtyp, bara ändringar) med förloppet. Under den listan över förslagen som en egen,
 * hopfällbar kolumn och arbetsytan, där kortet som granskas tar huvudplatsen: vilket kort,
 * område, typ, källor och status, kortet (eller en rättelse jämförd med den publicerade
 * versionen) och en fast åtgärdsrad i nederkant. Vid redigering döljs listan och filtren så
 * att redigeraren får hela bredden. Besluten syns direkt (optimistiskt) och rullas tillbaka
 * om servern säger nej; det senaste går att ångra.
 */
export function ReviewWorkspace({ deckId, areas, cards: serverCards, initialFilter, historyCounts, publishedVersions, userId, now: serverNow }: Props) {
  const [cards, setCards] = useState(serverCards);
  const [now, setNow] = useState(serverNow);
  const [filter, setFilter] = useState<ReviewFilter>({ source: "alla", ...initialFilter });
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ kind?: CardKind } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [histories, setHistories] = useState<Record<string, HistoryEntry>>({});
  /** Listkolumnen på breda skärmar (xl) och listpanelen på smalare. */
  const [listColumn, setListColumn] = useState(true);
  const [listSheet, setListSheet] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inFlight = useRef(new Map<string, number>());
  const listRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  // Senaste korten för Ångra-knappen, vars funktion skapades vid en tidigare rendering.
  const latestCards = useRef(cards);
  useEffect(() => {
    latestCards.current = cards;
  });

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LIST_KEY) === "dold") setListColumn(false);
    } catch {
      // Ingen lagring (privat läge): listan visas.
    }
  }, []);

  function toggleListColumn() {
    setListColumn((open) => {
      try {
        window.localStorage.setItem(LIST_KEY, open ? "dold" : "visad");
      } catch {
        // Ingen lagring: läget gäller bara nu.
      }
      return !open;
    });
  }

  // Filtret speglas i adressen (utan navigering), så att vyn går att ladda om med samma filter.
  useEffect(() => {
    const url = `${window.location.pathname}${filterQuery(filter)}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", url);
  }, [filter]);

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

  // Fel och upplysningar försvinner av sig själva; ett beslut med Ångra står kvar till nästa.
  useEffect(() => {
    if (!status || status.undo) return;
    const t = window.setTimeout(() => setStatus((s) => (s?.id === status.id ? null : s)), 6000);
    return () => window.clearTimeout(t);
  }, [status]);

  const colorIndex = useMemo(() => categoryColorIndex(areas), [areas]);
  const areaTitle = useCallback((id: string | null) => (id ? (areas.find((a) => a.id === id)?.title ?? sv.admin.uncategorized) : sv.admin.uncategorized), [areas]);
  const areaColor = useCallback((id: string | null) => (id ? (colorIndex.get(id) ?? 0) : 0), [colorIndex]);
  const visible = useMemo(() => filterReviewCards(cards, filter, areas, now), [cards, filter, areas, now]);
  const visibleIds = useMemo(() => visible.map((c) => c.id), [visible]);
  const groups = useMemo(() => groupReviewList(visible, areas), [visible, areas]);
  const current = visible.find((c) => c.id === currentId) ?? visible[0] ?? null;
  const position = current ? visibleIds.indexOf(current.id) : -1;
  const progress = reviewProgress(cards, filter, now);
  const bucketCounts = useMemo(() => {
    const count = (bucket: ReviewBucket) => filterReviewCards(cards, { ...filter, bucket }, areas, now).length;
    return { vantar: count("vantar"), avvisade: count("avvisade"), godkanda: count("godkanda") } satisfies Record<ReviewBucket, number>;
  }, [cards, filter, areas, now]);
  // Antal per källtyp i högen, inom de andra filtren (för källfiltrets alternativ).
  const sourceCounts = useMemo(() => countBySourceTag(filterReviewCards(cards, { ...filter, source: "alla" }, areas, now)), [cards, filter, areas, now]);
  const pendingTotal = cards.filter((c) => c.review_status === "utkast").length;
  const changesCount = countPublishedChanges(cards, filter, now);
  const issues = current ? approvalIssues(current) : [];
  const currentBucket = current ? reviewBucket(current, now) : null;
  // Ändring av ett publicerat kort: den publicerade versionen att jämföra med.
  const published = current && current.review_status !== null ? (publishedVersions[current.id] ?? null) : null;
  const correcting = published !== null && current?.review_status === "utkast";
  const reason = current ? cardSources(current).correction : null;
  const historyCount = current ? (historyCounts[current.id] ?? 0) : 0;
  const historyEntry = current ? histories[current.id] : undefined;
  const historyVersions = historyCount === 0 ? [] : historyEntry?.count === historyCount ? historyEntry.versions : null;

  // Historiken hämtas när ett kort med historik visas (och igen när antalet versioner ändrats).
  const fetchHistory = useCallback(
    (id: string, count: number) => {
      setHistories((h) => ({ ...h, [id]: { count, versions: null, error: false } }));
      const settle = (entry: HistoryEntry) => setHistories((h) => (h[id]?.count === count ? { ...h, [id]: entry } : h));
      fetch(`/admin/deck/${deckId}/kort/${id}/historik`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ versions: CardVersion[] }>) : Promise.reject(new Error(String(r.status)))))
        .then((body) => settle({ count, versions: body.versions, error: false }))
        .catch(() => settle({ count, versions: null, error: true }));
    },
    [deckId],
  );
  useEffect(() => {
    if (!current || historyCount === 0) return;
    if (histories[current.id]?.count === historyCount) return;
    fetchHistory(current.id, historyCount);
  }, [current?.id, historyCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Byter kort: stäng redigering och avvisning, visa det nya kortet i listan.
  useEffect(() => {
    setEditing(null);
    setRejecting(false);
    setRejectNote("");
    setNotice(null);
    if (!current) return;
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-review-id="${current.id}"]`);
    // Rulla bara inom listan, aldrig hela sidan.
    if (list && item && list.offsetParent !== null) {
      const top = item.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top - list.clientHeight / 2 + item.offsetHeight / 2;
    }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redigeringen tar hela bredden: visa arbetsytans topp när den öppnas.
  useEffect(() => {
    if (!editing) return;
    const top = mainRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) mainRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [editing !== null]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setStatus({ id: Date.now(), text: result.error, tone: "danger" });
      return null;
    } catch {
      revert();
      setStatus({ id: Date.now(), text: sv.errors.generic, tone: "danger" });
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
    setStatus(null);
    const before = latestCards.current.filter((c) => snaps.some((s) => s.id === c.id)).map(snapshot);
    restoreLocal(snaps);
    setCurrentId(snaps[0]?.id ?? null);
    void run(snaps.map((s) => s.id), () => restoreReviewAction(deckId, snaps), () => restoreLocal(before)).then((ok) => {
      if (ok !== null) setStatus({ id: Date.now(), text: sv.admin.reviewUndone });
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
    setStatus({ id: at, text: label, undo: () => undoDecision(snaps) });
    void run(ids, () => approveCardsAction(deckId, ids), () => restoreLocal(snaps)).then((data) => {
      if (!data || data.skipped.length === 0) return;
      restoreLocal(snaps.filter((s) => data.skipped.includes(s.id)));
      setStatus({ id: Date.now(), text: sv.admin.reviewSkipped(data.skipped.length), tone: "danger" });
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
    if (correcting && published) {
      rejectCorrection(note, published);
      return;
    }
    const snaps = [snapshot(current)];
    const at = Date.now();
    const text = note.trim();
    commit(
      patch(cards, [current.id], (c) => ({ ...c, review_status: "avvisad", review_note: text || null, is_active: false, reviewed_by: userId, reviewed_at: new Date(at).toISOString() })),
      { advance: true, at },
    );
    setRejecting(false);
    setRejectNote("");
    setStatus({ id: at, text: sv.admin.reviewRejected(firstLine(current.front, { maxLength: 60 })), undo: () => undoDecision(snaps) });
    void run([current.id], () => rejectCardAction(deckId, current.id, text), () => restoreLocal(snaps));
  }

  function replaceCard(card: ReviewCard) {
    setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
  }

  /**
   * Ångrar en innehållsändring (återställning eller avvisad rättelse): kortet får tillbaka
   * versionen som triggern sparade (versionId) och, om withReview, sitt granskningsläge.
   */
  function undoContent(before: ReviewCard, versionId: number | null, withReview: boolean) {
    setStatus(null);
    const after = latestCards.current.find((c) => c.id === before.id);
    replaceCard(before);
    setCurrentId(before.id);
    void run(
      [before.id],
      async (): Promise<ActionResult> => {
        if (versionId !== null) {
          const restored = await restoreCardVersionAction(deckId, before.id, versionId);
          if (!restored.ok) return restored;
        }
        return withReview ? restoreReviewAction(deckId, [snapshot(before)]) : { ok: true, data: undefined };
      },
      () => {
        if (after) replaceCard(after);
      },
    ).then((ok) => {
      if (ok !== null) setStatus({ id: Date.now(), text: sv.admin.reviewUndone });
    });
  }

  /**
   * Avvisar en ändring av ett publicerat kort: kortet går tillbaka till den publicerade
   * versionen och syns för studenterna igen. Förslaget finns kvar i historiken.
   */
  function rejectCorrection(note: string, version: CardVersion) {
    if (!current) return;
    const before = current;
    const at = Date.now();
    const text = note.trim();
    commit(
      patch(cards, [before.id], (c) => ({ ...c, ...restoreValues(version), review_note: text || null, reviewed_by: userId, reviewed_at: new Date(at).toISOString() })),
      { advance: true, at },
    );
    setRejecting(false);
    setRejectNote("");
    const pending = run([before.id], () => rejectCorrectionAction(deckId, before.id, version.id, text), () => replaceCard(before));
    setStatus({
      id: at,
      text: sv.admin.correctionRejected(firstLine(version.front, { maxLength: 60 })),
      undo: () => {
        setStatus(null);
        void pending.then((data) => {
          if (data) undoContent(before, data.undoVersionId, true);
        });
      },
    });
    // Servern kan ha lagt kortet utan område (om området tagits bort sedan versionen).
    void pending.then((data) => {
      if (data) setCards((prev) => patch(prev, [before.id], (c) => ({ ...c, ...data.content })));
    });
  }

  /** Återställer en version ur historiken. Ångra lägger tillbaka versionen som ersattes. */
  async function restoreFromHistory(version: CardVersion, n: number) {
    if (!current) return;
    const before = current;
    mark([before.id], 1);
    try {
      const result = await restoreCardVersionAction(deckId, before.id, version.id).catch(() => null);
      if (!result || !result.ok) {
        setStatus({ id: Date.now(), text: result && !result.ok ? result.error : sv.errors.generic, tone: "danger" });
        return;
      }
      const { content, undoVersionId } = result.data;
      if (undoVersionId === null) {
        setStatus({ id: Date.now(), text: sv.admin.historyUnchanged });
        return;
      }
      commit(patch(latestCards.current, [before.id], (c) => ({ ...c, ...content })));
      setStatus({ id: Date.now(), text: sv.admin.historyRestored(n), undo: () => undoContent(before, undoVersionId, false) });
    } finally {
      mark([before.id], -1);
    }
  }

  function moveCurrent(categoryId: string | null) {
    if (!current || current.category_id === categoryId) return;
    const card = current;
    const from = card.category_id;
    const setArea = (area: string | null) => setCards((prev) => patch(prev, [card.id], (c) => ({ ...c, category_id: area })));
    commit(patch(cards, [card.id], (c) => ({ ...c, category_id: categoryId })));
    setStatus({
      id: Date.now(),
      text: sv.admin.reviewMoved(areaTitle(categoryId)),
      undo: () => {
        setStatus(null);
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
    setStatus({
      id: Date.now(),
      text: sv.admin.reviewKindChanged(CARD_KIND_LABEL[kind]),
      undo: () => {
        setStatus(null);
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
    setStatus({ id: Date.now(), text: sv.admin.reviewSaved });
  }

  const go = (delta: -1 | 1) => setCurrentId(step(visibleIds, current?.id ?? null, delta));

  function select(id: string) {
    setCurrentId(id);
    setListSheet(false);
  }

  // -------------------------------------------------------------------------
  // Kortkommandon: G godkänn, A avvisa, R redigera, J/K eller pilar, Ctrl+Z ångra
  // -------------------------------------------------------------------------

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      if (status?.undo) {
        e.preventDefault();
        status.undo();
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
  const activeFilters = [filter.area !== "alla", filter.kind !== "alla", (filter.source ?? "alla") !== "alla", filter.changesOnly === true].filter(Boolean).length;
  const clearFilters = () => setFilter((f) => ({ ...f, area: "alla", kind: "alla", source: "alla", changesOnly: false }));

  const statusLine = status ? <StatusLine status={status} onClose={() => setStatus(null)} /> : null;
  // Föregående och Nästa: i arbetsytans huvud på breda ytor, i åtgärdsraden på smala.
  const nav = (size: "sm" | "md") => (
    <>
      <Button variant="outline" size={size} onClick={() => go(-1)} disabled={position <= 0} aria-keyshortcuts="K ArrowLeft" data-testid="review-prev">
        <ArrowLeft size={16} aria-hidden />
        {sv.admin.reviewPrev}
        <KeyHint>K</KeyHint>
      </Button>
      <Button variant="outline" size={size} onClick={() => go(1)} disabled={position >= visible.length - 1} aria-keyshortcuts="J ArrowRight" data-testid="review-next">
        {sv.admin.reviewNext}
        <ArrowRight size={16} aria-hidden />
        <KeyHint>J</KeyHint>
      </Button>
    </>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" data-testid="review-workspace">
      {/* Filterraden */}
      {editing ? null : (
        <Card padding="sm" className="grid grid-cols-[minmax(0,1fr)] gap-3" data-testid="review-filters">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="-mx-1 max-w-full overflow-x-auto px-1">
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
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-4 gap-y-2 max-md:basis-full max-sm:justify-between">
              <div className="flex min-w-[11rem] flex-1 items-center gap-3 sm:max-w-72" data-testid="review-progress">
                <ProgressBar value={progress.total ? progress.done / progress.total : 0} label={sv.admin.reviewProgressLabel} className="flex-1" />
                <span className="shrink-0 text-sm font-semibold tabular-nums">{sv.admin.reviewProgress(progress.done, progress.total)}</span>
              </div>
              {bulkCandidates.length > 1 ? (
                <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} data-testid="review-approve-all">
                  <CheckCheck size={15} aria-hidden />
                  {sv.admin.reviewApproveAll(bulkValid.length)}
                </Button>
              ) : null}
            </div>
          </div>
          {filter.bucket === "godkanda" ? <p className="-mt-1 text-xs text-muted">{sv.admin.reviewBucketApproved}</p> : null}

          <div className="flex items-center gap-2 sm:hidden">
            <Button variant="secondary" size="sm" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} aria-controls="granska-filter">
              <ListFilter size={15} aria-hidden />
              {activeFilters > 0 ? sv.admin.reviewFiltersActive(activeFilters) : sv.admin.reviewFilters}
            </Button>
            {activeFilters > 0 ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                {sv.admin.reviewClearFilters}
              </Button>
            ) : null}
          </div>
          <div id="granska-filter" className={cx("grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center", filtersOpen ? "" : "max-sm:hidden")}>
            <Select
              size="sm"
              label={sv.admin.reviewAreaFilter}
              value={filter.area}
              onChange={(area) => setFilter((f) => ({ ...f, area }))}
              options={[{ value: "alla", label: sv.admin.reviewAllAreas }, ...areas.map((a) => ({ value: a.id, label: a.title })), { value: "ingen", label: sv.admin.uncategorized }]}
              className="col-span-2 sm:w-64"
              data-testid="review-area-filter"
            />
            <Select<ReviewFilter["kind"]>
              size="sm"
              label={sv.admin.reviewKindFilter}
              value={filter.kind}
              onChange={(kind) => setFilter((f) => ({ ...f, kind }))}
              options={[{ value: "alla", label: sv.admin.reviewAllKinds }, ...CARD_KINDS.map((k) => ({ value: k, label: CARD_KIND_LABEL[k] }))]}
              className="sm:w-44"
              data-testid="review-kind-filter"
            />
            <Select<SourceFilter>
              size="sm"
              label={sv.admin.sourceFilter}
              value={filter.source ?? "alla"}
              onChange={(source) => setFilter((f) => ({ ...f, source }))}
              options={[
                { value: "alla", label: sv.admin.sourceAll },
                ...SOURCE_TAGS.filter((t) => sourceCounts[t] > 0 || filter.source === t).map((t) => ({ value: t, label: `${SOURCE_TAG_LABEL[t]} (${sourceCounts[t]})` })),
              ]}
              className="sm:w-48"
              data-testid="review-source-filter"
            />
            {changesCount > 0 || filter.changesOnly ? (
              <button
                type="button"
                aria-pressed={filter.changesOnly === true}
                title={sv.admin.reviewChangesFilterHelp}
                onClick={() => setFilter((f) => ({ ...f, changesOnly: !f.changesOnly }))}
                className={cx(
                  "col-span-2 inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-colors duration-150",
                  filter.changesOnly ? "border-inverse bg-inverse text-inverse-fg" : "border-line-strong text-fg hover:bg-surface-2",
                )}
                data-testid="review-changes-filter"
              >
                <GitCompareArrows size={15} aria-hidden />
                {sv.admin.reviewChangesShort}
                <span className={cx("tabular-nums", filter.changesOnly ? "opacity-80" : "text-muted")}>{changesCount}</span>
              </button>
            ) : null}
            {activeFilters > 0 ? (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="max-sm:hidden">
                <X size={15} aria-hidden />
                {sv.admin.reviewClearFilters}
              </Button>
            ) : null}
          </div>
        </Card>
      )}

      <div className={cx("grid grid-cols-[minmax(0,1fr)] items-start gap-5", listColumn && !editing && "xl:grid-cols-[19rem_minmax(0,1fr)]")}>
        {/* Listan över förslagen: egen kolumn på breda skärmar, en panel på smalare */}
        {visible.length > 0 && !editing ? (
          <Card
            padding="none"
            className={cx(
              "grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)]",
              listSheet ? "max-h-[65dvh]" : "max-xl:hidden",
              listColumn ? "" : "xl:hidden",
            )}
            data-testid="review-list-panel"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <p className="text-sm font-bold">{sv.admin.reviewListCount(visible.length)}</p>
              <Button variant="ghost" size="sm" onClick={toggleListColumn} className="max-xl:hidden">
                <PanelLeftClose size={15} aria-hidden />
                {sv.admin.reviewHideList}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setListSheet(false)} className="xl:hidden">
                <X size={15} aria-hidden />
                {sv.admin.reviewHideList}
              </Button>
            </div>
            <div ref={listRef} className="overflow-y-auto overscroll-contain px-2 py-1.5" data-testid="review-list">
              <p className="sr-only">{sv.admin.reviewList}</p>
              {groups.map((g) => (
                <Disclosure
                  key={g.key}
                  defaultOpen
                  className="px-1"
                  summary={
                    <span className="flex min-w-0 items-center gap-2">
                      {g.changes ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <GitCompareArrows size={14} aria-hidden className="text-muted" />
                          {sv.admin.reviewChangesGroup}
                        </span>
                      ) : g.areaId ? (
                        <CategoryTag title={g.title ?? ""} colorIndex={colorIndex.get(g.areaId) ?? 0} />
                      ) : (
                        <span className="text-sm">{sv.admin.uncategorized}</span>
                      )}
                      <span className="text-xs font-medium text-muted tabular-nums">{g.cards.length}</span>
                    </span>
                  }
                >
                  <ul className="-mx-1 grid gap-0.5">
                    {g.cards.map((c) => {
                      const active = c.id === current?.id;
                      const blocked = approvalIssues(c).length > 0 && c.review_status !== null;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            data-review-id={c.id}
                            aria-current={active ? "true" : undefined}
                            onClick={() => select(c.id)}
                            className={cx(
                              "relative grid w-full min-w-0 gap-1 rounded-md py-2 pl-3 pr-2 text-left text-sm transition-colors duration-150",
                              active ? "bg-surface-3 font-semibold" : "hover:bg-surface-2",
                            )}
                          >
                            {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent" /> : null}
                            <span className="line-clamp-2 break-words">{firstLine(c.front, { maxLength: 140 }) || "…"}</span>
                            <span className="flex min-w-0 flex-wrap items-center gap-1 font-normal">
                              <KindBadge kind={c.kind} compact />
                              {isPublishedChange(c) && !g.changes ? (
                                <span title={sv.admin.reviewChangeMarker} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                                  <GitCompareArrows size={12} aria-hidden />
                                  <span className="sr-only">{sv.admin.reviewChangeMarker}</span>
                                </span>
                              ) : null}
                              <SourceBadges source={c.source} original={c.original} max={2} />
                              {blocked ? (
                                <span title={sv.admin.reviewCannotApprove} className="ml-auto h-2 w-2 shrink-0 rounded-full bg-danger">
                                  <span className="sr-only">{sv.admin.reviewCannotApprove}</span>
                                </span>
                              ) : null}
                            </span>
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

        {/* Arbetsytan */}
        <section ref={mainRef} aria-label={sv.admin.reviewCurrent} className="@container grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 scroll-mt-20" data-testid="review-main">
          {current ? (
            <>
              <ReviewHeader
                card={current}
                position={position}
                total={visible.length}
                correcting={correcting}
                approved={currentBucket === "godkanda"}
                areaTitle={areaTitle}
                areaColor={areaColor}
                editing={editing !== null}
                nav={editing ? null : nav("sm")}
                listToggle={
                  editing ? null : (
                    <>
                      {listColumn ? null : (
                        <Button variant="secondary" size="sm" onClick={toggleListColumn} className="max-xl:hidden" data-testid="review-show-list">
                          <PanelLeftOpen size={15} aria-hidden />
                          {sv.admin.reviewShowList}
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => setListSheet((o) => !o)} aria-expanded={listSheet} className="xl:hidden" data-testid="review-toggle-list">
                        {listSheet ? <PanelLeftClose size={15} aria-hidden /> : <PanelLeftOpen size={15} aria-hidden />}
                        {listSheet ? sv.admin.reviewHideList : sv.admin.reviewListCount(visible.length)}
                      </Button>
                    </>
                  )
                }
              />

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
                  {reason ? <CorrectionNote reason={reason} /> : null}

                  {current.review_note ? (
                    <div className="flex gap-3 rounded-md bg-surface-2 px-4 py-3 text-sm">
                      <MessageSquareWarning size={17} aria-hidden className="mt-0.5 shrink-0 text-muted" />
                      <div className="min-w-0">
                        <p className="font-semibold">{sv.admin.reviewPrevNote}</p>
                        <p className="whitespace-pre-wrap break-words text-muted">{current.review_note}</p>
                      </div>
                    </div>
                  ) : null}

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

                  {published ? (
                    <Card padding="md" className="anim-fade-in grid gap-4" key={`jamfor-${current.id}`} data-testid="review-correction">
                      <CardHeader
                        title={
                          <span className="flex items-center gap-2">
                            <GitCompareArrows size={18} aria-hidden className="text-muted" />
                            {sv.admin.correctionTitle}
                          </span>
                        }
                        description={current.review_status === "utkast" ? sv.admin.correctionHelp : undefined}
                        as="h3"
                        spacing="none"
                      />
                      <CorrectionCompare
                        before={published}
                        after={{ ...contentOf(current), is_active: published.is_active, review_status: published.review_status }}
                        areaTitle={areaTitle}
                        colorIndex={areaColor}
                      />
                    </Card>
                  ) : (
                    <div className="anim-fade-in" key={current.id}>
                      <p className="mb-2 text-sm font-semibold text-subtle">{sv.admin.reviewAsStudent}</p>
                      <CardPreview
                        front={current.front}
                        back={current.back}
                        hint={current.hint}
                        kind={current.kind}
                        options={current.options}
                        area={current.category_id ? { title: areaTitle(current.category_id), colorIndex: areaColor(current.category_id) } : null}
                        compact
                        sideBySide
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
                    <Card padding="md" data-testid="review-sources">
                      <CardHeader title={sv.admin.sourcesTitle} as="h3" spacing="sm" />
                      <SourceList source={current.source} original={current.original} showCorrection={false} />
                    </Card>
                    <Card padding="md" className="grid gap-3" data-testid="review-meta">
                      <div>
                        <label htmlFor="granska-omrade" className="mb-1.5 block text-sm font-semibold">
                          {sv.admin.category}
                        </label>
                        <Select
                          id="granska-omrade"
                          size="sm"
                          value={current.category_id ?? ""}
                          onChange={(v) => moveCurrent(v || null)}
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
                          value={current.kind}
                          onChange={changeKind}
                          options={CARD_KINDS.map((k) => ({ value: k, label: CARD_KIND_LABEL[k] }))}
                          data-testid="review-kind"
                        />
                        <p className="mt-1 text-xs text-muted">{CARD_KIND_DESCRIPTION[current.kind]}</p>
                      </div>
                      {current.reviewed_at && current.review_status !== "utkast" ? (
                        <p className="text-xs text-muted" suppressHydrationWarning>
                          {sv.admin.reviewReviewedAt(formatWhen(current.reviewed_at))}
                        </p>
                      ) : null}
                    </Card>
                  </div>

                  <Card padding="md">
                    <CardHistory
                      key={current.id}
                      versions={historyVersions}
                      count={historyCount}
                      error={historyEntry?.count === historyCount && historyEntry.error}
                      onRetry={() => fetchHistory(current.id, historyCount)}
                      current={contentOf(current)}
                      areaTitle={areaTitle}
                      now={now}
                      onRestore={restoreFromHistory}
                    />
                  </Card>

                  {/* Åtgärdsraden, fast i nederkant av arbetsytan */}
                  <div className="sticky bottom-3 z-20 mt-1" data-testid="review-actions">
                    <div className="grid gap-2 rounded-lg border border-line bg-surface/95 p-2.5 shadow-pop backdrop-blur supports-[backdrop-filter]:bg-surface/85 dark:border-line-strong">
                      {statusLine}
                      {rejecting ? (
                        <div className="anim-fade-up grid gap-3 p-1.5" data-testid="review-reject-panel">
                          {correcting ? <p className="text-sm text-muted">{sv.admin.correctionRejectHelp}</p> : null}
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
                              {correcting ? sv.admin.correctionRejectConfirm : sv.admin.reviewRejectConfirm}
                            </Button>
                            <Button variant="ghost" onClick={() => setRejecting(false)}>
                              {sv.common.cancel}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div role="group" aria-label={sv.admin.reviewActions} className="grid grid-cols-3 gap-2 @xl:flex @xl:flex-wrap @xl:items-center">
                          {currentBucket !== "godkanda" ? (
                            <Button onClick={approveCurrent} disabled={issues.length > 0} aria-keyshortcuts="G" className="@max-xl:gap-1.5! @max-xl:px-2!" data-testid="review-approve">
                              <Check size={17} aria-hidden />
                              {sv.admin.reviewApprove}
                              <KeyHint>G</KeyHint>
                            </Button>
                          ) : null}
                          <Button variant="danger" onClick={() => setRejecting(true)} aria-keyshortcuts="A" className="@max-xl:gap-1.5! @max-xl:px-2!" data-testid="review-reject">
                            <X size={17} aria-hidden />
                            {correcting ? (
                              <>
                                <span className="@max-xl:hidden">{sv.admin.correctionReject}</span>
                                <span className="@xl:hidden">{sv.admin.reviewReject}</span>
                              </>
                            ) : (
                              sv.admin.reviewReject
                            )}
                            <KeyHint>A</KeyHint>
                          </Button>
                          <Button variant="secondary" onClick={() => setEditing({})} aria-keyshortcuts="R" className="@max-xl:gap-1.5! @max-xl:px-2!" data-testid="review-edit">
                            <Pencil size={16} aria-hidden />
                            {sv.admin.reviewEdit}
                            <KeyHint>R</KeyHint>
                          </Button>
                          <div className="col-span-3 grid grid-cols-2 gap-2 @xl:hidden">{nav("md")}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {statusLine ? <div className="rounded-lg border border-line bg-surface p-2.5 dark:border-transparent">{statusLine}</div> : null}
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
                    {activeFilters > 0 ? (
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        {sv.admin.reviewShowAll}
                      </Button>
                    ) : null}
                  </>
                )}
              </Card>
            </>
          )}
        </section>
      </div>

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
    </div>
  );
}

/**
 * Vad som granskas: kort X av N, status, område, uppgiftstyp och källtyper. I redigeringsläget
 * samma rad med en förklaring om att listan är dold.
 */
function ReviewHeader({
  card,
  position,
  total,
  correcting,
  approved,
  areaTitle,
  areaColor,
  editing,
  nav,
  listToggle,
}: {
  card: ReviewCard;
  position: number;
  total: number;
  correcting: boolean;
  approved: boolean;
  areaTitle: (id: string | null) => string;
  areaColor: (id: string | null) => number;
  editing: boolean;
  nav: ReactNode;
  listToggle: ReactNode;
}) {
  return (
    <Card padding="md" className="grid gap-3" data-testid="review-header">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h2 className="text-lg font-bold tracking-tight">
            {editing ? `${sv.admin.reviewEditing} · ` : null}
            <span className="tabular-nums">{sv.admin.reviewPosition(position + 1, total)}</span>
          </h2>
          {correcting ? (
            <Badge tone="accent">
              <GitCompareArrows size={12} aria-hidden />
              {sv.admin.reviewStatusCorrection}
            </Badge>
          ) : card.review_status === "utkast" ? (
            <Badge tone="strong">{sv.admin.statusDraft}</Badge>
          ) : card.review_status === "avvisad" ? (
            <Badge tone="danger">{sv.admin.statusRejected}</Badge>
          ) : approved ? (
            <Badge tone="accent">
              <CheckCheck size={12} aria-hidden />
              {sv.admin.statusApproved}
            </Badge>
          ) : null}
        </div>
        {listToggle || nav ? (
          <div className="flex flex-wrap items-center gap-2">
            {listToggle}
            {nav ? <div className="flex gap-2 @max-xl:hidden">{nav}</div> : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {card.category_id ? <CategoryTag title={areaTitle(card.category_id)} colorIndex={areaColor(card.category_id)} /> : <Badge tone="outline">{sv.admin.noCategory}</Badge>}
        <KindBadge kind={card.kind} />
        <span aria-hidden className="mx-0.5 h-4 w-px bg-line-strong max-sm:hidden" />
        <SourceBadges source={card.source} original={card.original} max={6} />
      </div>
      {editing ? <p className="text-sm text-muted">{sv.admin.reviewEditingHelp}</p> : null}
    </Card>
  );
}

/** Tangenten bredvid en knapps etikett, diskret och bara där det finns tangentbord (sm och uppåt). */
function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd aria-hidden className="ml-0.5 hidden h-5 min-w-5 items-center justify-center rounded border border-current/25 px-1 font-mono text-[10px] font-semibold opacity-70 @xl:inline-flex">
      {children}
    </kbd>
  );
}

/** Senaste beslutet eller felet, i åtgärdsraden (skymmer inget), med Ångra när det går. */
function StatusLine({ status, onClose }: { status: StatusState; onClose: () => void }) {
  return (
    <div
      role={status.tone === "danger" ? "alert" : "status"}
      className={cx(
        "anim-fade-in flex min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm",
        status.tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface-2 text-fg",
      )}
      data-testid="review-status"
      key={status.id}
    >
      <span className="min-w-0 flex-1 truncate" title={status.text}>
        {status.text}
      </span>
      {status.undo ? (
        <button
          type="button"
          onClick={status.undo}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold transition-colors duration-150 hover:bg-surface-3"
          data-testid="review-undo"
        >
          <RotateCcw size={14} aria-hidden />
          {sv.admin.reviewUndo}
          <span className="hidden text-xs font-medium text-muted sm:inline">Ctrl Z</span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label={sv.common.close}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-3 hover:text-fg"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" });
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
