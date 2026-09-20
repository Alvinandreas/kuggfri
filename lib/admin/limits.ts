/**
 * Längdgränser för innehåll. Samma värden som databasens check-villkor
 * (migration 20260918000000_import_and_limits.sql); servern kontrollerar dem först
 * och ger ett begripligt fel. Ligger i egen fil eftersom en "use server"-modul
 * bara får exportera async-funktioner.
 */
/** Tak på hur många kort en import får innehålla, så att ett misstag inte fyller databasen. */
export const MAX_IMPORT_CARDS = 2000;

export const LIMITS = {
  title: 200,
  description: 2000,
  courseCode: 50,
  sourceCredit: 2000,
  categoryTitle: 200,
  front: 5000,
  back: 20000,
  hint: 500,
} as const;
