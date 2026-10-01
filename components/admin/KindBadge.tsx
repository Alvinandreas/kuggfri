import { Award, CheckCheck, CircleHelp, ListChecks, MessageSquareText, ToggleLeft, type LucideIcon } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import type { CardKind } from "@/lib/cards/kinds";
import { Badge } from "@/components/ui/Badge";

export const KIND_ICON: Record<CardKind, LucideIcon> = {
  sjalvskattning: MessageSquareText,
  begrepp: CircleHelp,
  "sant-falskt": ToggleLeft,
  alternativ: ListChecks,
};

/*
 * Komponenterna här används både från servern och klienten, så ordlistan (sv) kommer från
 * anroparen: getT() på servern, useT() i klienten.
 */

/** Uppgiftstypen som en liten pill med ikon. compact = bara ikonen (namnet som title). label = namnet på ett annat språk. */
export function KindBadge({ kind, compact = false, label, sv }: { kind: CardKind; compact?: boolean; label?: string; sv: Dict }) {
  const Icon = KIND_ICON[kind];
  const name = label ?? sv.cardKind.label[kind];
  if (compact) {
    return (
      <span title={name} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon size={12} aria-hidden />
        <span className="sr-only">{name}</span>
      </span>
    );
  }
  return (
    <Badge tone="neutral">
      <Icon size={12} aria-hidden />
      {name}
    </Badge>
  );
}

/** Utkast, ur rotation eller ogranskat. Granskade kort får ingen pill (null) om inte approved. */
export function ReviewStatusBadge({ status, approved = false, unreviewed = false, sv }: { status: "utkast" | "avvisad" | null; approved?: boolean; unreviewed?: boolean; sv: Dict }) {
  if (status === "utkast") return <Badge tone="strong">{sv.admin.statusDraft}</Badge>;
  if (status === "avvisad") return <Badge tone="danger">{sv.admin.statusRejected}</Badge>;
  if (unreviewed) return <Badge tone="outline">{sv.admin.statusUnreviewed}</Badge>;
  if (approved)
    return (
      <Badge tone="accent">
        <CheckCheck size={12} aria-hidden />
        {sv.admin.statusApproved}
      </Badge>
    );
  return null;
}

/** Kortet hör till den beprövade originaluppsättningen (sätts av innehållsverktyget). */
export function OriginalBadge({ sv }: { sv: Dict }) {
  return (
    <span title={sv.admin.originalHelp} className="inline-flex shrink-0" data-testid="original-badge">
      <Badge tone="outline">
        <Award size={12} aria-hidden />
        {sv.admin.original}
      </Badge>
    </span>
  );
}
