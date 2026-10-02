import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";
import { adminTabs } from "@/lib/admin/tabs";
import { sv } from "@/lib/i18n/sv";

const ADMIN_TABS = adminTabs(sv);

/**
 * Adressbyggarna i lib/routes.ts ska ge exakt de strängar som appen alltid använt (e2e och
 * delade länkar bygger på dem), och nya handskrivna kurs- och adminadresser ska inte smyga in.
 */
describe("routes", () => {
  it("ger appens fasta sidor", () => {
    expect(routes.landing()).toBe("/");
    expect(routes.landing({ next: "/d/materialteknik?lage=exam" })).toBe("/?next=%2Fd%2Fmaterialteknik%3Flage%3Dexam");
    expect(routes.landing({ raderad: true })).toBe("/?raderad=1");
    expect(routes.login()).toBe("/logga-in");
    expect(routes.login({ next: "/admin" })).toBe("/logga-in?next=%2Fadmin");
    expect(routes.login({ next: routes.account() })).toBe("/logga-in?next=%2Fkonto");
    expect(routes.login({ fel: "google" })).toBe("/logga-in?fel=google");
    expect(routes.login({ fel: "bekraftelse" })).toBe("/logga-in?fel=bekraftelse");
    expect(routes.login({ fel: "lank" })).toBe("/logga-in?fel=lank");
    expect(routes.register({ next: "/hem" })).toBe("/registrera?next=%2Fhem");
    expect(routes.forgotPassword()).toBe("/glomt-losenord");
    expect(routes.home()).toBe("/hem");
    expect(routes.courses()).toBe("/kurser");
    expect(routes.myStats()).toBe("/statistik");
    expect(routes.account()).toBe("/konto");
    expect(routes.account({ bytLosenord: true })).toBe("/konto?byt-losenord=1");
    expect(routes.accountExport()).toBe("/api/konto/export");
    expect(routes.help()).toBe("/hjalp");
    expect(routes.about()).toBe("/om");
    expect(routes.privacy()).toBe("/integritet");
    expect(routes.designSystem()).toBe("/designsystem");
    expect(routes.courseInvite("materialteknik")).toBe("/kurs/materialteknik");
    expect(routes.authGoogle({ next: "/hem" })).toBe("/auth/google?next=%2Fhem");
    expect(routes.authGoogleCallback()).toBe("/auth/google/callback");
    expect(routes.authConfirm()).toBe("/auth/confirm");
    expect(routes.authConfirm({ next: routes.account({ bytLosenord: true }) })).toBe("/auth/confirm?next=%2Fkonto%3Fbyt-losenord%3D1");
  });

  it("ger kursens adresser med samma parameterordning och kodning som förut", () => {
    expect(routes.deck("mt")).toBe("/d/mt");
    expect(routes.deck("mt", { lage: "exam" })).toBe("/d/mt?lage=exam");
    expect(routes.deck("mt", { lage: "tricky" })).toBe("/d/mt?lage=tricky");
    expect(routes.deck("mt", { lage: "exam", omrade: "a b/c" })).toBe("/d/mt?lage=exam&omrade=a%20b%2Fc");
    expect(routes.study("mt")).toBe("/d/mt/plugga");
    expect(routes.study("mt", { mode: "fsrs", urval: "all" })).toBe("/d/mt/plugga?mode=fsrs&urval=all");
    expect(routes.study("mt", { mode: "random", urval: "k1,k2" })).toBe("/d/mt/plugga?mode=random&urval=k1%2Ck2");
    expect(routes.exam("mt")).toBe("/d/mt/tenta");
    expect(routes.examAttempt("mt", "2024-01")).toBe("/d/mt/tenta/2024-01");
    expect(routes.examAttempt("mt", "2024-01", { forsok: "f1" })).toBe("/d/mt/tenta/2024-01?forsok=f1");
    expect(routes.examAttempt("mt", "2024-01", { fran: "admin" })).toBe("/d/mt/tenta/2024-01?fran=admin");
    expect(routes.examAttempt("mt", "2024-01", { forsok: "f1", fran: "admin" })).toBe("/d/mt/tenta/2024-01?forsok=f1&fran=admin");
    expect(routes.examImage("m t", "k/1", "u 2", 0, "abc")).toBe("/d/m%20t/tenta/k%2F1/bild/u%202/0?v=abc");
  });

  it("ger adminsidornas adresser", () => {
    expect(routes.admin.home()).toBe("/admin");
    expect(routes.admin.decks()).toBe("/admin/deck");
    expect(routes.admin.newDeck()).toBe("/admin/deck/ny");
    expect(routes.admin.deck("d1")).toBe("/admin/deck/d1");
    expect(routes.admin.stats("d1")).toBe("/admin/deck/d1/statistik");
    expect(routes.admin.content("d1")).toBe("/admin/deck/d1/innehall");
    expect(routes.admin.review("d1")).toBe("/admin/deck/d1/granskning");
    expect(routes.admin.review("d1", { omrade: "ingen" })).toBe("/admin/deck/d1/granskning?omrade=ingen");
    expect(routes.admin.review("d1", { flik: "flaggade", kort: "c1" })).toBe("/admin/deck/d1/granskning?flik=flaggade&kort=c1");
    expect(routes.admin.exams("d1")).toBe("/admin/deck/d1/tentor");
    expect(routes.admin.examKey("d1", "2024-01")).toBe("/admin/deck/d1/tentor/2024-01");
    expect(routes.admin.reports("d1")).toBe("/admin/deck/d1/rapporter");
    expect(routes.admin.import("d1")).toBe("/admin/deck/d1/import");
    expect(routes.admin.export("d1")).toBe("/admin/deck/d1/export");
    expect(routes.admin.settings("d1")).toBe("/admin/deck/d1/installningar");
    expect(routes.admin.category("d1", "k1")).toBe("/admin/deck/d1/kategori/k1");
    expect(routes.admin.category("d1", "ingen")).toBe("/admin/deck/d1/kategori/ingen");
    expect(routes.admin.categoryPrefix("d1")).toBe("/admin/deck/d1/kategori");
    expect(routes.admin.card("d1", "c1")).toBe("/admin/deck/d1/kort/c1");
    expect(routes.admin.cardPrefix("d1")).toBe("/admin/deck/d1/kort");
    expect(routes.admin.newCard("d1")).toBe("/admin/deck/d1/kort/ny");
    expect(routes.admin.newCard("d1", { kategori: "k1" })).toBe("/admin/deck/d1/kort/ny?kategori=k1");
    expect(routes.admin.cardHistory("d1", "c1")).toBe("/admin/deck/d1/kort/c1/historik");
  });

  it("ADMIN_TABS har sidomenyns ordning, adresser och räknare", () => {
    expect(ADMIN_TABS.map((t) => [t.href("d1"), t.exact ?? false, t.also?.("d1") ?? [], t.counter?.key ?? null])).toEqual([
      ["/admin/deck/d1", true, ["/admin/deck/d1/statistik"], null],
      ["/admin/deck/d1/innehall", false, ["/admin/deck/d1/kategori", "/admin/deck/d1/kort"], null],
      ["/admin/deck/d1/granskning", false, [], "pendingDrafts"],
      ["/admin/deck/d1/tentor", false, [], null],
      ["/admin/deck/d1/rapporter", false, [], "openReports"],
      ["/admin/deck/d1/deltagare", false, [], null],
      ["/admin/deck/d1/import", false, [], null],
      ["/admin/deck/d1/installningar", false, [], null],
    ]);
    expect(ADMIN_TABS.map((t) => t.label)).toEqual(["Översikt", "Innehåll", "Granskning", "Tentor", "Felrapporter", "Deltagare", "Importera", "Inställningar"]);
  });
});

/**
 * Nya kurs- och adminadresser byggs med routes, inte för hand. e2e- och visuella tester ligger
 * utanför sökningen med flit: de testar de faktiska adresserna.
 */
describe("inga handskrivna kurs- och adminadresser", () => {
  const ROOT = process.cwd();
  const DIRS = ["app", "components", "lib", "scripts", "middleware.ts"];
  const ALLOWED = new Set(["lib/routes.ts"]);
  const PATTERNS = [/\/admin\/deck\/\$\{/, /\/d\/\$\{/];

  function files(path: string): string[] {
    const full = join(ROOT, path);
    if (!statSync(full).isDirectory()) return /\.(ts|tsx|mts)$/.test(path) ? [full] : [];
    return readdirSync(full).flatMap((name) => files(join(path, name)));
  }

  it("bara lib/routes.ts skriver `/admin/deck/${…}` och `/d/${…}`", () => {
    const hits: string[] = [];
    for (const file of DIRS.flatMap(files)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (ALLOWED.has(rel)) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (PATTERNS.some((p) => p.test(line))) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
