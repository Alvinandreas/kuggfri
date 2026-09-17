/**
 * Typer för databasen. Håll i synk med supabase/migrations.
 * Kan regenereras med `npm run db:types` när Supabase körs lokalt.
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
  created_at: string;
};

export type DeckRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  course_code: string | null;
  source_credit: string | null;
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
  reviews_14d: number;
  avg_rating: number | null;
  days: { day: string; reviews: number }[];
  categories: { category_id: string; learned: number; partial: number; studied: number; students: number }[];
  cards: { card_id: string; category_id: string | null; front: string; ratings: number; low: number; avg: number }[];
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Optional<ProfileRow, "display_name" | "is_admin" | "created_at">;
        Update: Partial<ProfileRow>;
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
      deck_stats_overview: { Args: { p_deck_id: string; p_days?: number }; Returns: DeckOverviewStats };
      can_edit_deck: { Args: { p_deck_id: string }; Returns: boolean };
      list_deck_examiners: {
        Args: { p_deck_id: string };
        Returns: { user_id: string; email: string; display_name: string | null; created_at: string }[];
      };
      add_deck_examiner: { Args: { p_deck_id: string; p_email: string }; Returns: "added" | "exists" | "not_found" };
      remove_deck_examiner: { Args: { p_deck_id: string; p_user_id: string }; Returns: number };
      reorder_cards: { Args: { p_deck_id: string; p_ids: string[] }; Returns: number };
      reorder_categories: { Args: { p_deck_id: string; p_ids: string[] }; Returns: number };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
