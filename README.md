# Kuggfri

Fri flashcard-plattform för kurser på Chalmers. Gratis för studenter, ingen administration,
ingen spårning. Version ett innehåller decket **Materialteknik** (144 kort i elva kategorier)
byggt från de Brainscape-set som redan använts av två årskullar.

- Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4
- Supabase (Postgres, Auth, Row Level Security) i EU-region
- ts-fsrs för schemalagd repetition, KaTeX för matte
- Vitest (enhetstester, RLS-tester) och Playwright (E2E med axe)

Läs också [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), [BLOCKERS.md](BLOCKERS.md) och
[SUMMARY.md](SUMMARY.md).

## Starta lokalt

Krav: Node 22+, Docker Desktop (för Supabase CLI).

```bash
npm install
cp .env.example .env.local
npx supabase start          # startar Postgres, Auth m.m. i Docker
npx supabase status         # kopiera "anon key" till NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local
npm run db:reset            # bygger seed från seed/ och kör migrationer + seed
npm run dev                 # http://localhost:3000
```

`npm run db:reset` kör `npm run seed:build` (skapar `supabase/seed.sql` från
`seed/materialteknik/*.csv`) och därefter `supabase db reset`.

E-post lokalt (magic link, bekräftelser) hamnar i Supabase Mailpit: `http://127.0.0.1:54324`.
E-postbekräftelse vid registrering är avstängd lokalt (`supabase/config.toml`), så konton
fungerar direkt.

## Tester

```bash
npm run verify:unit   # typecheck + lint + Vitest (FSRS, migrering, import, RLS)
npm run test:e2e      # Playwright, kräver att supabase start körs och att npm run db:reset körts
npm run verify        # allt ovan, ska vara grönt före varje commit
```

RLS-testerna kör som standard mot PGlite (riktig Postgres i process) med samma migrationsfiler.
Sätt `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` för att köra dem mot
den lokala Supabase-databasen i stället.

E2E-testerna skapar en admin-användare (`admin@kuggfri.test`) via service role-nyckeln. De
lokala standardnycklarna används automatiskt; skiljer de sig, sätt `SUPABASE_SERVICE_ROLE_KEY`
från `supabase status`. Första gången: `npx playwright install chromium`.

## Koppla på ett riktigt Supabase-projekt

1. Skapa ett projekt på supabase.com och välj en **EU-region** (t.ex. Frankfurt eller Stockholm).
   Detta är ett krav: all användardata ska ligga inom EU (se integritetspolicyn).
2. Länka och kör migrationerna:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ditt-project-ref>
   npx supabase db push
   ```
3. Ladda innehållet. Antingen kör du seeden en gång mot projektet
   (`npx supabase db push` tar inte med seed.sql; kör i stället innehållet i `supabase/seed.sql`
   i SQL-editorn, eller importera via admin, se nedan).
4. I Supabase-dashboarden under Authentication → URL Configuration: sätt Site URL till din
   domän och lägg till `https://din-domän/**` under Redirect URLs. Klistra in mallarna från
   `supabase/templates/` under Authentication → Emails (Magic Link, Confirm signup), annars fungerar
   inloggningslänkar bara i samma webbläsare som beställde dem (se docs/DEPLOY.md 3b). Under Providers → Email:
   välj om e-postbekräftelse ska krävas. Aktivera inga tredjepartsinloggningar.
5. Sätt miljövariablerna (se `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.

## Göra sig själv till admin

Registrera ett konto i appen. Kör sedan i SQL-editorn (eller `psql`):

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'din@epost.se');
```

Kolumnen `is_admin` kan bara ändras med databasrättigheter; en användare kan inte sätta den
själv (testat i `tests/unit/db/rls.test.ts`). Därefter syns länken **Admin** i menyn.

## Ge en examinator tillgång till sin kurs

Admin behöver inte delas ut. Under deckets **Inställningar → Examinatorer** anger admin
e-postadressen till ett registrerat konto; personen får då redigera innehåll, se kursöversikten
(anonym statistik) och felrapporter för just det decket, men varken se andra deck, skapa eller ta
bort deck eller utse andra examinatorer. Rättigheten ligger i tabellen `deck_examiners` och
kontrolleras av `public.can_edit_deck()` i RLS-policyerna (testat i `tests/unit/db/rls.test.ts`).
Länken **Admin** i menyn visas även för examinatorer och leder direkt till deras kurs.

## Importera innehåll

I admin: öppna decket → **Importera**. Stöd för CSV och JSON med kolumnerna
`front, back, hint, category, sort_order` (endast `front` och `back` krävs). Brainscape-exporter
med rubrikerna `Question,Answer` fungerar direkt. Du får en förhandsvisning med diff (nya,
uppdaterade, oförändrade kort och nya kategorier) innan något skrivs. Kort matchas på
framsidans text.

**Exportera** ger en JSON-fil med hela decket som kan importeras igen.

Vill du ändra seed-innehållet: redigera CSV-filerna eller `deck.json` i `seed/materialteknik/`
och kör `npm run seed:build`.

## Deploya till Vercel

1. Pusha repot till GitHub och importera det i Vercel. Ramverket upptäcks automatiskt.
2. Lägg till miljövariablerna `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` och
   `NEXT_PUBLIC_SITE_URL` (din produktionsdomän).
3. `vercel.json` sätter serverfunktionernas region till `arn1` (Stockholm) så att servern kör
   inom EU nära databasen.
4. Uppdatera Site URL och Redirect URLs i Supabase till produktionsdomänen.
5. Domänen **kuggfri.com** kopplas under Vercel → Project → Settings → Domains. Vercel visar vilka
   DNS-poster (A eller CNAME) som ska läggas in hos domänleverantören. Sätt sedan
   `NEXT_PUBLIC_SITE_URL=https://kuggfri.com` och lägg till `https://kuggfri.com/**` som
   Redirect URL i Supabase.

Sajten skickar `noindex, nofollow` i både metadata och HTTP-header och har en `robots.txt` som
blockerar allt. Det är avsiktligt: deck delas via länk (`/d/<slug>`), inte via sökmotorer.

## Struktur

```
app/                 sidor och route handlers (App Router)
  d/[slug]/          deck-sida och studiesession
  admin/             adminläge (skyddat i middleware + layout)
  konto/, logga-in/, registrera/, auth/confirm/
components/          UI, studie- och adminkomponenter
lib/
  fsrs/              ren FSRS-modul, sessionsreducer
  progress/          progresslager (localStorage + Supabase), migrering
  import/            CSV/JSON-parser, diff, normalisering
  i18n/sv.ts         alla UI-strängar
  supabase/          klienter och databastyper
supabase/            config, migrationer, genererad seed
seed/                källinnehåll (CSV) och manifest per deck
tests/unit, tests/e2e
```

Datamodellen är byggd för fler innehållstyper senare (t.ex. uppgiftsbank): deck är den
gemensamma behållaren, `cards` en innehållstyp bland kommande.
