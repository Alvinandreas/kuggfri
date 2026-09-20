/**
 * Dosering och tentaplan. Ren modul.
 *
 * Principer (docs/OMVARLDSANALYS.md, avsnitt 5 och 7):
 * - En session har ett tak på nya kort, så att första passet aldrig är "144 kort kvar".
 * - Tentadatum styr: alla kort ska vara sedda i god tid, inget intervall får sträcka sig
 *   förbi tentan, och de sista dagarna görs en slutrepetition av allt.
 * - Ikappläget är synligt: dagsmålet höjs öppet i stället för att kön tyst växer.
 */

/** Standard för nya kort per dag. Kan ändras av studenten (10/20/40). */
export const DEFAULT_DAILY_NEW = 20;
export const DAILY_NEW_CHOICES = [10, 20, 40] as const;

/** Ungefärlig tid per kort, för "cirka N minuter". */
export const SECONDS_PER_CARD = 15;

/** Så många dagar före tentan ska alla kort vara introducerade. */
export const INTRO_MARGIN_DAYS = 4;

/** De sista dagarna före tentan körs slutrepetition av hela urvalet. */
export const FINAL_REVIEW_DAYS = 2;

/** Provtentan: så många slumpade kort ur urvalet. */
export const EXAM_SIZE = 30;

export function estimateMinutes(cards: number): number {
  return Math.max(1, Math.ceil((cards * SECONDS_PER_CARD) / 60));
}

export type ExamPhase =
  | { kind: "none" }
  /** Tentan är i framtiden och styr schemat. */
  | { kind: "upcoming"; daysLeft: number; maxInterval: number }
  /** Sista dagarna: slutrepetition av allt. */
  | { kind: "final"; daysLeft: number }
  /** Tentan har passerat: långsiktigt schema igen. */
  | { kind: "past"; daysAgo: number };

import { calendarDaysUntil } from "@/lib/time/day";

/** Hela kalenderdagar från nu till datumet (lokal tid); negativt om passerat. */
export const daysUntil = calendarDaysUntil;

/** Tolkar ett tentadatum (YYYY-MM-DD, lokal tid). Null om saknas eller ogiltigt. */
export function parseExamDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function examPhase(examDate: Date | null, now: Date = new Date()): ExamPhase {
  if (!examDate) return { kind: "none" };
  const daysLeft = daysUntil(examDate, now);
  if (daysLeft < 0) return { kind: "past", daysAgo: -daysLeft };
  if (daysLeft <= FINAL_REVIEW_DAYS) return { kind: "final", daysLeft };
  // Inget intervall får sträcka sig förbi dagen före tentan. ts-fsrs lägger Good och Easy
  // en respektive två dagar över taket för att hålla ordningen mellan knapparna, därav 3.
  return { kind: "upcoming", daysLeft, maxInterval: Math.max(1, daysLeft - 3) };
}

export type NewCardPlan = {
  /** Så många nya kort får den här sessionen innehålla. */
  limit: number;
  /** Nya kort per dag som behövs för att hinna alla före tentan (null utan tenta). */
  neededPerDay: number | null;
  /** True när tentan kräver mer än studentens eget dagsmål: visas öppet. */
  catchUp: boolean;
};

/**
 * Hur många nya kort sessionen ska ta.
 * - Utan tenta: dagsmålet minus det som redan introducerats i dag.
 * - Med tenta: minst det som krävs för att alla nya kort ska vara sedda
 *   INTRO_MARGIN_DAYS dagar före tentan (ikappläge, visas för studenten).
 * - Slutrepetition och passerad tenta: dagsmålet gäller.
 */
export function planNewCards(input: {
  newRemaining: number;
  introducedToday: number;
  dailyGoal: number;
  phase: ExamPhase;
}): NewCardPlan {
  const { newRemaining, introducedToday, dailyGoal, phase } = input;
  let neededPerDay: number | null = null;
  if (phase.kind === "upcoming") {
    const daysToIntroduce = Math.max(1, phase.daysLeft - INTRO_MARGIN_DAYS);
    neededPerDay = Math.ceil(newRemaining / daysToIntroduce);
  }
  const goal = neededPerDay !== null && neededPerDay > dailyGoal ? neededPerDay : dailyGoal;
  const limit = Math.max(0, Math.min(newRemaining, goal - introducedToday));
  return { limit, neededPerDay, catchUp: neededPerDay !== null && neededPerDay > dailyGoal };
}
