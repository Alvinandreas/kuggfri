"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { changedFields, type ContentField, type VersionContent } from "@/lib/admin/history";
import { isAutoGraded, type CardOption } from "@/lib/cards/kinds";
import { Markdown } from "@/components/markdown/Markdown";
import { Badge } from "@/components/ui/Badge";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { cx } from "@/components/ui/cx";
import { KindBadge } from "./KindBadge";
import { VersionDiff, fieldLabel } from "./VersionDiff";

type Props = {
  /** Den publicerade versionen (det studenterna såg). */
  before: VersionContent;
  /** Det föreslagna innehållet, med samma status som before (bara innehållet jämförs). */
  after: VersionContent;
  areaTitle: (id: string | null) => string;
  colorIndex: (id: string | null) => number;
};

/** Fälten som jämförs renderade, i kortets ordning. Status och källa visas på andra ställen. */
type Row = { key: "meta" | "front" | "options" | "back" | "hint"; changed: boolean; label: string };

/**
 * Publicerad version och föreslagen ändring renderade sida vid sida (samma markdown och KaTeX
 * som korten), fält för fält så att raderna hamnar i höjd med varandra. Ändrade fält markeras;
 * oförändrade visas en gång över båda kolumnerna. Råtextens skillnad finns bakom en växel.
 */
export function CorrectionCompare({ before, after, areaTitle, colorIndex }: Props) {
  const [showText, setShowText] = useState(false);
  const changed = new Set<ContentField>(changedFields(before, after));
  const auto = isAutoGraded(before.kind) || isAutoGraded(after.kind);
  const rows: Row[] = [
    { key: "meta", changed: changed.has("kind") || changed.has("category_id"), label: `${sv.admin.category} och ${sv.admin.kind.toLowerCase()}` },
    { key: "front", changed: changed.has("front"), label: fieldLabel("front", after) },
    ...(auto ? [{ key: "options" as const, changed: changed.has("options"), label: sv.admin.alternatives }] : []),
    { key: "back", changed: changed.has("back"), label: fieldLabel("back", after) },
    ...(before.hint?.trim() || after.hint?.trim() ? [{ key: "hint" as const, changed: changed.has("hint"), label: sv.study.hint }] : []),
  ];
  const changedLabels = rows.filter((r) => r.changed).map((r) => r.label.toLowerCase());
  if (changed.has("source")) changedLabels.push(sv.admin.sourceShort.toLowerCase());

  const render = (row: Row, v: VersionContent): ReactNode => {
    switch (row.key) {
      case "meta":
        return (
          <span className="flex flex-wrap items-center gap-2">
            {v.category_id ? <CategoryTag title={areaTitle(v.category_id)} colorIndex={colorIndex(v.category_id)} /> : <span className="text-sm text-muted">{sv.admin.noCategory}</span>}
            <KindBadge kind={v.kind} />
          </span>
        );
      case "front":
        return <Markdown text={v.front || "…"} variant="body" />;
      case "options":
        return <OptionList options={v.options ?? []} />;
      case "back":
        return <Markdown text={v.back || "…"} variant="body" />;
      case "hint":
        return v.hint?.trim() ? <Markdown text={v.hint} variant="body" /> : <span className="text-muted">{sv.admin.diffEmpty}</span>;
    }
  };

  return (
    // Formler i display-läge (KaTeX) rullar inom sin kolumn i stället för att tränga ut den.
    <div className="grid gap-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1" data-testid="review-correction-compare">
      {changedLabels.length > 0 ? <p className="text-sm text-muted">{sv.admin.correctionChangedFields(changedLabels.join(", "))}</p> : <p className="text-sm text-muted">{sv.admin.correctionNoDiff}</p>}

      <div className="hidden grid-cols-2 gap-3 @xl:grid" aria-hidden>
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{sv.admin.correctionPublished}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">{sv.admin.correctionProposed}</p>
      </div>

      {rows.map((row) => (
        <section key={row.key} className="grid gap-1.5" aria-label={row.label} data-compare-field={row.key} data-changed={row.changed || undefined}>
          <p className="flex items-center gap-2 text-xs font-semibold text-muted">
            {row.label}
            {row.changed ? (
              <Badge tone="accent" className="px-2 py-0">
                {sv.admin.correctionChanged}
              </Badge>
            ) : null}
          </p>
          {row.changed ? (
            <div className="grid gap-2 @xl:grid-cols-2 @xl:gap-3">
              <Side label={sv.admin.correctionPublished} tone="before">
                {render(row, before)}
              </Side>
              <Side label={sv.admin.correctionProposed} tone="after">
                {render(row, after)}
              </Side>
            </div>
          ) : (
            <div className="min-w-0 rounded-md px-4 py-3 text-muted ring-1 ring-line ring-inset">{render(row, after)}</div>
          )}
        </section>
      ))}

      <div className="grid gap-3">
        <button
          type="button"
          aria-expanded={showText}
          onClick={() => setShowText((s) => !s)}
          className="inline-flex min-h-9 items-center gap-1.5 justify-self-start rounded-full px-3 text-sm font-semibold text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          data-testid="review-correction-text-toggle"
        >
          <ChevronDown size={15} aria-hidden className={cx("transition-transform duration-200", showText && "rotate-180")} />
          {sv.admin.correctionShowTextDiff}
        </button>
        {showText ? (
          <div className="anim-fade-in">
            <VersionDiff before={before} after={after} areaTitle={areaTitle} mode="inline" emptyText={sv.admin.correctionNoDiff} data-testid="review-correction-diff" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Side({ label, tone, children }: { label: string; tone: "before" | "after"; children: ReactNode }) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-md px-4 py-3",
        tone === "before" ? "bg-surface-2 text-muted" : "bg-accent-soft/50 ring-1 ring-accent/40 ring-inset dark:bg-accent-soft/60",
      )}
    >
      <p className={cx("mb-1.5 text-xs font-semibold @xl:hidden", tone === "before" ? "text-subtle" : "text-accent-ink")}>{label}</p>
      {children}
    </div>
  );
}

function OptionList({ options }: { options: readonly CardOption[] }) {
  if (options.length === 0) return <span className="text-muted">{sv.admin.diffEmpty}</span>;
  return (
    <ul className="grid gap-1.5">
      {options.map((o, i) => (
        <li key={`${i}-${o.text}`} className="flex items-start gap-2">
          <span
            className={cx(
              "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
              o.correct ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted",
            )}
          >
            {o.correct ? <Check size={12} strokeWidth={3} aria-hidden /> : String.fromCharCode(65 + i)}
            {o.correct ? <span className="sr-only">{sv.admin.correctOption}</span> : null}
          </span>
          <span className="min-w-0 flex-1">
            <Markdown text={o.text || "…"} variant="body" />
          </span>
        </li>
      ))}
    </ul>
  );
}
