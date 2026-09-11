import { describe, expect, it } from "vitest";
import {
  canGoPrevious,
  createSession,
  currentCardId,
  goPrevious,
  rateCurrent,
  remaining,
  shuffle,
  skipCurrent,
  summarize,
} from "@/lib/fsrs/session";

describe("session", () => {
  it("startar på första kortet och räknar kvarvarande", () => {
    const s = createSession(["a", "b", "c"], "free");
    expect(currentCardId(s)).toBe("a");
    expect(remaining(s)).toBe(3);
    expect(s.finished).toBe(false);
    expect(createSession([], "free").finished).toBe(true);
  });

  it("skattning går vidare och avslutar efter sista kortet", () => {
    let s = createSession(["a", "b"], "free");
    s = rateCurrent(s, 4);
    expect(currentCardId(s)).toBe("b");
    expect(remaining(s)).toBe(1);
    s = rateCurrent(s, 2);
    expect(s.finished).toBe(true);
    expect(currentCardId(s)).toBeNull();
    expect(remaining(s)).toBe(0);
  });

  it("i schemalagt läge läggs kort med skattning 1–2 tillbaka sist i kön", () => {
    let s = createSession(["a", "b"], "fsrs");
    s = rateCurrent(s, 1);
    expect(s.order).toEqual(["a", "b", "a"]);
    expect(remaining(s)).toBe(2);
    s = rateCurrent(s, 5);
    expect(currentCardId(s)).toBe("a");
    s = rateCurrent(s, 2); // a redan sist? nej, a är nu aktuellt och läggs tillbaka igen
    expect(s.order).toEqual(["a", "b", "a", "a"]);
    s = rateCurrent(s, 4);
    expect(s.finished).toBe(true);
    expect(s.ratings.a).toEqual([1, 2, 4]);
  });

  it("lägger inte tillbaka ett kort som redan ligger senare i kön", () => {
    let s = createSession(["a", "b", "a"], "fsrs");
    s = rateCurrent(s, 1);
    expect(s.order).toEqual(["a", "b", "a"]);
  });

  it("i fri repetition läggs inget tillbaka", () => {
    let s = createSession(["a", "b"], "free");
    s = rateCurrent(s, 1);
    expect(s.order).toEqual(["a", "b"]);
  });

  it("hoppa över flyttar kortet sist i schemalagt läge och bara vidare i fritt läge", () => {
    let f = createSession(["a", "b"], "fsrs");
    f = skipCurrent(f);
    expect(f.order).toEqual(["a", "b", "a"]);
    expect(currentCardId(f)).toBe("b");
    // Sista kortet kan inte hoppas över i schemalagt läge.
    let last = createSession(["x"], "fsrs");
    last = skipCurrent(last);
    expect(currentCardId(last)).toBe("x");

    let free = createSession(["a", "b"], "free");
    free = skipCurrent(free);
    expect(free.order).toEqual(["a", "b"]);
    expect(currentCardId(free)).toBe("b");
    free = skipCurrent(free);
    expect(free.finished).toBe(true);
  });

  it("föregående går tillbaka, även från avslutad session", () => {
    let s = createSession(["a", "b"], "free");
    expect(canGoPrevious(s)).toBe(false);
    s = rateCurrent(s, 3);
    expect(canGoPrevious(s)).toBe(true);
    s = goPrevious(s);
    expect(currentCardId(s)).toBe("a");
    s = rateCurrent(s, 5);
    s = rateCurrent(s, 5);
    expect(s.finished).toBe(true);
    s = goPrevious(s);
    expect(s.finished).toBe(false);
    expect(currentCardId(s)).toBe("b");
  });

  it("sammanfattar med senaste skattningen per kort", () => {
    let s = createSession(["a", "b", "c", "d"], "fsrs");
    s = rateCurrent(s, 1); // a
    s = rateCurrent(s, 5); // b
    s = rateCurrent(s, 3); // c
    s = rateCurrent(s, 4); // d
    s = rateCurrent(s, 2); // a igen
    const sum = summarize(s);
    expect(sum.reviewed).toBe(4);
    expect(sum.distribution).toEqual({ 1: 0, 2: 1, 3: 1, 4: 1, 5: 1 });
    expect(sum.needsWork).toEqual([
      { cardId: "a", rating: 2 },
      { cardId: "c", rating: 3 },
    ]);
  });

  it("shuffle är deterministisk med given slumpkälla och behåller alla element", () => {
    const seq = [0.1, 0.9, 0.5, 0.3, 0.7];
    let i = 0;
    const random = () => seq[i++ % seq.length] ?? 0;
    const out = shuffle(["a", "b", "c", "d", "e"], random);
    expect([...out].sort()).toEqual(["a", "b", "c", "d", "e"]);
    i = 0;
    expect(shuffle(["a", "b", "c", "d", "e"], random)).toEqual(out);
  });
});
