/**
 * Gemensamt för de visuella testerna: deterministisk klient och skärmbildshjälpen.
 *
 * Varje sida får samma förutsättningar vid varje körning:
 * - klientens klocka börjar på VISUAL_NOW (datum, "i dag", hälsningen och statistiken),
 * - samma stjärnmärkning på enheten (stjärnorna sparas i localStorage, inte i kontot).
 * Det som ändå beror på serverns klocka eller på andra användare maskas i varje test.
 *
 * Math.random seedas inte: med samma slumpföljd i fyra parallella webbläsare hängde sig de
 * inloggade sidorna. Passen körs i stället i kursens ordning (ordning=kurs), utan slump.
 */
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { readFixture, VISUAL_NOW, type Fixture } from "./data";

type VisualFixtures = {
  fx: Fixture;
  /** Klientens klocka börjar på VISUAL_NOW. Av för sidor som renderar tid på servern (se designsystem). */
  shiftClock: boolean;
  deterministic: void;
};

export const test = base.extend<VisualFixtures>({
  shiftClock: [process.env.VISUAL_REAL_CLOCK !== "1", { option: true }],
  fx: async ({}, provide) => {
    await provide(readFixture());
  },
  deterministic: [
    async ({ page, fx, shiftClock }, provide) => {
      await page.addInitScript(
        ({ starred, now, shift }) => {
          // Klockan börjar på VISUAL_NOW när sidan laddas och går sedan som vanligt (Date.now() och
          // new Date() utan argument); timers och performance.now() rörs inte. En klocka som står
          // helt still (page.clock.setFixedTime) fick inloggade sidor att hänga sig
          // när fyra arbetare körde samtidigt.
          const RealDate = Date;
          const offset = now - RealDate.now();
          class VisualDate extends RealDate {
            constructor(...args: unknown[]) {
              if (args.length === 0) super(RealDate.now() + offset);
              else super(...(args as [string | number | Date]));
            }
            static now() {
              return RealDate.now() + offset;
            }
          }
          if (shift) window.Date = VisualDate as DateConstructor;
          try {
            if (window.localStorage.getItem("kuggfri:stars:v1") === null) window.localStorage.setItem("kuggfri:stars:v1", JSON.stringify([starred]));
          } catch {
            // Sidor utan lagring (t.ex. about:blank) hoppas över.
          }
        },
        { starred: fx.starredCardId, now: VISUAL_NOW.getTime(), shift: shiftClock },
      );
      // Fel som sidan kastar (t.ex. en misslyckad hydrering, som renderar om hela sidan och tappar
      // mörkt läge) ska synas som fel, inte som en mystisk bild. Se shot().
      const errors: string[] = [];
      pageErrors.set(page, errors);
      page.on("pageerror", (e) => errors.push(e.message));
      await provide();
    },
    { auto: true },
  ],
});

export { expect };

const pageErrors = new WeakMap<Page, string[]>();

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

/** Högsta höjd på en helsidesbild: långa listor kapas här så att bilderna hålls rimliga. */
const MAX_HEIGHT = { desktop: 3200, mobile: 4800 };

type ShotOptions = {
  /** Hela sidan (kapad vid MAX_HEIGHT) i stället för bara fönstret. Standard: ja. */
  fullPage?: boolean;
  /** Det som ändras från dag till dag eller mellan körningar. */
  mask?: Locator[];
  /** Bild av ett enskilt element (t.ex. en dialog) i stället för sidan. */
  element?: Locator;
};

/** Väntar tills sidan laddat klart: nätverket tyst, typsnitt och bilder klara, inga laddningsskelett. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Bilder med loading="lazy" utanför fönstret laddas annars aldrig före en helsidesbild.
    for (const img of Array.from(document.images)) if (img.loading === "lazy") img.loading = "eager";
    await Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            }),
        ),
    );
  });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  // Intoningar och dialogernas bakgrund (::backdrop) som fortfarande pågår, t.ex. direkt efter ett
  // klick: vänta tills de är klara. Oändliga animationer (laddningsskelett) räknas inte.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]),
  );
}

/** Skärmbild som jämförs mot referensen tests/visual/__screenshots__/<projekt>/<fil>/<namn>.png. */
export async function shot(page: Page, name: string, options: ShotOptions = {}) {
  await settle(page);
  expect(pageErrors.get(page) ?? [], "Sidan kastade fel innan bilden togs").toEqual([]);
  const mask = options.mask ?? [];
  if (options.element) {
    await expect(options.element).toHaveScreenshot(`${name}.png`, { mask });
    return;
  }
  const fullPage = options.fullPage ?? true;
  if (!fullPage) {
    await expect(page).toHaveScreenshot(`${name}.png`, { mask });
    return;
  }
  const width = page.viewportSize()?.width ?? 1440;
  const max = isMobile(page) ? MAX_HEIGHT.mobile : MAX_HEIGHT.desktop;
  const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask,
    ...(height > max ? { clip: { x: 0, y: 0, width, height: max } } : {}),
  });
}

/** Går till en sida och väntar tills den laddat klart. */
export async function open(page: Page, url: string) {
  await page.goto(url);
  await settle(page);
  // Sällan (en gång på drygt hundra visningar av /hem i testerna, utan ändringar i koden)
  // misslyckas hydreringen med React-fel #418. Då laddas sidan om, högst två gånger. Ett fel som
  // kommer varje gång (t.ex. efter en ändring) syns ändå, eftersom shot() kräver en sida utan fel.
  const errors = pageErrors.get(page) ?? [];
  for (let attempt = 0; attempt < 2 && errors.some((e) => HYDRATION_ERROR.test(e)); attempt++) {
    errors.length = 0;
    await page.reload();
    await settle(page);
  }
}

const HYDRATION_ERROR = /Minified React error #(418|419|423|425)/;

/**
 * Stoppar passets skrivningar till databasen (progress, historik, passloggen), så att ett pass i
 * testet inte ändrar teststudentens statistik inför nästa bild eller nästa körning.
 */
export async function blockProgressWrites(page: Page) {
  await page.route(/\/rest\/v1\/(card_progress|review_log|study_sessions)/, async (route) => {
    if (route.request().method() === "GET" || route.request().method() === "HEAD") return route.continue();
    return route.fulfill({ status: 201, body: "" });
  });
}

/**
 * Kursstatistiken i admin räknas över alla konton i databasen (även E2E-testernas studenter) och
 * mot serverns klocka ("senaste 7 dagarna", veckorna i diagrammet). Värdena och diagrammen maskas;
 * etiketterna, rutorna och layouten jämförs.
 */
export function courseStatsMasks(page: Page): Locator[] {
  return [
    page.locator("main dl dd"),
    page.locator("main svg[role='img']"),
    page.locator("main table"),
    // Svåraste områdena och kluriga frågor: visas först när fem studenter skattat.
    page.locator("main section[aria-labelledby='svarast'], main section[aria-labelledby='kluriga']"),
  ];
}

/**
 * Granskningens listor: rubrikerna "I dag", "I går" och datum räknas mot serverns klocka, och de
 * flaggade kortens högerkolumn är relativ ("I går"). Granskade-flikens klockslag är absoluta.
 */
export function reviewListMasks(page: Page, options: { rightLabels: boolean }): Locator[] {
  const list = page.getByTestId("review-list");
  return [list.locator("h3"), ...(options.rightLabels ? [list.locator("li a > span:last-child")] : [])];
}

/** Ett kort i granskningsvyn: "Granskad i går kl. …" och "Flaggat av … i går" är relativa. */
export function reviewCardMasks(page: Page): Locator[] {
  return [page.getByTestId("review-status-line"), page.getByTestId("review-flag-note").locator("p").first()];
}

/** Öppnar mobilens utdragbara meny (sidomenyn på desktop syns redan). */
export async function openMobileMenu(page: Page) {
  await page.getByRole("button", { name: "Öppna menyn" }).click();
  await expect(page.getByRole("complementary", { name: "Huvudmeny" }).getByRole("button", { name: "Stäng menyn" })).toBeVisible();
}
