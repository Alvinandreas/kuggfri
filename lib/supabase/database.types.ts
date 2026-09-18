/**
 * Typer för databasen. Håll i synk med supabase/migrations.
 * OBS: `npm run db:types` skriver över den här handskrivna filen med råformatet; lägg till nya kolumner för hand i stället.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRow = {
  id: string;
  display_name: string | null;
  is_admin: boolean;
  /** Daglig påminnelse via mejl när kort är förfallna (opt-in). */
  reminder_email: boolean;
  /** Examinator: veckobrev på måndagar. */
  digest_email: boolean;
  created_at: string;
};

/** Rad i email_log: bara servern (service role) läser och skriver. */
export type EmailLogRow = {
  id: string;
  kind: "reminder" | "reminder_stop" | "digest";
  user_id: string;
  deck_id: string | null;
  subject: string;
  sent_at: string;
};

/** Svar från deck_digest(): underlag för examinatorns veckobrev. */
export type DeckDigest = {
  exam_date: string | null;
  students: number;
  new_students_7d: number;
  active_7d: number;
  reviews_7d: number;
  avg_rating_7d: number | null;
  hardest: { title: string; avg: number; students: number }[];
  tricky: { front: string; low_share: number; ratings: number }[];
  open_reports: number;
  latest_reports: { front: string; message: string; created_at: string }[];
};

export type DeckRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  course_code: string | null;
  source_credit: string | null;
  /** Tentadatum YYYY-MM-DD, valfritt. */
  exam_date: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  deck_id: string;
  title: string;
  sort_order: number;
};

export type CardRow = {
  id: string;
  deck_id: string;
  category_id: string | null;
  front: string;
  back: string;
  hint: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CardProgressRow = {
  user_id: string;
  card_id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  self_rating: number | null;
};

export type StudySessionRow = {
  id: string;
  user_id: string | null;
  deck_id: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  cards_reviewed: number;
};

export type CardReportRow = {
  id: string;
  card_id: string;
  user_id: string | null;
  message: string;
  contact: string | null;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
};

export type ReviewLogRow = {
  id: string;
  user_id: string;
  card_id: string;
  rating: number;
  mode: string;
  reviewed_at: string;
};

export type DeckStatsCardRow = {
  card_id: string;
  front: string;
  rating_count: number;
  avg_rating: number | null;
  total_reps: number;
};

export type DeckExaminerRow = {
  deck_id: string;
  user_id: string;
  created_at: string;
};

/** Svar från deck_stats_overview (jsonb). Bara aggregat, inga användar-id:n. */
export type DeckOverviewStats = {
  students: number;
  active_7d: number;
  reviews_7d: number;
  avg_rating: number | null;
  open_reports: number;
  /** Kommer studenterna tillbaka? Saknas om databasen kör en äldre version av funktionen. */
  activation?: { started: number; first_session_20: number; eligible: number; returned_3d: number };
  rating_dist: { rating: number; n: number }[];
  /** bucket 0 = 0–20 % inlärda kort … 4 = 80–100 % */
  progress_buckets: { bucket: number; students: number }[];
  weeks: { week: number; start: string; students: number; reviews: number }[];
  categories: { category_id: string; students: number; ratings: number; avg: number | null; low: number; learned: number; partial: number; studied: number }[];
  cards: { card_id: string; category_id: string | null; front: string; ratings: number; low: number; avg: number }[];
};

/** Rad från deck_reports(): felrapport med kortets framsida, utan user_id. */
export type DeckReportRow = {
  id: string;
  card_id: string;
  card_front: string;
  message: string;
  contact: string | null;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Optional<ProfileRow, "display_name" | "is_admin" | "reminder_email" | "digest_email" | "created_at">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      email_log: {
        Row: EmailLogRow;
        Insert: Optional<EmailLogRow, "id" | "deck_id" | "sent_at">;
        Update: Partial<EmailLogRow>;
        Relationships: [];
      };
      decks: {
        Row: DeckRow;
        Insert: Optional<
          DeckRow,
          | "id"
          | "description"
          | "course_code"
          | "source_credit"
          | "exam_date"
          | "is_published"
          | "sort_order"
          | "created_at"
          | "updated_at"
        >;
        Update: Partial<DeckRow>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Optional<CategoryRow, "id" | "sort_order">;
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      cards: {
        Row: CardRow;
        Insert: Optional<
          CardRow,
          "id" | "category_id" | "hint" | "sort_order" | "is_active" | "created_at" | "updated_at"
        >;
        Update: Partial<CardRow>;
        Relationships: [];
      };
      card_progress: {
        Row: CardProgressRow;
        Insert: Optional<
          CardProgressRow,
          | "due"
          | "stability"
          | "difficulty"
          | "elapsed_days"
          | "scheduled_days"
          | "reps"
          | "lapses"
          | "state"
          | "last_review"
          | "self_rating"
        >;
        Update: Partial<CardProgressRow>;
        Relationships: [];
      };
      study_sessions: {
        Row: StudySessionRow;
        Insert: Optional<
          StudySessionRow,
          "id" | "user_id" | "started_at" | "ended_at" | "cards_reviewed"
        >;
        Update: Partial<StudySessionRow>;
        Relationships: [];
      };
      review_log: {
        Row: ReviewLogRow;
        Insert: Optional<ReviewLogRow, "id" | "reviewed_at">;
        Update: Partial<ReviewLogRow>;
        Relationships: [];
      };
      deck_examiners: {
        Row: DeckExaminerRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      card_reports: {
        Row: CardReportRow;
        // Klienten får bara sätta dessa kolumner (kolumnrättigheter i databasen).
        Insert: { card_id: string; message: string; contact?: string | null };
        Update: Partial<Pick<CardReportRow, "status" | "resolved_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      reset_deck_progress: { Args: { p_deck_id: string }; Returns: number };
      reset_all_progress: { Args: Record<string, never>; Returns: number };
      reset_schedule_keep_ratings: { Args: { p_deck_id: string | null }; Returns: number };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      deck_stats_summary: {
        Args: { p_deck_id: string };
        Returns: { unique_users: number; total_reviews: number; avg_rating: number | null }[];
      };
      deck_stats_cards: { Args: { p_deck_id: string }; Returns: DeckStatsCardRow[] };
      deck_stats_overview: { Args: { p_deck_id: string; p_weeks?: number }; Returns: DeckOverviewStats };
      deck_digest: { Args: { p_deck_id: string; p_min_students?: number }; Returns: DeckDigest };
      reminder_candidates: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          display_name: string | null;
          last_review_at: string | null;
          reminders_since_last_review: number;
          sent_today: boolean;
          decks: { slug: string; title: string; due: number; exam_date: string | null }[] | null;
        }[];
      };
      digest_recipients: {
        Args: Record<string, never>;
        Returns: { deck_id: string; deck_slug: string; deck_title: string; user_id: string; email: string; display_name: string | null }[];
      };
      is_service_role: { Args: Record<string, never>; Returns: boolean };
      deck_reports: { Args: { p_deck_id: string }; Returns: DeckReportRow[] };
      deck_open_report_count: { Args: { p_deck_id: string }; Returns: number };
      can_edit_deck: { Args: { p_deck_id: string }; Returns: boolean };
      list_deck_examiners: {
        Args: { p_deck_id: string };
        Returns: { user_id: string | null; email: string; display_name: string | null; created_at: string; pending: boolean }[];
      };
      add_deck_examiner: { Args: { p_deck_id: string; p_email: string }; Returns: "added" | "exists" | "invited" };
      remove_deck_examiner_invite: { Args: { p_deck_id: string; p_email: string }; Returns: number };
      remove_deck_examiner: { Args: { p_deck_id: string; p_user_id: string }; Returns: number };
      import_cards: {
        Args: {
          p_deck_id: string;
          p_new_categories: string[];
          p_create: { front: string; back: string; hint: string | null; category: string | null; sort_order: number | null }[];
          p_update: { id: string; back: string; hint: string | null; category: string | null; sort_order: number | null }[];
        };
        Returns: { created: number; updated: number };
      };
      reorder_cards: { Args: { p_deck_id: string; p_ids: string[] }; Returns: number };
      reorder_categories: { Args: { p_deck_id: string; p_ids: string[] }; Returns: number };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
