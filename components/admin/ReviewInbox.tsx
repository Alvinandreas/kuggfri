"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, ChevronDown, FlagTriangleRight, ListFilter, Search, X } from "lucide-react";
import { categoryColorIndex, tagBgClass } from "@/lib/ui/tag-colors";
import {
  DEFAULT_REVIEW_FILTER,
  ORIGIN_FILTERS,
  activeFilterCount,
  approvalIssues,
  countByTab,
  formatDay,
  formatTime,
  groupKey,
  groupReviewList,
  matchesReviewFilter,
  relativeDay,
  reviewList,
  inTab,
  reviewProgress,
  reviewTab,
  step,
  type OriginFilter,
  type ReviewArea,
  type ReviewCard,
  type ReviewFilter,
  type ReviewTab,
} from "@/lib/admin/review";
import { SOURCE_TAGS, countBySourceTag, type SourceFilter } from "@/lib/admin/sources";
import { CARD_KINDS } from "@/lib/cards/kinds";
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
import { useReviewT } from "./review/ReviewLanguage";
import { useT } from "@/lib/i18n/client";
import { ReviewBar, ReviewOverview, reviewedOf } from "./review/ReviewOverview";

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

const TABS = ["att-granska", "granskade", "flaggade", "ur-rotation"] as const satisfies readonly ReviewTab[];

/**
 * Granskningen som en inkorg (Alvins beslut 30 sep och 1 okt). Fyra flikar: Att granska,
 * Granskade, Flaggade och Ur rotation, med antal. Reglaget English visar korten och granskningen
 * på engelska för examinatorer som inte läser svenska. Under fliken en lugn lista, en rad per kort, med filter på område,
 * uppgiftstyp, källa och ursprung och en sökning. Ett klick på en rad öppnar kortet i
 * granskningsvyn (ReviewCardView), där Godkänn går direkt till nästa kort i samma lista.
 *
 * Allt som avgör vyn står i adressen, så att flikar och kort går att länka och bakåtknappen
 * fungerar: flik och kort läggs till i historiken, filter och bläddring ersätter. Besluten syns
 * direkt (optimistiskt), rullas tillbaka om servern säger nej, och det senaste går att ångra.
 */
export function ReviewInbox({ deckId, areas, cards: serverCards, reviewerNames, userId, now: serverNow }: Props) {
  const t = useReviewT();
  const dict = useT();
  const g = t.g;
  const TAB_LABEL: Record<ReviewTab, string> = { "att-granska": g.tabToReview, granskade: g.tabReviewed, flaggade: g.tabFlagged, "ur-rotation": g.tabRemoved };
  const TAB_HELP: Record<ReviewTab, string> = { "att-granska": g.tabHelpToReview, granskade: g.tabHelpReviewed, flaggade: g.tabHelpFlagged, "ur-rotation": g.tabHelpRemoved };
  const ORIGIN_LABEL: Record<OriginFilter, string> = { alla: g.originAll, original: g.originOriginal, nya: g.originNew };
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Områdena i listan är ihopfällda från början, så att alla områden syns på en gång.
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const decisions = useOptimisticDecisions(serverCards, serverNow, setStatus);
  const { cards, now, saving } = decisions;
  const { pathname, view, navigate, query, setQuery } = useReviewView({ areas, inFlight: decisions.inFlight, saving });
  const lastOpened = useRef<string | null>(null);

  const colorIndex = useMemo(() => categoryColorIndex(areas), [areas]);
  const nameOf = useCallback((a: ReviewArea) => (t.lang === "en" && a.title_en ? a.title_en : a.title), [t.lang]);
  const areaTitle = useCallback(
    (id: string | null) => {
      const area = id ? areas.find((a) => a.id === id) : undefined;
      return area ? nameOf(area) : g.noArea;
    },
    [areas, nameOf, g.noArea],
  );
  const areaColor = useCallback((id: string) => colorIndex.get(id) ?? 0, [colorIndex]);

  const current = view.cardId ? (cards.find((c) => c.id === view.cardId) ?? null) : null;
  // Ett öppet kort visas under sin egen flik (t.ex. en länk till ett kort som hunnit granskas).
  const tab: ReviewTab = current && !inTab(current, view.tab) ? (reviewTab(current) ?? view.tab) : view.tab;
  const filter = view.filter;
  const counts = useMemo(() => countByTab(cards), [cards]);
  const list = useMemo(() => reviewList(cards, tab, filter, areas), [cards, tab, filter, areas]);
  const listIds = useMemo(() => list.map((c) => c.id), [list]);
  const position = current ? listIds.indexOf(current.id) : -1;
  const tabCards = useMemo(() => cards.filter((c) => inTab(c, tab)), [cards, tab]);
  const sourceCounts = useMemo(() => countBySourceTag(tabCards.filter((c) => matchesReviewFilter(c, { ...filter, source: "alla" }))), [tabCards, filter]);

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
      if (id === null) return g.flaggedBySomeone;
      if (id === userId) return g.you;
      return reviewerNames[id] ?? g.flaggedBySomeone;
    },
    [reviewerNames, userId, g],
  );

  const dayText = useCallback(
    (iso: string, withTime = false) => {
      const rel = relativeDay(iso, now);
      if (rel) return `${(rel === "today" ? g.today : g.yesterday).toLocaleLowerCase("sv-SE")}${withTime ? (t.lang === "en" ? ` at ${formatTime(iso)}` : ` kl. ${formatTime(iso)}`) : ""}`;
      return formatDay(iso, now);
    },
    [now, g, t.lang],
  );

  function reviewedLine(c: ReviewCard): string | null {
    if (!c.reviewed_at || c.review_status !== null) return null;
    const date = dayText(c.reviewed_at, true);
    if (!c.reviewed_by) return g.reviewedOn(date);
    const name = c.reviewed_by === userId ? g.you : reviewerNames[c.reviewed_by];
    return name ? g.reviewedBy(date, name) : g.reviewedOn(date);
  }

  function flaggedLine(c: ReviewCard): string | null {
    if (!c.flag_note) return null;
    const by = c.flagged_by === null ? g.flaggedByTool : who(c.flagged_by);
    return g.flaggedBy(by, c.flagged_at ? dayText(c.flagged_at) : "");
  }

  // -------------------------------------------------------------------------
  // Beslut (optimistiska, se useOptimisticDecisions och useReviewDecisions)
  // -------------------------------------------------------------------------

  const { approve, flag, resolve, reject, unreview, saveEdit } = useReviewDecisions({ deckId, userId, areas, tab, filter, listIds, navigate, setStatus, setEditing, decisions, t });

  // -------------------------------------------------------------------------
  // Navigering
  // -------------------------------------------------------------------------

  function openCard(id: string) {
    setStatus(null);
    // Området står utfällt när man kommer tillbaka till listan.
    const card = cards.find((c) => c.id === id);
    if (card) setOpenGroups((prev) => new Set(prev).add(groupKey(card, areas)));
    navigate({ tab, cardId: id }, "push");
  }

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
    <nav aria-label={g.tabsLabel} className="-mx-4 min-w-0 max-w-full overflow-x-auto px-4 sm:mx-0 sm:px-0" data-testid="review-tabs">
      <ul className="inline-flex min-w-max gap-0.5 rounded-full bg-surface-2 p-1 text-sm">
        {TABS.map((tabKey) => {
          const active = tabKey === tab;
          const href = `${pathname}${viewQuery({ tab: tabKey, cardId: null, filter })}`;
          return (
            <li key={tabKey}>
              <a
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  setEditing(false);
                  setStatus(null);
                  navigate({ tab: tabKey, cardId: null }, "push");
                }}
                className={cx(
                  "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-semibold transition-colors duration-200 sm:gap-2 sm:px-4",
                  active ? "bg-inverse text-inverse-fg" : "text-muted hover:bg-surface-3 hover:text-fg",
                )}
                data-testid={`review-tab-${tabKey}`}
              >
                {tabKey === "flaggade" ? <FlagTriangleRight size={15} aria-hidden className="max-sm:hidden" /> : null}
                {TAB_LABEL[tabKey]}
                <span className={cx("tabular-nums", active ? "opacity-75" : "text-subtle")} data-testid={`review-count-${tabKey}`}>
                  {counts[tabKey]}
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
          issues={approvalIssues(current, dict)}
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
          onReject={(mode) => reject(current, mode)}
          onUnreview={() => unreview(current)}
        />
      </div>
    );
  }

  const groups = groupReviewList(list, areas);
  const total = counts[tab];
  const progress = reviewProgress(cards, areas);
  const progressOf = new Map(progress.rows.map((r) => [r.areaId, r] as const));
  // Med en sökning eller ett valt område står allt utfällt; annars det man fällt ut.
  const expandAll = filter.query.trim() !== "" || filter.area !== "alla";
  const isOpen = (key: string) => expandAll || openGroups.has(key);
  const allOpen = groups.every((grp) => isOpen(grp.key));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5" data-testid="review-inbox" data-saving={saving}>
      <ReviewOverview progress={progress} />
      {tabs}
      <p className="-mt-1 text-sm text-muted">{TAB_HELP[tab]}</p>

      {total > 0 ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5" data-testid="review-filters">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-60">
              <span className="sr-only">{g.search}</span>
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
                placeholder={g.searchPlaceholder}
                className={cx(inputClass, "h-10 pl-10 text-sm [&::-webkit-search-cancel-button]:hidden")}
                data-testid="review-search"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={g.clearSearch}
                  className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-fg"
                >
                  <X size={14} aria-hidden />
                </button>
              ) : null}
            </label>
            <Button variant="secondary" size="sm" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} aria-controls="granska-filter" className="min-h-10 md:hidden">
              <ListFilter size={15} aria-hidden />
              {activeFilters > 0 ? g.filtersActive(activeFilters) : g.filters}
            </Button>
          </div>
          <div id="granska-filter" className={cx("grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center", filtersOpen ? "" : "max-md:hidden")}>
            <Select
              size="sm"
              label={g.areaFilter}
              value={filter.area}
              onChange={(area) => setFilter({ area })}
              options={[{ value: "alla", label: g.allAreas }, ...areas.map((a) => ({ value: a.id, label: nameOf(a) })), { value: "ingen", label: g.noArea }]}
              className="col-span-2 md:w-64"
              data-testid="review-area-filter"
            />
            <Select<ReviewFilter["kind"]>
              size="sm"
              label={g.kindFilter}
              value={filter.kind}
              onChange={(kind) => setFilter({ kind })}
              options={[{ value: "alla", label: g.allKinds }, ...CARD_KINDS.map((k) => ({ value: k, label: t.kind[k] }))]}
              className="md:w-48"
              data-testid="review-kind-filter"
            />
            <Select<SourceFilter>
              size="sm"
              label={g.sourceFilter}
              value={filter.source}
              onChange={(source) => setFilter({ source })}
              options={[
                { value: "alla", label: g.allSources },
                ...SOURCE_TAGS.filter((s) => sourceCounts[s] > 0 || filter.source === s).map((s) => ({ value: s, label: `${t.source[s]} (${sourceCounts[s]})` })),
              ]}
              className="md:w-48"
              data-testid="review-source-filter"
            />
            <Select<OriginFilter>
              size="sm"
              label={g.originFilter}
              value={filter.origin}
              onChange={(origin) => setFilter({ origin })}
              options={ORIGIN_FILTERS.map((o) => ({ value: o, label: ORIGIN_LABEL[o] }))}
              className="col-span-2 md:w-60"
              data-testid="review-origin-filter"
            />
            {activeFilters > 0 || filter.query ? (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="col-span-2 justify-self-start" data-testid="review-clear-filters">
                <X size={15} aria-hidden />
                {g.clearFilters}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {total === 0 ? (
        <EmptyState tab={tab} />
      ) : list.length === 0 ? (
        <div className="grid justify-items-start gap-3 rounded-lg border border-line bg-surface p-6 dark:border-transparent" data-testid="review-no-match">
          <p className="font-semibold">{g.noMatch}</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            {g.showAll}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="text-sm font-semibold tabular-nums" data-testid="review-list-count">
                {filtered ? g.countOf(list.length, total) : g.count(list.length)}
              </p>
              {expandAll ? null : (
                <button
                  type="button"
                  onClick={() => setOpenGroups(allOpen ? new Set() : new Set(groups.map((grp) => grp.key)))}
                  className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
                  data-testid="review-toggle-all"
                >
                  {allOpen ? g.collapseAll : g.expandAll}
                </button>
              )}
            </div>
            {tab === "att-granska" || tab === "flaggade" ? (
              <Button size="sm" onClick={() => openCard(list[0]!.id)} data-testid="review-start">
                {tab === "att-granska" ? g.startReview : g.startFlagged}
                <ArrowRight size={15} aria-hidden />
              </Button>
            ) : null}
          </div>
          <div className="overflow-clip rounded-lg border border-line bg-surface dark:border-transparent" data-testid="review-list">
            <p className="sr-only">{g.list}</p>
            {groups.map((grp) => {
              const open = isOpen(grp.key);
              const row = grp.areaId ? progressOf.get(grp.areaId) : undefined;
              const reviewed = row ? reviewedOf(row) : null;
              const title = grp.areaId ? areaTitle(grp.areaId) : g.noArea;
              return (
                <section key={grp.key} aria-label={title} className="border-b border-line last:border-b-0" data-testid="review-group">
                  <h3>
                    <button
                      type="button"
                      onClick={() => toggleGroup(grp.key)}
                      aria-expanded={open}
                      aria-controls={`omrade-${grp.key}`}
                      disabled={expandAll}
                      className={cx(
                        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition-colors duration-150 enabled:hover:bg-surface-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(8rem,14rem)_auto]",
                        open && "bg-surface-2/60",
                      )}
                      data-testid="review-group-toggle"
                    >
                      <ChevronDown size={17} aria-hidden className={cx("shrink-0 text-muted transition-transform duration-200", open ? "" : "-rotate-90")} />
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden className={cx("h-2.5 w-2.5 shrink-0 rounded-full", grp.areaId ? tagBgClass(areaColor(grp.areaId)) : "bg-line-strong")} />
                        <span className="min-w-0 truncate font-semibold">{title}</span>
                        <span className="shrink-0 text-sm font-medium text-muted tabular-nums">{grp.cards.length}</span>
                      </span>
                      {row && reviewed ? <ReviewBar counts={row} size="sm" className="max-sm:col-span-3 max-sm:col-start-2 max-sm:row-start-2" /> : <span className="max-sm:hidden" />}
                      <span className="text-right text-sm text-muted tabular-nums">{reviewed ? g.overviewOf(reviewed.done, reviewed.all) : null}</span>
                    </button>
                  </h3>
                  {open ? (
                    <ul id={`omrade-${grp.key}`} className="divide-y divide-line border-t border-line">
                      {grp.cards.map((c) => (
                        <li key={c.id}>
                          <ReviewRow
                            card={c}
                            tab={tab}
                            href={`${pathname}${viewQuery({ tab, cardId: c.id, filter })}`}
                            onClick={(e) => onRowClick(e, c.id)}
                            showArea={false}
                            areaTitle={areaTitle}
                            areaColor={areaColor}
                            rightLabel={rowLabel(c, tab)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        </>
      )}

      <Toast message={status?.text ?? null} id={status?.id} tone={status?.tone} action={status?.undo ? { label: g.undo, onClick: status.undo } : undefined} onClose={() => setStatus(null)} />
    </div>
  );

  function rowLabel(c: ReviewCard, tabKey: ReviewTab): string {
    if (tabKey === "att-granska") return typeof c.published_version_id === "number" ? g.labelCorrected : c.original ? g.labelOriginal : g.labelNew;
    if (tabKey === "granskade") return c.reviewed_at ? capitalize(dayText(c.reviewed_at, true)) : g.labelOriginal;
    if (tabKey === "ur-rotation") return c.reviewed_at ? capitalize(dayText(c.reviewed_at)) : "";
    return c.flagged_at ? capitalize(dayText(c.flagged_at)) : "";
  }

}

function capitalize(text: string): string {
  return text ? text[0]!.toLocaleUpperCase("sv-SE") + text.slice(1) : text;
}
