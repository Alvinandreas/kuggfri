# TASKS – levande uppgiftslista

Claude uppdaterar den här filen löpande. Alvin behöver inte göra något här utom att läsa.
Syfte: alltid veta vad som är klart, vad som pågår, vad som väntar och vad som tillkommit.

Legend: `[x]` klart · `[ ]` att göra · `[~]` pågår · `[?]` väntar på Alvin · `[-]` skippat (med skäl)

Deadline: **demo-redo onsdag 16 sep 19:00**. Presentation för Johan (examinator) torsdag 17 sep 08:30.

## Väntar på Alvin (blockerar)

- [x] Installera Docker Desktop och säga "Docker är igång" (klart mån 09:45, krävde `wsl --install` + omstart)
- [?] Bestämma: publik deploy (Supabase EU + Vercel + GitHub, ~30 min mån 13:00) eller demo från laptop
- [?] Registrera konto i appen och ange e-post så att Claude kan sätta is_admin (mån 18:30)
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
- [ ] Gör Alvin till admin (SQL enligt README) när e-post finns

### Deploy (om Alvin säger ja)
- [ ] `supabase link` + `supabase db push` mot Alvins projekt
- [ ] Kör seed mot molnprojektet (SQL-editorn eller admin-import)
- [ ] Miljövariabler i Vercel, deploy, kontrollera magic link och registrering på riktig domän
- [ ] Sätt Site URL / Redirect URLs i Supabase-dashboarden (Alvin, eftersom det är hans konto)
- [ ] Sätt Alvin som admin även i molnet

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
- [ ] Domän: koppla kuggfri.com i Vercel när deployen finns (se README, steg 5)

## Tisdag 15 sep (Alvin fullbokad, Claude jobbar ensam)

- [x] Rätta allt från Alvins måndagslista (båda rundorna gjorda redan måndag)
- [x] Formatera om kort enligt den godkända granskningslistan (gjort mån 11:40 via `applyTypography` i seed-bygget, med tester)
- [x] Konvertera unicode-matte till KaTeX (gjort mån 11:40)
- [x] `docs/PRESENTATION.md` utkast skrivet redan mån 11:10, uppdaterat efter runda 2. Alvin redigerar ons kväll
- [x] Sessionssammanfattningen visar kategoritagg på korten som behöver mest arbete
- [~] Mobilpolish: långa baksidor scrollar inom kortet (max 55 dvh), KaTeX-block scrollar vågrätt, ljust/mörkt kontrollerat med taggar. iOS Safari kan bara Alvin testa i riktig telefon (svep från vänsterkant krockar med bakåtgesten, det är känt och accepterat)
- [ ] Rapport i chatten 12:00 och 17:00
- [ ] Ta bort `/d/dev-preview`-rutten före deploy (finns kvar för utveckling, svarar 404 i produktion)

## Onsdag 16 sep

- [ ] Sista ändringar från Alvins onsdagslista
- [ ] Full `npm run verify`, kontroll i mobilen ljust/mörkt, axe utan allvarliga fel
- [ ] 16:00 gemensam genomgång av demoflödet
- [ ] **19:00 kodfrysning** – inget ändras utan uttrycklig begäran

## Torsdag 17 sep

- [ ] 08:30 presentation. Efteråt: skriv ner Johans önskemål här under "Tillkommit"

## Tillkommit under arbetet (nya uppgifter, ej prioriterade än)

- [ ] Byte av e-postadress på kontosidan (`supabase.auth.updateUser`)
- [ ] Paginering eller sök i admin-kortlistan när deck blir större än ~300 kort
- [ ] Redirect-tabell för gamla slugs om ett deck byter slug
- [ ] Reviewer-roll: låta Johan kommentera kort utan full admin (kräver ny tabell + RLS)
- [ ] "Rapportera fel på kortet"-knapp för studenter (kräver ny tabell + RLS)
- [ ] Fler deck från Alvins övriga Brainscape-set (samma seed-manifest-format)

## Klart

- [x] Skiva 0–7 enligt PLAN.md: skelett, datamodell + RLS-tester, FSRS, studieläge, konton, admin, statistik, dokumentation
- [x] Härdning: kontrast, inert, RPC-ombeställning, memoiserad auth
- [x] Förhandsvisning utan databas på `/d/dev-preview`
- [x] Veckoplan inlagd i Alvins kalender (Privat), 14–17 sep
