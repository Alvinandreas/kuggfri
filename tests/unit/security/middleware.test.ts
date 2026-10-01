import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Middlewaren som helhet: omdirigeringar, omskrivningar, 403 och CSP-huvudet på varje svar.
 * Supabase ersätts av en låtsasklient så att varje fall styrs av vem som är inloggad, om
 * profilen är admin och hur många kurser hen är examinator för. Noncen är fast, så att hela
 * svaret (alla huvuden) kan jämföras exakt.
 */

const NONCE = "testnonce";

vi.mock("@/lib/security/headers", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/security/headers")>();
  return { ...original, createNonce: () => NONCE };
});

type Scenario = { user: { id: string } | null; isAdmin?: boolean | null; examinerDecks?: number; refreshedCookie?: boolean };
let scenario: Scenario = { user: null };
let queriedTables: string[] = [];

/** Låtsasklient: svarar på profiles- och deck_examiners-uppslagen enligt scenariot. */
function fakeSupabase() {
  return {
    from(table: string) {
      queriedTables.push(table);
      const result = () => {
        if (table === "profiles") {
          return { data: scenario.isAdmin === null || scenario.isAdmin === undefined ? null : { is_admin: scenario.isAdmin }, error: null };
        }
        const rows = Array.from({ length: scenario.examinerDecks ?? 0 }, (_, i) => ({ deck_id: `deck-${i}` }));
        return { data: rows, count: rows.length, error: null };
      };
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => result(),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
      };
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: async (_request: NextRequest, requestHeaders: Headers) => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (scenario.refreshedCookie) response.cookies.set("sb-test-auth-token", "fornyad", { path: "/" });
    return { supabase: fakeSupabase(), response, user: scenario.user };
  },
}));

const { middleware } = await import("@/middleware");
const { buildCsp } = await import("@/lib/security/headers");
const CSP = buildCsp(NONCE, process.env.NODE_ENV !== "production");

async function run(path: string, s: Scenario) {
  scenario = s;
  queriedTables = [];
  const res = await middleware(new NextRequest(new URL(path, "https://kuggfri.test")));
  const headers = [...res.headers.entries()].map(([k, v]) => [k, v.replaceAll(CSP, "<CSP>")] as const);
  return {
    status: res.status,
    location: res.headers.get("location"),
    csp: res.headers.get("content-security-policy"),
    headers,
    body: res.status === 403 ? await res.text() : null,
    queried: [...queriedTables],
  };
}

const STUDENT = { id: "student" };
const ADMIN = { id: "admin" };
const EXAMINATOR = { id: "examinator" };

const FALL: [string, string, Scenario][] = [
  ["kod på annan sida skickas till /auth/confirm", "/d/materialteknik?code=abc", { user: null }],
  ["kod på startsidan skickas till /auth/confirm", "/?code=abc", { user: STUDENT }],
  ["kod på /auth/ släpps igenom", "/auth/confirm?code=abc", { user: null }],
  ["utloggad på kurslänk får inbjudan (omskrivning)", "/d/materialteknik", { user: null }],
  ["utloggad på kurslänk behåller förnyade kakor", "/d/materialteknik", { user: null, refreshedCookie: true }],
  ["utloggad på skyddad sida skickas till startsidan", "/hem?flik=1", { user: null }],
  ["utloggad på /admin skickas till startsidan", "/admin/deck", { user: null }],
  ["utloggad på publik sida släpps igenom", "/om", { user: null }],
  ["inloggad student på vanlig sida", "/hem", { user: STUDENT, isAdmin: false }],
  ["student på /admin nekas", "/admin", { user: STUDENT, isAdmin: false, examinerDecks: 0 }],
  ["student utan profil på /admin nekas", "/admin/deck/x", { user: STUDENT, isAdmin: null, examinerDecks: 0 }],
  ["admin på /admin släpps in", "/admin", { user: ADMIN, isAdmin: true }],
  ["examinator på /admin släpps in", "/admin/deck/x", { user: EXAMINATOR, isAdmin: false, examinerDecks: 1 }],
  ["examinator utan profil på /admin släpps in", "/admin", { user: EXAMINATOR, isAdmin: null, examinerDecks: 2 }],
];

describe("middleware", () => {
  beforeEach(() => {
    scenario = { user: null };
  });

  it.each(FALL)("%s", async (_namn, path, s) => {
    const { csp, ...svar } = await run(path, s);
    expect(csp).toBe(CSP);
    expect(svar).toMatchSnapshot();
  });

  it("omdirigeringarna går till rätt adresser", async () => {
    expect((await run("/d/materialteknik?code=abc", { user: null })).location).toBe("https://kuggfri.test/auth/confirm?code=abc&next=%2Fd%2Fmaterialteknik");
    expect((await run("/hem?flik=1", { user: null })).location).toBe("https://kuggfri.test/?next=%2Fhem%3Fflik%3D1");
    expect((await run("/admin", { user: STUDENT, isAdmin: false })).status).toBe(403);
  });

  it("admin slår inte upp examinatorskap; andra gör det", async () => {
    expect((await run("/admin", { user: ADMIN, isAdmin: true })).queried).toEqual(["profiles"]);
    expect((await run("/admin", { user: STUDENT, isAdmin: false })).queried).toEqual(["profiles", "deck_examiners"]);
    expect((await run("/hem", { user: STUDENT, isAdmin: false })).queried).toEqual([]);
  });
});
