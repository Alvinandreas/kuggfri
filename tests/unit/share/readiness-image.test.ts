import { describe, expect, it } from "vitest";
import { readinessHeadline, readinessSubline } from "@/lib/share/readiness-image";

const card = { deckTitle: "Materialteknik", share: 0.643, streak: 5, reviewed: 88, total: 144, url: "kuggfri.com/d/materialteknik", date: new Date(2026, 9, 18) };

describe("beredskapsbild", () => {
  it("rubrik och underrad", () => {
    expect(readinessHeadline(card)).toBe("Jag kan 64 % av Materialteknik");
    expect(readinessSubline(card)).toBe("88 av 144 kort repeterade · 5 dagar i rad");
    expect(readinessSubline({ ...card, streak: 0 })).toBe("88 av 144 kort repeterade");
    expect(readinessSubline({ ...card, streak: 1 })).toBe("88 av 144 kort repeterade · 1 dag i rad");
  });
});
