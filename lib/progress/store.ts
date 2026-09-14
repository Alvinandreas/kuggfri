"use client";

/**
 * Progresslager. Två implementationer med samma gränssnitt:
 * - LocalProgressStore: gäst, localStorage
 * - SupabaseProgressStore: inloggad, tabellerna card_progress och review_log
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { resetScheduleKeepRating } from "@/lib/fsrs/scheduler";
import {
  appendLocalReview,
  clearLocalProgress,
  clearLocalReviews,
  hasLocalProgress,
  readLocalProgress,
  readLocalReviews,
  writeLocalProgress,
  writeLocalReviews,
} from "./local-store";
import { mergeProgress } from "./migrate";
import { isSelfRating, isStudyMode, type CardProgress, type ProgressMap, type ReviewEntry, type StudyMode } from "./types";

export interface ProgressStore {
  readonly kind: "local" | "account";
  /** Progress för angivna kort. Kort utan progress saknas i svaret. */
  load(cardIds: readonly string[]): Promise<ProgressMap>;
  save(progress: CardProgress): Promise<void>;
  /** Tar bort all progress (och historik) för ett deck. */
  resetDeck(deckId: string, cardIds: readonly string[]): Promise<void>;
  /** Tar bort all progress i alla deck. */
  resetAll(): Promise<void>;
  /** Nollställer schemat men behåller self_rating. deckId null = alla deck. */
  resetSchedule(deckId: string | null, cardIds: readonly string[] | null): Promise<void>;
  /** Loggar en avslutad session. Gäster loggar ingenting. */
  logSession(input: { deckId: string; mode: StudyMode; startedAt: Date; cardsReviewed: number }): Promise<void>;
  /** Repetitionshistorik för angivna kort, äldst först. */
  loadReviews(cardIds: readonly string[]): Promise<ReviewEntry[]>;
  /** Lägger till en rad i repetitionshistoriken. */
  logReview(entry: ReviewEntry): Promise<void>;
}

function byTime(a: ReviewEntry, b: ReviewEntry): number {
  return Date.parse(a.reviewed_at) - Date.parse(b.reviewed_at);
}

export class LocalProgressStore implements ProgressStore {
  readonly kind = "local" as const;
  constructor(private readonly storage: Storage) {}

  async load(cardIds: readonly string[]): Promise<ProgressMap> {
    const all = readLocalProgress(this.storage);
    const wanted = new Set(cardIds);
    const result: ProgressMap = {};
    for (const [id, p] of Object.entries(all)) if (wanted.has(id)) result[id] = p;
    return result;
  }

  async save(progress: CardProgress): Promise<void> {
    const all = readLocalProgress(this.storage);
    all[progress.card_id] = progress;
    writeLocalProgress(this.storage, all);
  }

  async resetDeck(_deckId: string, cardIds: readonly string[]): Promise<void> {
    const all = readLocalProgress(this.storage);
    const ids = new Set(cardIds);
    for (const id of cardIds) delete all[id];
    writeLocalProgress(this.storage, all);
    writeLocalReviews(
      this.storage,
      readLocalReviews(this.storage).filter((r) => !ids.has(r.card_id)),
    );
  }

  async resetAll(): Promise<void> {
    clearLocalProgress(this.storage);
    clearLocalReviews(this.storage);
  }

  async resetSchedule(_deckId: string | null, cardIds: readonly string[] | null): Promise<void> {
    const all = readLocalProgress(this.storage);
    const now = new Date();
    const ids = cardIds ?? Object.keys(all);
    for (const id of ids) {
      const p = all[id];
      if (p) all[id] = resetScheduleKeepRating(p, now);
    }
    writeLocalProgress(this.storage, all);
  }

  async logSession(): Promise<void> {
    // Gäster loggar inga sessioner.
  }

  async loadReviews(cardIds: readonly string[]): Promise<ReviewEntry[]> {
    const wanted = new Set(cardIds);
    return readLocalReviews(this.storage)
      .filter((r) => wanted.has(r.card_id))
      .sort(byTime);
  }

  async logReview(entry: ReviewEntry): Promise<void> {
    appendLocalReview(this.storage, entry);
  }
}

type Client = SupabaseClient<Database>;

export class SupabaseProgressStore implements ProgressStore {
  readonly kind = "account" as const;
  constructor(
    private readonly supabase: Client,
    private readonly userId: string,
  ) {}

  async load(cardIds: readonly string[]): Promise<ProgressMap> {
    if (cardIds.length === 0) return {};
    const result: ProgressMap = {};
    // Håll in-listan rimlig i storlek.
    for (let i = 0; i < cardIds.length; i += 200) {
      const chunk = cardIds.slice(i, i + 200);
      const { data, error } = await this.supabase
        .from("card_progress")
        .select("*")
        .eq("user_id", this.userId)
        .in("card_id", chunk);
      if (error) throw error;
      for (const row of data ?? []) result[row.card_id] = rowToProgress(row);
    }
    return result;
  }

  async save(progress: CardProgress): Promise<void> {
    const { error } = await this.supabase
      .from("card_progress")
      .upsert({ user_id: this.userId, ...progress }, { onConflict: "user_id,card_id" });
    if (error) throw error;
  }

  async saveMany(items: readonly CardProgress[]): Promise<void> {
    if (items.length === 0) return;
    const rows = items.map((p) => ({ user_id: this.userId, ...p }));
    const { error } = await this.supabase.from("card_progress").upsert(rows, { onConflict: "user_id,card_id" });
    if (error) throw error;
  }

  async resetDeck(deckId: string): Promise<void> {
    const { error } = await this.supabase.rpc("reset_deck_progress", { p_deck_id: deckId });
    if (error) throw error;
  }

  async resetAll(): Promise<void> {
    const { error } = await this.supabase.rpc("reset_all_progress");
    if (error) throw error;
  }

  async resetSchedule(deckId: string | null): Promise<void> {
    const { error } = await this.supabase.rpc("reset_schedule_keep_ratings", { p_deck_id: deckId });
    if (error) throw error;
  }

  async logSession(input: { deckId: string; mode: StudyMode; startedAt: Date; cardsReviewed: number }): Promise<void> {
    const { error } = await this.supabase.from("study_sessions").insert({
      user_id: this.userId,
      deck_id: input.deckId,
      mode: input.mode,
      started_at: input.startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      cards_reviewed: input.cardsReviewed,
    });
    if (error) throw error;
  }

  async loadReviews(cardIds: readonly string[]): Promise<ReviewEntry[]> {
    if (cardIds.length === 0) return [];
    const result: ReviewEntry[] = [];
    for (let i = 0; i < cardIds.length; i += 200) {
      const chunk = cardIds.slice(i, i + 200);
      const { data, error } = await this.supabase
        .from("review_log")
        .select("card_id, rating, mode, reviewed_at")
        .eq("user_id", this.userId)
        .in("card_id", chunk)
        .order("reviewed_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      for (const row of data ?? []) {
        if (isSelfRating(row.rating) && isStudyMode(row.mode)) {
          result.push({ card_id: row.card_id, rating: row.rating, mode: row.mode, reviewed_at: row.reviewed_at });
        }
      }
    }
    return result.sort(byTime);
  }

  async logReview(entry: ReviewEntry): Promise<void> {
    const { error } = await this.supabase.from("review_log").insert({ user_id: this.userId, ...entry });
    if (error) throw error;
  }

  async logReviews(entries: readonly ReviewEntry[]): Promise<void> {
    for (let i = 0; i < entries.length; i += 500) {
      const rows = entries.slice(i, i + 500).map((e) => ({ user_id: this.userId, ...e }));
      const { error } = await this.supabase.from("review_log").insert(rows);
      if (error) throw error;
    }
  }
}

function rowToProgress(row: Database["public"]["Tables"]["card_progress"]["Row"]): CardProgress {
  return {
    card_id: row.card_id,
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: (row.state >= 0 && row.state <= 3 ? row.state : 0) as CardProgress["state"],
    last_review: row.last_review,
    self_rating: row.self_rating === null ? null : (row.self_rating as CardProgress["self_rating"]),
  };
}

/**
 * Flyttar all lokal progress och historik till kontot. Vid konflikt vinner
 * senast last_review. Rensar localStorage när allt är skrivet.
 * Returnerar antal flyttade kort.
 */
export async function migrateLocalProgressToAccount(storage: Storage, supabase: Client, userId: string): Promise<number> {
  const reviews = readLocalReviews(storage);
  if (!hasLocalProgress(storage) && reviews.length === 0) return 0;
  const local = readLocalProgress(storage);
  const store = new SupabaseProgressStore(supabase, userId);
  const remote = await store.load(Object.keys(local));
  const { toUpsert } = mergeProgress(local, remote);
  await store.saveMany(toUpsert);
  await store.logReviews(reviews);
  clearLocalProgress(storage);
  clearLocalReviews(storage);
  return toUpsert.length;
}
