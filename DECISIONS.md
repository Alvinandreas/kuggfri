# DECISIONS – beslut jag fattat åt dig

Varje punkt: vad, varför, och hur du ändrar om du vill annat.

## Miljö och verktyg

- **RLS-tester körs mot PGlite i process** (riktig Postgres 18 kompilerad till WASM) i stället för
  Docker, eftersom Docker saknas på maskinen (se BLOCKERS.md). Samma migrationsfiler används
  oförändrade; en liten shim (`tests/unit/db/supabase-shim.sql`) återskapar rollerna `anon`,
  `authenticated`, `service_role` och `auth.uid()`. Sätt `DATABASE_URL` för att i stället köra
  testerna mot `supabase start`.
- **Systemtypsnitt i stället för Google Fonts.** Ingen extern hämtning vid bygge, ingen
  integritetsfråga, snabbare. Byt i `app/globals.css` (`--font-sans`) om du vill ha ett annat.
- **Vercel-region `arn1` (Stockholm)** i `vercel.json` så att serverkoden körs i EU nära Supabase
  EU-regionen.
- **`server-only`** används i moduler som aldrig får hamna i klienten (Supabase-serverklient,
  innehållsfrågor).

## Datamodell

- **`decks.source_credit`** är tillagd utöver specen: fritextfältet för kreditering av
  innehållskällan som visas på `/om`.
- **`study_sessions.mode` tillåter `'random'`** utöver `'fsrs'` och `'free'`, så att slumpad
  genomkörning kan skiljas från fri repetition i statistiken. Check-constraint i migrationen.
- **`profiles.is_admin` skyddas med kolumnrättigheter**, inte bara RLS: `authenticated` har
  `update (display_name)` men inte `update (is_admin)`. En användare kan alltså inte befordra sig
  själv ens med en egen policy-lucka. Testat.
- **Nollställning sker via Postgres-funktioner** (`reset_deck_progress`, `reset_all_progress`,
  `reset_schedule_keep_ratings`) som är `security definer` men alltid filtrerar på `auth.uid()`.
  Skälet är att progress på kort i ett deck som avpublicerats också ska kunna nollställas, vilket
  inte går med bara RLS (korten är då osynliga för användaren).
- **Kontoradering via `delete_my_account()`** som raderar raden i `auth.users`; allt annat
  kaskaderar via främmande nycklar. Ingen service role-nyckel behövs i appen.
- **Statistik via `deck_stats_summary` / `deck_stats_cards`** (security definer med admin-kontroll
  i funktionen). Returnerar bara aggregat, aldrig användar-id eller e-post.
- **Profiler skapas av en trigger på `auth.users`**, med `display_name` från
  `raw_user_meta_data` om det angavs vid registrering.

## Innehåll och seed

- **De elva Brainscape-exporterna är ett deck ("Materialteknik") med elva kategorier**, inte elva
  deck. Det matchar hur Brainscape organiserar "decks" inom en "class" och gör att
  schemalagd repetition kan blanda hela kursen.
- **Kategorititlarna är mina tolkningar av innehållet** (filerna hette bara `deck_<id>.csv`).
  Ordningen följer ungefär kursens upplägg (grunder → materialval → struktur → egenskaper → stål →
  termiskt → hållbarhet → tillverkning → metaller → begrepp). Ändra i `seed/materialteknik/deck.json`
  eller direkt i admin.
- **Kurskod `MTM081`** är hämtad från exemplet i din spec. Kontrollera att den stämmer och ändra i
  admin annars.
- **Kreditering (`source_credit`)** är en kort text jag skrivit utifrån din beskrivning. Redigera
  i admin.
- **Seed-texten normaliseras lätt till giltig markdown** (`lib/import/normalize.ts`): rader som
  börjar med "−" blir nästlade punkter, och en rubrikrad med kolon direkt efter en lista får en
  tomrad före sig. Inget innehåll ändras i övrigt. Admin-importen rör inte texten alls.
- **Deterministiska UUID:n i seeden** (UUID v5 av slug + kategori + framsida) så att
  `supabase db reset` inte byter id på korten; gästers localStorage-progress överlever därmed.
- **`supabase/seed.sql` är en genererad fil** som ändå är incheckad, så att `supabase db reset`
  fungerar utan extra steg. Bygg om med `npm run seed:build` när du ändrar i `seed/`.

## Studieläge

- **Skattning 1–5 → FSRS**: 1 och 2 → Again, 3 → Hard, 4 → Good, 5 → Easy (enligt spec). Rå
  skattning sparas i `self_rating`.
- **Fri och slumpad repetition skriver aldrig till `card_progress`**, inte ens `self_rating`.
  Specen säger att `card_progress` inte får muteras i fri repetition, och jag tolkar slumpad
  genomkörning på samma sätt. Sessionens skattningar visas i sammanfattningen men försvinner sedan.
  Sessionen loggas i `study_sessions` för inloggade (mode `free`/`random`).
- **"Föregående" i schemalagt läge** går tillbaka till senast visade kort, men en ny skattning där
  schemalägger om kortet igen (senaste skattningen vinner). "Nästa" utan skattning i schemalagt läge
  lägger kortet sist i kön.
- **Swipe**: horisontellt svep = föregående/nästa i alla lägen. På ett vänt kort betyder svep åt
  vänster skattning 1 och svep åt höger skattning 5; däremellan används knapparna. Det ger snabb
  tumnavigering utan att kräva fem olika gester.
- **Gästprogress i localStorage** under nyckeln `plugget:progress:v1`, samma fältnamn som
  `card_progress`. Temat sparas under `plugget:theme`. Inget annat lagras lokalt.
- **Migrering vid inloggning**: varje lokalt kort jämförs med databasens rad; den med senast
  `last_review` vinner (lokal rad utan `last_review` vinner bara om databasen saknar raden).
  Efter lyckad migrering rensas localStorage.

## Auth

- **E-postbekräftelse är avstängd i lokala Supabase** (`enable_confirmations = false` i
  `supabase/config.toml`) så att E2E-testerna kan registrera konton direkt. Slå på det i det
  riktiga projektet om du vill; koden hanterar båda fallen.
- **Admin-skyddet ligger i middleware** (svarar 403 utan att rendera) **och** i `/admin`-layouten
  (`forbidden()` → status 403). Alla server actions under admin kontrollerar dessutom `is_admin`
  själva. Databasen nekar ändå via RLS om något skulle missas.
- **Inga tredjepartsinloggningar**, ingen telefon, inga profilbilder.
