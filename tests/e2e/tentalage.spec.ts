import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { parseExamFile } from "@/lib/tentor/format";
import { DECK_SLUG, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, registerStudent } from "./helpers";

/**
 * Tentaläget (docs/TENTOR.md): låst för studenter tills examinatorn öppnar det, och sedan ett helt
 * flöde mot en demotenta: försättsblad, starta, svara på varje typ, flagga, lämna in, resultat
 * med självbedömning. Demotentan skrivs med service role före testerna och tas bort efteråt.
 */

const KEY = "0000-e2e";
const FIL = `# Demotenta E2E
datum: 2026-09-29
tid: 240
poäng: 8
betyg: 3=3, 4=5, 5=7
hjälpmedel: Typgodkänd räknare
status: publicerad

## 1a
del: Metaller
typ: flerval
poäng: 1

Definiera "eutektisk reaktion".

- [ ] Fel
- [x] Rätt

## 1b
typ: flera
poäng: 1

Vilka gitter är tätpackade?

- [x] FCC
- [ ] BCC
- [x] HCP

## 2
typ: sant-falskt
poäng: 2

Ange sant eller falskt.

- [sant] FCC har packningsgrad 0,74.
- [falskt] BCC är tätpackat.

## 3
typ: para
poäng: 1
alternativ: Ferrit | Austenit

Para ihop.

- 1 => Ferrit

## 4
del: Polymerer
typ: numerisk
poäng: 1
svar: 0,727
tolerans: 0,01

Beräkna andelen.

## 5
typ: text
poäng: 2

Förklara skjuvförtunning.

### Lösning

Viskositeten minskar med ökande skjuvhastighet.
`;

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function deckId(): Promise<string> {
  const { data, error } = await service.from("decks").select("id").eq("slug", DECK_SLUG).single();
  if (error) throw error;
  return data.id as string;
}

async function setExamMode(open: boolean) {
  const { error } = await service.from("decks").update({ exam_mode_open: open }).eq("slug", DECK_SLUG);
  if (error) throw error;
}

test.describe("Tentaläget", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const { exam, issues } = parseExamFile(FIL, KEY);
    expect(issues).toEqual([]);
    const { error } = await service.from("exams").upsert(
      {
        deck_id: await deckId(),
        key: KEY,
        title: exam.title,
        exam_date: exam.date,
        duration_minutes: exam.durationMinutes,
        max_points: exam.maxPoints,
        grade_limits: exam.grades,
        aids: exam.aids,
        instructions: exam.instructions,
        source: exam.source,
        status: exam.status,
        questions: exam.questions,
      },
      { onConflict: "deck_id,key" },
    );
    if (error) throw error;
  });

  test.afterAll(async () => {
    await setExamMode(false);
    await service.from("exams").delete().eq("key", KEY);
  });

  test("låst för studenter: låsvy, låsikon i sidomenyn och ingen väg in via adressen", async ({ page }) => {
    await setExamMode(false);
    await registerStudent(page, "tentalas", `/d/${DECK_SLUG}/tenta`);
    await page.goto(`/d/${DECK_SLUG}/tenta`);
    await expect(page.getByTestId("exam-mode-locked")).toBeVisible();
    await expect(page.getByTestId("exam-list")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Till kurssidan" })).toHaveAttribute("href", `/d/${DECK_SLUG}`);
    await page.goto(`/d/${DECK_SLUG}/tenta/${KEY}`);
    await expect(page).toHaveURL(new RegExp(`/d/${DECK_SLUG}/tenta$`));
    await expect(page.getByTestId("exam-mode-locked")).toBeVisible();
  });

  test("hel tenta: starta, svara, flagga, lämna in och bedöm själv", async ({ page }) => {
    await setExamMode(true);
    await registerStudent(page, "tentaflode", `/d/${DECK_SLUG}/tenta`);
    await page.goto(`/d/${DECK_SLUG}/tenta`);
    await page.getByTestId(`exam-row-${KEY}`).getByRole("link", { name: /Starta/ }).click();

    // Försättsbladet
    await expect(page.getByTestId("exam-cover")).toContainText("Skrivtid");
    await expect(page.getByTestId("exam-cover")).toContainText("4 timmar");
    await page.getByTestId("exam-start").click();
    await expect(page.getByTestId("exam-runner")).toBeVisible();
    await expect(page.getByTestId("exam-clock")).toHaveText(/^3:59:\d\d$/);

    // Inget facit i sidan under tentan
    expect(await page.content()).not.toContain("Viskositeten minskar");

    await page.getByTestId("option-1").check(); // 1a rätt
    await page.getByTestId("exam-next").click();
    await page.getByTestId("option-0").check(); // 1b: bara FCC (fel med allt eller inget)
    await page.getByTestId("flag-toggle").click();
    await page.getByTestId("exam-next").click();
    await page.getByTestId("statement-0-sant").check(); // 2: ett av två rätt
    await page.getByTestId("statement-1-sant").check();
    await page.getByTestId("exam-next").click();
    await page.getByTestId("pair-0").click();
    await page.getByRole("option", { name: "Ferrit" }).click(); // 3 rätt
    await page.getByTestId("exam-next").click();
    await page.getByTestId("numeric-answer").fill("0,73"); // 4 rätt inom toleransen
    await page.getByTestId("exam-next").click();
    await page.getByTestId("text-answer").fill("Viskositeten sjunker när skjuvhastigheten ökar.");

    await expect(page.getByTestId("nav-box-1b")).toHaveAttribute("data-flagged", "true");
    await expect(page.locator('[data-testid^="nav-box-"][data-answered="true"]')).toHaveCount(6);

    // Omladdning: svaren och flaggan finns kvar
    await page.reload();
    await expect(page.locator('[data-testid^="nav-box-"][data-answered="true"]')).toHaveCount(6);
    await expect(page.getByTestId("nav-box-1b")).toHaveAttribute("data-flagged", "true");

    // Inlämning
    await page.getByTestId("exam-submit").click();
    await expect(page.getByTestId("submit-summary")).toContainText("1 uppgift är flaggad");
    await page.getByTestId("exam-submit-confirm").click();

    // Resultatet: 1 + 0 + 1 + 1 + 1 = 4 automatiskt, betyg 3
    await expect(page.getByTestId("exam-result")).toBeVisible();
    await expect(page.getByTestId("result-points")).toHaveText("4");
    await expect(page.getByTestId("result-grade")).toHaveText("3");
    await expect(page.getByTestId("result-1b")).toHaveAttribute("data-outcome", "fel");
    await expect(page.getByTestId("result-2")).toHaveAttribute("data-outcome", "delvis");
    await expect(page.getByTestId("result-5")).toContainText("Viskositeten minskar");

    // Självbedömning av skrivuppgiften räknas in: 4 + 1,5 = 5,5, betyg 4
    await page.getByTestId("self-grade-5-1.5").click();
    await expect(page.getByTestId("result-points")).toHaveText("5,5");
    await expect(page.getByTestId("result-grade")).toHaveText("4");
    await page.reload();
    await expect(page.getByTestId("result-points")).toHaveText("5,5");

    // Listan visar resultatet
    await page.goto(`/d/${DECK_SLUG}/tenta`);
    await expect(page.getByTestId(`exam-row-${KEY}`).getByTestId("exam-row-result")).toContainText("5,5/8 p, betyg 4");
  });
});
