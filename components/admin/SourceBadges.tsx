import {
  Award,
  BookA,
  BookOpen,
  CircleDashed,
  ClipboardCheck,
  File,
  FileText,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  PencilRuler,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { SOURCE_TAG_LABEL, cardSources, sourceTags, type SourceTag } from "@/lib/admin/sources";
import { cx } from "@/components/ui/cx";

export const SOURCE_TAG_ICON: Record<SourceTag, LucideIcon> = {
  forelasning: Presentation,
  tenta: GraduationCap,
  quiz: ClipboardCheck,
  ovning: PencilRuler,
  labb: FlaskConical,
  bok: BookOpen,
  ordlista: BookA,
  kursdokument: FileText,
  ovrigt: File,
  original: Award,
  ingen: CircleDashed,
};

/**
 * Källtypen som en liten kantad pill med ikon ("Föreläsning", "Quiz"). Kantad, så att den skiljer
 * sig från uppgiftstypens grå pill. Färgen följer texten runt omkring (fungerar på markerade rader).
 */
export function SourceBadge({ tag, className }: { tag: SourceTag; className?: string }) {
  const Icon = SOURCE_TAG_ICON[tag];
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-xs font-semibold",
        tag === "ingen" ? "border-dashed border-line-strong text-subtle" : "border-line-strong text-muted",
        className,
      )}
      title={tag === "original" ? sv.admin.originalHelp : undefined}
      data-testid={tag === "original" ? "original-badge" : undefined}
      data-source-tag={tag}
    >
      <Icon size={12} aria-hidden className="shrink-0" />
      {SOURCE_TAG_LABEL[tag]}
    </span>
  );
}

/** Kortets alla källtyper som badges (Originalkort eller Ingen källa om källa saknas). */
export function SourceBadges({ source, original, max = 3, className }: { source: string | null; original?: boolean; max?: number; className?: string }) {
  const tags = sourceTags({ source, original });
  const shown = tags.slice(0, max);
  const rest = tags.length - shown.length;
  return (
    <span className={cx("inline-flex min-w-0 flex-wrap items-center gap-1", className)}>
      {shown.map((t) => (
        <SourceBadge key={t} tag={t} />
      ))}
      {rest > 0 ? (
        <span className="text-xs font-semibold text-muted" title={tags.slice(max).map((t) => SOURCE_TAG_LABEL[t]).join(", ")}>
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

/** Motiveringen till en rättelse av ett publicerat kort, som en tydlig notis. */
export function CorrectionNote({ reason, className }: { reason: string; className?: string }) {
  return (
    <div role="note" className={cx("flex gap-3 rounded-md bg-accent-soft px-4 py-3 text-sm text-accent-ink", className)} data-testid="review-correction-reason">
      <Lightbulb size={17} aria-hidden className="mt-0.5 shrink-0" />
      <p className="min-w-0 break-words">
        <span className="font-semibold">{sv.admin.sourceWhyChanged}</span> {reason}
      </p>
    </div>
  );
}

/**
 * Källorna strukturerat: en rad per dokument med typ, dokumentnamn och sidor/frågor
 * ("Kapitel_08 Seghet och Brott · s. 7, 13, 14"). Rättelsens motivering visas som en notis
 * överst (showCorrection), eller inte alls om den redan visas på annat ställe.
 */
export function SourceList({
  source,
  original,
  showCorrection = true,
  className,
}: {
  source: string | null;
  original?: boolean;
  showCorrection?: boolean;
  className?: string;
}) {
  const { groups, correction, missing } = cardSources({ source, original });
  return (
    <div className={cx("grid gap-3", className)} data-testid="source-list">
      {showCorrection && correction ? <CorrectionNote reason={correction} /> : null}
      {missing ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <SourceBadge tag={missing} />
          <span>{missing === "original" ? sv.admin.sourceOriginalHelp : sv.admin.sourceNoneHelp}</span>
        </div>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {groups.map((g) => (
            <li key={`${g.kind}-${g.document}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 max-sm:grid-cols-1 max-sm:gap-1">
              <span className="pt-px">
                <SourceBadge tag={g.kind} />
              </span>
              <span className="min-w-0 break-words leading-6">
                <span className="font-medium text-fg">{g.document}</span>
                {g.locator ? (
                  <>
                    <span aria-hidden className="px-1.5 text-subtle">
                      ·
                    </span>
                    <span className="text-muted tabular-nums">{g.locator}</span>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
