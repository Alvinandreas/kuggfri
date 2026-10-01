/**
 * Visningstexter i admin för den som slagit på reglaget English: områdets namn och kortets fråga
 * på engelska i listor och tabeller som bara visar innehållet (Översikt, Mer statistik, Innehåll,
 * områdessidan, Felrapporter). Redigerarna visar alltid den svenska texten, eftersom det är den
 * som sparas och som studenterna ser.
 */
import type { Lang } from "@/lib/i18n/types";
import type { CardTranslation } from "@/lib/supabase/database.types";

/** Områdets namn i det valda språket. */
export function areaName(area: { title: string; title_en?: string | null }, lang: Lang): string {
  return lang === "en" && area.title_en ? area.title_en : area.title;
}

/** Kortets fråga i det valda språket (den svenska om översättning saknas). */
export function cardFront(card: { front: string; translation_en?: CardTranslation | null }, lang: Lang): string {
  return lang === "en" && card.translation_en ? card.translation_en.front : card.front;
}
