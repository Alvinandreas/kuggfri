"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, FlagTriangleRight, ListFilter, Search, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { categoryColorIndex, tagBgClass } from "@/lib/ui/tag-colors";
import {
  DEFAULT_REVIEW_FILTER,
  ORIGIN_FILTERS,
  activeFilterCount,
  approvalIssues,
  countByTab,
  formatDay,
  formatTime,
  groupReviewList,
  matchesReviewFilter,
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
import { SOURCE_TAGS, SOURCE_TAG_LABEL, countBySourceTag, type SourceFilter } from "@/lib/admin/sources";
import { CARD_KINDS, CARD_KIND_LABEL } from "@/lib/cards/kinds";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Toast } from "@/components/ui/Toast";
import { inputClass } from "@/components/ui/TextField";
import { cx } from "@/components/ui/cx";
import { ReviewCardView, type ReviewStatus } from "./ReviewCardView";
import { EmptyState } from "./review/EmptyState";
import { ReviewRow } from "./review/ReviewRow";
import { useListKeyboard } from "./review/useListKeyboard";
import { useOptimisticDecisions } from "./review/useOptimisticDecisions";
import { useReviewDecisions } from "./review/useReviewDecisions";
import { useReviewView, viewQuery } from "./review/useReviewView";

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
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const decisions = useOptimisticDecisions(serverCards, serverNow, setStatus);
  const { cards, now, saving } = decisions;
  const { pathname, view, navigate, query, setQuery } = useReviewView({ areas, inFlight: decisions.inFlight, saving });
  const lastOpened = useRef<string | null>(null);

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
  // Beslut (optimistiska, se useOptimisticDecisions och useReviewDecisions)
  // -------------------------------------------------------------------------

  const { approve, flag, resolve, reject, saveEdit } = useReviewDecisions({ deckId, userId, areas, tab, filter, listIds, navigate, setStatus, setEditing, decisions });

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

  useListKeyboard(current);

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
