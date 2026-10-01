# Engångsverktyg

Små skript som skrevs för ett visst tillfälle (lanseringen, logotypen, granskningen) och som inte
ingår i bygget, testerna eller innehållspipelinen. De körs från **repots rot**: alla sökvägar
(`public/`, `brand/`, `docs/`, `content/`) är relativa till arbetskatalogen. Flera är skrivna för
**Materialteknik** (decket `materialteknik`) och behöver anpassas för andra kurser.

Det dagliga verktyget är `npm run kuggfri` (`scripts/kuggfri.ts`); säkerhetskopior och deploy-SQL
ligger kvar direkt i `scripts/`.

| Verktyg | Vad det gör | Körs med |
|---|---|---|
| `build-logo.py` | Bygger logotyper och appikoner ur Alvins originalfiler i `brand/` och skriver `public/logo-*.png`, `public/icon-*.png`, `public/apple-touch-icon.png` och `app/favicon.ico`. Kräver Pillow och numpy. | `python scripts/verktyg/build-logo.py` |
| `build-icons.py` | De första appikonerna (två staplade kort på grönt), skriver `public/icon-*.png` och `public/apple-touch-icon.png`. **Ersatt av `build-logo.py`**: att köra det skriver över de nuvarande ikonerna. Kräver Pillow. | `python scripts/verktyg/build-icons.py` |
| `build-review-pdf.tsx` | Granskningsunderlag: alla kort i en kurs som utskriftsvänlig PDF per område, med kryssrutor och anteckningsrad. Läser `content/<kurs>/` och skriver ut med Playwrights Chromium (mellanfil i `.next-review/` eller `REVIEW_TMP`). | `npx tsx scripts/verktyg/build-review-pdf.tsx [materialteknik] [docs/granskning-materialteknik.pdf]` |
| `demo-shots.cjs` | Skärmdumpar av demoflödet som reserv vid presentationen: mobil mot kuggfri.com och admin på desktop mot den lokala kopian på `:3001` (lokalt testadminkonto). Skrivet för Materialteknik och lanseringsdemot; flödet kan behöva uppdateras. | `node scripts/verktyg/demo-shots.cjs [docs/demo-skarmdumpar]` |
| `load-test.cjs` | Belastningstest med bara GET-anrop (startsidan, Materialtekniks decksida, studieläget, /om). Mäter svarstider och fel per sida. Inga skrivningar, inga konton. | `node scripts/verktyg/load-test.cjs [bas-URL=https://kuggfri.com] [samtidiga=60] [sekunder=20]` |
| `simulate-progress.cjs` | Fyller ett kontos studieprogress i den **lokala** databasen (raderar kontots befintliga progress först) så att progressvyn kan granskas utan att plugga i dagar. Vägrar om `DATABASE_URL` inte pekar på localhost. Använder Materialteknik. | `node scripts/verktyg/simulate-progress.cjs <e-post> [antal kort=90] [dagar=14]` |
