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
- [ ] `npx supabase start`, skriv riktig anon-nyckel till `.env.local`
- [ ] `npm run db:reset` (151 kort laddade), kontrollera `/` och `/d/materialteknik` i webbläsaren
- [ ] `npx playwright install chromium`, kör `npm run test:e2e`, rätta det som spricker
- [ ] `npm run verify` grönt, uppdatera BLOCKERS.md (Docker-blockern löst)
- [ ] Klicka igenom hela adminflödet mot riktig databas: deck, kategori, kort, dnd, import, export, statistik
- [ ] Gör Alvin till admin (SQL enligt README) när e-post finns

### Deploy (om Alvin säger ja)
- [ ] `supabase link` + `supabase db push` mot Alvins projekt
- [ ] Kör seed mot molnprojektet (SQL-editorn eller admin-import)
- [ ] Miljövariabler i Vercel, deploy, kontrollera magic link och registrering på riktig domän
- [ ] Sätt Site URL / Redirect URLs i Supabase-dashboarden (Alvin, eftersom det är hans konto)
- [ ] Sätt Alvin som admin även i molnet

### Innehållsgranskning, steg 1
- [ ] Skript som listar kort där normaliseringen kan ha blivit fel (lösa "−"-rader, kolonrader, unicode-matte som 𝜎 = 𝐸 𝜀)
- [ ] Lista i `docs/INNEHALL-GRANSKNING.md` för Alvin att godkänna, inga innehållsändringar utan godkännande

## Tisdag 15 sep (Alvin fullbokad, Claude jobbar ensam)

- [ ] Rätta allt från Alvins måndagslista
- [ ] Formatera om kort enligt den godkända granskningslistan (bara markdown, inte innehåll); uppdatera seed och kör `npm run seed:build`
- [ ] Konvertera uppenbar unicode-matte till KaTeX där det ger bättre läsbarhet (t.ex. `$\sigma = E\varepsilon$`)
- [ ] Skriv `docs/PRESENTATION.md`: talarpunkter, demo-manus i tre steg, de tre frågorna ur mejlet, förslag på hur Johan kan granska innehållet (adminkonto eller export)
- [ ] Mobilpolish: testa iOS Safari-specifika saker (100dvh, svep vs. tillbaka-gest), långa baksidor, KaTeX-bredd
- [ ] Rapport i chatten 12:00 och 17:00

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
