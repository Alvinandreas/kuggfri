/**
 * Tillstånd för en studiesession. Ren reducer utan sidoeffekter.
 * Själva schemaläggningen (FSRS) och lagringen sköts utanför.
 */
import type { SelfRating, StudyMode } from "@/lib/progress/types";

export type SessionState = {
  mode: StudyMode;
  /** Kort-id i den ordning de visas. Kan växa när kort läggs tillbaka i kön. */
  order: string[];
  /** Index i order för det kort som visas nu. */
  position: number;
  /** Alla skattningar per kort under sessionen, i tidsordning. */
  ratings: Record<string, SelfRating[]>;
  finished: boolean;
};

export function createSession(cardIds: readonly string[], mode: StudyMode): SessionState {
  return {
    mode,
    order: [...cardIds],
    position: 0,
    ratings: {},
    finished: cardIds.length === 0,
  };
}

export function currentCardId(state: SessionState): string | null {
  if (state.finished) return null;
  return state.order[state.position] ?? null;
}

export function remaining(state: SessionState): number {
  if (state.finished) return 0;
  return Math.max(0, state.order.length - state.position);
}

/** Kort som redan ligger senare i kön ska inte läggas till igen. */
function isQueuedLater(state: SessionState, cardId: string): boolean {
  return state.order.indexOf(cardId, state.position + 1) !== -1;
}

function advance(state: SessionState): SessionState {
  const position = state.position + 1;
  if (position >= state.order.length) {
    return { ...state, position: state.order.length, finished: true };
  }
  return { ...state, position };
}

/**
 * Skattar aktuellt kort och går vidare. I schemalagt läge läggs kort med
 * skattning 1–2 tillbaka sist i kön så att de ses igen innan sessionen är slut.
 */
export function rateCurrent(state: SessionState, rating: SelfRating): SessionState {
  const id = currentCardId(state);
  if (!id) return state;
  const ratings = { ...state.ratings, [id]: [...(state.ratings[id] ?? []), rating] };
  let order = state.order;
  if (state.mode === "fsrs" && rating <= 2 && !isQueuedLater(state, id)) {
    order = [...order, id];
  }
  return advance({ ...state, ratings, order });
}

/** Nästa kort utan skattning. I schemalagt läge hamnar kortet sist i kön i stället för att försvinna. */
export function skipCurrent(state: SessionState): SessionState {
  const id = currentCardId(state);
  if (!id) return state;
  if (state.mode === "fsrs" && !isQueuedLater(state, id)) {
    // Ett kort som är ensamt kvar kan inte hoppas över.
    if (state.order.length - state.position <= 1) return state;
    return advance({ ...state, order: [...state.order, id] });
  }
  return advance(state);
}

export function goPrevious(state: SessionState): SessionState {
  if (state.position === 0) return state;
  const position = state.finished ? state.order.length - 1 : state.position - 1;
  return { ...state, position, finished: false };
}

export function canGoPrevious(state: SessionState): boolean {
  return state.position > 0;
}

export type RatingDistribution = Record<SelfRating, number>;

export type SessionSummary = {
  /** Antal unika kort som fått minst en skattning. */
  reviewed: number;
  /** Fördelning av senaste skattningen per kort. */
  distribution: RatingDistribution;
  /** Kort vars senaste skattning var 1–2, sämst först, därefter kort med 3. */
  needsWork: { cardId: string; rating: SelfRating }[];
};

export function summarize(state: SessionState): SessionSummary {
  const distribution: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const needsWork: { cardId: string; rating: SelfRating }[] = [];
  let reviewed = 0;
  for (const [cardId, list] of Object.entries(state.ratings)) {
    const last = list[list.length - 1];
    if (!last) continue;
    reviewed++;
    distribution[last]++;
    if (last <= 3) needsWork.push({ cardId, rating: last });
  }
  needsWork.sort((a, b) => a.rating - b.rating);
  return { reviewed, distribution, needsWork };
}

/** Fisher–Yates med valfri slumpkälla (för testbarhet). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = a;
  }
  return arr;
}
