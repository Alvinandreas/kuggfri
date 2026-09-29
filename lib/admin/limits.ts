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
  /** Källa, t.ex. "Canvas, Quiz vecka 1, fråga 3". */
  source: 500,
  /** Granskarens kommentar vid avvisning. */
  reviewNote: 2000,
  /** Flaggans anteckning (samma gräns som cards_flag_note_length). */
  flagNote: 2000,
  optionText: 1000,
  maxOptions: 10,
  /** Tak på hur många kort en massåtgärd (godkänn, flytta) får röra i ett anrop. */
  bulkCards: 1000,
} as const;
