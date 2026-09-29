import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { parseExamFile } from "@/lib/tentor/format";
import { ADMIN_USER, DECK_SLUG, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, login, registerStudent } from "./helpers";

/**
 * Tentaläget (docs/TENTOR.md): låst för studenter tills examinatorn öppnar det, och sedan ett helt
 * flöde mot en demotenta: försättsblad, starta, svara på varje typ, flagga, lämna in,
 * rättningsläget (självbedömning utan resultat), Rätta, resultatet och Tänk om. Redaktörens
 * studentvy och förhandsgranskningen från admin. Demotentan skrivs med service role före testerna
 * och tas bort efteråt.
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
minuspoäng: 0,5

Ange sant eller falskt.

- [sant] FCC har packningsgrad 0,74.
- [falskt] BCC är tätpackat.

## 3
typ: para
poäng: 1

Fyll i luckan.

- 1 => Austenit | [x] Ferrit

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
    await expect(page.getByTestId("penalty-rule")).toContainText("varje fel svar ger −0,5 p");
    await page.getByTestId("statement-0-sant").check(); // 2: ett rätt (+1), ett fel (−0,5)
    await page.getByTestId("statement-1-sant").check();
    await page.getByTestId("exam-next").click();
    await page.getByTestId("pair-0").click();
    await expect(page.getByRole("option")).toHaveText(["Välj", "Austenit", "Ferrit"]); // ledets egen lista
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

    // Rättningsläget: bara skrivuppgiften, med lösningsförslaget, och inget resultat
    await expect(page.getByTestId("exam-grading")).toBeVisible();
    await expect(page.getByTestId("grading-question")).toHaveAttribute("data-question", "5");
    await expect(page.getByTestId("grading-question")).toContainText("Viskositeten minskar");
    await expect(page.getByTestId("grading-progress")).toHaveText("0 av 1 bedömda");
    await expect(page.getByTestId("result-points")).toHaveCount(0);
    await expect(page.getByTestId("result-grade")).toHaveCount(0);
    await page.getByTestId("self-grade-5-1.5").click();
    await expect(page.getByTestId("grading-progress")).toHaveText("1 av 1 bedömda");

    // Går man ifrån kommer man tillbaka till rättningen, med bedömningen kvar
    await page.goto(`/d/${DECK_SLUG}/tenta`);
    await expect(page.getByTestId(`exam-row-${KEY}`)).toContainText("Inte rättad");
    await page.getByTestId("exam-row-grade").click();
    await expect(page.getByTestId("exam-grading")).toBeVisible();
    await expect(page.getByTestId("self-grade-5-1.5")).toHaveAttribute("aria-checked", "true");

    // Rätta: 1 + 0 + (1 − 0,5) + 1 + 1 = 3,5 automatiskt, + 1,5 självbedömt = 5, betyg 4
    await page.getByTestId("grading-finish").click();
    await expect(page.getByTestId("grading-summary")).toContainText("Du har bedömt alla uppgifter.");
    await page.getByTestId("grading-confirm").click();
    await expect(page.getByTestId("exam-result")).toBeVisible();
    await expect(page.getByTestId("result-points")).toHaveText("5");
    await expect(page.getByTestId("result-grade")).toHaveText("4");
    await expect(page.getByTestId("result-auto")).toHaveText("3,5 av 6 p");
    await expect(page.getByTestId("result-self")).toHaveText("1,5 av 2 p");
    await expect(page.getByTestId("result-1b")).toHaveAttribute("data-outcome", "fel");
    await expect(page.getByTestId("result-2")).toHaveAttribute("data-outcome", "delvis");
    await expect(page.getByTestId("result-2-points")).toHaveText("0,5/2 p");
    await expect(page.getByTestId("result-5")).toContainText("Viskositeten minskar");

    // Tänk om: full poäng på 1b (+1) och 2 (+1,5) hade gett 7,5, betyg 5. Inget sparas.
    await page.getByTestId("whatif-start").click();
    await page.getByTestId("whatif-1b-full").click();
    await page.getByTestId("whatif-2-full").click();
    await expect(page.getByTestId("whatif-points")).toHaveText("7,5 / 8 p");
    await expect(page.getByTestId("result-grade")).toHaveText("5");
    await page.getByTestId("whatif-reset").click();
    await expect(page.getByTestId("result-points")).toHaveText("5");
    await page.reload();
    await expect(page.getByTestId("result-points")).toHaveText("5");
    await expect(page.getByTestId("result-grade")).toHaveText("4");

    // Listan visar resultatet
    await page.goto(`/d/${DECK_SLUG}/tenta`);
    await expect(page.getByTestId(`exam-row-${KEY}`).getByTestId("exam-row-result")).toContainText("5/8 p, betyg 4");
  });

  test("redaktör: förhandsgranskning från admin leder tillbaka dit, och studentvyn visar tentaläget som studenten ser det", async ({ page }) => {
    await setExamMode(false);
    await service.from("exams").update({ status: "utkast" }).eq("key", KEY);
    const deck = await deckId();
    await login(page, ADMIN_USER.email, ADMIN_USER.password, `/admin/deck/${deck}/tentor`);
    await page.goto(`/admin/deck/${deck}/tentor`);
    await page.locator(`a[href="/d/${DECK_SLUG}/tenta/${KEY}?fran=admin"]`).click();
    await expect(page.getByTestId("exam-back")).toHaveAttribute("href", `/admin/deck/${deck}/tentor`);
    await page.getByTestId("exam-back").click();
    await expect(page).toHaveURL(new RegExp(`/admin/deck/${deck}/tentor$`));

    // Studentvyn: utkasten syns, men utan redaktörens märkning; låst läge visar låsvyn
    await page.getByTestId("student-view-start").click();
    await expect(page.getByTestId("student-view-bar")).toBeVisible();
    await expect(page.getByTestId(`exam-row-${KEY}`)).toBeVisible();
    await expect(page.getByText("Utkast, syns inte för studenter")).toHaveCount(0);
    await expect(page.getByTestId("exam-mode-editor-note")).toHaveCount(0);
    await page.getByTestId("student-view-bar").getByRole("button", { name: "Låst" }).click();
    await expect(page.getByTestId("exam-mode-locked")).toBeVisible();
    await page.getByTestId("student-view-exit").click();
    await expect(page.getByTestId("exam-mode-editor-note")).toBeVisible();
    await service.from("exams").update({ status: "publicerad" }).eq("key", KEY);
  });

  test("studentvyns kaka ger en student ingenting", async ({ page }) => {
    await setExamMode(false);
    await registerStudent(page, "tentakaka", `/d/${DECK_SLUG}/tenta`);
    await page.context().addCookies([{ name: "kuggfri_studentvy", value: `${await deckId()}:oppen`, url: page.url() }]);
    await page.goto(`/d/${DECK_SLUG}/tenta`);
    await expect(page.getByTestId("exam-mode-locked")).toBeVisible();
    await expect(page.getByTestId("student-view-bar")).toHaveCount(0);
    await page.goto(`/d/${DECK_SLUG}/tenta/${KEY}?fran=admin`);
    await expect(page).toHaveURL(new RegExp(`/d/${DECK_SLUG}/tenta$`));
  });
});
