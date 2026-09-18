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
- **Gästprogress i localStorage** under nyckeln `kuggfri:progress:v1`, samma fältnamn som
  `card_progress`. Temat sparas under `kuggfri:theme`. Inget annat lagras lokalt.
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

## Beslut 2026-09-14 (efter Alvins feedback)

- **Nollställning ligger under Konto**, inte på deck-sidan, på Alvins uttryckliga önskan (specen sa
  ursprungligen motsatsen). Gäster har ingen kontosida och specen kräver att de kan nollställa, så
  deck-sidan behåller en diskret textlänk längst ner för att nollställa just det decket.
- **Urvalsrullgardinen är borttagen.** Urvalet görs via kryssrutor i kategorilistan; en
  sammanställning visar valda kategorier, antal kort och antal inlärda. Filtret "bara kort med låg
  skattning" (krav i specen) finns kvar som en kryssruta i fri repetition.
- **Kortet stämplas vid skattning** med siffran i skattningens färg och glider ut åt vänster; nästa
  kort visas alltid på framsidan. Vändläget är knutet till kort + position, aldrig till komponenten,
  så ett kortbyte kan inte utlösa en flip.
- **Kategorifärger** är tio tokens (`--tag-1` … `--tag-10`) som tilldelas efter kategorins plats i
  decket. Samma färg används på kortet, i kategorilistan och i urvalssammanställningen.
- **Dubbletter i seeden tas bort automatiskt** (samma första 100 tecken i svaret, första förekomsten
  vinner). Sju kort försvann ur "Tillverkning och värmebehandling av stål".
- **Typografiska rättelser i seed-bygget** (`applyTypography`): `=>` → `→`, nedsänkta siffror i
  kemiska formler, unicode-matte som KaTeX. Godkänt av Alvin; rör aldrig innehållet.
- **Namnet är Kuggfri** (kuggfri.com). localStorage-nycklarna bytte samtidigt namn.
- **Stabil testkopia på port 3001** (`NEXT_DIST_DIR=.next-prod`) så att Alvin kan testa medan
  dev-servern på 3000 kompilerar om.

## Beslut 2026-09-14, runda 3

- **Repetitionshistorik (`review_log`)** loggas i alla lägen, även fri och slumpad repetition,
  eftersom det är aktivitet och inte schema. Specens krav att fri repetition inte muterar
  `card_progress` gäller fortfarande och testas. Nollställning av deck/allt raderar även historiken;
  schemanollställning behåller den.
- **"Kluriga kort"** uppdaterar bara `self_rating` och `last_review`, aldrig FSRS-fälten. Annars skulle
  ett cramläge skjuta fram schemat. Ett aldrig sett kort får en rad i state New så att det slutar
  räknas som klurigt utan att bli "repeterat" för schemat.
- **Ordning inom samma nivå slumpas** (förfallodag för fsrs, skattning för fri/kluriga). Fri repetition
  går svagast först i stället för deckets ordning, på Alvins önskan.
- **Diagram i ren SVG** utan bibliotek. Paletten (`--chart-1` grön, `--chart-2` blå) är validerad med
  dataviz-skillens validator i både ljust och mörkt läge. Två serier har legend och direkt etikett;
  varje diagram har tabellvy.
- **Kontrastfärgen är grön** (`#1f7a4d` / `#3aa868`), samma som diagrammens huvudfärg.

## Beslut 2026-09-15, produktion

- **Inloggningslänkar använder `token_hash`, inte Supabase standardlänk.** Standardmallen går via
  Supabase verify-sida och lämnar en PKCE-kod som bara kan lösas in i webbläsaren som beställde
  länken. Studenter öppnar mejl i mobilens mejlapp eller på en annan enhet, så det flödet håller inte.
  Egna mallar i `supabase/templates/` länkar till `{{ .SiteURL }}/auth/confirm?token_hash=…`, som
  verifieras server-side utan cookies. `/auth/confirm` och middleware stöder fortfarande `?code=`
  som reserv. Mallarna klistras in i molnprojektets dashboard (docs/DEPLOY.md 3b); `config push`
  används inte eftersom den skulle skriva över molnets Site URL och redirect-lista med lokala värden.
- **Byt lösenord under Konto** i stället för ett separat "glömt lösenord"-flöde. Inloggningslänken
  är återställningsvägen: logga in med länk, välj nytt lösenord. Färre mejl, färre sidor, samma
  resultat. Kräver ingen ominloggning (`secure_password_change` är av).
- **Felrapporter från studenter (`card_reports`)** är kvalitetsslingan: vem som helst, även gäster,
  kan flagga ett kort direkt från studieläget; admin ser rapporterna per deck, hoppar till kortet,
  åtgärdar och markerar. Kolumnrättigheter gör att klienten bara får sätta kort, text och kontakt;
  `user_id` sätts av databasen (`default auth.uid()`), status av default. RLS släpper bara in
  rapporter på kort i publicerade deck och låter bara admin läsa. Ingen rate-limit ännu; om skräp
  dyker upp är en captcha eller "max N per timme och IP" nästa steg. Inloggningslänken var inte
  klar för molnet (kräver egen SMTP), så det här är veckans viktigaste tillägg inför examinatormötet:
  det gör granskningserbjudandet konkret.
- **Admin är kategori-först.** Deckets adminsida visar kategorierna (deckets ordning, antal kort,
  byt namn/ta bort/ordna om) och varje kategori har en egen sida med sina kort. 144 kort i en platt
  lista var oöverskådligt. Konsekvens: **deckets ordning definieras som kategoriordning, sedan
  kortordning inom kategorin** (`sortCardsByCategory`), så att ombeställning inom en kategori aldrig
  rör de andra. Kort utan kategori ligger sist och nås via "Utan kategori".
- **Logotypen** är Alvins original (brand/) med oförändrad komposition, bara beskuren till innehållet.
  Två färgvarianter byggs av ett skript: mörkt bläck för ljust tema (annars osynlig), vitt för mörkt;
  bocken förblir vit på grön. Visas bara i sidhuvudet (40 px) och på /om, inte på startsidan
  (dubblering). Appikon och favicon byggs från Alvins separata ikonfil (bara kugghjulet).
- **Radardiagram i stället för linjediagram** på decksidan: kunskap per kategori är mer talande för
  en student än ackumulerade kurvor, och passar bredvid stapeldiagrammet. Elva långa kategorinamn
  får inte plats runt en radar i en tredjedelskolumn, så axlarna är numrerade och namnen står i en
  färgkodad lista under båda diagrammen (samma färg som kategorins tagg). Fylld yta = inlärda,
  streckad kontur = studerade; legend, hover och tabellvy enligt dataviz-reglerna.
- **Fri och slumpad repetition rör fortfarande inte progressen** (specens krav), men det står nu i
  lägesbeskrivningen. Alvin pluggade 42 kort i fri repetition på kuggfri.com och undrade varför
  kategorier och radar stod stilla. Alternativet, att låta fri repetition räkna som "studerat", bryter
  specens "påverkar inte schemat" och gör radarn tvetydig; tydligare text valdes i stället.
- **Kortinnehåll centreras med `m-auto` på barnet, inte `items-center` på behållaren.** Med
  items-center + overflow klipps toppen av långt innehåll under rubrikraden och går inte att scrolla
  fram; med m-auto är kort innehåll fortfarande centrerat och långt innehåll scrollas från toppen.
- **Skattningskvittensen skalar med betyget.** 5 och 4 får större stämpel, längre intåg och en grön ring
  runt kortet; 1 och 2 en mindre stämpel och en kort skakning. Poängen är känslan: en femma ska
  kännas som en belöning, en etta ska kännas.
- **"Delvis inlärda" = skattning 3 eller 4.** Alvin bad om "3"; kort med 4 ("Bra") räknas också som
  delvis, annars försvinner de ur diagrammet (inlärt kräver 5). Ändras lätt i `categoryStats`.
- **Tabellvyerna är dolda (sr-only), inte borttagna.** Alvin vill inte se länken; skärmläsare får
  ändå siffrorna, vilket dataviz-reglerna kräver.
- **Kategorifärgerna** är tio jämnt fördelade nyanser i oklch (ljust: L 0,90 C 0,10; mörkt: L 0,44
  C 0,13), inga bruna eller grå steg. Text i förgrundsfärg ovanpå fungerar i båda teman.
- **Admin-rader är helt klickbara** (osynlig länk som täcker raden, knappar ovanpå) med hover, för
  både kategorier och kort, så att listorna beter sig likadant. Ingen separat "Öppna"-knapp.
- **E-postbekräftelse är avstängd** i produktion. Kontot skapas direkt med lösenord, ingen väntan på
  mejl som kan fastna i Supabase inbyggda gräns (ett par mejl per timme). Egen SMTP (Resend) läggs
  till före lansering till studenter, se docs/DEPLOY.md 3c.

## Beslut 2026-09-17, efter mötet med Johan

- **Examinatorroll per deck** (`deck_examiners`, `can_edit_deck()`). Admin är global; en examinator
  ser och redigerar bara sina deck. Skapa/ta bort deck och utse examinatorer är admin-only. Valt i
  stället för att ge Johan full admin, eftersom tjänsten ska kunna hosta flera kurser med olika
  examinatorer utan att de ser varandras innehåll eller statistik.
- **Adminvyn är deck-centrerad**: `/admin` går direkt till kursen när användaren bara har en,
  decket har flikarna Översikt, Innehåll, Felrapporter, Importera, Inställningar. Listan över alla
  deck finns på `/admin/deck` (bara admin ser "Alla deck"/"Nytt deck").
- **Kursöversikten** (`deck_stats_overview`, ett RPC-anrop) visar bara aggregat: antal studenter,
  aktiva, repetitioner per dag, kunskap per kategori (genomsnitt per student), kluriga frågor
  (andel skattningar 1–2 per kort). Inga user_id eller e-postadresser lämnar databasen.
  `MIN_RATINGS` i CourseOverview.tsx är 1 under utvecklingsfasen och ska höjas (5) före
  lansering så att ett enskilt svar inte kan läsas ut.
- **Kursöversikten är examinatorns, inte studentens uppskalad** (Alvins synpunkt 17 sep kväll):
  repetitioner per dag och radar ersattes av svåraste områdena (snittskattning per kategori),
  fördelning av hur långt studenterna kommit, aktiva per vecka, skattningsfördelning och senaste
  felrapporterna. Varje panel svarar på en fråga examinatorn faktiskt har inför föreläsning/tenta.
- **Arbetssätt:** inga skärmdumpar utan begäran; ingen push till kuggfri.com förrän Alvin
  verifierat på testkopian (3001). Felrapporter adresseras i UI:t till "kursens examinator";
  admin ser dem också men det nämns inte för studenterna.
- **Skydd mot felklick**: deck-radering kräver att titeln skrivs, avpublicering och radering av
  felrapport har bekräftelsedialog, opublicerat deck visar banderoll för redaktören, egen
  `app/error.tsx`.

## Beslut 2026-09-19, efter omvärldsanalysen (docs/OMVARLDSANALYS.md)

- **Ingen kodfrysning, i stället återställningsrutin** (`docs/ATERSTALLNING.md`): git-taggen
  `v1-lansering` markerar produktionsläget inför lanseringen, Vercel "Promote to Production" rullar
  tillbaka koden på en minut, migrationer är expanderande (bara lägga till) och har en kommenterad
  ÅNGRA-sektion, backup + återställningstest före varje migration.
- **Dosering: 20 nya kort per dag som standard** (`lib/study/plan.ts`, `DEFAULT_DAILY_NEW`), valbart
  10/20/40 under "Nya kort per dag" på decksidan (sparas i `kuggfri:prefs:v1` per enhet). Förfallna
  kort kommer alltid med. Skälet: första sessionen var 144 kort, samma "backlog-ångest" som 82 % av
  läkarstudenter rapporterar om Anki. Sammanfattningen säger "Klar för i dag" när inget förfallet
  finns kvar och dagsmålet är nått, med länk "Ta N nya kort till" (URL-parametern `nya=N`) för den
  som vill mer. Två sessioner samma dag delar dagsmålet (räknas ur historiken).
- **Tentadatum per deck** (`decks.exam_date`, sätts av examinatorn under Inställningar). Styr tre
  saker: intervalltak så att inget kort skjuts förbi tentan (`maxInterval = dagar kvar − 3`, eftersom
  ts-fsrs lägger Good/Easy en–två dagar över taket), dosering så att alla nya kort är introducerade
  fyra dagar före tentan (öppet "ikappläge" om det kräver mer än dagsmålet, aldrig tyst
  omschemaläggning), och slutrepetition de sista två dagarna (alla kort i urvalet, lägst
  återkallelsesannolikhet först). Efter tentan fortsätter schemat långsiktigt. Ingen
  studentöverstyrning ännu.
- **Streak med frysningar** (`computeStreak` i `lib/stats/progress-stats.ts`): två frysningar,
  påfyllning var sjunde aktiva dag, i dag räknas aldrig som missad förrän dagen är slut, valfritt
  "vardagar" som undantar helger. Allt beräknas ur historiken (fungerar för gäster, kan inte gå
  sönder av synk). Ingen notis om att streaken "är i fara".
- **Skattningsskalan behåller fem knappar men blir ärlig:** etiketterna är nu "Inte alls / Nästan /
  Med möda / Bra / Direkt" (3 är ett godkänt i FSRS, "Sådär" lät som ett underkänt) och i schemalagt
  läge visar varje knapp när kortet kommer tillbaka. Mappningen 1,2→Again, 3→Hard, 4→Good, 5→Easy
  är oförändrad; ändras först om studenttestet första veckan visar att 3 missbrukas.
- **Fuzz på i FSRS** (`enable_fuzz: true`): intervallen sprids några procent så att kort som lärts in
  samma dag inte förfaller i klump. Deterministiskt per kort.
- **"Uppskattad kunskap just nu"** (summa av FSRS-återkallelsesannolikheter) visas på decksidan och
  i sammanfattningen, med "baserat på N repeterade kort". Ersätter inte "Inlärda" än, men är det
  ärligare måttet (studenter läser "kort sedda" som "kort inlärda").
- **QR-kod** på decksidan (biblioteket `qrcode`, renderas som SVG i webbläsaren först vid klick).
- **Rörelse:** kortvändningen 260 ms med ease-out (var 420 ms), kortinträde 180 ms. Stämpeln vid
  skattning är kvar oförändrad (Alvins val i runda 3–8). En enda lugn animation vid "Klar för i dag".
- **`npm run db:types` skriver över den handskrivna typfilen** (`lib/supabase/database.types.ts`)
  med råformatet; nya kolumner läggs till för hand. Noterat i filens huvud.

## Beslut 2026-09-19, omgång två (Fas 1 klar, Fas 2 påbörjad)

- **Utkorg för inloggade** (`lib/progress/outbox.ts`, `kuggfri:outbox:v1`): en skrivning som
  misslyckas (spårvagnen, tappat wifi) köas i localStorage och skickas när sidan laddas nästa gång
  eller när webbläsaren säger att nätet är tillbaka. Sessionen visar "N skattningar väntar på
  anslutning" i stället för ett fel. Det är den del av "offline" som handlar om förtroende: en
  repetition försvinner aldrig. Fullt offlineläge (service worker som serverar sidan utan nät)
  är kvar i planen; det kräver mer och ger mindre.
- **Provtenta** (läget `exam`): 30 slumpade kort ur urvalet, ingen ledtråd, ingen tillbaka, rör
  aldrig progressen (som fri repetition) men loggas i historiken. Resultatet visas som andel kort
  skattade 4–5. Skälet (OMVARLDSANALYS 3.10, princip 4): studenter överskattar sig; ett
  fullängdstest kalibrerar bättre än frågebankens procent. Check-villkoren för `mode` i
  `review_log` och `study_sessions` utökades (migration 20260919000100).
- **"Kan nu"-kolumn** i kategoritabellen: uppskattad andel av kategorin studenten kan just nu
  (summa FSRS-återkallelse / antal kort, aldrig sedda = 0). Visas först när minst tre kort i
  kategorin repeterats; annars "–". Radardiagrammet lämnas orört.
- **Aktivering i kursöversikten** ("Kommer studenterna tillbaka?"): andel med minst 20
  repetitioner första dagen, och andel som repeterade igen inom tre dagar (räknas bara för dem vars
  första dag ligger minst tre dagar tillbaka). Beräknas i `deck_stats_overview` ur `review_log`,
  aggregerat, inga id:n. Det är planens aktiveringsmått, utan tredjepartsanalys.
