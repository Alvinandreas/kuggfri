/**
 * Tolkar svaret från deck_stats_overview (jsonb) till en typad struktur.
 *
 * Funktionen returnerar `jsonb`, så TypeScript vet ingenting om innehållet. I stället för
 * en cast (som skulle ljuga om att fälten finns) validerar vi här, precis som
 * lib/progress/local-store.ts gör med localStorage. Då kan databasen och koden versioneras
 * oberoende: ett fält som saknas får ett vettigt standardvärde i stället för att krascha.
 */
import type { DeckOverviewStats } from "@/lib/supabase/database.types";

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseOverviewStats(data: unknown, fallbackMinStudents: number): DeckOverviewStats {
  const d = obj(data);
  const activation = d.activation === undefined ? undefined : obj(d.activation);
  const suppressed = obj(d.suppressed);
  return {
    students: num(d.students),
    active_7d: num(d.active_7d),
    reviews_7d: num(d.reviews_7d),
    avg_rating: numOrNull(d.avg_rating),
    open_reports: num(d.open_reports),
    min_students: num(d.min_students) || fallbackMinStudents,
    suppressed: { cards: num(suppressed.cards), categories: num(suppressed.categories) },
    activation: activation
      ? {
          started: num(activation.started),
          first_session_20: num(activation.first_session_20),
          eligible: num(activation.eligible),
          returned_3d: num(activation.returned_3d),
        }
      : undefined,
    rating_dist: arr(d.rating_dist).map((raw) => {
      const r = obj(raw);
      return { rating: num(r.rating), n: num(r.n) };
    }),
    progress_buckets: arr(d.progress_buckets).map((raw) => {
      const b = obj(raw);
      return { bucket: num(b.bucket), students: num(b.students) };
    }),
    weeks: arr(d.weeks).map((raw) => {
      const w = obj(raw);
      return { week: num(w.week), start: str(w.start), students: num(w.students), reviews: num(w.reviews) };
    }),
    categories: arr(d.categories).map((raw) => {
      const c = obj(raw);
      return {
        category_id: str(c.category_id),
        students: num(c.students),
        ratings: num(c.ratings),
        avg: numOrNull(c.avg),
        low: num(c.low),
        learned: num(c.learned),
        partial: num(c.partial),
        studied: num(c.studied),
      };
    }),
    cards: arr(d.cards).map((raw) => {
      const c = obj(raw);
      return {
        card_id: str(c.card_id),
        category_id: c.category_id === null || c.category_id === undefined ? null : str(c.category_id),
        front: str(c.front),
        ratings: num(c.ratings),
        low: num(c.low),
        avg: num(c.avg),
      };
    }),
  };
}
