import { describe, expect, it } from "vitest";
import { countCourse, diffCourses, findUtgava, restoreCards, restoreCourse, utgavaId, type Utgava } from "../../../scripts/utgavor";
import type { ContentCard, ContentCourse } from "@/lib/content/model";

function card(key: string, extra: Partial<ContentCard> = {}): ContentCard {
  return { key, front: key, back: "b", hint: null, active: true, kind: "sjalvskattning", options: null, review: null, source: null, original: false, flag: null, ...extra };
}

function course(areas: { key: string; cards: ContentCard[] }[], title = "Kurs"): ContentCourse {
  return {
    key: "kurs",
    title,
    description: null,
    course_code: null,
    source_credit: null,
    exam_date: null,
    published: true,
    sort_order: 0,
    categories: areas.map((a, i) => ({ key: a.key, title: a.key, file: `0${i + 1}-${a.key}.md`, cards: a.cards })),
  };
}

// Originalet: två kort i område a.
const original = course([{ key: "a", cards: [card("k1", { back: "gammalt" }), card("k2")] }]);
// I dag: k1 rättat till utkast och originalmarkerat, k2 flyttat till nytt område b, nytt utkast k3.
const today = course(
  [
    { key: "a", cards: [card("k1", { back: "rättat", active: false, review: "utkast", original: true })] },
    { key: "b", cards: [card("k2", { original: true }), card("k3", { active: false, review: "utkast" })] },
  ],
  "Kurs med ny titel",
);

describe("utgåvor", () => {
  it("återställer hela kursens kort men behåller kursuppgifter och originalmarkering", () => {
    const next = restoreCourse(today, original);
    expect(next.title).toBe("Kurs med ny titel");
    const a = next.categories.find((c) => c.key === "a");
    expect(a?.cards.map((c) => c.key)).toEqual(["k1", "k2"]);
    expect(a?.cards[0]).toMatchObject({ back: "gammalt", active: true, review: null, original: true });
    expect(a?.cards[1]?.original).toBe(true);
  });

  it("raderar inget: kort som tillkommit efter utgåvan blir kvar men inaktiva", () => {
    const next = restoreCourse(today, original);
    const b = next.categories.find((c) => c.key === "b");
    expect(b?.cards.map((c) => c.key)).toEqual(["k3"]);
    expect(b?.cards[0]).toMatchObject({ active: false, review: "utkast" });
  });

  it("återställer enstaka kort och flyttar dem till utgåvans område om det finns", () => {
    const next = restoreCards(today, original, ["k2"]);
    expect(next.categories.find((c) => c.key === "a")?.cards.map((c) => c.key)).toEqual(["k1", "k2"]);
    expect(next.categories.find((c) => c.key === "b")?.cards.map((c) => c.key)).toEqual(["k3"]);
    // k1 är orört.
    expect(next.categories[0]?.cards[0]?.back).toBe("rättat");
  });

  it("behåller kortets plats när området är detsamma", () => {
    const next = restoreCards(today, original, ["k1"]);
    expect(next.categories[0]?.cards[0]).toMatchObject({ key: "k1", back: "gammalt", active: true, original: true });
    expect(() => restoreCards(today, original, ["k3"])).toThrow(/Finns inte i utgåvan/);
  });

  it("räknar, jämför och hittar utgåvor", () => {
    expect(countCourse(today)).toEqual({ kort: 3, aktiva: 1, utkast: 2, inaktiva: 0, original: 2 });
    const d = diffCourses(today, original);
    expect(d.andrade.sort()).toEqual(["k1", "k2"]);
    expect(d.baraI).toEqual(["k3"]);
    const id = utgavaId(new Date(2026, 8, 28, 23, 5, 9), "prod");
    expect(id).toBe("2026-09-28-230509-prod");
    const u = (x: string) => ({ id: x }) as Utgava;
    const all = [u("2026-09-28-2305-prod"), u("2026-09-29-0800-prod")];
    expect(findUtgava(all, "2026-09-29").id).toBe("2026-09-29-0800-prod");
    expect(() => findUtgava(all, "2026-09")).toThrow(/flera/);
  });
});
