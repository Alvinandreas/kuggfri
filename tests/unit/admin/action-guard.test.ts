import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Serveråtgärdernas gemensamma skelett (lib/actions/guard.ts, lib/actions/result.ts) och
 * cachetömningen (lib/cache/revalidate.ts). Åtgärderna själva går mot databasen och testas i
 * E2E; här låses att åtkomstkontrollen och felhanteringen ger samma resultat som tidigare
 * try/catch-skelett, och att varje cachetömning träffar exakt samma sökvägar och taggar.
 */

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/content/queries", () => ({ CONTENT_TAG: "content" }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ client: true })) }));
vi.mock("@/lib/admin/access", () => ({
  getAdminContext: vi.fn(),
  canEditDeck: (ctx: { isAdmin: boolean; examinerDeckIds: string[] } | null, deckId: string) =>
    !!ctx && (ctx.isAdmin || ctx.examinerDeckIds.includes(deckId)),
}));

const { revalidatePath, revalidateTag } = await import("next/cache");
const { getAdminContext } = await import("@/lib/admin/access");
const { adminAction, editorAction, runAction } = await import("@/lib/actions/guard");
const { cleanIds, fail, isUuid } = await import("@/lib/actions/result");
const revalidate = await import("@/lib/cache/revalidate");
const { sv } = await import("@/lib/i18n/sv");

const DECK = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";
const ctxMock = vi.mocked(getAdminContext);

/** Alla cacheanrop i ordning, som [funktion, ...argument]. */
function calls() {
  const all = [
    ...vi.mocked(revalidateTag).mock.calls.map((args, i) => ({ order: vi.mocked(revalidateTag).mock.invocationCallOrder[i], call: ["tag", ...args] })),
    ...vi.mocked(revalidatePath).mock.calls.map((args, i) => ({ order: vi.mocked(revalidatePath).mock.invocationCallOrder[i], call: ["path", ...args] })),
  ];
  return all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => c.call);
}

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(revalidateTag).mockClear();
  ctxMock.mockReset();
});

describe("fail", () => {
  it("ger behörighetstexten för forbidden och det allmänna felet för allt annat", () => {
    expect(fail(new Error("forbidden"))).toEqual({ ok: false, error: sv.common.forbiddenBody });
    expect(fail(new Error("något annat"))).toEqual({ ok: false, error: sv.errors.generic });
    expect(fail({ code: "23505", message: "duplicate" })).toEqual({ ok: false, error: sv.errors.generic });
    expect(fail("forbidden")).toEqual({ ok: false, error: sv.common.forbiddenBody });
  });
});

describe("isUuid och cleanIds", () => {
  it("släpper bara igenom strikta uuid:er", () => {
    expect(isUuid(DECK)).toBe(true);
    expect(isUuid(DECK.toUpperCase())).toBe(true);
    expect(isUuid("-".repeat(36))).toBe(false);
    expect(isUuid("11111111222243338444555555555555")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });

  it("rensar dubbletter och nekar listor med ogiltiga id:n eller för många", () => {
    expect(cleanIds([DECK, DECK, OTHER], 5)).toEqual([DECK, OTHER]);
    expect(cleanIds([DECK, "x"], 5)).toBeNull();
    expect(cleanIds("inte en lista", 5)).toBeNull();
    expect(cleanIds([DECK, OTHER], 1)).toBeNull();
  });
});

describe("runAction", () => {
  it("returnerar åtgärdens resultat", async () => {
    await expect(runAction(async () => ({ ok: true, data: 1 }))).resolves.toEqual({ ok: true, data: 1 });
  });

  it("gör ett kastat fel till fail(e)", async () => {
    await expect(
      runAction(async () => {
        throw new Error("boom");
      }),
    ).resolves.toEqual({ ok: false, error: sv.errors.generic });
    await expect(
      runAction(async () => {
        throw new Error("forbidden");
      }),
    ).resolves.toEqual({ ok: false, error: sv.common.forbiddenBody });
  });
});

describe("editorAction", () => {
  it("nekar utloggade och examinatorer för andra deck utan att köra åtgärden", async () => {
    const fn = vi.fn(async () => ({ ok: true as const, data: undefined }));
    ctxMock.mockResolvedValueOnce(null);
    await expect(editorAction(DECK, fn)).resolves.toEqual({ ok: false, error: sv.common.forbiddenBody });
    ctxMock.mockResolvedValueOnce({ userId: "u", isAdmin: false, examinerDeckIds: [OTHER] });
    await expect(editorAction(DECK, fn)).resolves.toEqual({ ok: false, error: sv.common.forbiddenBody });
    expect(fn).not.toHaveBeenCalled();
  });

  it("kör åtgärden med klienten och kontexten för deckets examinator", async () => {
    const ctx = { userId: "u", isAdmin: false, examinerDeckIds: [DECK] };
    ctxMock.mockResolvedValueOnce(ctx);
    const fn = vi.fn(async () => ({ ok: true as const, data: "klar" }));
    await expect(editorAction(DECK, fn)).resolves.toEqual({ ok: true, data: "klar" });
    expect(fn).toHaveBeenCalledWith({ supabase: { client: true }, ctx });
  });

  it("fångar fel som åtgärden kastar", async () => {
    ctxMock.mockResolvedValueOnce({ userId: "u", isAdmin: true, examinerDeckIds: [] });
    await expect(
      editorAction(DECK, async () => {
        throw new Error("db");
      }),
    ).resolves.toEqual({ ok: false, error: sv.errors.generic });
  });
});

describe("adminAction", () => {
  it("släpper bara igenom global admin", async () => {
    const fn = vi.fn(async () => ({ ok: true as const, data: undefined }));
    ctxMock.mockResolvedValueOnce({ userId: "u", isAdmin: false, examinerDeckIds: [DECK] });
    await expect(adminAction(fn)).resolves.toEqual({ ok: false, error: sv.common.forbiddenBody });
    expect(fn).not.toHaveBeenCalled();
    ctxMock.mockResolvedValueOnce({ userId: "u", isAdmin: true, examinerDeckIds: [] });
    await expect(adminAction(fn)).resolves.toEqual({ ok: true, data: undefined });
  });
});

describe("cachetömningen", () => {
  it("revalidateDeck med och utan adress", () => {
    revalidate.revalidateDeck(DECK, "kurs");
    expect(calls()).toEqual([
      ["tag", "content"],
      ["path", "/admin"],
      ["path", "/admin/deck"],
      ["path", `/admin/deck/${DECK}`, "layout"],
      ["path", "/"],
      ["path", "/d/kurs"],
      ["path", "/d/kurs/plugga"],
    ]);
    vi.mocked(revalidatePath).mockClear();
    vi.mocked(revalidateTag).mockClear();
    revalidate.revalidateDeck(DECK);
    expect(calls()).toEqual([
      ["tag", "content"],
      ["path", "/admin"],
      ["path", "/admin/deck"],
      ["path", `/admin/deck/${DECK}`, "layout"],
      ["path", "/"],
    ]);
  });

  it("revalidateDeckRemoved", () => {
    revalidate.revalidateDeckRemoved();
    expect(calls()).toEqual([["tag", "content"], ["path", "/admin"], ["path", "/admin/deck"], ["path", "/"]]);
  });

  it("felrapporter, examinatorer och tentor", () => {
    revalidate.revalidateReports(DECK);
    revalidate.revalidateExaminers(DECK);
    revalidate.revalidateExam("kurs", "t1");
    revalidate.revalidateExamPages("kurs");
    expect(calls()).toEqual([
      ["path", `/admin/deck/${DECK}`],
      ["path", `/admin/deck/${DECK}/rapporter`],
      ["path", `/admin/deck/${DECK}/installningar`],
      ["path", "/d/kurs/tenta"],
      ["path", "/d/kurs/tenta/t1"],
      ["path", "/d/kurs/tenta", "layout"],
    ]);
  });

  it("revalidateExamMode", () => {
    revalidate.revalidateExamMode(DECK, "kurs");
    expect(calls()).toEqual([
      ["tag", "content"],
      ["path", "/admin"],
      ["path", "/admin/deck"],
      ["path", `/admin/deck/${DECK}`, "layout"],
      ["path", "/"],
      ["path", "/d/kurs"],
      ["path", "/d/kurs/plugga"],
      ["path", "/d/kurs/tenta", "layout"],
      ["path", `/admin/deck/${DECK}/tentor`, "layout"],
    ]);
  });
});
