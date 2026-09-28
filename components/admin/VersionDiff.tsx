import { Check } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { diffText, type DiffPart } from "@/lib/admin/diff";
import { changedFields, diffOptions, versionStatus, type ContentField, type OptionDiffRow, type VersionContent } from "@/lib/admin/history";
import { CARD_KIND_LABEL, isAutoGraded } from "@/lib/cards/kinds";
import { cx } from "@/components/ui/cx";

const delClass = "rounded-sm bg-danger-soft px-0.5 text-danger line-through decoration-danger/70";
const insClass = "rounded-sm bg-accent-soft px-0.5 text-accent-ink no-underline";

/** Ett fälts namn i skillnaden. Fram- och baksidan heter som i redigeraren för kortets typ. */
export function fieldLabel(field: ContentField, content: Pick<VersionContent, "kind">): string {
  switch (field) {
    case "status":
      return sv.admin.diffStatus;
    case "kind":
      return sv.admin.kind;
    case "category_id":
      return sv.admin.category;
    case "front":
      return content.kind === "sant-falskt" ? sv.admin.statement : content.kind === "begrepp" ? sv.admin.concept : content.kind === "alternativ" ? sv.admin.question : sv.admin.front;
    case "back":
      return isAutoGraded(content.kind) ? sv.admin.explanation : sv.admin.back;
    case "options":
      return sv.admin.alternatives;
    case "hint":
      return sv.study.hint;
    case "source":
      return sv.admin.sourceShort;
  }
}

/** Texten med borttaget och tillagt markerat. side = bara ena sidan (för sida vid sida). */
export function DiffText({ parts, side }: { parts: readonly DiffPart[]; side?: "before" | "after" }) {
  const shown = parts.filter((p) => (side === "before" ? p.type !== "add" : side === "after" ? p.type !== "del" : true));
  if (shown.every((p) => !p.text)) return <span className="text-muted">{sv.admin.diffEmpty}</span>;
  return (
    <span className="whitespace-pre-wrap break-words">
      {shown.map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "del" ? (
          <del key={i} className={delClass}>
            <span className="sr-only">{sv.admin.diffRemoved} </span>
            {p.text}
          </del>
        ) : (
          <ins key={i} className={insClass}>
            <span className="sr-only">{sv.admin.diffAdded} </span>
            {p.text}
          </ins>
        ),
      )}
    </span>
  );
}

/** Ett enkelt värde (status, typ, område) före och efter. */
function valueOf(field: "status" | "kind" | "category_id", c: VersionContent, areaTitle: (id: string | null) => string): string {
  if (field === "status") return sv.admin.historyStatus[versionStatus(c)];
  if (field === "kind") return CARD_KIND_LABEL[c.kind];
  return areaTitle(c.category_id);
}

function OptionMarker({ correct, changed }: { correct: boolean; changed: boolean }) {
  return (
    <span
      className={cx(
        "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        correct ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted",
        changed && "ring-2 ring-offset-1 ring-offset-surface " + (correct ? "ring-accent" : "ring-danger"),
      )}
    >
      {correct ? <Check size={12} strokeWidth={3} aria-hidden /> : null}
      <span className="sr-only">{correct ? sv.admin.correctOption : sv.admin.diffOptionWrong}</span>
    </span>
  );
}

/** Alternativen, antingen alla rader (inline) eller bara ena sidans. */
function OptionsDiff({ rows, side }: { rows: readonly OptionDiffRow[]; side?: "before" | "after" }) {
  const shown = rows.filter((r) => (side === "before" ? r.before !== null : side === "after" ? r.after !== null : true));
  if (shown.length === 0) return <span className="text-muted">{sv.admin.diffEmpty}</span>;
  return (
    <ul className="grid gap-1">
      {shown.map((r, i) => {
        const removed = r.after === null;
        const added = r.before === null;
        const flipped = !removed && !added && r.before !== r.after;
        const correct = side === "before" ? r.before === true : r.after === null ? r.before === true : r.after === true;
        const highlight = side === "before" ? removed : side === "after" ? added : removed || added;
        return (
          <li key={`${i}-${r.text}`} className="flex items-start gap-2">
            <OptionMarker correct={correct} changed={flipped} />
            <span className="min-w-0 flex-1 break-words">
              {highlight ? (
                removed ? (
                  <del className={delClass}>
                    <span className="sr-only">{sv.admin.diffRemoved} </span>
                    {r.text}
                  </del>
                ) : (
                  <ins className={insClass}>
                    <span className="sr-only">{sv.admin.diffAdded} </span>
                    {r.text}
                  </ins>
                )
              ) : (
                r.text
              )}
              {flipped && side === undefined ? (
                <span className="ml-2 text-xs">
                  <del className={delClass}>{r.before ? sv.admin.correctOption : sv.admin.diffOptionWrong}</del>{" "}
                  <ins className={insClass}>{r.after ? sv.admin.correctOption : sv.admin.diffOptionWrong}</ins>
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type Props = {
  before: VersionContent;
  after: VersionContent;
  areaTitle: (id: string | null) => string;
  /** inline = en kolumn med borttaget och tillagt i texten; split = före och efter sida vid sida. */
  mode?: "inline" | "split";
  /** Kolumnrubrikerna i split-läget. */
  labels?: { before: string; after: string };
  /** Visa vilka fält som inte ändrats. */
  showUnchanged?: boolean;
  /** Visas när inget skiljer. */
  emptyText?: string;
  "data-testid"?: string;
};

/** Skillnaden mellan två versioner av ett kort, fält för fält. */
export function VersionDiff({ before, after, areaTitle, mode = "inline", labels, showUnchanged = false, emptyText = sv.admin.historySame, ...rest }: Props) {
  const fields = changedFields(before, after);
  const unchanged = showUnchanged ? (["front", "back", "category_id", "kind"] as const).filter((f) => !fields.includes(f)) : [];
  if (fields.length === 0) return <p className="text-sm text-muted" data-testid={rest["data-testid"]}>{emptyText}</p>;

  return (
    <div className="grid gap-3 text-sm" data-testid={rest["data-testid"]}>
      {mode === "split" && labels ? (
        <div className="hidden gap-3 text-xs font-semibold uppercase tracking-wide text-subtle sm:grid sm:grid-cols-2">
          <span>{labels.before}</span>
          <span>{labels.after}</span>
        </div>
      ) : null}
      {fields.map((field) => {
        const label = fieldLabel(field, field === "front" || field === "back" ? after : before);
        const text = field === "front" || field === "back" || field === "hint" || field === "source";
        const parts = text ? diffText(before[field] ?? "", after[field] ?? "") : null;
        const rows = field === "options" ? diffOptions(before.options, after.options) : null;
        const simple = field === "status" || field === "kind" || field === "category_id" ? field : null;

        const side = (s: "before" | "after") =>
          parts ? (
            <DiffText parts={parts} side={s} />
          ) : rows ? (
            <OptionsDiff rows={rows} side={s} />
          ) : simple ? (
            s === "before" ? (
              <del className={delClass}>{valueOf(simple, before, areaTitle)}</del>
            ) : (
              <ins className={insClass}>{valueOf(simple, after, areaTitle)}</ins>
            )
          ) : null;

        return (
          <div key={field} className="grid gap-1.5" data-diff-field={field}>
            <p className="text-xs font-semibold text-muted">{label}</p>
            {mode === "split" ? (
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                {(["before", "after"] as const).map((s) => (
                  <div key={s} className="min-w-0 rounded-md bg-surface-2 px-3 py-2">
                    {labels ? <p className="mb-1 text-xs font-semibold text-subtle sm:hidden">{s === "before" ? labels.before : labels.after}</p> : null}
                    {side(s)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="min-w-0 rounded-md bg-surface-2 px-3 py-2">
                {parts ? (
                  <DiffText parts={parts} />
                ) : rows ? (
                  <OptionsDiff rows={rows} />
                ) : simple ? (
                  <span>
                    {side("before")} <span aria-hidden>→</span> {side("after")}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
      {unchanged.length > 0 ? (
        <p className="text-xs text-muted">{sv.admin.correctionUnchanged(unchanged.map((f) => fieldLabel(f, after).toLowerCase()).join(", "))}</p>
      ) : null}
    </div>
  );
}
