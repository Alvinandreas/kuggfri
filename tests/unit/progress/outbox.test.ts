import { describe, expect, it } from "vitest";
import { flushOutbox, LOCAL_OUTBOX_KEY, outboxSize, queueProgress, queueReview, readOutbox } from "@/lib/progress/outbox";
import { reviewCard } from "@/lib/fsrs/scheduler";
import type { CardProgress, ReviewEntry } from "@/lib/progress/types";

const NOW = new Date("2026-09-19T10:00:00Z");

function memStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: () => m.get(LOCAL_OUTBOX_KEY) ?? null,
  };
}

const rev = (card: string, at = NOW): ReviewEntry => ({ card_id: card, rating: 4, mode: "fsrs", reviewed_at: at.toISOString() });

describe("utkorg", () => {
  it("köar progress (senaste per kort vinner) och historik i ordning", () => {
    const s = memStorage();
    const a1 = reviewCard("a", undefined, 3, NOW);
    const a2 = reviewCard("a", a1, 5, new Date(NOW.getTime() + 1000));
    queueProgress(s, a1);
    queueProgress(s, a2);
    queueReview(s, rev("a"));
    queueReview(s, rev("a", new Date(NOW.getTime() + 1000)));
    const box = readOutbox(s);
    expect(Object.keys(box.progress)).toEqual(["a"]);
    expect(box.progress.a?.self_rating).toBe(5);
    expect(box.reviews).toHaveLength(2);
    expect(outboxSize(s)).toBe(3);
  });

  it("trasig data ignoreras", () => {
    const s = memStorage({ [LOCAL_OUTBOX_KEY]: "{nej" });
    expect(readOutbox(s)).toEqual({ progress: {}, reviews: [] });
    const s2 = memStorage({ [LOCAL_OUTBOX_KEY]: JSON.stringify({ progress: { a: { card_id: "b" } }, reviews: [{ card_id: "x" }] }) });
    expect(readOutbox(s2)).toEqual({ progress: {}, reviews: [] });
  });

  it("tömmer utkorgen när sändningen lyckas och tar bort nyckeln", async () => {
    const s = memStorage();
    queueProgress(s, reviewCard("a", undefined, 4, NOW));
    queueReview(s, rev("a"));
    const sent: { progress: CardProgress[]; reviews: ReviewEntry[] } = { progress: [], reviews: [] };
    const n = await flushOutbox(s, {
      saveMany: async (items) => void sent.progress.push(...items),
      logReviews: async (items) => void sent.reviews.push(...items),
    });
    expect(n).toBe(2);
    expect(sent.progress).toHaveLength(1);
    expect(sent.reviews).toHaveLength(1);
    expect(s.raw()).toBeNull();
    expect(outboxSize(s)).toBe(0);
  });

  it("behåller allt när sändningen misslyckas", async () => {
    const s = memStorage();
    queueProgress(s, reviewCard("a", undefined, 4, NOW));
    queueReview(s, rev("a"));
    await expect(
      flushOutbox(s, {
        saveMany: async () => {
          throw new Error("nätet borta");
        },
        logReviews: async () => {},
      }),
    ).rejects.toThrow();
    expect(outboxSize(s)).toBe(2);
  });

  it("poster som köas under sändningen ligger kvar efteråt", async () => {
    const s = memStorage();
    queueProgress(s, reviewCard("a", undefined, 4, NOW));
    queueReview(s, rev("a"));
    await flushOutbox(s, {
      saveMany: async () => {
        // Under sändningen: ett nytt kort och en ny historikrad köas.
        queueProgress(s, reviewCard("b", undefined, 2, NOW));
        queueReview(s, rev("b"));
      },
      logReviews: async () => {},
    });
    const box = readOutbox(s);
    expect(Object.keys(box.progress)).toEqual(["b"]);
    expect(box.reviews.map((r) => r.card_id)).toEqual(["b"]);
  });

  it("ingenting att skicka ger 0 utan att anropa mottagaren", async () => {
    const s = memStorage();
    let called = false;
    const n = await flushOutbox(s, {
      saveMany: async () => {
        called = true;
      },
      logReviews: async () => {
        called = true;
      },
    });
    expect(n).toBe(0);
    expect(called).toBe(false);
  });
});
