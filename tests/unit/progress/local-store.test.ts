import { describe, expect, it } from "vitest";
import {
  LOCAL_PROGRESS_KEY,
  clearLocalProgress,
  hasLocalProgress,
  readLocalProgress,
  upsertLocalProgress,
  writeLocalProgress,
} from "@/lib/progress/local-store";
import { LocalProgressStore } from "@/lib/progress/store";
import { reviewCard } from "@/lib/fsrs/scheduler";
import { applyRating } from "@/lib/fsrs/apply-rating";

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

const NOW = new Date("2026-09-11T08:00:00Z");

describe("localStorage-progress", () => {
  it("skriver och läser tillbaka samma struktur som card_progress", () => {
    const storage = new FakeStorage();
    const p = reviewCard("k1", undefined, 4, NOW);
    upsertLocalProgress(storage, p);
    const all = readLocalProgress(storage);
    expect(all).toEqual({ k1: p });
    expect(Object.keys(all.k1 ?? {}).sort()).toEqual(
      ["card_id", "due", "stability", "difficulty", "elapsed_days", "scheduled_days", "reps", "lapses", "state", "last_review", "self_rating"].sort(),
    );
    expect(hasLocalProgress(storage)).toBe(true);
    clearLocalProgress(storage);
    expect(hasLocalProgress(storage)).toBe(false);
  });

  it("ignorerar trasig JSON och ogiltiga poster", () => {
    const storage = new FakeStorage();
    storage.setItem(LOCAL_PROGRESS_KEY, "{ trasig");
    expect(readLocalProgress(storage)).toEqual({});
    const good = reviewCard("ok", undefined, 5, NOW);
    storage.setItem(
      LOCAL_PROGRESS_KEY,
      JSON.stringify({ version: 1, cards: { ok: good, bad: { card_id: "bad", due: "igår" }, fel: { ...good, card_id: "annan" } } }),
    );
    expect(readLocalProgress(storage)).toEqual({ ok: good });
  });

  it("tål en storage som kastar", () => {
    const broken = {
      getItem: () => {
        throw new Error("blockerad");
      },
      setItem: () => {
        throw new Error("blockerad");
      },
      removeItem: () => {
        throw new Error("blockerad");
      },
    };
    expect(readLocalProgress(broken)).toEqual({});
    expect(() => writeLocalProgress(broken, {})).not.toThrow();
    expect(() => clearLocalProgress(broken)).not.toThrow();
  });
});

describe("LocalProgressStore", () => {
  it("laddar bara efterfrågade kort, nollställer deck och schema", async () => {
    const storage = new FakeStorage();
    const store = new LocalProgressStore(storage);
    await store.save(reviewCard("a", undefined, 2, NOW));
    await store.save(reviewCard("b", undefined, 5, NOW));
    await store.save(reviewCard("c", undefined, 3, NOW));

    expect(Object.keys(await store.load(["a", "b"])).sort()).toEqual(["a", "b"]);

    await store.resetSchedule(["a"]);
    const afterSchedule = await store.load(["a"]);
    expect(afterSchedule.a?.state).toBe(0);
    expect(afterSchedule.a?.self_rating).toBe(2);

    await store.resetCards(["a", "b"]);
    expect(Object.keys(await store.load(["a", "b", "c"]))).toEqual(["c"]);

    await store.resetAll();
    expect(await store.load(["c"])).toEqual({});
  });

  it("fri repetition lämnar lagret orört", async () => {
    const storage = new FakeStorage();
    const store = new LocalProgressStore(storage);
    await store.save(reviewCard("a", undefined, 5, NOW));
    const snapshot = storage.getItem(LOCAL_PROGRESS_KEY);

    const progress = await store.load(["a", "b"]);
    for (const cardId of ["a", "b"]) {
      const next = applyRating({ mode: "free", cardId, rating: 1, progress, now: NOW });
      if (next) await store.save(next);
    }
    expect(storage.getItem(LOCAL_PROGRESS_KEY)).toBe(snapshot);
  });
});
