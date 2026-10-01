import { describe, expect, it } from "vitest";
import { E2E_USER_EMAIL, isE2eDeck, isLocalSupabase } from "../../e2e/cleanup";
import { ACTIVE_ADMIN_COURSE_SLUG, pickActiveAdminCourse } from "@/lib/admin/active-course";

const deck = (slug: string, title: string, id = "1fd9bb0d-b779-540f-bbbd-604e02cdaf6b") => ({ id, slug, title });

describe("E2E-städningen", () => {
  it("tar bara testernas egna studenter, aldrig seed-kontona eller det visuella testets konton", () => {
    expect(E2E_USER_EMAIL.test("plugg-1790831883590-731252@kuggfri.test")).toBe(true);
    expect(E2E_USER_EMAIL.test("e2e-1790831883590-1@kuggfri.test")).toBe(true);
    expect(E2E_USER_EMAIL.test("konto-mobile-1789378988086@kuggfri.test")).toBe(false);
    expect(E2E_USER_EMAIL.test("admin@kuggfri.test")).toBe(false);
    expect(E2E_USER_EMAIL.test("visual-student@kuggfri.test")).toBe(false);
    expect(E2E_USER_EMAIL.test("plugg-1790831883590-731252@chalmers.se")).toBe(false);
  });

  it("känner igen kurser som testerna skapat", () => {
    expect(isE2eDeck(deck("e2e-deck-123", "Något"))).toBe(true);
    expect(isE2eDeck(deck("en-kurs", "E2E-deck 123"))).toBe(true);
    expect(isE2eDeck(deck("fast-id", "Fast id", "00000000-0000-4000-8000-0000000e0001"))).toBe(true);
  });

  it("rör aldrig Materialteknik eller vanliga kurser", () => {
    expect(isE2eDeck(deck("materialteknik", "E2E Materialteknik"))).toBe(false);
    expect(isE2eDeck(deck("materialteknik", "Materialteknik", "00000000-0000-4000-8000-0000000e0001"))).toBe(false);
    expect(isE2eDeck(deck("hallfasthetslara", "Hållfasthetslära"))).toBe(false);
  });

  it("städar bara en lokal Supabase", () => {
    expect(isLocalSupabase("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabase("http://localhost:54321")).toBe(true);
    expect(isLocalSupabase("https://abcdefgh.supabase.co")).toBe(false);
    expect(isLocalSupabase("inte en adress")).toBe(false);
  });
});

describe("adminvyns låsta kurs", () => {
  it("är Materialteknik även när andra kurser kommer först", () => {
    const decks = [deck("e2e-deck-1", "E2E-deck 1", "a"), deck(ACTIVE_ADMIN_COURSE_SLUG, "Materialteknik", "b")];
    expect(ACTIVE_ADMIN_COURSE_SLUG).toBe("materialteknik");
    expect(pickActiveAdminCourse(decks, "forsta")?.id).toBe("b");
    expect(pickActiveAdminCourse(decks, "enda")?.id).toBe("b");
  });

  it("sidomenyn faller tillbaka på den första kursen för den som inte får redigera Materialteknik", () => {
    expect(pickActiveAdminCourse([deck("annan", "Annan", "c")], "forsta")?.id).toBe("c");
    expect(pickActiveAdminCourse([deck("annan", "Annan", "c"), deck("tredje", "Tredje", "d")], "forsta")?.id).toBe("c");
    expect(pickActiveAdminCourse([], "forsta")).toBeUndefined();
  });

  it("ingången /admin faller tillbaka bara när det finns exakt en annan kurs", () => {
    expect(pickActiveAdminCourse([deck("annan", "Annan", "c")], "enda")?.id).toBe("c");
    expect(pickActiveAdminCourse([deck("annan", "Annan", "c"), deck("tredje", "Tredje", "d")], "enda")).toBeUndefined();
    expect(pickActiveAdminCourse([], "enda")).toBeUndefined();
  });
});
