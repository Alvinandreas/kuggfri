# SUMMARY – läget när du vaknar

## Titta på detta först

1. **Docker saknas på den här maskinen.** Installera Docker Desktop, kör sedan:
   ```bash
   npm install
   cp .env.example .env.local
   npx supabase start
   npx supabase status      # klistra in anon key i .env.local
   npm run db:reset
   npx playwright install chromium
   npm run verify
   ```
   **Uppdatering 2026-09-14:** Docker är installerat, Supabase kör lokalt och hela `npm run verify`
   är grön (134 enhetstester inkl. alla RLS-policyer + 28 E2E-tester med axe). Se TASKS.md för
   veckans läge.
2. **Kontrollera innehållet i seeden**: kategorititlar, ordning, kurskod (`MTM081` är tagen från
   din spec-exempeltext) och krediteringstexten i `seed/materialteknik/deck.json`. Allt kan också
   ändras i admin.
3. **Gör dig till admin** enligt README och klicka igenom admin: redigera ett kort med
   förhandsvisning, dra om ordningen, importera en CSV, titta på statistiken.
4. Gå igenom några kort i mobilen. Textnormaliseringen från Brainscape (punktlistor) är
   försiktig; enstaka kort kan behöva en handpåläggning i admin.

## Läget måndag 14 sep, kväll

- Docker, lokal Supabase och hela `npm run verify` gröna (157 enhetstester, 30 E2E).
- Tre feedbackrundor från Alvin införda: färgkodade kategorier med klickbar lista och urval,
  centrerad fråga, stämpel och animationer vid skattning, desktop-layout, nollställning under Konto,
  slumpad ordning inom samma nivå, läget "Kluriga kort", grön kontrastfärg, samt statistik med
  diagram under "Din progress" byggd på en ny repetitionshistorik (`review_log`).
- Innehåll: typografi rättad, sju dubbletter borta, K1c-formeln rättad. 144 kort.
- Appen heter Kuggfri. Stabil testkopia på http://localhost:3001.
- Väntar på Alvin: Supabase-projekt, GitHub, Vercel (för kuggfri.com), nästa feedbackrunda.
- Se TASKS.md för allt annat.

## Klart

- **Studieläge**: schemalagd repetition (FSRS via ts-fsrs), fri repetition (hela decket, en
  kategori eller kort med låg skattning), slumpad genomkörning. Flip-animation, skattning 1–5
  med knappar, siffertangenter och swipe, pilar/swipe för föregående/nästa, ledtråd,
  progressindikator, aria-live, sessionssammanfattning med fördelning, "behöver mest arbete"
  och nästa schemalagda repetition.
- **Nollställning** direkt på deckets sida: hela decket, allt, eller bara schemat med behållna
  skattningar. Bekräftelsedialog. Finns även på kontosidan.
- **Gästläge** med progress i localStorage (samma struktur som `card_progress`), banner, och
  migrering till kontot vid inloggning där senaste `last_review` vinner.
- **Konton**: e-post/lösenord och magic link, kontosida med visningsnamn, "ladda ner mina data"
  (JSON) och fullständig kontoradering som kaskaderar.
- **Admin** (`/admin`, 403 för andra via middleware och layout): CRUD för deck, kategorier och
  kort, live-förhandsvisning av markdown/KaTeX, drag-and-drop-ordning (även tangentbord och
  knappar), CSV/JSON-import med diff-förhandsvisning, JSON-export, publicera/avpublicera,
  statistik per deck (unika användare, genomgångna kort, snitt per kort, lägst snitt).
- **Datamodell och RLS** enligt spec plus `decks.source_credit`. Ett test per policy mot riktig
  Postgres. Testerna hittade och stoppade en riktig lucka: utan explicit `revoke` skulle
  Supabase-standardrättigheterna ha låtit användare sätta `is_admin` på sig själva.
- **Design**: tokens i `app/globals.css`, ljust/mörkt efter system med manuell override,
  `prefers-reduced-motion`, systemtypsnitt, mobilförst (kontrollerat vid 375 px), svenska
  strängar i `lib/i18n/sv.ts`.
- **GDPR**: integritetspolicy på `/integritet`, `/om` med kreditering per deck, `noindex` +
  `robots.txt`, inga kakor utöver sessionen, ingen analytics, Vercel-region Stockholm.
- **Seed**: dina elva Brainscape-exporter som ett deck med elva kategorier, 144 kort, byggt av
  `npm run seed:build`.

## Återstår / kända luckor

- E2E-testerna körs nu mot lokal Supabase och är gröna (2026-09-14). De kräver `supabase start`.
- Byte av e-postadress finns inte i gränssnittet (policyn hänvisar till kontakt). Lätt att lägga
  till med `supabase.auth.updateUser`.
- Ingen paginering i admin-kortlistan (144 kort går bra; tusentals blir långsamt).
- Import via fil läser filen i webbläsaren; mycket stora filer (>5 MB) har inte testats.
- Statistiken räknar bara inloggade användare (gäster finns bara i sina webbläsare). Det står
  på statistiksidan.
- Deckets slug kan ändras i admin; gamla länkar slutar då fungera (ingen redirect-tabell).

## Beslut jag fattat åt dig

Se [DECISIONS.md](DECISIONS.md). De viktigaste:

- Fri och slumpad repetition skriver **ingenting** till progressen, inte ens självskattningen.
- Skattning 1–2 → Again, 3 → Hard, 4 → Good, 5 → Easy. Korta inlärningssteg i FSRS är
  avstängda; sessionen visar i stället kort med 1–2 igen innan den är slut.
- Swipe: på ovänt kort bläddrar det, på vänt kort betyder vänster = 1 och höger = 5.
- Ett deck ("Materialteknik") med elva kategorier, inte elva deck.
- Kategorititlarna är mina tolkningar av innehållet i filerna.

## Commits

Varje skiva är en commit på `main`, alla med grön `verify:unit`. Kör `git log --oneline`.
