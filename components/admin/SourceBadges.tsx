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
/** Källtypernas namn och hjälptexter på ett annat språk (granskningen på engelska). */
export type SourceLabels = { tags: Record<SourceTag, string>; originalHelp: string; sourceOriginalHelp: string; sourceNoneHelp: string };

export function SourceBadge({ tag, className, labels }: { tag: SourceTag; className?: string; labels?: SourceLabels }) {
  const Icon = SOURCE_TAG_ICON[tag];
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-xs font-semibold",
        tag === "ingen" ? "border-dashed border-line-strong text-subtle" : "border-line-strong text-muted",
        className,
      )}
      title={tag === "original" ? (labels?.originalHelp ?? sv.admin.originalHelp) : undefined}
      data-testid={tag === "original" ? "original-badge" : undefined}
      data-source-tag={tag}
    >
      <Icon size={12} aria-hidden className="shrink-0" />
      {(labels?.tags ?? SOURCE_TAG_LABEL)[tag]}
    </span>
  );
}

/** Kortets alla källtyper som badges (Originalkort eller Ingen källa om källa saknas). */
export function SourceBadges({
  source,
  original,
  max = 3,
  className,
  labels,
}: {
  source: string | null;
  original?: boolean;
  max?: number;
  className?: string;
  labels?: SourceLabels;
}) {
  const tags = sourceTags({ source, original });
  const shown = tags.slice(0, max);
  const rest = tags.length - shown.length;
  return (
    <span className={cx("inline-flex min-w-0 flex-wrap items-center gap-1", className)}>
      {shown.map((t) => (
        <SourceBadge key={t} tag={t} labels={labels} />
      ))}
      {rest > 0 ? (
        <span className="text-xs font-semibold text-muted" title={tags.slice(max).map((t) => (labels?.tags ?? SOURCE_TAG_LABEL)[t]).join(", ")}>
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Källorna strukturerat: en rad per dokument med typ, dokumentnamn och sidor/frågor
 * ("Kapitel_08 Seghet och Brott" och under det "s. 7, 13, 14"). En eventuell motivering till en
 * rättelse visas inte (Alvins beslut 30 sep: examinatorerna har inte sett korten förut).
 */
export function SourceList({ source, original, className, labels }: { source: string | null; original?: boolean; className?: string; labels?: SourceLabels }) {
  const { groups, missing } = cardSources({ source, original });
  return (
    <div className={cx("grid gap-3", className)} data-testid="source-list">
      {missing ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <SourceBadge tag={missing} labels={labels} />
          <span>{missing === "original" ? (labels?.sourceOriginalHelp ?? sv.admin.sourceOriginalHelp) : (labels?.sourceNoneHelp ?? sv.admin.sourceNoneHelp)}</span>
        </div>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {groups.map((g) => (
            <li key={`${g.kind}-${g.document}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 max-sm:grid-cols-1 max-sm:gap-1">
              <span className="pt-px">
                <SourceBadge tag={g.kind} labels={labels} />
              </span>
              <span className="grid min-w-0 break-words leading-6">
                <span className="font-medium text-fg">{g.document}</span>
                {g.locator ? <span className="text-muted tabular-nums">{g.locator}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
