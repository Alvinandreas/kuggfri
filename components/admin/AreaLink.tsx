import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import { tagBgClass } from "@/lib/ui/tag-colors";
import { cx } from "@/components/ui/cx";
import { routes } from "@/lib/routes";

/**
 * Ett område som färgad tagg och länk till områdets sida i admin. Samma form som CategoryTag,
 * med en ring vid hovring så att det syns att den går att klicka på. Används i adminens
 * områdestabeller (Översikt, Innehåll, Mer statistik).
 */
export function AreaLink({
  deckId,
  areaId,
  title,
  colorIndex,
  size = "sm",
  className,
  sv,
}: {
  deckId: string;
  areaId: string;
  title: string;
  colorIndex: number;
  size?: "sm" | "md";
  className?: string;
  /** Ordlistan i det valda språket (komponenten används både från servern och klienten). */
  sv: Dict;
}) {
  return (
    <Link
      href={routes.admin.category(deckId, areaId)}
      title={sv.admin.openArea(title)}
      data-testid="area-link"
      className={cx(
        "inline-flex max-w-full items-center rounded-full font-medium text-fg ring-fg/25 transition-[box-shadow,filter] duration-150 ease-out hover:ring-2 hover:brightness-[0.97] focus-visible:ring-2 dark:hover:brightness-110",
        tagBgClass(colorIndex),
        size === "md" ? "px-3.5 py-1.5 text-left text-sm leading-snug" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span className={size === "sm" ? "truncate" : undefined}>{title}</span>
    </Link>
  );
}
