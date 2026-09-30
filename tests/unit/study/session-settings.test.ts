import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  filterKinds,
  parseSessionSettings,
  readStoredSettings,
  sanitizeSettings,
  SETTINGS_STORAGE_KEY,
  settingsQuery,
  writeStoredSettings,
  type SessionSettings,
  type SettingsMode,
} from "@/lib/study/session-settings";
import { DEFAULT_DUGGA } from "@/lib/study/dugga";
import { selectCardIds, type SelectableCard } from "@/lib/study/selection";
import { planDeckSession } from "@/lib/study/deck-plan";
import { buildSessionResult } from "@/lib/study/session-result";
import type { CardProgress, ProgressMap, SelfRating } from "@/lib/progress/types";

const NOW = new Date("2026-09-20T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const keepOrder = () => 0.999999;

function rated(cardId: string, rating: SelfRating, dueInDays: number): CardProgress {
  return {
    card_id: cardId,
    due: new Date(NOW.getTime() + dueInDays * DAY).toISOString(),
    stability: 10,
    difficulty: 5,
    elapsed_days: 1,
    scheduled_days: 1,
    reps: 2,
    lapses: 0,
    state: 2,
    last_review: new Date(NOW.getTime() - 2 * DAY).toISOString(),
    self_rating: rating,
  };
}

/** 12 kort: 6 i k1 (vändkort), 6 i k2 (flerval), omväxlande i kursens ordning. */
const cards: SelectableCard[] = Array.from({ length: 12 }, (_, i) => ({
  id: `c${i}`,
  category_id: i % 2 === 0 ? "k1" : "k2",
  sort_order: i,
  kind: i % 2 === 0 ? "sjalvskattning" : "alternativ",
}));

const with_ = (mode: SettingsMode, patch: Partial<SessionSettings>): SessionSettings => ({ ...defaultSettings(mode), ...patch });

describe("session-settings: adressen", () => {
  it("standardvalen ger ingen extra parameter, utom duggans regler", () => {
    for (const mode of ["fsrs", "tricky", "free", "random", "starred"] as const) {
      expect(settingsQuery(mode, defaultSettings(mode))).toBe("");
    }
    expect(settingsQuery("exam", defaultSettings("exam"))).toBe("&antal=20&ledtradar=0&tid=1");
    expect(defaultSettings("exam")).toMatchObject(DEFAULT_DUGGA);
  });

  it("läser och skriver samma inställningar för varje läge", () => {
    const cases: [SettingsMode, Partial<SessionSettings>][] = [
      ["fsrs", { size: 10, newCards: false, order: "omrade", hints: false }],
      ["tricky", { size: 20, order: "slump", unseen: false }],
      ["free", { size: 30, order: "kurs", kinds: "flerval" }],
      ["random", { size: 10, kinds: "vand", followAreas: true }],
      ["exam", { size: "alla", hints: true, timer: false }],
      ["starred", { order: "slump", size: 10 }],
    ];
    for (const [mode, patch] of cases) {
      const s = with_(mode, patch);
      const query = Object.fromEntries(new URLSearchParams(settingsQuery(mode, s).slice(1)));
      expect(parseSessionSettings(mode, query)).toEqual(s);
    }
  });

  it("inställningar som läget inte har får standardvärdet", () => {
    // Uppgiftstyper finns inte i schemalagt läge, osedda kort bara i kluriga.
    const s = parseSessionSettings("fsrs", { typer: "flerval", osedda: "0", ordning: "slump" });
    expect(s).toEqual(defaultSettings("fsrs"));
    expect(settingsQuery("fsrs", with_("fsrs", { kinds: "flerval" }))).toBe("");
  });

  it("okända värden faller tillbaka på standard", () => {
    expect(parseSessionSettings("free", { antal: "999", ordning: "baklänges", typer: "x" })).toEqual(defaultSettings("free"));
    expect(sanitizeSettings("tricky", { size: 7, order: "kurs", hints: "ja" })).toEqual(defaultSettings("tricky"));
    expect(sanitizeSettings("free", null)).toEqual(defaultSettings("free"));
  });
});

describe("session-settings: webbläsarens lagring", () => {
  it("sparar och läser valen per läge", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const all = readStoredSettings(storage);
    expect(all.free).toEqual(defaultSettings("free"));
    writeStoredSettings(storage, { ...all, free: with_("free", { size: 10, order: "slump" }) });
    expect(JSON.parse(store.get(SETTINGS_STORAGE_KEY) ?? "{}").free.size).toBe(10);
    const again = readStoredSettings(storage);
    expect(again.free).toEqual(with_("free", { size: 10, order: "slump" }));
    expect(again.exam).toEqual(defaultSettings("exam"));
  });

  it("trasig eller otillgänglig lagring ger standardvärden och kastar aldrig", () => {
    expect(readStoredSettings({ getItem: () => "{inte json" }).fsrs).toEqual(defaultSettings("fsrs"));
    expect(
      readStoredSettings({
        getItem: () => {
          throw new Error("SecurityError");
        },
      }).tricky,
    ).toEqual(defaultSettings("tricky"));
    expect(() =>
      writeStoredSettings(
        {
          setItem: () => {
            throw new Error("QuotaExceeded");
          },
        },
        readStoredSettings(null),
      ),
    ).not.toThrow();
  });
});

describe("selectCardIds med inställningar", () => {
  it("utan inställningar och med standardinställningar blir kön densamma", () => {
    const progress: ProgressMap = { c0: rated("c0", 1, -1), c1: rated("c1", 4, -2), c2: rated("c2", 5, 3) };
    for (const mode of ["fsrs", "tricky", "free", "random", "exam"] as const) {
      const base = { cards, progress, mode, selection: { kind: "all" as const }, now: NOW, random: keepOrder };
      const withDefaults = selectCardIds({ ...base, settings: defaultSettings(mode), examSize: mode === "exam" ? 30 : undefined });
      expect(withDefaults).toEqual(selectCardIds(base));
    }
  });

  it("antal kort: taket tas efter ordningen", () => {
    const free = selectCardIds({ cards, progress: {}, mode: "free", selection: { kind: "all" }, random: keepOrder, settings: with_("free", { size: 10 }) });
    expect(free).toHaveLength(10);
    // Schemalagt: förfallna kort kommer först och är de som blir kvar under taket.
    const progress: ProgressMap = { c11: rated("c11", 3, -1), c10: rated("c10", 3, -3) };
    const fsrs = selectCardIds({ cards, progress, mode: "fsrs", selection: { kind: "all" }, now: NOW, random: keepOrder, settings: with_("fsrs", { size: 10 }) });
    expect(fsrs).toHaveLength(10);
    expect(fsrs.slice(0, 2)).toEqual(["c10", "c11"]);
  });

  it("schemalagt utan nya kort: bara repetitioner, även i Plugga vidare", () => {
    const progress: ProgressMap = { c0: rated("c0", 3, -1), c1: rated("c1", 4, 5) };
    const base = { cards, progress, mode: "fsrs" as const, selection: { kind: "all" as const }, now: NOW, random: keepOrder, settings: with_("fsrs", { newCards: false }) };
    expect(selectCardIds({ ...base, maxNew: 20 })).toEqual(["c0"]);
    expect(selectCardIds({ ...base, extraSize: 20 }).sort()).toEqual(["c0", "c1"]);
  });

  it("schemalagt ett område i taget: områdena i kursens ordning", () => {
    const ids = selectCardIds({ cards, progress: {}, mode: "fsrs", selection: { kind: "all" }, now: NOW, random: Math.random, maxNew: 12, settings: with_("fsrs", { order: "omrade" }) });
    const areas = ids.map((id) => cards.find((c) => c.id === id)?.category_id);
    expect(areas).toEqual([...Array(6).fill("k1"), ...Array(6).fill("k2")]);
  });

  it("kluriga: svåraste först eller slumpat, med eller utan osedda kort", () => {
    const progress: ProgressMap = { c0: rated("c0", 2, 1), c1: rated("c1", 1, 1), c2: rated("c2", 5, 1) };
    const base = { cards, progress, mode: "tricky" as const, selection: { kind: "all" as const }, random: keepOrder };
    const hardest = selectCardIds({ ...base, settings: defaultSettings("tricky") });
    expect(hardest.slice(0, 2)).toEqual(["c1", "c0"]);
    expect(hardest).toHaveLength(11);
    expect(selectCardIds({ ...base, settings: with_("tricky", { unseen: false }) })).toEqual(["c1", "c0"]);
    expect(selectCardIds({ ...base, settings: with_("tricky", { unseen: false, order: "slump" }) }).sort()).toEqual(["c0", "c1"]);
  });

  it("fri repetition: kursordning och uppgiftstyper", () => {
    const progress: ProgressMap = { c3: rated("c3", 1, 1) };
    const base = { cards, progress, mode: "free" as const, selection: { kind: "all" as const }, random: keepOrder };
    expect(selectCardIds({ ...base, settings: with_("free", { order: "kurs" }) })).toEqual(cards.map((c) => c.id));
    expect(selectCardIds({ ...base, settings: with_("free", { order: "kurs", kinds: "flerval" }) })).toEqual(["c1", "c3", "c5", "c7", "c9", "c11"]);
    expect(selectCardIds({ ...base, settings: with_("free", { order: "kurs", kinds: "vand", size: 10 }) })).toEqual(["c0", "c2", "c4", "c6", "c8", "c10"]);
    // Svagast först (standard): kortet skattat 1 först.
    expect(selectCardIds({ ...base, settings: defaultSettings("free") })[0]).toBe("c3");
  });

  it("slumpad genomkörning: hela kursen, eller bara valda områden", () => {
    const base = { cards, progress: {}, mode: "random" as const, selection: { kind: "categories" as const, categoryIds: ["k1"] }, random: keepOrder };
    expect(selectCardIds({ ...base, settings: defaultSettings("random") })).toHaveLength(12);
    const areas = selectCardIds({ ...base, settings: with_("random", { followAreas: true }) });
    expect(areas).toHaveLength(6);
    expect(areas.every((id) => Number(id.slice(1)) % 2 === 0)).toBe(true);
    const quiz = selectCardIds({ ...base, settings: with_("random", { kinds: "flerval", size: 10 }) });
    expect(quiz).toHaveLength(6);
    expect(quiz.every((id) => Number(id.slice(1)) % 2 === 1)).toBe(true);
  });

  it("dugga: antal frågor ur inställningarna", () => {
    const base = { cards, progress: {}, mode: "exam" as const, selection: { kind: "all" as const }, random: keepOrder };
    expect(selectCardIds({ ...base, settings: with_("exam", { size: 10 }) })).toHaveLength(10);
    expect(selectCardIds({ ...base, settings: with_("exam", { size: "alla" }) })).toHaveLength(12);
  });
});

describe("planDeckSession med inställningar", () => {
  const deck = { slug: "mtt015", exam_date: null };
  const plan = (mode: "fsrs" | "tricky" | "free" | "random" | "exam", settings: SessionSettings, progress: ProgressMap = {}, selectedIds: string[] = []) =>
    planDeckSession({ deck, cards, progress, reviews: [], mode, selectedIds, dailyNew: 20, settings, now: NOW });

  it("antal kort begränsar passet men inte urvalet", () => {
    const p = plan("free", with_("free", { size: 10 }));
    expect(p.selectionCount).toBe(10);
    expect(p.availableCount).toBe(12);
    expect(p.selectionCards).toHaveLength(12);
  });

  it("schemalagt: färre än dagens, och utan nya kort", () => {
    const progress: ProgressMap = { c0: rated("c0", 3, -1), c1: rated("c1", 3, -1) };
    const today = plan("fsrs", defaultSettings("fsrs"), progress);
    expect(today.sessionCards).toBe(12);
    expect(today.availableCount).toBe(12);
    const fewer = plan("fsrs", with_("fsrs", { size: 10 }), progress);
    expect([fewer.sessionDue, fewer.sessionNew, fewer.sessionCards]).toEqual([2, 8, 10]);
    const onlyReviews = plan("fsrs", with_("fsrs", { newCards: false }), progress);
    expect([onlyReviews.sessionDue, onlyReviews.sessionNew, onlyReviews.moreNew]).toEqual([2, 0, 0]);
    // Inget förfallet och inga nya: dagen är klar, Plugga vidare tar bara sedda kort.
    const done = plan("fsrs", with_("fsrs", { newCards: false }), { c0: rated("c0", 3, 2) });
    expect(done.nothingDue).toBe(true);
    expect(done.extraCount).toBe(1);
  });

  it("kluriga utan osedda, uppgiftstyper och områden i slumpläget", () => {
    expect(plan("tricky", with_("tricky", { unseen: false }), { c0: rated("c0", 1, 1) }).selectionCount).toBe(1);
    expect(plan("free", with_("free", { kinds: "flerval" })).selectionCount).toBe(6);
    const random = plan("random", with_("random", { followAreas: true }), {}, ["k2"]);
    expect(random.selectionCount).toBe(6);
    expect(random.startHref).toContain("urval=kategori%3Ak2");
    expect(plan("random", defaultSettings("random"), {}, ["k2"]).startHref).toContain("urval=all");
  });

  it("dugga: antal frågor", () => {
    expect(plan("exam", with_("exam", { size: 10 })).selectionCount).toBe(10);
    expect(plan("exam", with_("exam", { size: "alla" })).selectionCount).toBe(12);
  });
});

describe("buildSessionResult med inställningar", () => {
  it("länkarna vidare behåller inställningarna, och utan nya kort erbjuds inga nya", () => {
    const progress: ProgressMap = { c0: rated("c0", 4, 3) };
    const base = {
      deckSlug: "mtt015",
      cards,
      progress,
      reviews: [],
      selection: { kind: "all" as const },
      dailyNew: 20,
      weekdaysOnly: false,
      finalReview: false,
      now: NOW,
    };
    const withNew = buildSessionResult({ ...base, suffix: "&antal=10", size: 10 });
    expect(withNew.today.extraHref).toContain("&antal=10&pass=1");
    expect(withNew.today.extraCount).toBe(10);
    expect(withNew.today.continueHref).toContain("&nya=10&antal=10");
    const noNew = buildSessionResult({ ...base, suffix: "&nyakort=0", newCards: false });
    expect(noNew.today.continueHref).toBeNull();
    expect(noNew.today.extraCount).toBe(1);
    expect(noNew.today.extraHref).toContain("&nyakort=0");
  });
});

describe("filterKinds", () => {
  it("kort utan typ räknas som vändkort", () => {
    const mixed = [{ id: "a" }, { id: "b", kind: "sant-falskt" as const }];
    expect(filterKinds(mixed, "vand").map((c) => c.id)).toEqual(["a"]);
    expect(filterKinds(mixed, "flerval").map((c) => c.id)).toEqual(["b"]);
    expect(filterKinds(mixed, "alla")).toHaveLength(2);
  });
});
