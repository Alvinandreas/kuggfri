import { Award, CheckCheck, CircleHelp, ListChecks, MessageSquareText, ToggleLeft, type LucideIcon } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { CARD_KIND_LABEL, type CardKind } from "@/lib/cards/kinds";
import { Badge } from "@/components/ui/Badge";

export const KIND_ICON: Record<CardKind, LucideIcon> = {
  sjalvskattning: MessageSquareText,
  begrepp: CircleHelp,
  "sant-falskt": ToggleLeft,
  alternativ: ListChecks,
};

/** Uppgiftstypen som en liten pill med ikon. compact = bara ikonen (namnet som title). */
export function KindBadge({ kind, compact = false }: { kind: CardKind; compact?: boolean }) {
  const Icon = KIND_ICON[kind];
  if (compact) {
    return (
      <span title={CARD_KIND_LABEL[kind]} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon size={12} aria-hidden />
        <span className="sr-only">{CARD_KIND_LABEL[kind]}</span>
      </span>
    );
  }
  return (
    <Badge tone="neutral">
      <Icon size={12} aria-hidden />
      {CARD_KIND_LABEL[kind]}
    </Badge>
  );
}

/** Utkast eller avvisad. Vanliga kort får ingen pill (null). */
export function ReviewStatusBadge({ status, approved = false }: { status: "utkast" | "avvisad" | null; approved?: boolean }) {
  if (status === "utkast") return <Badge tone="strong">{sv.admin.statusDraft}</Badge>;
  if (status === "avvisad") return <Badge tone="danger">{sv.admin.statusRejected}</Badge>;
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
export function OriginalBadge() {
  return (
    <span title={sv.admin.originalHelp} className="inline-flex shrink-0" data-testid="original-badge">
      <Badge tone="outline">
        <Award size={12} aria-hidden />
        {sv.admin.original}
      </Badge>
    </span>
  );
}
