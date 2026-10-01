# E2E-testerna (Playwright)

## Köra

Kräver lokala Supabase (`supabase start`, Docker) med Mailpit, och en databas från `npm run db:reset`.

```bash
npm run test:e2e                                   # hela sviten, båda projekten
npx playwright test granskning.spec.ts             # en spec
npx playwright test --project=desktop -g "export"  # ett test, ett projekt
E2E_BASE_URL=http://localhost:3001 npx playwright test …   # mot en server som redan kör
```

Utan `E2E_BASE_URL` bygger Playwright ett produktionsbygge (`.next-e2e`) och startar det på
`http://localhost:3020` (ca 1,5 min extra). Det är stabilare än dev-servern, som kompilerar
varje sida vid första anropet. `E2E_REUSE_SERVER=1` återanvänder en server som redan kör på 3020.

Mot produktionen körs bara `public.spec.ts`, som inte skapar eller skriver något:
`E2E_BASE_URL=https://kuggfri.com E2E_SKIP_SETUP=1 npx playwright test public.spec.ts`.

## Projekt

- **mobile** (375 × 812, touch) och **desktop** kör samma tester, utom de som är taggade
  `@desktop`: rena admintester där inget skiljer sig på mobil. De körs bara i desktop
  (`grepInvert` i `playwright.config.ts`).
- En worker, inte parallellt: testerna delar den lokala databasen och kursen Materialteknik
  (granskningskön, områdenas ordning, tentaläget).

## Global setup och teardown

`global-setup.ts` (en gång, efter att webbservern startat):

1. Kontrollerar att Supabase svarar.
2. Skapar admin-testanvändaren (`ADMIN_USER` i `helpers.ts`) om den saknas och sätter `is_admin`.
3. Loggar in admin via formuläret och sparar sessionen i `tests/e2e/.auth/admin.json`
   (git-ignorerad). Admintesterna anropar `loginAsAdmin(page)`, som lägger in kakorna i den
   sidans kontext i stället för att logga in via formuläret. Är filen äldre än 50 minuter
   (åtkomsttoken gäller en timme lokalt) loggar den in via formuläret som förr. Inget test får
   logga ut admin, eftersom utloggningen återkallar den delade sessionen.

`global-teardown.ts` (en gång, även efter fallerade tester) tar bort kurserna testerna skapat
(adressen `e2e-…`, titeln `E2E …`) och felrapporterna `E2E-rapport …`, bara mot en lokal
Supabase och aldrig Materialteknik. Fristående: `npx tsx tests/e2e/global-teardown.ts`.

## Hjälpare (`helpers.ts`)

- `serviceClient()`: Supabase-klient med service role-nyckeln, för testdata och städning.
- `loginAsAdmin(page, next?)` och `openAdminCourse(page)`: adminsessionen och Materialtekniks
  adminsida (returnerar adressen).
- `registerStudent`, `login`, `logout`, `startSession`, `rateCurrentCard`,
  `expectNoSeriousA11yViolations` m.fl.
