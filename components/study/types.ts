/**
 * Typer som delas av studiekomponenterna.
 *
 * Ligger i en egen fil för att StudySession och SessionSummary annars importerar
 * varandras typer, vilket är den enda cykeln i kodbasen. När korten får fler typer
 * (flerval, lucktext) är StudyCard det som ändras mest, och då ska inte två
 * komponenter behöva byta plats i beroendekedjan.
 */

import type { CardKind, CardOption } from "@/lib/cards/kinds";

export type StudyCard = {
  id: string;
  category_id: string | null;
  front: string;
  back: string;
  hint: string | null;
  sort_order: number;
  /** Uppgiftstyp: styr om kortet vänds och självskattas eller rättas automatiskt. */
  kind: CardKind;
  /** Svarsalternativ för sant-falskt och alternativ, annars null. */
  options: CardOption[] | null;
  /** Del av den beprövade originaluppsättningen. */
  original: boolean;
};

/** Dagsläget efter en schemalagd session: underlag för "Klar för i dag". */
export type TodaySummary = {
  reviewsToday: number;
  streak: number;
  freezesLeft: number;
  freezeUsedRecently: boolean;
  /** Uppskattat antal kort studenten kan just nu. */
  known: number;
  total: number;
  /** Inget förfallet kvar och dagsmålet nått: en tydlig slutpunkt. */
  done: boolean;
  /** Länk för att ta fler nya kort utöver dagsmålet, eller null. */
  continueHref: string | null;
  continueCount: number;
  /** Plugga vidare: nästa extra pass (kort närmast att förfalla, sedan nya), eller null. */
  extraHref: string | null;
  extraCount: number;
  /** Passet som just tog slut var ett Plugga vidare-pass. */
  extraPass: boolean;
};
