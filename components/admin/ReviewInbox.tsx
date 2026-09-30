"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCheck, FlagTriangleRight, Inbox, ListFilter, Search, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { firstLine } from "@/lib/text/first-line";
import { categoryColorIndex, tagBgClass } from "@/lib/ui/tag-colors";
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
  DEFAULT_REVIEW_FILTER,
  ORIGIN_FILTERS,
  activeFilterCount,
  approvalIssues,
  cleanFlagNote,
  countByTab,
  formatDay,
  formatTime,
  groupReviewList,
  isOriginFilter,
  isReviewTab,
  matchesReviewFilter,
  nextAfterDecision,
  relativeDay,
  reviewList,
  reviewTab,
  step,
  type OriginFilter,
  type ReviewArea,
  type ReviewCard,
  type ReviewFilter,
  type ReviewTab,
} from "@/lib/admin/review";
import { SOURCE_TAGS, SOURCE_TAG_LABEL, countBySourceTag, isSourceFilter, sourceTags, type SourceFilter } from "@/lib/admin/sources";
import { CARD_KINDS, CARD_KIND_LABEL, isCardKind, type CardKind } from "@/lib/cards/kinds";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Toast } from "@/components/ui/Toast";
import { inputClass } from "@/components/ui/TextField";
import { cx } from "@/components/ui/cx";
import { KIND_ICON } from "./KindBadge";
import { ReviewCardView, type ReviewStatus } from "./ReviewCardView";
import type { ReviewEdit } from "./ReviewEditor";

type Props = {
  deckId: string;
  areas: ReviewArea[];
  cards: ReviewCard[];
  /** Visningsnamn för dem som granskat eller flaggat kort i kursen (deck_reviewer_names). */
  reviewerNames: Record<string, string>;
  /** Den inloggade granskaren. */
  userId: string;
  /** Serverns klocka vid renderingen, så att server och klient skriver samma datum. */
  now: number;
};

type View = { tab: ReviewTab; cardId: string | null; filter: ReviewFilter };

const TAB_LABEL: Record<ReviewTab, string> = {
  "att-granska": sv.granskning.tabToReview,
  granskade: sv.granskning.tabReviewed,
  flaggade: sv.granskning.tabFlagged,
};

const TAB_HELP: Record<ReviewTab, string> = {
  "att-granska": sv.granskning.tabHelpToReview,
  granskade: sv.granskning.tabHelpReviewed,
  flaggade: sv.granskning.tabHelpFlagged,
};

const ORIGIN_LABEL: Record<OriginFilter, string> = {
  alla: sv.granskning.originAll,
  original: sv.granskning.originOriginal,
  nya: sv.granskning.originNew,
};

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

/** Flik, öppet kort och filter ur adressen. */
function parseView(params: URLSearchParams, areaIds: Set<string>): View {
  const tab = params.get("flik");
  const area = params.get("omrade") ?? "alla";
  const kind = params.get("typ");
  const source = params.get("kalla");
  const origin = params.get("ursprung");
  return {
    tab: isReviewTab(tab) ? tab : "att-granska",
    cardId: params.get("kort") || null,
    filter: {
      area: area === "ingen" || areaIds.has(area) ? area : "alla",
      kind: isCardKind(kind) ? kind : "alla",
      source: isSourceFilter(source) ? source : "alla",
      origin: isOriginFilter(origin) ? origin : "alla",
      query: params.get("sok") ?? "",
    },
  };
}

function viewQuery(v: View): string {
  const q = new URLSearchParams();
  if (v.tab !== "att-granska") q.set("flik", v.tab);
  if (v.cardId) q.set("kort", v.cardId);
  if (v.filter.area !== "alla") q.set("omrade", v.filter.area);
  if (v.filter.kind !== "alla") q.set("typ", v.filter.kind);
  if (v.filter.source !== "alla") q.set("kalla", v.filter.source);
  if (v.filter.origin !== "alla") q.set("ursprung", v.filter.origin);
  if (v.filter.query.trim()) q.set("sok", v.filter.query);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Granskningen som en inkorg (Alvins beslut 30 sep). Tre flikar: Att granska, Granskade och
 * Flaggade, med antal. Under fliken en lugn lista, en rad per kort, med filter på område,
 * uppgiftstyp, källa och ursprung och en sökning. Ett klick på en rad öppnar kortet i
 * granskningsvyn (ReviewCardView), där Godkänn går direkt till nästa kort i samma lista.
 *
 * Allt som avgör vyn står i adressen, så att flikar och kort går att länka och bakåtknappen
 * fungerar: flik och kort läggs till i historiken, filter och bläddring ersätter. Besluten syns
 * direkt (optimistiskt), rullas tillbaka om servern säger nej, och det senaste går att ångra.
 */
export function ReviewInbox({ deckId, areas, cards: serverCards, reviewerNames, userId, now: serverNow }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const areaIds = useMemo(() => new Set(areas.map((a) => a.id)), [areas]);
  // Vyn hålls i ett eget tillstånd som skrivs till adressen samtidigt (navigate), så att ett
  // beslut och bytet till nästa kort renderas i samma svep. Adressen läses tillbaka när den
  // ändras utifrån: bakåtknappen, eller en länk hit från sidomenyn eller innehållsöversikten.
  const [view, setView] = useState<View>(() => parseView(new URLSearchParams(searchParams.toString()), areaIds));
  useEffect(() => {
    const sync = () => {
      const fromUrl = parseView(new URLSearchParams(window.location.search), areaIds);
      setView((v) => (viewQuery(v) === viewQuery(fromUrl) ? v : fromUrl));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [searchParams, areaIds]);

  const [cards, setCards] = useState(serverCards);
  const [now, setNow] = useState(serverNow);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState(view.filter.query);
  const inFlight = useRef(new Map<string, number>());
  // Beslut som ännu inte sparats på servern. Lämnar man sidan då kan beslutet gå förlorat,
  // så webbläsaren varnar tills allt är sparat.
  const [saving, setSaving] = useState(0);
  useEffect(() => {
    if (saving === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);
  const lastOpened = useRef<string | null>(null);
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

  // Sökrutan följer adressen (bakåtknappen), men skriver man i den gäller det man skriver.
  useEffect(() => {
    setQuery((q) => (q === view.filter.query ? q : view.filter.query));
  }, [view.filter.query]);

  // Adressen skrivs först när inga beslut sparas: ändras adressen medan ett beslut är på väg
  // avbryter Next förfrågan, och beslutet når aldrig tillbaka hit. Vyn byter kort direkt ändå.
  const pendingUrl = useRef<{ url: string; mode: "push" | "replace" } | null>(null);
  const writeUrl = useCallback((url: string, mode: "push" | "replace") => {
    if (url === `${window.location.pathname}${window.location.search}`) return;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  const navigate = useCallback(
    (next: Partial<View>, mode: "push" | "replace" = "push") => {
      const v: View = { ...view, ...next, filter: { ...view.filter, ...next.filter } };
      setView(v);
      const url = `${pathname}${viewQuery(v)}`;
      // Nästa tick: ett beslut som fattas i samma klick har då hunnit markeras som pågående.
      window.setTimeout(() => {
        const busy = [...inFlight.current.values()].some((n) => n > 0);
        if (busy) pendingUrl.current = { url, mode: pendingUrl.current?.mode === "push" ? "push" : mode };
        else writeUrl(url, mode);
      }, 0);
    },
    [pathname, view, writeUrl],
  );

  useEffect(() => {
    if (saving > 0 || !pendingUrl.current) return;
    const { url, mode } = pendingUrl.current;
    pendingUrl.current = null;
    writeUrl(url, mode);
  }, [saving, writeUrl]);

  // Sökningen skrivs till adressen när man slutat skriva en stund.
  useEffect(() => {
    if (query === view.filter.query) return;
    const t = window.setTimeout(() => navigate({ filter: { ...view.filter, query } }, "replace"), 250);
    return () => window.clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const colorIndex = useMemo(() => categoryColorIndex(areas), [areas]);
  const areaTitle = useCallback((id: string | null) => (id ? (areas.find((a) => a.id === id)?.title ?? sv.granskning.noArea) : sv.granskning.noArea), [areas]);
  const areaColor = useCallback((id: string) => colorIndex.get(id) ?? 0, [colorIndex]);

  const current = view.cardId ? (cards.find((c) => c.id === view.cardId) ?? null) : null;
  // Ett öppet kort visas under sin egen flik (t.ex. en länk till ett kort som hunnit granskas).
  const tab: ReviewTab = (current && reviewTab(current)) || view.tab;
  const filter = view.filter;
  const counts = useMemo(() => countByTab(cards), [cards]);
  const list = useMemo(() => reviewList(cards, tab, filter, areas), [cards, tab, filter, areas]);
  const listIds = useMemo(() => list.map((c) => c.id), [list]);
  const position = current ? listIds.indexOf(current.id) : -1;
  const inTab = useMemo(() => cards.filter((c) => reviewTab(c) === tab), [cards, tab]);
  const sourceCounts = useMemo(() => countBySourceTag(inTab.filter((c) => matchesReviewFilter(c, { ...filter, source: "alla" }))), [inTab, filter]);

  // Adressen pekar på ett kort som inte finns (borttaget, eller från en annan kurs): tillbaka till listan.
  useEffect(() => {
    if (view.cardId && !current) navigate({ cardId: null }, "replace");
  }, [view.cardId, current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stäng redigeringen när kortet byts.
  useEffect(() => {
    setEditing(false);
  }, [current?.id]);

  // Kortvyn börjar överst; tillbaka i listan hamnar man vid kortet man just lämnade.
  useEffect(() => {
    if (current) {
      lastOpened.current = current.id;
      window.scrollTo({ top: 0 });
      return;
    }
    const id = lastOpened.current;
    if (!id) return;
    const row = document.querySelector<HTMLElement>(`[data-review-row="${CSS.escape(id)}"]`);
    if (row) {
      row.scrollIntoView({ block: "center" });
      row.focus({ preventScroll: true });
    }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Namn och datum
  // -------------------------------------------------------------------------

  const who = useCallback(
    (id: string | null): string => {
      if (id === null) return sv.granskning.flaggedBySomeone;
      if (id === userId) return sv.granskning.you;
      return reviewerNames[id] ?? sv.granskning.flaggedBySomeone;
    },
    [reviewerNames, userId],
  );

  const dayText = useCallback(
    (iso: string, withTime = false) => {
      const rel = relativeDay(iso, now);
      if (rel) return `${(rel === "today" ? sv.granskning.today : sv.granskning.yesterday).toLocaleLowerCase("sv-SE")}${withTime ? ` kl. ${formatTime(iso)}` : ""}`;
      return formatDay(iso, now);
    },
    [now],
  );

  function reviewedLine(c: ReviewCard): string | null {
    if (!c.reviewed_at || c.review_status !== null) return null;
    const date = dayText(c.reviewed_at, true);
    if (!c.reviewed_by) return sv.granskning.reviewedOn(date);
    const name = c.reviewed_by === userId ? sv.granskning.you : reviewerNames[c.reviewed_by];
    return name ? sv.granskning.reviewedBy(date, name) : sv.granskning.reviewedOn(date);
  }

  function flaggedLine(c: ReviewCard): string | null {
    if (!c.flag_note) return null;
    const by = c.flagged_by === null ? sv.granskning.flaggedByTool : who(c.flagged_by);
    return sv.granskning.flaggedBy(by, c.flagged_at ? dayText(c.flagged_at) : "");
  }

  // -------------------------------------------------------------------------
  // Optimistiska uppdateringar
  // -------------------------------------------------------------------------

  function mark(ids: string[], delta: 1 | -1) {
    for (const id of ids) inFlight.current.set(id, (inFlight.current.get(id) ?? 0) + delta);
    setSaving((n) => Math.max(0, n + delta * ids.length));
  }

  function patchList(list: ReviewCard[], id: string, fn: (c: ReviewCard) => ReviewCard): ReviewCard[] {
    return list.map((c) => (c.id === id ? fn(c) : c));
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
      if (ok !== null) setStatus({ id: Date.now(), text: sv.granskning.undone });
    });
  }

  const label = (c: ReviewCard) => firstLine(c.front, { maxLength: 60 });

  function approve(card: ReviewCard) {
    if (approvalIssues(card).length > 0) return;
    const snaps = [snapshot(card)];
    const at = Date.now();
    const reviewedAt = new Date(at).toISOString();
    commit(
      patchList(cards, card.id, (c) => ({ ...c, review_status: null, is_active: true, reviewed_by: userId, reviewed_at: reviewedAt, flag_note: null, flagged_at: null, flagged_by: null })),
      card,
      at,
    );
    setStatus({ id: at, text: sv.granskning.approved(label(card)), undo: () => undoDecision(snaps) });
    void run([card.id], () => approveCardsAction(deckId, [card.id]), () => restoreLocal(snaps)).then((data) => {
      if (!data || data.skipped.length === 0) return;
      restoreLocal(snaps);
      setStatus({ id: Date.now(), text: sv.admin.reviewSkipped(data.skipped.length), tone: "danger" });
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
    setStatus({ id: at, text: changing ? sv.granskning.flagUpdated : sv.granskning.flagged(label(card)), undo: () => undoDecision(snaps) });
    void run([card.id], () => flagCardAction(deckId, card.id, text), () => restoreLocal(snaps));
  }

  function resolve(card: ReviewCard) {
    const snaps = [snapshot(card)];
    const at = Date.now();
    commit(
      patchList(cards, card.id, (c) => ({ ...c, flag_note: null, flagged_at: null, flagged_by: null })),
      card,
      at,
    );
    setStatus({ id: at, text: sv.granskning.resolved(label(card)), undo: () => undoDecision(snaps) });
    void run([card.id], () => resolveFlagAction(deckId, card.id), () => restoreLocal(snaps));
  }

  function reject(card: ReviewCard, note: string) {
    const snaps = [snapshot(card)];
    const at = Date.now();
    const reviewedAt = new Date(at).toISOString();
    const text = note.trim();
    const versionId = card.review_status === "utkast" ? card.published_version_id : null;
    if (typeof versionId === "number") {
      // En rättelse av ett publicerat kort: tillbaka till den publicerade versionen, som
      // servern skickar tillbaka (innehållet finns inte här).
      const before = card;
      commit(
        patchList(cards, card.id, (c) => ({ ...c, review_status: null, is_active: true, review_note: text || null, reviewed_by: userId, reviewed_at: reviewedAt, flag_note: null, flagged_at: null, flagged_by: null, published_version_id: null })),
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
        text: sv.granskning.correctionRejected(label(card)),
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
              if (ok !== null) setStatus({ id: Date.now(), text: sv.granskning.undone });
            });
          });
        },
      });
      return;
    }
    commit(
      patchList(cards, card.id, (c) => ({ ...c, review_status: "avvisad", review_note: text || null, is_active: false, reviewed_by: userId, reviewed_at: reviewedAt, flag_note: null, flagged_at: null, flagged_by: null })),
      card,
      at,
    );
    setStatus({ id: at, text: sv.granskning.rejected(label(card)), undo: () => undoDecision(snaps) });
    void run([card.id], () => rejectCardAction(deckId, card.id, text), () => restoreLocal(snaps));
  }

  async function saveEdit(card: ReviewCard, edit: ReviewEdit, approveAfter: boolean): Promise<string | null> {
    mark([card.id], 1);
    try {
      const result = await saveReviewCardAction(deckId, { id: card.id, ...edit }, approveAfter).catch(() => null);
      if (!result) return sv.errors.generic;
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
          patchList(latestCards.current, card.id, (c) => ({ ...c, ...content, review_status: null, is_active: true, reviewed_by: userId, reviewed_at: reviewedAt, flag_note: null, flagged_at: null, flagged_by: null })),
          card,
          at,
        );
        setStatus({ id: at, text: sv.granskning.savedApproved(firstLine(content.front, { maxLength: 60 })) });
      } else {
        setCards((prev) => patchList(prev, card.id, (c) => ({ ...c, ...content })));
        setEditing(false);
        setStatus({ id: at, text: sv.granskning.saved });
      }
      return null;
    } finally {
      mark([card.id], -1);
    }
  }

  // -------------------------------------------------------------------------
  // Navigering
  // -------------------------------------------------------------------------

  function openCard(id: string) {
    setStatus(null);
    navigate({ tab, cardId: id }, "push");
  }

  function backToList() {
    setEditing(false);
    navigate({ tab, cardId: null }, "push");
  }

  function onRowClick(e: MouseEvent<HTMLAnchorElement>, id: string) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openCard(id);
  }

  const setFilter = (next: Partial<ReviewFilter>) => navigate({ filter: { ...filter, ...next } }, "replace");
  const clearFilters = () => {
    setQuery("");
    navigate({ filter: DEFAULT_REVIEW_FILTER }, "replace");
  };

  // Listan: J/K och pilarna flyttar mellan raderna, Enter öppnar (länkarnas eget beteende).
  useEffect(() => {
    if (current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [role="combobox"], [role="listbox"], [role="menu"], dialog') || document.querySelector("dialog[open]")) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const rows = [...document.querySelectorAll<HTMLElement>("[data-review-row]")];
      const i = rows.findIndex((r) => r === document.activeElement);
      // Pilarna rullar sidan som vanligt tills en rad har fokus.
      const down = key === "j" || (key === "ArrowDown" && i !== -1);
      const up = key === "k" || (key === "ArrowUp" && i !== -1);
      if ((!down && !up) || rows.length === 0) return;
      if (i === -1 && up) return;
      e.preventDefault();
      const to = i === -1 ? 0 : Math.max(0, Math.min(rows.length - 1, i + (down ? 1 : -1)));
      rows[to]?.focus();
      rows[to]?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  // -------------------------------------------------------------------------
  // Vy
  // -------------------------------------------------------------------------

  const activeFilters = activeFilterCount(filter);
  const filtered = activeFilters > 0 || filter.query.trim() !== "";

  const tabs = (
    <nav aria-label={sv.granskning.tabsLabel} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-testid="review-tabs">
      <ul className="inline-flex min-w-max gap-0.5 rounded-full bg-surface-2 p-1 text-sm">
        {(["att-granska", "granskade", "flaggade"] as const).map((t) => {
          const active = t === tab;
          const href = `${pathname}${viewQuery({ tab: t, cardId: null, filter })}`;
          return (
            <li key={t}>
              <a
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  setEditing(false);
                  setStatus(null);
                  navigate({ tab: t, cardId: null }, "push");
                }}
                className={cx(
                  "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-semibold transition-colors duration-200 sm:gap-2 sm:px-4",
                  active ? "bg-inverse text-inverse-fg" : "text-muted hover:bg-surface-3 hover:text-fg",
                )}
                data-testid={`review-tab-${t}`}
              >
                {t === "flaggade" ? <FlagTriangleRight size={15} aria-hidden className="max-sm:hidden" /> : null}
                {TAB_LABEL[t]}
                <span className={cx("tabular-nums", active ? "opacity-75" : "text-subtle")} data-testid={`review-count-${t}`}>
                  {counts[t]}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  if (current) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5" data-testid="review-inbox" data-saving={saving}>
        {tabs}
        <ReviewCardView
          card={current}
          tab={tab}
          position={position}
          total={list.length}
          areas={areas}
          areaTitle={areaTitle}
          areaColor={areaColor}
          reviewedLine={reviewedLine(current)}
          flaggedLine={flaggedLine(current)}
          issues={approvalIssues(current)}
          editing={editing}
          status={status}
          onCloseStatus={() => setStatus(null)}
          onBack={backToList}
          onStep={(delta) => {
            const id = step(listIds, current.id, delta);
            if (id && id !== current.id) {
              setStatus(null);
              navigate({ cardId: id }, "replace");
            }
          }}
          onApprove={() => approve(current)}
          onResolve={() => resolve(current)}
          onEdit={setEditing}
          onSave={(edit, approveAfter) => saveEdit(current, edit, approveAfter)}
          onFlag={(note) => flag(current, note)}
          onReject={(note) => reject(current, note)}
        />
      </div>
    );
  }

  const groups = groupReviewList(list, tab, areas);
  const total = counts[tab];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5" data-testid="review-inbox" data-saving={saving}>
      {tabs}
      <p className="-mt-1 text-sm text-muted">{TAB_HELP[tab]}</p>

      {total > 0 ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5" data-testid="review-filters">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-60">
              <span className="sr-only">{sv.granskning.search}</span>
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && query) {
                    e.preventDefault();
                    setQuery("");
                  }
                }}
                placeholder={sv.granskning.searchPlaceholder}
                className={cx(inputClass, "h-10 pl-10 text-sm [&::-webkit-search-cancel-button]:hidden")}
                data-testid="review-search"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={sv.granskning.clearSearch}
                  className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-fg"
                >
                  <X size={14} aria-hidden />
                </button>
              ) : null}
            </label>
            <Button variant="secondary" size="sm" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} aria-controls="granska-filter" className="min-h-10 md:hidden">
              <ListFilter size={15} aria-hidden />
              {activeFilters > 0 ? sv.granskning.filtersActive(activeFilters) : sv.granskning.filters}
            </Button>
          </div>
          <div id="granska-filter" className={cx("grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center", filtersOpen ? "" : "max-md:hidden")}>
            <Select
              size="sm"
              label={sv.granskning.areaFilter}
              value={filter.area}
              onChange={(area) => setFilter({ area })}
              options={[{ value: "alla", label: sv.granskning.allAreas }, ...areas.map((a) => ({ value: a.id, label: a.title })), { value: "ingen", label: sv.granskning.noArea }]}
              className="col-span-2 md:w-64"
              data-testid="review-area-filter"
            />
            <Select<ReviewFilter["kind"]>
              size="sm"
              label={sv.granskning.kindFilter}
              value={filter.kind}
              onChange={(kind) => setFilter({ kind })}
              options={[{ value: "alla", label: sv.granskning.allKinds }, ...CARD_KINDS.map((k) => ({ value: k, label: CARD_KIND_LABEL[k] }))]}
              className="md:w-48"
              data-testid="review-kind-filter"
            />
            <Select<SourceFilter>
              size="sm"
              label={sv.granskning.sourceFilter}
              value={filter.source}
              onChange={(source) => setFilter({ source })}
              options={[
                { value: "alla", label: sv.granskning.allSources },
                ...SOURCE_TAGS.filter((t) => sourceCounts[t] > 0 || filter.source === t).map((t) => ({ value: t, label: `${SOURCE_TAG_LABEL[t]} (${sourceCounts[t]})` })),
              ]}
              className="md:w-48"
              data-testid="review-source-filter"
            />
            <Select<OriginFilter>
              size="sm"
              label={sv.granskning.originFilter}
              value={filter.origin}
              onChange={(origin) => setFilter({ origin })}
              options={ORIGIN_FILTERS.map((o) => ({ value: o, label: ORIGIN_LABEL[o] }))}
              className="col-span-2 md:w-60"
              data-testid="review-origin-filter"
            />
            {activeFilters > 0 || filter.query ? (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="col-span-2 justify-self-start" data-testid="review-clear-filters">
                <X size={15} aria-hidden />
                {sv.granskning.clearFilters}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {total === 0 ? (
        <EmptyState tab={tab} />
      ) : list.length === 0 ? (
        <div className="grid justify-items-start gap-3 rounded-lg border border-line bg-surface p-6 dark:border-transparent" data-testid="review-no-match">
          <p className="font-semibold">{sv.granskning.noMatch}</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            {sv.granskning.showAll}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold tabular-nums" data-testid="review-list-count">
              {filtered ? sv.granskning.countOf(list.length, total) : sv.granskning.count(list.length)}
            </p>
            {tab !== "granskade" ? (
              <Button size="sm" onClick={() => openCard(list[0]!.id)} data-testid="review-start">
                {tab === "att-granska" ? sv.granskning.startReview : sv.granskning.startFlagged}
                <ArrowRight size={15} aria-hidden />
              </Button>
            ) : null}
          </div>
          <div className="overflow-clip rounded-lg border border-line bg-surface dark:border-transparent" data-testid="review-list">
            <p className="sr-only">{sv.granskning.list}</p>
            {groups.map((g) => (
              <section key={g.key} aria-label={g.type === "area" ? (g.title ?? sv.granskning.noArea) : g.type === "day" ? dayHeading(g.day, now) : sv.granskning.originalGroup}>
                <h3 className="sticky top-14 z-10 flex items-center gap-2 border-b border-line bg-surface-2/95 px-4 py-2 text-sm font-semibold backdrop-blur lg:top-0 dark:bg-surface-2/95">
                  {g.type === "area" ? (
                    <>
                      <span aria-hidden className={cx("h-2.5 w-2.5 shrink-0 rounded-full", g.areaId ? tagBgClass(areaColor(g.areaId)) : "bg-line-strong")} />
                      <span className="min-w-0 truncate">{g.title ?? sv.granskning.noArea}</span>
                    </>
                  ) : g.type === "day" ? (
                    <span>{dayHeading(g.day, now)}</span>
                  ) : (
                    <span title={sv.granskning.originalGroupHelp}>{sv.granskning.originalGroup}</span>
                  )}
                  <span className="font-medium text-muted tabular-nums">{g.cards.length}</span>
                </h3>
                <ul className="divide-y divide-line">
                  {g.cards.map((c) => (
                    <li key={c.id}>
                      <ReviewRow
                        card={c}
                        tab={tab}
                        href={`${pathname}${viewQuery({ tab, cardId: c.id, filter })}`}
                        onClick={(e) => onRowClick(e, c.id)}
                        showArea={g.type !== "area"}
                        areaTitle={areaTitle}
                        areaColor={areaColor}
                        rightLabel={rowLabel(c, tab)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <Toast message={status?.text ?? null} id={status?.id} tone={status?.tone} action={status?.undo ? { label: sv.granskning.undo, onClick: status.undo } : undefined} onClose={() => setStatus(null)} />
    </div>
  );

  function rowLabel(c: ReviewCard, t: ReviewTab): string {
    if (t === "att-granska") return c.original ? sv.granskning.labelCorrected : sv.granskning.labelNew;
    if (t === "granskade") return c.reviewed_at ? formatTime(c.reviewed_at) : sv.granskning.labelOriginal;
    return c.flagged_at ? capitalize(dayText(c.flagged_at)) : "";
  }

  function dayHeading(day: string, at: number): string {
    const iso = `${day}T12:00:00+02:00`;
    const rel = relativeDay(iso, at);
    return rel === "today" ? sv.granskning.today : rel === "yesterday" ? sv.granskning.yesterday : capitalize(formatDay(iso, at));
  }
}

function capitalize(text: string): string {
  return text ? text[0]!.toLocaleUpperCase("sv-SE") + text.slice(1) : text;
}

/** En rad i inkorgen: frågans första rad och, under den, område, uppgiftstyp och källa. */
function ReviewRow({
  card,
  tab,
  href,
  onClick,
  showArea,
  areaTitle,
  areaColor,
  rightLabel,
}: {
  card: ReviewCard;
  tab: ReviewTab;
  href: string;
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void;
  showArea: boolean;
  areaTitle: (id: string | null) => string;
  areaColor: (id: string) => number;
  rightLabel: string;
}) {
  const KindIcon = KIND_ICON[card.kind as CardKind];
  const tags = sourceTags(card);
  return (
    <a
      href={href}
      onClick={onClick}
      data-review-row={card.id}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2"
      // Fokusramen (globalt, :focus-visible) inuti raden, så att listans kant inte klipper den.
      style={{ outlineOffset: "-2px" }}
    >
      <span className="min-w-0">
        <span className="line-clamp-2 break-words font-medium sm:line-clamp-1">{firstLine(card.front, { maxLength: 200 }) || "…"}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {showArea ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span aria-hidden className={cx("h-2 w-2 shrink-0 rounded-full", card.category_id ? tagBgClass(areaColor(card.category_id)) : "bg-line-strong")} />
              <span className="truncate">{areaTitle(card.category_id)}</span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <KindIcon size={12} aria-hidden />
            {CARD_KIND_LABEL[card.kind]}
          </span>
          <span className="inline-flex items-center gap-1">{tags.map((t) => SOURCE_TAG_LABEL[t]).join(", ")}</span>
        </span>
        {tab === "flaggade" && card.flag_note ? (
          <span className="mt-1.5 flex items-start gap-1.5 text-sm">
            <FlagTriangleRight size={14} aria-hidden className="mt-0.5 shrink-0 text-chart-3" />
            <span className="line-clamp-2 break-words">{card.flag_note}</span>
          </span>
        ) : null}
      </span>
      <span className="whitespace-nowrap pt-0.5 text-xs text-muted tabular-nums">{rightLabel}</span>
    </a>
  );
}

function EmptyState({ tab }: { tab: ReviewTab }) {
  const [title, help] =
    tab === "att-granska"
      ? [sv.granskning.emptyToReview, sv.granskning.emptyToReviewHelp]
      : tab === "granskade"
        ? [sv.granskning.emptyReviewed, sv.granskning.emptyReviewedHelp]
        : [sv.granskning.emptyFlagged, sv.granskning.emptyFlaggedHelp];
  const Icon = tab === "att-granska" ? CheckCheck : tab === "flaggade" ? FlagTriangleRight : Inbox;
  return (
    <div className="anim-fade-up grid justify-items-start gap-2 rounded-lg border border-line bg-surface p-6 sm:p-8 dark:border-transparent" data-testid="review-empty">
      <Icon size={26} aria-hidden className="text-muted" />
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-prose text-sm text-muted">{help}</p>
    </div>
  );
}
