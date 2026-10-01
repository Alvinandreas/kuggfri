/**
 * Sammanfattningens knappar: antalet i etiketten ska vara exakt det antal kort passet bakom
 * länken får. Länken tolkas som sidan /d/[slug]/plugga tolkar den (parsePassQuery) och kön
 * byggs med samma funktion som passet (buildSessionQueue).
 *
 * Buggen (Alvin 1 okt 2026): "Ta 2 nya kort till" gav 20 kort. Etiketten räknade bara nya kort
 * (min av dagsmål, nya kvar och passets antal), men länken (nya=2) startade ett vanligt
 * schemalagt pass, som först tar alla förfallna kort i urvalet och sedan de två nya. Knappen
 * visades även när dagens kort inte var klara (överhoppade kort, fler förfallna än passets
 * antal, förfallna sedan tidigare dagar), och då blev passet så mycket större.
 */
import { describe, expect, it } from "vitest";
import { buildSessionResult, type TodaySummary } from "@/lib/study/session-result";
import { buildSessionQueue, parsePassQuery } from "@/lib/study/session-queue";
import { defaultSettings, forgetLegacyOnlyOriginal, type SessionSettings } from "@/lib/study/session-settings";
import type { SelectableCard, Selection } from "@/lib/study/selection";
import type { CardProgress, ProgressMap, ReviewEntry } from "@/lib/progress/types";

const NOW = new Date("2026-09-30T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

/** 40 kort i två områden. */
const cards: SelectableCard[] = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, category_id: i % 2 === 0 ? "k1" : "k2", sort_order: i }));

/** Ett repeterat kort som förfaller om `days` dagar (negativt: redan förfallet). */
function scheduled(id: string, days: number, rating: CardProgress["self_rating"] = 4): CardProgress {
  return {
    card_id: id,
    due: new Date(NOW.getTime() + days * DAY).toISOString(),
    stability: 5,
    difficulty: 5,
    elapsed_days: 2,
    scheduled_days: 2,
    reps: 2,
    lapses: 0,
    state: 2,
    last_review: new Date(NOW.getTime() - 2 * DAY).toISOString(),
    self_rating: rating,
  };
}

/** Progress: `due` förfallna kort, `later` kort längre fram, resten nya. */
function progressWith(due: number, later: number): ProgressMap {
  const p: ProgressMap = {};
  cards.slice(0, due).forEach((c) => (p[c.id] = scheduled(c.id, -1, 2)));
  cards.slice(due, due + later).forEach((c) => (p[c.id] = scheduled(c.id, 3)));
  return p;
}

type Fixture = {
  progress: ProgressMap;
  reviews?: ReviewEntry[];
  settings?: SessionSettings;
  selection?: Selection;
  dailyNew?: number;
  examDate?: string | null;
};

function result(f: Fixture, now: Date = NOW): TodaySummary {
  return buildSessionResult({
    deckSlug: "mtt015",
    cards,
    progress: f.progress,
    reviews: f.reviews ?? [],
    selection: f.selection ?? { kind: "all" },
    dailyNew: f.dailyNew ?? 20,
    weekdaysOnly: false,
    finalReview: false,
    settings: f.settings,
    examDate: f.examDate ?? null,
    now,
  }).today;
}

/** Kön som passet bakom länken får: adressen tolkas som sidan gör, kön byggs som passet gör. */
function queueFor(href: string, f: Fixture, now: Date = NOW): string[] {
  const url = new URL(href, "http://localhost");
  const query = Object.fromEntries(url.searchParams.entries());
  const req = parsePassQuery(query);
  return buildSessionQueue({
    cards,
    progress: f.progress,
    reviews: f.reviews ?? [],
    request: req,
    dailyNew: f.dailyNew ?? 20,
    examDate: f.examDate ?? null,
    now,
  }).order;
}

const isNew = (p: ProgressMap, id: string) => !p[id] || p[id]?.state === 0;

describe("buggen: Ta 2 nya kort till gav 20 kort", () => {
  // 38 kort genomgångna förut: 18 förfallna (överhoppade eller kvar från tidigare dagar), 20 längre fram. 2 nya kvar.
  const f: Fixture = { progress: progressWith(18, 20) };

  it("dagen är inte klar: knappen kör de förfallna korten och säger hur många det blir", () => {
    const today = result(f);
    expect(today.done).toBe(false);
    // Förut: "Ta 2 nya kort till" med nya=2, som gav 18 förfallna + 2 nya = 20 kort.
    expect(today.continueHref).toBeNull();
    expect(today.passCount).toBe(20);
    expect(queueFor(today.passHref!, f)).toHaveLength(today.passCount);
  });

  it("passet växer inte även om fler kort hinner förfalla innan man klickar", () => {
    const today = result(f);
    // En timme senare har ytterligare tio kort förfallit.
    const later = { progress: { ...f.progress } };
    cards.slice(18, 28).forEach((c) => (later.progress[c.id] = scheduled(c.id, 0.01)));
    const soon = new Date(NOW.getTime() + 60 * 60 * 1000);
    expect(queueFor(today.passHref!, later, soon)).toHaveLength(today.passCount);
  });
});

describe("Ta N nya kort till", () => {
  it("när dagen är klar: exakt N kort, alla nya", () => {
    const f: Fixture = { progress: progressWith(0, 30) };
    const today = result(f);
    expect(today.done).toBe(true);
    expect(today.passHref).toBeNull();
    expect(today.continueCount).toBe(10);
    const queue = queueFor(today.continueHref!, f);
    expect(queue).toHaveLength(10);
    expect(queue.every((id) => isNew(f.progress, id))).toBe(true);
  });

  it("förfallna kort som dyker upp efteråt tas inte med", () => {
    const f: Fixture = { progress: progressWith(0, 30) };
    const today = result(f);
    const later = { progress: { ...f.progress, c0: scheduled("c0", -0.01) } };
    const queue = queueFor(today.continueHref!, later, new Date(NOW.getTime() + DAY));
    expect(queue).toHaveLength(today.continueCount);
    expect(queue).not.toContain("c0");
  });
});

describe("etikett och pass stämmer för varje knapp", () => {
  const fixtures: [string, Fixture][] = [];
  for (const [due, later] of [
    [0, 0],
    [0, 39],
    [0, 40],
    [2, 30],
    [18, 20],
    [25, 10],
    [40, 0],
  ] as const) {
    for (const size of [10, 20, 30, "alla"] as const) {
      for (const newCards of [true, false]) {
        for (const selection of [{ kind: "all" }, { kind: "categories", categoryIds: ["k2"] }] as Selection[]) {
          fixtures.push([
            `${due} förfallna, ${later} senare, antal ${size}, nya kort ${newCards ? "på" : "av"}, ${selection.kind}`,
            { progress: progressWith(due, later), settings: { ...defaultSettings("fsrs"), size, newCards }, selection },
          ]);
        }
      }
    }
  }
  // Dagsmål delvis gjort i dag, ett lägre dagsmål, och tentaläget (ikappläge och slutrepetition).
  const introduced: ReviewEntry[] = cards.slice(30, 35).map((c) => ({ card_id: c.id, rating: 4, mode: "fsrs", reviewed_at: NOW.toISOString() }));
  const introducedProgress = { ...progressWith(3, 20), ...Object.fromEntries(cards.slice(30, 35).map((c) => [c.id, { ...scheduled(c.id, 2), reps: 1 }])) };
  fixtures.push(["dagsmålet delvis gjort i dag", { progress: introducedProgress, reviews: introduced }]);
  fixtures.push(["lågt dagsmål", { progress: progressWith(5, 10), dailyNew: 10 }]);
  fixtures.push(["tenta om tio dagar (ikappläge)", { progress: progressWith(4, 6), examDate: "2026-10-10" }]);
  fixtures.push(["tenta i övermorgon (slutrepetition)", { progress: progressWith(4, 30), examDate: "2026-10-02" }]);

  for (const [name, f] of fixtures) {
    it(name, () => {
      const today = result(f);
      if (today.passHref) {
        expect(today.passCount).toBeGreaterThan(0);
        expect(queueFor(today.passHref, f), "Kör N kort till").toHaveLength(today.passCount);
      } else {
        expect(today.passCount).toBe(0);
      }
      if (today.continueHref) {
        const queue = queueFor(today.continueHref, f);
        expect(queue, "Ta N nya kort till").toHaveLength(today.continueCount);
        expect(queue.every((id) => isNew(f.progress, id))).toBe(true);
      } else {
        expect(today.continueCount).toBe(0);
      }
      if (today.extraHref) {
        expect(queueFor(today.extraHref, f), "Plugga vidare (N kort till)").toHaveLength(today.extraCount);
      }
      // Knapparna utesluter varandra: Kör N kort till medan dagens kort väntar, annars de andra.
      expect(today.passHref !== null && (today.continueHref !== null || today.extraHref !== null)).toBe(false);
    });
  }
});

describe("det borttagna valet Bara originalkorten", () => {
  it("original=1 i en gammal adress ignoreras", () => {
    const withOld = parsePassQuery({ mode: "fsrs", urval: "all", original: "1" });
    const without = parsePassQuery({ mode: "fsrs", urval: "all" });
    expect(withOld).toEqual(without);
  });

  it("sparade val tas bort ur webbläsaren, andra nycklar lämnas", () => {
    const store = new Map<string, string>([
      ["kuggfri:bara-original:deck-1", "1"],
      ["kuggfri:bara-original:deck-2", "0"],
      ["kuggfri:passinstallningar:v1", "{}"],
      ["kuggfri:prefs:v1", "{}"],
    ]);
    const storage = {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      removeItem: (k: string) => void store.delete(k),
    };
    forgetLegacyOnlyOriginal(storage);
    expect([...store.keys()]).toEqual(["kuggfri:passinstallningar:v1", "kuggfri:prefs:v1"]);
    // Ingen lagring, eller lagring som kastar: inget fel.
    expect(() => forgetLegacyOnlyOriginal(null)).not.toThrow();
    expect(() =>
      forgetLegacyOnlyOriginal({
        get length(): number {
          throw new Error("blockerad");
        },
        key: () => null,
        removeItem: () => undefined,
      }),
    ).not.toThrow();
  });
});
