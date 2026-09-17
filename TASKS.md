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
- [ ] Belastningstest mot produktion (`scripts/load-test.cjs`)
- [ ] **Alvin:** Hostinger-mejl + SMTP i Supabase (A–B), klistra in tre mallar (C), fråga Johan om kurskoden
- [ ] **Alvin verifierar på 3001**, sedan push (migrationer 20260917000200 och 20260918000000 följer med)

## Inför tisdag 22 sep 10:00 (kandidater, prioriteras med Alvin fre 18 sep)

Måste (lansering till riktiga studenter):
- [~] Egen SMTP via Hostingers fria e-post (100 mejl/dygn) + tre mallar med token_hash. Alvin gör dashboardstegen
- [x] Glömt lösenord-flöde (fre 18 sep)
- [ ] Belastning: många studenter samtidigt direkt efter föreläsningen (Supabase-gränser, RLS-frågornas kostnad, ev. cache på deck-sidan)
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


## Tillkommit under arbetet (nya uppgifter, ej prioriterade än)

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
