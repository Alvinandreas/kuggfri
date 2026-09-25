# TASKS – levande uppgiftslista

Claude uppdaterar den här filen löpande. Alvin behöver inte göra något här utom att läsa.
Syfte: alltid veta vad som är klart, vad som pågår, vad som väntar och vad som tillkommit.

Legend: `[x]` klart · `[ ]` att göra · `[~]` pågår · `[?]` väntar på Alvin · `[-]` skippat (med skäl)

Presentationen för Johan (examinator) torsdag 17 sep 08:30 är genomförd: samarbete spikat. Ny deadline: **presentation för studenterna tisdag 22 sep 10:00 på Johans föreläsning**, lansering direkt därefter. Helgen 19–20 sep är arbetshelg.

## Väntar på Alvin (blockerar)

- [x] Installera Docker Desktop och säga "Docker är igång" (klart mån 09:45, krävde `wsl --install` + omstart)
- [?] Bestämma: publik deploy (Supabase EU + Vercel + GitHub, ~30 min mån 13:00) eller demo från laptop
- [x] Registrera konto i appen och ange e-post så att Claude kan sätta is_admin (klart mån 20:30, efter att Confirm email stängts av)
- [?] Testa fem kort i mobilen och lämna felaktighetslista (mån 18:30)
- [?] Sista ändringslista efter tisdagens rapport (ons 09:45)

## Måndag 14 sep

### När Docker finns
- [x] `npx supabase start`, skriv riktig anon-nyckel till `.env.local` (mån 10:05; migrationer + seed kördes automatiskt vid start)
- [x] 144 kort laddade, `/d/materialteknik` kontrollerad mot riktig databas
- [x] `npx playwright install chromium`
- [x] `npm run test:e2e`: 28/28 gröna efter fixar (understrukna textlänkar för axe, tvetydiga lokatorer, admin ser opublicerade deck, längre timeouts för dev-kompilering, städning av importerade testkort)
- [x] `npm run verify` grönt mån 10:55 (134 enhetstester + 28 E2E), BLOCKERS.md uppdaterad
- [x] Adminflödet mot riktig databas: deck, kategori, kort, import, export (E2E) samt ombeställning och statistik (manuellt som admin@kuggfri.test). Hittade och rättade: seedens sort_order räknades per kategori så att kategorierna blandades i deckets ordning; nu global numrering
- [x] Gör Alvin till admin (SQL enligt README) när e-post finns (lokalt mån 11:55, molnet mån 20:30)

### Deploy (Alvin vill ha kuggfri.com uppe till torsdag)
- [x] Konton skapade på Supabase och Vercel (mån 16:30)
- [x] `docs/DEPLOY.md` med exakta steg för Alvin; `supabase/deploy/full.sql` (alla migrationer + seed) för SQL-editorn; `npm run deploy:sql` bygger om den
- [x] GitHub: repo `Alvinandreas/kuggfri`, `main` pushad (mån 17:05). Remote-URL innehåller användarnamnet så att Git inte tar fel konto
- [x] Supabase CLI inloggat (mån 17:15). Projekt **Kuggfri**, ref `fujwpsmqllqwvnzaxatg`, region eu-west-1 (Irland, EU), URL `https://fujwpsmqllqwvnzaxatg.supabase.co`, anon-nyckel hämtad
- [x] Alvin körde `supabase link` + `db push --include-seed` (mån 17:30): 4 migrationer, 144 kort i molnet
- [x] Vercel: **https://kuggfri.vercel.app** svarar med riktig data och noindex (mån 17:35)
- [x] Alvin registrerade konto på kuggfri.vercel.app (Confirm email avstängt i Supabase); is_admin = true satt i molnet via `supabase db query --linked` (mån 20:30)
- [x] Site URL `https://kuggfri.com` och Redirect URLs för kuggfri.com och kuggfri.vercel.app satta av Alvin (mån 21:15)
- [x] Domänen kopplad (mån 21:00): DNS hos Hostinger (A `@` → 216.198.79.1, CNAME `www` → Vercels projektspecifika värde), certifikat utfärdat, `https://www.kuggfri.com` svarar. Gästflödena 5/5 gröna mot domänen. Huvudadress kuggfri.com, www och http omdirigerar dit (308), verifierat mån 21:15
- [x] Gästflödena i E2E mot produktion: 5/5 gröna (`E2E_BASE_URL=https://kuggfri.vercel.app E2E_SKIP_SETUP=1`, mån 17:50)
- [x] Seed i molnet via `db push --include-seed` (144 kort)
- [x] Miljövariabler i Vercel, deploy. Registrering med lösenord fungerar i produktion (mån 20:30). Magic link väntar på egen SMTP (se Tillkommit)
- [x] Site URL / Redirect URLs satta av Alvin i Supabase-dashboarden
- [x] Sätt Alvin som admin även i molnet (mån 20:30)

### Innehållsgranskning, steg 1
- [x] `scripts/content-review.ts` listar kort med formateringsanmärkningar (körs med `npx tsx scripts/content-review.ts`)
- [x] Alvin godkände alla fyra åtgärderna + borttagning av dubbletter (mån 11:30). Gjort: pilar →, nedsänkta kemiska formler, unicode-matte som KaTeX, sju dubbletter bort. Decket har nu 144 kort. Kvar i `docs/INNEHALL-GRANSKNING.md`: 10 ofarliga radbrytningsanmärkningar
- [x] Brottseghetskortet rättat till $K_{1c} = \sqrt{E\,G_c}$ (Alvin sa ja mån 11:55; ändrat i CSV, seed och direkt i lokala databasen utan omladdning)
- [x] Alvin är admin lokalt (alvinandreas.cth@gmail.com, is_admin = true, mån 11:55)
- [x] Stabil testkopia: produktionsbygge i `.next-prod` på **http://localhost:3001** så att Alvins test inte störs av dev-serverns omkompileringar. Byggs om med `NEXT_DIST_DIR=.next-prod npx next build` när nya ändringar ska testas
- **Regel från och med nu:** ingen `supabase db reset` medan Alvin har konto och progress lokalt. Seedändringar appliceras med riktade SQL-uppdateringar

## Alvins feedback (mån 12:15), i prioritetsordning

- [x] F6. Nollställningsfältet: knapparna staplas i en kolumn med hjälptext under (mån 13:10)
- [x] F3. Frågan centrerad på framsidan, baksidan lodrätt centrerad när den är kort
- [x] F2. Färgade kategoritaggar (tio tokens i globals.css, index efter kategorins plats i decket) uppe till vänster på kortet och i kategorilistan
- [x] F4. Kortet glider in, pulserar i skattningens färg och glider ut (åt vänster vid 3–5, åt höger vid 1–2); knappar trycks ihop vid klick; allt av vid prefers-reduced-motion
- [x] F5. Kategoritabell med kryssrutor (flera kategorier i urvalet, URL `urval=kategori:id1,id2`), klick på namnet väljer bara den, kolumner Studerade/Inlärda, stapel (studerat tonat + inlärt grönt), sortering "Minst inlärt först". Rullgardinen kvar och synkad
- [x] F1. Desktop: innehållsbredd 64 rem, deck-sidan i två kolumner med Starta/Nollställ sticky till höger, bredare kort i studieläget. Mobil: Starta-panelen före kategorilistan
- [ ] F2b (senare): färgtema utöver taggarna, om Alvin vill ha mer färg i helheten

## Alvins feedback, runda 2 (mån 14:00)

- [x] G1. "Deckets ordning" → "Kronologisk ordning"
- [x] G2. Urvalsrullgardinen borttagen; i stället en sammanställning "Ditt urval" med valda kategorier som taggar, antal kort och antal inlärda. Låg-skattning-filtret finns kvar som en kryssruta i fri repetition (specen kräver det)
- [x] G3. Vid skattning: kortet stämplas med siffran i skattningens färg, glider ut åt vänster, och nästa kort visas alltid på framsidan (ingen flip mitt i bytet). Kortbunt bakom kortet
- [x] G4. Större kategoritagg: text-base på kortet, mer luft i pillret
- [x] G5. Bredare desktop: innehållet följer skärmen upp till 76 rem (88 rem på mycket breda skärmar); kortet max 56 rem
- [x] G6. Nollställning flyttad till kontosidan (per deck, bara schemat, allt). Deck-sidan har bara en diskret textlänk längst ner för att nollställa det decket, eftersom gäster inte har någon kontosida (specen kräver att gäster kan nollställa)
- [x] E2E 30/30 gröna efter runda 2 (mån 14:50), kopian på port 3001 ombyggd

## Alvins feedback, runda 3 (mån 16:00)

- [x] H1. Ordningen är inte hårdkodad: fsrs blandar kort med samma förfallodag och alla nya kort; fri repetition och kluriga kort går svagast först (1, 2, aldrig sedda, 3, 4, 5) med blandning inom varje grupp
- [x] H2. Stämpeln syns cirka 0,7 s innan kortet glider ut, och ligger centrerad i kortet
- [x] H3. "Din progress" har fyra nyckeltal (inlärda, dagar i rad, repetitioner i dag, snitt 7 dagar), stapeldiagram "Repetitioner per dag" (14 dagar) och linjediagram "Ackumulerad kunskap" (sedda och inlärda). Ny tabell `review_log` med RLS-tester, localStorage-motsvarighet för gäster (`kuggfri:reviews:v1`), migreras till kontot vid inloggning, rensas vid nollställning. Diagrammen har hover-tooltip och tabellvy
- [x] H3b. Grön kontrastfärg (#1f7a4d ljust, #3aa868 mörkt) och diagrampalett validerad med dataviz-skillens verktyg i båda lägena
- [x] H4. Läget "Kluriga kort": bara kort med skattning 1–2 eller aldrig sedda; kategorier utan kluriga kort är gråade; skattning i läget uppdaterar self_rating men inte FSRS-schemat. Migration för `study_sessions.mode`
- Historiken loggas i alla lägen (även fri och slumpad) eftersom den bara är aktivitet, inte schema. Fri/slumpad rör fortfarande aldrig `card_progress` (testat)
- [x] Namnbyte Plugget → **Kuggfri** (kuggfri.com) i app, dokument, lagringsnycklar (`kuggfri:progress:v1`, `kuggfri:theme`), testkonton och exportfilnamn (mån 13:30). Obs: gästprogress sparad under gamla nyckeln följer inte med; ingen har sådan ännu utom Alvins egna tester
- [x] Domän: kuggfri.com kopplad i Vercel via Hostinger-DNS (mån 21:00)

## Tisdag 15 sep (Alvin fullbokad, Claude jobbar ensam)

- [x] Rätta allt från Alvins måndagslista (båda rundorna gjorda redan måndag)
- [x] Formatera om kort enligt den godkända granskningslistan (gjort mån 11:40 via `applyTypography` i seed-bygget, med tester)
- [x] Konvertera unicode-matte till KaTeX (gjort mån 11:40)
- [x] `docs/PRESENTATION.md` utkast skrivet redan mån 11:10, uppdaterat efter runda 2. Alvin redigerar ons kväll
- [x] Sessionssammanfattningen visar kategoritagg på korten som behöver mest arbete
- [~] Mobilpolish: långa baksidor scrollar inom kortet (max 55 dvh), KaTeX-block scrollar vågrätt, ljust/mörkt kontrollerat med taggar. iOS Safari kan bara Alvin testa i riktig telefon (svep från vänsterkant krockar med bakåtgesten, det är känt och accepterat)
- [ ] Rapport i chatten 12:00 och 17:00
- [x] Ta bort `/d/dev-preview`-rutten (ons kväll)

## Onsdag 16 sep (kväll: förberedelser inför Johan, se kartläggningen i chatten)

- [x] Alvin registrerade om kontot med manuellt lösenord, admin satt i molnet (ons 20:30)
- [x] Felrapporter (se Tillkommit)
- [x] Granskningsunderlag: `docs/granskning-materialteknik.pdf` (144 kort per kategori, kryssrutor + anteckningsrad, byggs med `npx tsx scripts/build-review-pdf.tsx`)
- [x] Appikon + manifest ("lägg till på hemskärmen"): `scripts/build-icons.py` → public/icon-*.png, `app/manifest.ts`, apple-touch-icon
- [x] /om: avsnitt "För kursansvariga"; /d/dev-preview borttagen
- [x] Lämna-kvar-sida: `docs/lamna-kvar-johan.pdf` (källa `docs/lamna-kvar-johan.html`), skriv ut och lägg ovanpå granskningsunderlaget
- [x] Allt pushat och live på kuggfri.com (ons 21:50, commit be99e4e): felrapporter, ikon/manifest, /om, mobilfix i admin. Testkopian på 3001 ombyggd
- [x] Skärmdumpar av hela flödet som reserv: `docs/demo-skarmdumpar/` (17 bilder: gäst i mobilen mot kuggfri.com, admin på desktop; byggs om med `node scripts/demo-shots.cjs`)
- [x] Feedbackrunda 4 (ons 22:30, lokalt, ej pushad förrän Alvin verifierat): Alvins logotyp i sidhuvud, startsida och /om (ljus/mörk variant, `scripts/build-logo.py` → public/logo-*.png, nya appikoner från märket); kryssrutan i kategoritabellen fick luft; admin omstrukturerad: kategorier först med antal kort, egen sida per kategori (`/admin/deck/[id]/kategori/[katId]`, "ingen" = utan kategori), kortredigeraren har förhandsvisning som ser ut som studentens kort, "Spara och stäng", föregående/nästa kort, sökväg. Deckets ordning = kategoriordning, sedan kortordning inom kategorin
- [x] Feedbackrunda 5 (ons 23:15, lokalt): logotypen används oförändrad (bara beskuren; mörkt bläck i ljust tema), bara i sidhuvudet och på /om; appikon/favicon från Alvins ikonfil (`brand/ikon-kuggfri.png`). Admin: hela kategoriraden och hela kortraden är klickbara med hover, titel + antal på samma rad, "Öppna"-knappen borta; Deckets inställningar överst igen. Fokusramar klipps inte längre (överflödesskyddet i adminlayouten bort). Enhetlig rullgardinsmeny (`components/ui/Select.tsx`) i kortredigeraren och decksidans sortering. `scripts/simulate-progress.cjs` fyller ett lokalt konto med 14 dagars progress så att diagrammen syns (körd för Alvins lokala konto och admin@kuggfri.test)
- [x] Feedbackrunda 6 (ons 23:50, lokalt): menylogotyp med större ordmärke (`brand/logotyp-kuggfri-meny.png`); linjediagrammet bort, stapeldiagram 2/3 + nytt radardiagram 1/3 (kunskap per kategori, numrerade axlar med färgkodad lista under, delad hover, tabellvy); "Dela decket med en vän" som eget kort med tydlig kopierad-återkoppling, sluggen borta; vibranta kategorifärger (tio jämnt fördelade nyanser i oklch, ingen brun/grå)
- [x] Feedbackrunda 7 (tor 00:30, lokalt): "Visa som tabell" borta (tabellerna finns kvar osynliga för skärmläsare); "Studerade" → "Delvis inlärda" (skattning 3–4) i mjuk orange (`--chart-3`, validerad mot grönt i båda teman), staplat i radarn; sju datumetiketter i stapeldiagrammet; färgade nyckeltalsrutor (grön/orange/blå/violett ur taggskalan); delningskortet bara så brett som innehållet; nollställning flyttad till progresskortets rubrik, resttexterna borta; sidfoten visar menylogotypen (scrollar till toppen) i stället för spårningstexten
- [x] Feedbackrunda 8 (tor 01:15, lokalt): kortinnehåll aldrig under rubrikraden (m-auto i stället för items-center, scroll från toppen); innehållets maxhöjd lämnar luft under kortet (`--card-content-max`); stämpeln alltid uppe till höger, större intåg och grön ring för 4–5, mindre stämpel + skakning för 1–2; "Hur väl kunde du…" och tangentbords-/svephjälpen borta; delvis inlärda i ljus genomskinlig grön; röd/orange i taggskalan lugnare; "Dagar i rad" mörkblå, "Repetitioner i dag" turkos; källtexten borta från decksidan; "Behöver mest arbete" som tabell (Fråga, Kategori, Skattning)
- [x] Runda 9–10 (tor 02:00): delvis inlärda mer genomskinlig, Dagar i rad i taggskalans blå, studerad del av kategoristaplarna i ljusgrön, procentmarkeringar bort ur radarn
- [x] Tor 02:40: Alvins repetitioner på kuggfri.com var alla i Fri repetition, som per spec inte rör progressen (staplar räknas, kategorier/radar inte). Lägestexterna säger nu uttryckligen "Påverkar varken schemat eller din progress". Alvins produktionskonto fyllt med 14 dagars representativ data via SQL (100 kort med progress, 27 inlärda, 53 delvis, 342 repetitioner), hans egna schemalagda repetitioner sammanslagna
- [x] Tor 03:00: infoblad `docs/infoblad-kuggfri.pdf` (källa `docs/infoblad-kuggfri.html`, två A4-sidor i sajtens ljusa stil: vad/bakgrund/algoritmen, jämförelse med kommersiella appar, nytta för examinator och studenter, "som en del av kursen"). Renderas med Playwright från HTML; Alvins produktionskonto omseedat med varierad progress i alla kategorier
- [x] **Pushat tor 02:15 efter Alvins "pusha"**: hela E2E-sviten 34/34 på slutkoden, 165 enhetstester. Kodfrysning: inget mer ändras före presentationen 08:30 utan uttrycklig begäran

- [ ] Sista ändringar från Alvins onsdagslista
- [ ] Full `npm run verify`, kontroll i mobilen ljust/mörkt, axe utan allvarliga fel
- [ ] 16:00 gemensam genomgång av demoflödet
- [ ] **19:00 kodfrysning** – inget ändras utan uttrycklig begäran

## Torsdag 17 sep

- [x] 08:30 presentation, hela timmen gick åt (Johan fick avbryta för att han måste gå)

## Mötet med Johan (tor 17 sep), resultat

- Samarbete i kursen spikat. Alvin får använda Johans material i tjänsten.
- Ingen begränsning till Chalmersadresser: vilken e-postadress som helst får registreras.
- Johans enda mål: att studenterna lär sig så mycket som möjligt.
- **Tisdag 22 sep 10:00: Alvin gästar Johans föreläsning** och presenterar tjänsten för tvåorna (proffsig presentation + livedemo). Kort därefter ska tjänsten vara redo att lanseras.
- Johan föreslog själv amanuenslön 20 % i tre månader för arbetet (Alvin hade inte nämnt betalning).

Vad Johan reagerade särskilt positivt på (styr vad vi polerar och överlevererar på):
1. Designen, gränssnittet och progressvisualiseringen på decksidan.
2. Sessionsvyn: begränsad sessionsstorlek, sammanfattning med skattningar och "behöver mest arbete". Samma sak på adminsidan: han vill se vilka områden studenterna har svårt för, för att ändra kursen till nästa år. **Överleverans: uppföljningsrapporter för examinatorn** (aggregerad, anonymiserad statistik per kategori/kort).
3. Full adminkontroll: redigera kort, kategorier, ordning, förhandsvisning.
4. Obegränsat och gratis för studenterna, enkel delning.

## Torsdag 17 sep kväll: adminvyn inför att Johan får tillgång

- [x] Genomgång av adminflödet (kod + klick): rapport i chatten 19:45
- [x] Examinatorroll per deck (migration `20260917000000_examiners.sql`): examinatorn ser bara sina deck, kan inte skapa/ta bort deck eller utse andra. Middleware, layout, actions och queries kontrollerar; RLS avgör i botten
- [x] Ny adminstruktur: `/admin` → kursen direkt när man bara har en; flikar Översikt / Innehåll / Felrapporter (antal) / Importera / Inställningar; `/admin/deck` listar alla (admin)
- [x] Kursöversikt för examinatorn: fyra nyckeltal, repetitioner per dag (alla studenter), radar per kategori (snitt per student), tabell per kategori med staplar, "Kluriga frågor just nu" med andel 1–2 och länk till kortet, "Alla kort i detalj". Allt anonymt via `deck_stats_overview`
- [x] Skydd: deck-radering kräver titeln, bekräftelse vid avpublicering och vid radering av felrapport, banderoll på opublicerat deck, egen felsida, tomtext i tom kategori rättad, dubbellänken i adminmenyn borta
- [x] Examinatorer hanteras i UI (Inställningar → Examinatorer, uppslag på e-post i databasen)
- [x] sr-only-tabellerna i diagrammen gjorde mobilsidan bredare än skärmen (gällde även studentens decksida); rättat
- [x] Pushat tor 17 sep 21:20 (commit 56450f0): migrationen i molnet, kuggfri.com uppdaterad, hela E2E-sviten 34/34, 173 enhetstester, testkopian på 3001 ombyggd
- [x] Tor 21:00–22:00, Alvins synpunkter: (1) inga skärmdumpar utan begäran, (2) ingen push förrän Alvin verifierat på 3001, (3) felrapporttexten säger "kursens examinator", (4) kursöversikten omgjord för examinatorn: fyra nyckeltal (studenter, aktiva 7 dagar med repetitioner, snittskattning, öppna rapporter), sedan Svåraste områdena (kategorier efter snittskattning, färg efter skattningsskalan), Kluriga frågor, Hur långt har studenterna kommit (fördelning av studenter per andel inlärda kort), Aktiva studenter per vecka (8 veckor), Så skattar studenterna sig (1–5), Senaste felrapporterna. `deck_stats_overview` v2 ger allt i ett anrop; (5) prestanda och städning: `getDeckForAdmin`/`countOpenReports` memoiserade per request (layout + sida delar anrop), tre parallella frågor i stället för seriella, felrapporter via `deck_reports`/`deck_open_report_count` i stället för id-listor, admin slipper examinatorslagningen, `loading.tsx` under decket så flikbyten känns omedelbara, delade `firstLine`/`StatTile`, LineChart borttagen, 40 döda i18n-nycklar borta
- [x] Omgång tre (lör 19 sep): påminnelser via mejl (opt-in under Konto, ett per dag, stopp efter 14 utan repetition), examinatorns veckobrev måndagar, cron-jobb `/api/cron/daily` i `vercel.json`, migration `20260919000200` (profiles.reminder_email/digest_email, email_log, tre funktioner för service role). Enhetstester för mejlinnehåll och beslut, RLS-tester
- [x] Omgång fyra (lör 19 sep): kalibrering (snabbt vänt + 1–2 på ett känt kort ger längre tid med svaret och en omläsningsrad), "Dela din beredskap" (PNG i webbläsaren, Web Share på mobil)
- [ ] **Alvin (Vercel, efter push):** miljövariablerna i docs/DEPLOY.md 3d (`SMTP_*`, `EMAIL_FROM`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`), sedan testa med `curl ... /api/cron/daily?digest=1`
- [ ] **Alvin verifierar på http://localhost:3001** (adminvyn, alla flikar, studentsidan) och säger "pusha"
- [ ] **Före lansering:** höj `MIN_RATINGS` (CourseOverview.tsx) till 5 så att enskilda svar inte kan läsas ut

## Fredag 18 sep (natt): robusthet inför lansering

- [x] Backup: `scripts/backup.cjs` nattligen 03:30 (Windows-uppgift "Kuggfri backup"), verifierad återställning med `scripts/restore-test.cjs`, recept i docs/BACKUP.md. Inget lösenord behövs: CLI:ts lagrade projektuppgifter används
- [x] Examinatorer kan förberedas innan kontot finns (`deck_examiner_invites`, kopplas i `handle_new_user`). Johan och Alvins testkonto kopplade automatiskt
- [x] Glömt lösenord: `/glomt-losenord`, återställningslänk med token_hash (`supabase/templates/recovery.html`), landar på Konto med lösenordsbytet markerat. E2E via Mailpit
- [x] Import i en transaktion (`import_cards`), längdgränser i databasen och servern med begripliga fel, maxLength i formulären
- [x] Kursöversikten visar per kategori/kort först när minst 5 studenter skattat (`MIN_STUDENTS`)
- [x] Kort utan kategori syns och kan väljas som "Utan kategori" på studentsidan
- [x] Klartext i admins listor (KaTeX/markdown-syntax bort)
- [x] E2E: admin-content (kategori-CRUD, omordning, kort-radering, export, examinatorrollen), glömt lösenord. Sviten är nu 40 tester
- [x] Integritetspolicy och /om uppdaterade (öppen registrering, examinatorsvy, anonym statistik)
- [x] Belastningstest: 60 samtidiga klienter i 20 s mot kuggfri.com gav 0 fel, p50 1,1 s / p95 2,8 s på decksidan. Därefter cache på publikt innehåll (5 min, ogiltigförklaras vid adminändring). Full E2E 42/42 efteråt
- [ ] **Alvin:** Hostinger-mejl + SMTP i Supabase (A–B), klistra in tre mallar (C), fråga Johan om kurskoden
- [ ] **Alvin verifierar på 3001**, sedan push (migrationer 20260917000200 och 20260918000000 följer med)

## Inför tisdag 22 sep 10:00 (kandidater, prioriteras med Alvin fre 18 sep)

Måste (lansering till riktiga studenter):
- [~] Egen SMTP via Hostingers fria e-post (100 mejl/dygn) + tre mallar med token_hash. Alvin gör dashboardstegen
- [x] Glömt lösenord-flöde (fre 18 sep)
- [x] Belastning testad och cache införd (fre 18 sep)
- [ ] Kurskod i decket: MTM081 i appen, MTT085 i infobladet. Bekräfta med Johan/kurshemsidan och rätta
- [x] Johan får ett konto: examinatorroll per deck byggd tor 17 sep kväll (se nedan). Kvar: Johan registrerar sig, Alvin lägger till adressen under Inställningar → Examinatorer
- [ ] Integritetspolicy och /om uppdaterade för öppen registrering
- [ ] Full verify + mobiltest ljust/mörkt före lansering; kodfrysning måndag 21 sep kväll

Bör (det Johan gillade mest):
- [ ] Uppföljningsrapport för examinatorn i admin: per kategori och kort, andel låga skattningar, antal studenter, felrapporter; export (PDF/CSV). Aggregerat och anonymiserat, minsta gruppstorlek innan siffror visas
- [ ] Presentation för studenterna: bildspel (bygg på docs/PRESENTATION.md och infobladet), demoscript, QR-kod till kuggfri.com/d/materialteknik på sista bilden, "lägg till på hemskärmen"-instruktion
- [ ] Onboarding för nya studenter: första besöket förklarar lägena kort, gäst → konto utan att tappa progress (finns, verifiera)

Kan:
- [ ] Fler deck från Johans material (han har gett tillåtelse)
- [x] Examinatorroll (ersätter reviewer-rollen): full redigering av eget deck, inget annat


## Lördag 19 sep (natt): omvärldsanalysens Fas 0–1, kodfrysningen ersatt av återställningsrutin

Alvin gav fri hand ("kör på, bygg så mycket du orkar"). Allt lokalt, ej pushat.

- [x] Git-tagg `v1-lansering` på produktionscommiten (pushad, bara taggen). `docs/ATERSTALLNING.md`: Vercel-återställning på en minut, expanderande migrationer med ÅNGRA-sektion, backup före migration, deployrutin. ÅNGRA-sektioner i de två opushade migrationerna
- [x] Migration `20260919000000_exam_date.sql` (decks.exam_date, applicerad lokalt), tentadatum i deckets inställningar i admin
- [x] Dosering: 20 nya kort per session/dag (valbart 10/20/40), förfallna alltid med, "N att repetera + M nya kort · cirka X min" under Starta, "Klar för i dag"-sammanfattning med tre nyckeltal och "Ta N nya kort till"
- [x] Tentaplan: intervalltak, ikappläge (synligt), slutrepetition sista två dagarna, tentarad på decksidan, banderoll i sessionen
- [x] Streak med två frysningar (påfylls var sjunde aktiva dag), "vardagar"-val; visas i progress och sammanfattning
- [x] Skattningsknappar: nya etiketter (Nästan / Med möda / Direkt) och intervalltext per knapp i schemalagt läge. Fuzz på
- [x] "Uppskattad kunskap just nu" (FSRS-sannolikheter) på decksidan och i sammanfattningen
- [x] Förstabesöksruta i stället för "Du har inte pluggat…", tangentbordshjälp under knapparna (bara på enheter med mus), QR-kod under Dela
- [x] Rörelse: vändning 260 ms, inträde 180 ms, lugn "klar"-animation
- [x] Tester: 25 nya enhetstester (dosering, tentaplan, streak, förhandsvisning, kunskap, inställningar), nytt E2E-test för dosering och "Klar för i dag". Unit 191 gröna, E2E 42 gröna före det nya testet
- [x] Testkopian på 3001 ombyggd
- [x] Omgång två (lör 19 sep): utkorg så att ingen repetition tappas vid dålig anslutning; provtenta-läget (30 slumpade kort, resultat i procent); "Kan nu"-kolumn per kategori; aktiveringsmått i kursöversikten (migration `20260919000100`, ÅNGRA-sektion finns). Enhetstester och nya E2E-tester (provtenta)
- [ ] **Alvin verifierar på http://localhost:3001**: decksidan (förstabesöksrutan, Starta-raden, "Nya kort per dag", QR), en session (intervall på knapparna, "Klar för i dag"), admin → Inställningar → Tentadatum. Sedan "pusha" (migrationerna `20260919000000`, `20260919000100` och `20260919000200` följer med: `supabase db push` före `git push`, se ATERSTALLNING.md)
- [ ] Sätt tentadatum för Materialteknik i admin när Johan bekräftat datumet. Lokalt ligger platshållaren 2026-10-27 (bara i den lokala databasen, så att tentaraden och ikappläget syns på 3001)
- [ ] Övning av återställningen i Vercel tillsammans (fram och tillbaka), datum antecknas i ATERSTALLNING.md

## Lördag 19 sep (kväll): innehållspipelinen

Alvin: "bygg ut det systemet". Design i `docs/INNEHALL.md`, byggd samma kväll. Allt lokalt, ej pushat.

- [x] Migration `20260920000000_content_keys.sql`: `key` och `source_hash` på kort/kategorier/deck, `deck_snapshot()`, `sync_deck()` (transaktionell), `can_sync_deck()`. ÅNGRA-sektion finns
- [x] `lib/content/`: modell och nycklar (UUID v5, samma namnrymd som förut), markdown-parser och -skrivare med rundturstest, trevägsplanerare, konverterare, filbutik
- [x] `scripts/kuggfri.ts`: kontrollera, plan, apply, pull, konvertera, ny-kurs, ny-kategori, ta-bort-kurs, seed. `--mal lokal|prod`, `--ja`, `--radera`, `--tvinga`. Backup tas automatiskt före apply mot prod
- [x] Dagens 144 kort konverterade till `content/materialteknik/` (11 filer). Planen mot lokala databasen visade 144 "knyts ihop", 0 nya, 0 borttagna: alla id:n och all progress intakt. Applicerad lokalt, andra planen tom
- [x] Hela slingan verifierad lokalt: ändring i admin → plan varnar och rör inget → pull → filen uppdaterad → apply bekräftar → plan tom
- [x] `seed/`, `scripts/build-seed.ts` och `scripts/content-review.ts` borttagna; seeden byggs nu ur `content/`, granskningsunderlagets PDF likaså. `kuggfri kontrollera` ingår i `npm run verify`
- [x] Tester: 21 enhetstester för pipelinen (parser, nycklar, planerare, pull) och 6 databastester för `sync_deck` (behörigheter, idempotens, inaktivering behåller progress, radering kaskaderar, unika nycklar). Totalt 236 enhetstester
- [ ] **Efter push:** kör `npm run kuggfri -- plan materialteknik --mal prod`. Den ska visa 144 "knyts ihop" och noll innehållsändringar, precis som lokalt. Först därefter `apply --mal prod`
- [ ] Överväg att flytta `exam_date` för Materialteknik in i `content/materialteknik/kurs.json` när Johan bekräftat datumet (nu satt direkt i den lokala databasen)

## Söndag 20 sep (natt): lista inför lanseringen på tisdag

Alvin: "skriv en ny lista med grejer vi hinner förbättra innan vi går live nu i veckan".
Sorterad efter vad som faktiskt hindrar en lansering, inte efter hur roligt det är att bygga.
Allt nedan är lokalt tills Alvin sagt "pusha".

> **Två Claude-sessioner arbetade i samma mapp natten mot måndag.** Det blev några felmärkta
> commits (63d5238, 4a5997d, c1e83fb beskriver inte riktigt vad de innehåller), men inget arbete
> gick förlorat och trädet är grönt. Sessionerna delade sedan upp sig: en på koden och testerna,
> en på TASKS.md och docs/. Lärdomen är värd att ta med: `git add -A` med två skribenter i samma
> träd sveper med den andres filer.

**Gjort i natt (dokumentation):**

- [x] `docs/LANSERING.md`: körordningen för tisdagen — Alvins inställningar (SMTP före Confirm
      email), databasen före koden, innehållet sist, rökprov i tre roller, avbrytskriterier med
      tabell över vad som ska rulla tillbaka och vad som bara ska felsökas
- [x] `docs/PRESENTATION-STUDENTER.md`: 6–8 minuter för tisdagens föreläsning, demon som mittpunkt,
      QR-bilden som får ligga kvar medan salen skannar, svaren på frågorna som kommer
- [x] **Fynd:** byter vi till Resend för inloggningsmejlen blir Resend ett personuppgiftsbiträde som
      måste stå i `/integritet` innan första studenten registrerar sig. Registret och
      lanseringsordningen uppdaterade; raden på integritetssidan ligger hos kodsessionen
- [x] Lanseringschecklista att bocka av i handen på måndag kväll: https://claude.ai/artifact/XegL8HAcJfTSE7xP49UFj6
      (samma steg som LANSERING.md, med kommandon att kopiera; bockarna följer med mellan dator och
      mobil). Privat länk, bara Alvin kommer åt den

### Måste vara på plats innan studenterna släpps in

- [?] **Alvin verifierar på http://localhost:3001** och säger "pusha". Allt som rör produktionen
      nedan väntar på det. Kopian är ombyggd natten mot 21 sep från commit 3b5b8ea (sista committen)
      och startad, så den visar hela helgens arbete. Sidorna svarar på 37–300 ms. Dev-servern på
      3000 är avstängd med flit: två Next-processer i samma `.next` korrumperar bygget
- [?] **Alvin i Supabase och Vercel** (20 min, exakta steg i docs/DEPLOY.md): egen SMTP (Resend), slå på Confirm email, miljövariabler (`CRON_SECRET`, `REVALIDATE_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_HOSTS`), ta bort wildcard-adressen `https://*.vercel.app/**` ur Redirect URLs
- [x] Hela E2E-sviten grön lokalt: **50/50 på 12,9 minuter, noll omkörningar** (21 sep 00:53,
      commit cb5058b). De två tidigare körningarna i natt räknas inte — den första förstördes av två
      parallella dev-servrar i samma `.next`, den andra föll på det trasiga produktionsbygget
- [ ] **Bygg om testkopian på 3001 innan Alvin verifierar.** `.next-prod/BUILD_ID` är daterad
      19 sep 03:05, alltså före hela helgens arbete: innehållspipelinen, säkerhetshärdningen,
      dataskyddet och komponentuppdelningen finns inte i den kopian. Det Alvin tittade på i går
      kväll är inte det han ska godkänna. `NEXT_DIST_DIR=.next-prod npx next build`
- [ ] **`npm run build` med dev-servern stoppad**, som ett eget steg före push. `verify` kör
      typecheck, lint, `kontrollera`, enhetstester och E2E — men inte bygget, och natten mot måndag
      visade att allt det kan vara grönt medan produktionsbygget är trasigt (`export const` i en
      `"use server"`-fil, rättat i cb5058b med ett test som vaktar regeln). Kvar att bestämma: ska
      bygget in i `verify`? Det kostar en till två minuter per körning
- [x] **Registrering med e-postbekräftelse påslagen** verifierad lokalt mot Mailpit (21 sep 00:53):
      gäst → registrera → mejl → `/auth/confirm` → "2 kort flyttades till ditt konto", och
      inloggning före bekräftelse nekas med `email_not_confirmed`. Flödet hade aldrig körts skarpt
      förut eftersom `enable_confirmations` är `false` lokalt. Resultat och procedur i
      docs/LANSERING.md steg 1. Testkontona raderade, config.toml återställd, databasen räknad före
      och efter: identisk
- [x] Lastbild mätt mot produktionsbygget på 3001 (21 sep, commit f217f08): startsidan 25 kB och
      32 ms, kurssidan 71 kB och 39 ms, en session 99 kB och 57 ms, delningsbilden 50 kB PNG.
      `/admin` och `/konto` ger 307 till inloggning för utloggad. Mobil 375 px utan horisontell
      scroll, mörkt läge rätt, noll konsolfel. Inget av det behöver åtgärdas före lansering
- [ ] Felvägarna: tappad anslutning mitt i en session (utkorgen), 404, 500, deck utan kort, kort utan kategori

### Bör hinnas med (studenterna märker skillnaden)

- [ ] Delningsbild (OG-image) så att en länk i gruppchatten visar ett Kuggfri-kort i stället för en tom ruta
- [x] Mobilpass: 375 px, 768 px, mörkt läge och en runda genom alla admin- och studentvyer —
      ingen horisontell scroll någonstans, statistiksidan tyngst med 210 kB HTML men innanför
      kanten. Fyndet var inte layouten utan **klickytorna**: kryssrutorna i kategoritabellen låg på
      16×16 px mot WCAG 2.5.8:s 24×24, och det är studentens huvudsakliga interaktion på en telefon.
      Åtgärdat på fem ställen utan att något ritas större eller flyttas (se DECISIONS.md).
      E2E 50/50 grön igen efter markup-ändringen (12,8 min) — etiketten runt kryssrutan fångar
      inga klick
- [ ] Tillgänglighetsgenomgång: axe på varje sida i E2E och en tangentbordsrunda genom en hel session
- [ ] "Lägg till på hemskärmen" med i presentationen och infobladet (manifest och ikoner finns redan)

### Examinatorn (det Johan gillade mest)

- [ ] CSV-export av kategori- och kortstatistiken, så att Johan kan ta med siffrorna till kursutvärderingen
- [ ] Torrkörning av veckobrevet mot Mailpit: rätt siffror, rätt anonymitetsgräns, avprenumerera fungerar

### Drift

- [ ] Systemöversikt i admin: senaste cron-körningen, skickade mejl, öppna felrapporter. En sida som svarar på "fungerar allt?"
- [ ] Återställningsövning i Vercel tillsammans med Alvin (5 min, fram och tillbaka), datum antecknas i docs/ATERSTALLNING.md

### Inre kvalitet (bara om tiden räcker)

- [ ] Dela upp `lib/content/plan.ts` och `scripts/kuggfri.ts` i moduler
- [ ] Beslut om komponenttester: egen jsdom-körning eller ta bort de fyra testing-library-beroendena

## Tisdag 22 sep: presentationen genomförd, tjänsten stängd under sista rundan

Alvin presenterade för studenterna kl. 10:00. **Studenterna väntar på länken.** kuggfri.com svarar
med avstängningssidan (503, `x-kuggfri-lage: under-utveckling`) tills vi öppnar, enligt Alvins
beslut: helgens arbete ska verifieras i lugn och ro först, med fler iterationer.

- [x] Miljön i gång igen (tis 16:00): Docker, lokal Supabase (54321–54324), dev-server på 3000,
      testkopian på **http://localhost:3001** ombyggd från senaste committen
- [x] `launch-check` (6 commits) fast-forwardad in i `main`. En linje igen; inget pushat
- [x] Migration `20260921000000_rapportgrans.sql` applicerad i den lokala databasen (låg oapplicerad
      sedan grenbytet). Lokalt är nu 17 av 17 migrationer på plats, 144 kort, progressen orörd
- [x] `npm run verify:unit` grön: typecheck, lint, `kuggfri kontrollera`, **335 enhetstester**
- [ ] **Alvin verifierar helgens arbete på http://localhost:3001** – det är första gången kopian
      innehåller dosering, "Klar för i dag", provtenta, streak, utkorg, tentaplan, innehållspipelinen,
      säkerhetshärdningen och dataskyddet

### Fynd i dag

- [ ] **Den nattliga backupen har inte gått sedan 21 sep 01:30.** Uppgiften "Kuggfri backup" kör
      `scripts/backup.cjs`, som inte finns på grenen `under-utveckling` – den var utcheckad, så
      körningarna 22 sep föll med MODULE_NOT_FOUND (se `backups/backup.log`). Fungerar nu när `main`
      är utcheckad, men uppgiften ska inte vara beroende av vilken gren som råkar ligga i trädet
- [ ] **Produktionsdatabasen ligger nio migrationer efter** (senast applicerad `20260917000200`).
      Backup före push, enligt docs/ATERSTALLNING.md
- Produktionens innehåll och `content/` är identiska sedan cd978f4: första synken knyter bara nycklar

## Vägen till lansering: **måndag 28 september**

Alvins beslut tisdag 22 sep: tjänsten öppnar måndag nästa vecka om allt fungerar som avsett, och
**före dess ska vi gå igenom hur tjänsten drivs under läsperioden** – både rutinerna och vad som
tekniskt händer. Alvin har aldrig drivit något liknande, så genomgången är ett eget leveransmål,
inte en fotnot. Avstängningssidan står kvar oförändrad tills vi öppnar.

Fyra byggspår valda av Alvin, alla fyra: begränsningarna som biter vid 150 studenter,
uppföljningsrapporten för Johan, robusta backuper och deployrutin, samt delningsbild och onboarding.

### Dagsordning

- **Tis 22 sep (kväll)** – Alvin: verifiera helgens arbete på 3001. Claude: robust backuprutin,
  färsk produktionsbackup, därefter cron-poolningen
- **Ons 23 sep** – Claude: dagsmålet till `profiles`, uppföljningsrapporten för Johan påbörjad.
  Alvin: dashboardstegen (SMTP + SPF/DKIM tar tid att slå igenom i DNS, gör dem tidigt)
- **Tors 24 sep** – Claude: uppföljningsrapporten klar, delningsbild (OG) och onboarding.
  Generalrepetition i molnet bakom grinden: nio migrationer + `apply --mal prod` + preview-deploy
- **Fre 25 sep** – `docs/DRIFT.md` och genomgången med Alvin: läsperiodens rutiner, kostnader,
  övervakning, support, incidenter, innehållsändringar, dataskyddsansvar. Rökprov i tre roller
- **Lör–sön 26–27 sep** – buffert och Alvins iterationer: full `npm run verify`, `npm run build`,
  mobiltest ljust/mörkt, återställningsövning i Vercel tillsammans
- **Mån 28 sep** – öppning: `UNDER_UTVECKLING=0` respektive produktionsgrenen tillbaka till `main`,
  rökprov, länken till studenterna

### Måste vara klart före öppning

- [ ] Alvin har verifierat på 3001 och sagt "pusha"
- [ ] Driftgenomgången gjord (docs/DRIFT.md), Alvin vet vad som händer när något går sönder
- [ ] Eget SMTP + SPF/DKIM, provmejl till en `@student.chalmers.se`-adress som landar i inkorgen
- [ ] Höjda rate limits i Supabase (registreringen stryps annars efter ~30 studenter)
- [ ] Confirm email på, **efter** SMTP
- [ ] Vercel-variabler: `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`,
      `REVALIDATE_SECRET`, `ALLOWED_HOSTS`, SMTP-variablerna
- [ ] `https://*.vercel.app/**` bort ur Redirect URLs
- [ ] Nio migrationer i molnet + `kuggfri apply --mal prod` (144 kort ska knytas ihop, noll ändringar)
- [ ] Kurskoden bekräftad med Johan (MTM081 i appen, MTT085 i infobladet)
- [ ] Beslut om de tre korrosionskorten och om tentadatum

## Fredag 25 sep: pipelinen kopplad mot produktionen, tjänsten fortsatt stängd

Alvins beslut: ta bort korrosionsfilen, koppla innehållspipelinen mot produktionen nu och pusha
allt – men **utan att ändra registreringsvillkoren**, tjänsten ska vara stängd medan vi bygger ut.

- [x] `content/materialteknik/12-korrosion.md` borttagen (korten finns i git-historiken,
      `git show 24cb104:content/materialteknik/12-korrosion.md`). `kontrollera` är utan varningar
- [x] `kuggfri` skrev ut en rad för mycket i hjälpen (klippte på radnummer); hjalp/--help finns nu
- [x] Färsk produktionsbackup före migrationerna: `backups/2026-09-25-0047`
- [x] **Nio migrationer körda i molnet** (`supabase db push`), från `20260918000000` till
      `20260921000000`. Data intakt efteråt: 3 konton, 144 kort, 110 progressrader, 380 repetitioner
- [x] **Innehållspipelinen kopplad mot produktionen.** `plan --mal prod` visade 11 kategorier och
      144 kort som "knyts ihop", noll innehållsändringar – precis som lokalt. `apply --mal prod`:
      144 kort uppdaterade (nycklar och hashar), 0 skapade, 0 borttagna, 0 inaktiverade. Andra
      planen: "Inget att göra: filerna och databasen är i fas". Alla 144 kort har nu `key` och
      `source_hash` i molnet, så nästa innehållsändring är en filändring + `apply`
- [x] **Grinden flyttad in i `main`** (debd858): satt `UNDER_UTVECKLING` avgör, annars stängt i
      varje Vercel-miljö och öppet lokalt. Stängningen vilade tidigare på vilken gren Vercels
      produktion pekar på – en inställning vi inte kan läsa härifrån. Nu kan ingen deploy råka
      öppna tjänsten. Grinden stänger även `/api/cron/*`, så inga mejl går ut medan det är stängt
- [x] 347 enhetstester gröna, produktionsbygget grönt som eget steg, testkopian på 3001 ombyggd
- [x] **`main` pushad till GitHub** (58 commits, `3935773..debd858`). kuggfri.com svarar fortfarande
      503 på startsidan, kurssidan, `/registrera` och cron-vägen
- [ ] **Alvin i Vercel:** peka produktionsgrenen på `main` (så att molnet kör v1.0 bakom grinden)
      och lägg in `FORHANDSVISNING_NYCKEL` så att vi kan titta på den skarpa sajten med `?nyckel=`
- [ ] Full E2E-svit mot den nya koden innan öppning

## Tillkommit under arbetet (nya uppgifter, ej prioriterade än)

- [?] **Omvärldsanalys och arbetsplan klar (fre 18 sep):** `docs/OMVARLDSANALYS.md` (fem teser, jämförelsematris, forskningsprinciper, anti-mönster, arbetsplan i fyra faser) med fullständigt underlag i `docs/research/`. Väntar på Alvin: (1) får taket på nya kort per session (Fas 0, standard 20) byggas före lanseringen trots kodfrysningen? (2) tentadatum för LP1, (3) skattningsskalans semantik (3 → Again?), (4) fråga Johan om föreläsningsläge, (5) AI-generering i år eller inte

- [?] **Alvin (5 min): klistra in mejlmallarna i Supabase** (Authentication → Emails → Magic Link och Confirm signup, innehåll från `supabase/templates/`) och lägg till `https://kuggfri.com/**` + `https://kuggfri.vercel.app/**` under Redirect URLs. Exakta steg i docs/DEPLOY.md 3b. Utan detta fungerar inloggningslänken bara i samma webbläsare som beställde den
- [x] Inloggningslänk fungerar på alla enheter: egna mallar med `token_hash` (tis 00:10). Testat lokalt utan cookies mot Mailpit: länken loggar in, förbrukad länk ger felsidan
- [x] Byt lösenord under Konto (för den som loggat in med länk eller glömt lösenordet), E2E-test tillagt (tis 00:20)
- [x] Felsökning tis 00:00: lösenordsinloggning på kuggfri.com fungerar tekniskt (fel lösenord ger rätt fel, Supabase svarar). Molnets Redirect URLs innehöll bara Vercel-integrationens `kuggfri-gate-ai-sverige.vercel.app`, inte kuggfri.com, därför hamnade länken där
- [?] **Före lansering till studenter: egen SMTP i Supabase.** Den inbyggda mejlservern skickar bara ett par mejl per timme (det var det som gav "Det gick inte" för Alvin mån kväll). Med e-postbekräftelse avstängd fungerar registrering med lösenord utan mejl, men inloggningslänkar behöver riktig SMTP (t.ex. Resend, gratis upp till 3 000 mejl/månad: Supabase → Project Settings → Authentication → SMTP Settings). Alvin skapar kontot och klistrar in nyckeln själv
- [x] Auth-fel visar nu specifik orsak (mejlbegränsning, obekräftad e-post, ogiltig adress) och loggas i Vercel
- [x] Återvändsadress i mejllänkar följer besökt domän; inloggningskod fångas på valfri sida

- [ ] Byte av e-postadress på kontosidan (`supabase.auth.updateUser`)
- [ ] Paginering eller sök i admin-kortlistan när deck blir större än ~300 kort
- [ ] Redirect-tabell för gamla slugs om ett deck byter slug
- [x] Examinatorroll per deck (tor 17 sep): tabell `deck_examiners`, `can_edit_deck()` i alla innehållspolicyer, admin-UI under Inställningar, 7 nya RLS-tester
- [x] "Rapportera fel på kortet"-knapp för studenter: tabell `card_reports` med RLS (6 nya RLS-tester), dialog i studieläget (även gäster), adminsida /admin/deck/[id]/rapporter med åtgärda/öppna igen/ta bort, länk med antal öppna på deckets adminsida, E2E-test, integritetspolicyn uppdaterad. Migration pushad till molnet (ons 21:30)
- [ ] Fler deck från Alvins övriga Brainscape-set (samma seed-manifest-format)

## Klart

- [x] Skiva 0–7 enligt PLAN.md: skelett, datamodell + RLS-tester, FSRS, studieläge, konton, admin, statistik, dokumentation
- [x] Härdning: kontrast, inert, RPC-ombeställning, memoiserad auth
- [x] Förhandsvisning utan databas på `/d/dev-preview`
- [x] Veckoplan inlagd i Alvins kalender (Privat), 14–17 sep
