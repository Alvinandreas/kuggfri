import { Check } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { CARD_KIND_LABEL, isAutoGraded, type CardKind, type CardOption } from "@/lib/cards/kinds";
import { Markdown } from "@/components/markdown/Markdown";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { cx } from "@/components/ui/cx";

type Props = {
  front: string;
  back: string;
  hint: string | null;
  kind: CardKind;
  options: readonly CardOption[] | null;
  area: { title: string; colorIndex: number } | null;
  /** Mindre luft, för granskningsvyn där många kort gås igenom efter varandra. */
  compact?: boolean;
};

/**
 * Kortet så som studenten ser det: framsidan (med alternativen för automaträttade typer,
 * det rätta markerat) och baksidan, som heter Förklaring för automaträttade typer.
 * Samma markdown- och KaTeX-renderare som studievyn.
 */
export function CardPreview({ front, back, hint, kind, options, area, compact = false }: Props) {
  const auto = isAutoGraded(kind);
  const sides = [
    { key: "front", label: kind === "sant-falskt" ? sv.admin.statement : kind === "begrepp" ? sv.admin.concept : sv.study.front, text: front },
    { key: "back", label: auto ? sv.admin.explanation : sv.study.back, text: back },
  ] as const;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {sides.map((side) => (
        <section
          key={side.key}
          className={cx(
            "flex flex-col rounded-lg border bg-surface shadow-card",
            compact ? "min-h-36 p-5" : "min-h-48 p-5 sm:p-7",
            side.key === "back" ? "border-accent/40" : "border-line",
          )}
          aria-label={`${sv.admin.preview}: ${side.label}`}
          data-testid={`preview-${side.key}`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            {area ? <CategoryTag title={area.title} colorIndex={area.colorIndex} size="lg" /> : <span className="text-xs text-muted">{sv.admin.noCategory}</span>}
            <span className="shrink-0 text-xs uppercase tracking-wide text-muted">
              {side.key === "front" ? CARD_KIND_LABEL[kind] : side.label}
            </span>
          </div>
          <div className={cx("flex flex-1 py-2", side.key === "front" && !auto && "text-center")}>
            <Markdown text={side.text || "…"} variant="card" className="m-auto w-full" />
          </div>
          {side.key === "front" && auto ? <OptionList options={options ?? []} /> : null}
          {side.key === "front" && hint?.trim() ? (
            <p className="mt-4 border-t border-line pt-3 text-center text-sm">
              <span className="font-medium text-muted">{sv.study.hint}: </span>
              {hint}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function OptionList({ options }: { options: readonly CardOption[] }) {
  if (options.length === 0) return <p className="mt-3 text-sm text-danger">{sv.admin.alternativesHelp}</p>;
  return (
    <ul className="mt-3 grid gap-2" aria-label={sv.admin.alternatives}>
      {options.map((o, i) => (
        <li
          key={`${i}-${o.text}`}
          className={cx(
            "flex items-start gap-3 rounded-md border-2 px-4 py-3",
            o.correct ? "border-accent bg-accent-soft/60" : "border-transparent bg-surface-2",
          )}
        >
          <span
            aria-hidden
            className={cx(
              "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              o.correct ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted",
            )}
          >
            {o.correct ? <Check size={14} strokeWidth={3} /> : String.fromCharCode(65 + i)}
          </span>
          <span className="min-w-0 flex-1">
            <Markdown text={o.text || "…"} variant="body" />
          </span>
          {o.correct ? <span className="sr-only">{sv.admin.correctAnswer}</span> : null}
        </li>
      ))}
    </ul>
  );
}
