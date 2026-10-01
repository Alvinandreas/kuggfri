"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, CheckCheck, ChevronLeft, ChevronRight, Ellipsis, FlagTriangleRight, History, Info, Languages, MessageSquareWarning, Pencil, RotateCcw, Undo2, X } from "lucide-react";
import { cardSources } from "@/lib/admin/sources";
import { englishFace, translationState } from "@/lib/cards/translation";
import { shouldIgnoreShortcut } from "@/lib/ui/keyboard";
import { reviewTab, type ReviewArea, type ReviewCard, type ReviewTab } from "@/lib/admin/review";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Disclosure } from "@/components/ui/Disclosure";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { TextArea } from "@/components/ui/TextArea";
import { cx } from "@/components/ui/cx";
import { KindBadge } from "./KindBadge";
import { ReviewCardFace } from "./ReviewCardFace";
import { ReviewEditor, type ReviewEdit } from "./ReviewEditor";
import { SourceBadges, SourceList } from "./SourceBadges";
import { useReviewT } from "./review/ReviewLanguage";

/** Senaste beslutet eller felet, med Ångra när det går. */
export type ReviewStatus = { id: number; text: string; undo?: () => void; tone?: "default" | "danger" };

type Panel = { type: "flag"; note: string; edit: boolean } | null;

type Props = {
  card: ReviewCard;
  tab: ReviewTab;
  /** Platsen i listan (0-baserad), -1 om kortet inte finns i den filtrerade listan. */
  position: number;
  total: number;
  areas: ReviewArea[];
  areaTitle: (id: string | null) => string;
  areaColor: (id: string) => number;
  /** "Granskad 30 sep av Johan Ahlström", "Flaggat av Kuggfris källgranskning i dag" och liknande. */
  reviewedLine: string | null;
  flaggedLine: string | null;
  issues: string[];
  editing: boolean;
  status: ReviewStatus | null;
  onCloseStatus: () => void;
  onBack: () => void;
  onStep: (delta: -1 | 1) => void;
  onApprove: () => void;
  onResolve: () => void;
  onEdit: (open: boolean) => void;
  onSave: (edit: ReviewEdit, approve: boolean) => Promise<string | null>;
  onFlag: (note: string) => void;
  /** Ta ur rotation, eller (restore) återställ originalet för ett rättat originalkort. */
  onReject: (mode: "remove" | "restore") => void;
  /** Markera som ogranskad: från Granskade eller Ur rotation tillbaka till Att granska. */
  onUnreview: () => void;
};

/** Tangenter räknas inte medan man skriver eller står i en lista, meny eller dialog. */
const TYPING_SELECTOR = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="menu"], dialog';

/**
 * Ett kort i taget i granskningen. Överst tillbaka till listan och var i kön man är, sedan en
 * kort instruktion (Att granska) eller flaggans anteckning (Flaggade), kortets område, typ och
 * källor, och kortet som studenten ser det, tydligt uppdelat i Fråga och Svar. Åtgärderna står
 * i en fast rad i nederkant. Varje övergång mellan flikarna är en knapp, och beslutet går direkt
 * vidare till nästa kort (Ångra tar tillbaka det): Godkänn (också från Ur rotation), Markera som
 * ogranskad (från Granskade och Ur rotation), Åtgärdad (flaggan), Redigera (Spara och godkänn
 * finns i alla flikar), Flagga och Ta ur rotation. Återställ originalet och Ändra anteckningen
 * ligger i menyn. Med reglaget English visas kortet på engelska. Kortkommandon: G godkänn,
 * O ogranskad, T ta ur rotation, R redigera, F flagga, J/K eller pilarna nästa och föregående,
 * Esc tillbaka till listan, Ctrl+Z ångra.
 */
export function ReviewCardView(props: Props) {
  const { card, position, total, areas, areaTitle, areaColor, reviewedLine, flaggedLine, issues, editing, status } = props;
  const t = useReviewT();
  const g = t.g;
  const [panel, setPanel] = useState<Panel>(null);
  const [showSwedish, setShowSwedish] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const flagged = card.flag_note !== null && card.flag_note !== "";
  // Knapparna följer kortets eget läge, inte fliken: ett flaggat kort under Flaggade kan vara
  // ogranskat eller granskat.
  const state = reviewTab(card);
  const removed = state === "ur-rotation";
  const reviewed = state === "granskade";
  const canApprove = !reviewed;
  const correcting = !removed && typeof card.published_version_id === "number";
  const english = t.lang === "en" && !showSwedish;
  const translation = t.lang === "en" ? translationState(card) : null;
  const face = (english ? englishFace(card) : null) ?? card;
  const sourceLabels = { tags: t.source, originalHelp: t.admin.originalHelp, sourceOriginalHelp: t.admin.sourceOriginalHelp, sourceNoneHelp: t.admin.sourceNoneHelp };
  const sources = cardSources(card);
  const sourceCount = sources.groups.length;

  // Nytt kort: stäng paneler och flytta fokus till rubriken (skärmläsare hör vilket kort det är).
  useEffect(() => {
    setPanel(null);
    setShowSwedish(false);
    headingRef.current?.focus({ preventScroll: true });
  }, [card.id]);

  // Kortkommandon (inte medan man skriver, i en panel eller i redigeraren).
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      if (status?.undo) {
        e.preventDefault();
        status.undo();
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || editing || panel) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === "j" || key === "ArrowRight") {
      e.preventDefault();
      props.onStep(1);
    } else if (key === "k" || key === "ArrowLeft") {
      e.preventDefault();
      props.onStep(-1);
    } else if (key === "Escape") {
      e.preventDefault();
      props.onBack();
    } else if (key === "g" && canApprove) {
      e.preventDefault();
      if (issues.length === 0) props.onApprove();
    } else if (key === "o" && (reviewed || removed)) {
      e.preventDefault();
      props.onUnreview();
    } else if (key === "t" && !removed) {
      e.preventDefault();
      props.onReject("remove");
    } else if (key === "r") {
      e.preventDefault();
      props.onEdit(true);
    } else if (key === "f" && !removed) {
      e.preventDefault();
      setPanel({ type: "flag", note: flagged ? (card.flag_note ?? "") : "", edit: flagged });
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e, { handled: true, repeat: true, selector: TYPING_SELECTOR, openDialog: true })) return;
      keys.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusLine = status ? <StatusLine status={status} onClose={props.onCloseStatus} /> : null;
  const hasPosition = position >= 0;

  return (
    <section aria-labelledby="granska-kort-rubrik" className="@container grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4" data-testid="review-card-view" data-card-id={card.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={props.onBack} className="-ml-3" data-testid="review-back">
          <ArrowLeft size={16} aria-hidden />
          {g.backToList}
        </Button>
        <div className="flex items-center gap-1">
          <IconButton label={g.prev} variant="outline" size="sm" onClick={() => props.onStep(-1)} disabled={!hasPosition || position <= 0} aria-keyshortcuts="K ArrowLeft" data-testid="review-prev">
            <ChevronLeft size={17} aria-hidden />
          </IconButton>
          <h2
            id="granska-kort-rubrik"
            ref={headingRef}
            tabIndex={-1}
            className="min-w-20 px-2 text-center text-sm font-semibold tabular-nums"
            // Rubriken får fokus när kortet byts (för skärmläsare), men ska inte se markerad ut.
            style={{ outline: "none" }}
            aria-label={hasPosition ? g.positionLabel(position + 1, total) : g.outsideFilter}
            data-testid="review-position"
          >
            {hasPosition ? g.position(position + 1, total) : g.outsideFilter}
          </h2>
          <IconButton
            label={g.next}
            variant="outline"
            size="sm"
            onClick={() => props.onStep(1)}
            disabled={!hasPosition || position >= total - 1}
            aria-keyshortcuts="J ArrowRight"
            data-testid="review-next"
          >
            <ChevronRight size={17} aria-hidden />
          </IconButton>
        </div>
      </div>

      {state === "att-granska" && !editing ? (
        <p className="flex gap-2.5 rounded-md bg-surface-2 px-4 py-3 text-sm" data-testid="review-instruction">
          <Info size={17} aria-hidden className="mt-0.5 shrink-0 text-muted" />
          <span>
            {g.instruction}
          </span>
        </p>
      ) : null}

      {flagged ? (
        <div className="flex gap-3 rounded-md bg-tag-2 px-4 py-3" data-testid="review-flag-note">
          <FlagTriangleRight size={18} aria-hidden className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{flaggedLine}</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words">{card.flag_note}</p>
          </div>
          {!editing ? (
            <Button variant="ghost" size="sm" className="-mr-2 -mt-1 shrink-0 hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setPanel({ type: "flag", note: card.flag_note ?? "", edit: true })} data-testid="review-flag-change">
              <Pencil size={14} aria-hidden />
              <span className="max-sm:sr-only">{g.changeFlag}</span>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {card.category_id ? <CategoryTag title={areaTitle(card.category_id)} colorIndex={areaColor(card.category_id)} /> : <Badge tone="outline">{g.noArea}</Badge>}
          <KindBadge kind={card.kind} label={t.kind[card.kind]} />
          <SourceBadges source={card.source} original={card.original} max={4} labels={sourceLabels} />
        </div>
        <p className="text-sm text-muted" data-testid="review-status-line">
          {reviewed
            ? (reviewedLine ?? g.statusOriginal)
            : removed
              ? g.statusRemoved
              : card.review_status === "utkast"
                ? g.statusDraft
                : correcting
                  ? g.statusCorrected
                  : card.original
                    ? g.statusOriginal
                    : g.statusNew}
        </p>
      </div>

      {card.review_note && card.review_status !== null && !editing ? (
        <div className="flex gap-3 rounded-md bg-surface-2 px-4 py-3 text-sm">
          <MessageSquareWarning size={17} aria-hidden className="mt-0.5 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="font-semibold">{g.statusRejectedBefore}</p>
            <p className="whitespace-pre-wrap break-words text-muted">{card.review_note}</p>
          </div>
        </div>
      ) : null}

      {issues.length > 0 && canApprove && !editing ? (
        <div role="note" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger" data-testid="review-issues">
          <p className="font-semibold">{g.cannotApprove}</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {editing ? (
        <ReviewEditor key={card.id} card={card} areas={areas} canApprove onSave={props.onSave} onCancel={() => props.onEdit(false)} />
      ) : (
        <>
          {translation ? (
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-md bg-surface-2 px-4 py-3 text-sm" data-testid="review-translation-note">
              <Languages size={17} aria-hidden className="mt-0.5 shrink-0 text-muted" />
              <p className="min-w-0 flex-1">
                {translation === "missing" ? g.translationMissing : g.translationNote}
                {translation === "stale" ? <span className="mt-1 block font-semibold text-danger">{g.translationStale}</span> : null}
              </p>
              {translation !== "missing" ? (
                <button type="button" onClick={() => setShowSwedish((v) => !v)} className="shrink-0 font-semibold text-accent underline-offset-2 hover:underline" data-testid="review-translation-switch">
                  {showSwedish ? g.showEnglish : g.showSwedish}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="anim-fade-in" key={`${card.id}-${english ? "en" : "sv"}`} lang={english && translation !== "missing" ? "en" : "sv"}>
            <ReviewCardFace front={face.front} back={face.back} hint={face.hint} kind={card.kind} options={face.options ? [...face.options] : null} />
          </div>

          <div className="rounded-lg border border-line bg-surface px-4 py-1 dark:border-transparent" data-testid="review-sources">
            <Disclosure
              summary={
                <span className="flex items-center gap-2 text-sm">
                  {g.sources}
                  <span className="font-medium text-muted tabular-nums">{sourceCount > 0 ? sourceCount : null}</span>
                </span>
              }
            >
              <SourceList source={card.source} original={card.original} className="pb-2" labels={sourceLabels} />
            </Disclosure>
          </div>

          <div className="sticky bottom-3 z-20 mt-1" data-testid="review-actions">
            <div className="grid gap-2 rounded-lg border border-line bg-surface p-2.5 shadow-pop dark:border-line-strong">
              {statusLine}
              {panel?.type === "flag" ? (
                <NotePanel
                  key="flagga"
                  label={g.flagNote}
                  help={g.flagNoteHelp}
                  value={panel.note}
                  onChange={(note) => setPanel({ ...panel, note })}
                  required
                  confirm={panel.edit ? g.flagSave : g.flagConfirm}
                  confirmIcon={<FlagTriangleRight size={16} aria-hidden />}
                  onConfirm={() => {
                    if (!panel.note.trim()) return;
                    props.onFlag(panel.note);
                    setPanel(null);
                  }}
                  onCancel={() => setPanel(null)}
                  testId="review-flag-panel"
                />
              ) : (
                <div role="group" aria-label={g.actions} className="flex flex-wrap items-center gap-2">
                  {canApprove ? (
                    <Button onClick={props.onApprove} disabled={issues.length > 0} aria-keyshortcuts="G" className="flex-1 @2xl:flex-none" data-testid="review-approve">
                      <Check size={17} aria-hidden />
                      {removed ? g.approveBack : flagged ? g.approveResolve : g.approve}
                      <KeyHint>G</KeyHint>
                    </Button>
                  ) : null}
                  {reviewed || removed ? (
                    <Button variant={reviewed ? "primary" : "secondary"} onClick={props.onUnreview} aria-keyshortcuts="O" className="flex-1 @2xl:flex-none" data-testid="review-unreview">
                      <Undo2 size={16} aria-hidden />
                      {g.markUnreviewed}
                      <KeyHint>O</KeyHint>
                    </Button>
                  ) : null}
                  {flagged && !removed ? (
                    <Button variant="outline" onClick={props.onResolve} title={g.resolveHelp} className="flex-1 @2xl:flex-none" data-testid="review-resolve">
                      <CheckCheck size={17} aria-hidden />
                      {g.resolve}
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => props.onEdit(true)} aria-keyshortcuts="R" className="flex-1 @2xl:flex-none" data-testid="review-edit">
                    <Pencil size={16} aria-hidden />
                    {g.edit}
                    <KeyHint>R</KeyHint>
                  </Button>
                  {!flagged && !removed ? (
                    <Button
                      variant="secondary"
                      onClick={() => setPanel({ type: "flag", note: "", edit: false })}
                      aria-keyshortcuts="F"
                      className="flex-1 @2xl:flex-none"
                      data-testid="review-flag"
                    >
                      <FlagTriangleRight size={16} aria-hidden />
                      {g.flag}
                      <KeyHint>F</KeyHint>
                    </Button>
                  ) : null}
                  {removed ? null : (
                    <Button variant="secondary" onClick={() => props.onReject("remove")} aria-keyshortcuts="T" className="flex-1 @2xl:flex-none" data-testid="review-reject">
                      <X size={16} aria-hidden />
                      {g.reject}
                      <KeyHint>T</KeyHint>
                    </Button>
                  )}
                  {flagged || correcting ? (
                    <Menu
                      label={g.more}
                      placement="top-end"
                      width="15rem"
                      trigger={(t) => (
                        <button
                          {...t}
                          type="button"
                          aria-label={g.more}
                          title={g.more}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
                          data-testid="review-more"
                        >
                          <Ellipsis size={18} aria-hidden />
                        </button>
                      )}
                    >
                      {flagged ? (
                        <MenuItem icon={<Pencil size={16} />} onSelect={() => setPanel({ type: "flag", note: card.flag_note ?? "", edit: true })}>
                          {g.changeFlag}
                        </MenuItem>
                      ) : null}
                      {correcting ? (
                        <MenuItem icon={<History size={16} />} onSelect={() => props.onReject("restore")}>
                          {g.restoreOriginal}
                        </MenuItem>
                      ) : null}
                    </Menu>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** Anteckning till en flagga eller en avvisning, i åtgärdsraden. Enter bekräftar, Esc avbryter. */
function NotePanel({
  label,
  help,
  value,
  onChange,
  required = false,
  confirm,
  confirmIcon,
  danger = false,
  onConfirm,
  onCancel,
  testId,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  confirm: string;
  confirmIcon: ReactNode;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId: string;
}) {
  const t = useReviewT();
  const empty = required && !value.trim();
  return (
    <div className="anim-fade-up grid gap-3 p-1.5" data-testid={testId}>
      <TextArea
        label={label}
        hint={help}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        maxLength={2000}
        autoFocus
        required={required}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!empty) onConfirm();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        data-testid={`${testId}-note`}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={empty} data-testid={`${testId}-confirm`}>
          {confirmIcon}
          {confirm}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}

/** Tangenten bredvid en knapps etikett, diskret och bara när ytan är bred nog. */
function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd aria-hidden className="ml-0.5 hidden h-5 min-w-5 items-center justify-center rounded border border-current/25 px-1 font-mono text-[10px] font-semibold opacity-70 @3xl:inline-flex">
      {children}
    </kbd>
  );
}

/** Senaste beslutet eller felet, i åtgärdsraden (skymmer inget), med Ångra när det går. */
function StatusLine({ status, onClose }: { status: ReviewStatus; onClose: () => void }) {
  const t = useReviewT();
  return (
    <div
      role={status.tone === "danger" ? "alert" : "status"}
      className={cx("anim-fade-in flex min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm", status.tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface-2 text-fg")}
      data-testid="review-toast"
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
          {t.g.undo}
          <span className="hidden text-xs font-medium text-muted sm:inline">Ctrl Z</span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label={t.common.close}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-3 hover:text-fg"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
