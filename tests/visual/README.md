# Visuellt regressionstest

Säkerhetsnätet för refaktoreringen efter taggen `fore-refaktor-2026-10-01`: skärmbilder av hela
Kuggfri i fyra varianter, tagna från utgångsläget och jämförda pixel för pixel efter varje ändring.
Är allt grönt ser varje sida och varje tillstånd ut exakt som förut.

## Köra

Kräver den lokala Supabase-stacken (`npm run db:start`) med Materialteknik och
`admin@kuggfri.test` (seed). Dev-servern på 3005 och kopian på 3001 får gärna vara igång.

```bash
npm run test:visual            # bygger, startar på port 3010 och jämför mot referensbilderna
npx playwright show-report playwright-report/visual   # rapporten med före/efter/diff
```

En körning tar cirka 6–7 minuter: produktionsbygget (`NEXT_DIST_DIR=.next-visual`, ~1,5 min) och
220 tester med två arbetare (~4,5 min). Bara en del:

```bash
npm run test:visual -- admin                          # en testfil (utloggad, student, admin, examinator)
npm run test:visual -- --project=desktop-ljus         # ett projekt
npm run test:visual -- -g "kurssidan"                 # tester vars namn matchar
VISUAL_REUSE_SERVER=1 npm run test:visual             # återanvänd en server som redan kör på 3010
```

`VISUAL_REUSE_SERVER=1` hoppar över bygget och är bara för att iterera på själva testerna: servern
på 3010 visar då koden från när den byggdes, inte det som ligger i arbetskatalogen nu.

Kör inte `npm run test:e2e` samtidigt: E2E-testerna skapar kurser och studenter som syns i
admin, och fyra webbläsare till gör maskinen långsam.

## Efter en ändring

1. `npm run test:visual`.
2. Grönt: inget syns ändrat, i någon av de fyra varianterna.
3. Rött: öppna rapporten (`npx playwright show-report playwright-report/visual`). Varje fel har
   tre bilder och ett reglage: **Expected** (referensen), **Actual** (nu) och **Diff** (ändrade
   pixlar i rött). Bilderna ligger också i `test-results/visual/<test>/` som
   `*-expected.png`, `*-actual.png` och `*-diff.png`.
4. Är skillnaden oavsiktlig: rätta koden och kör igen. Är den avsiktlig (och godkänd):

```bash
npm run test:visual:update     # skriver bara över bilderna som skiljer sig, och lägger till nya
```

Granska sedan `git diff --stat tests/visual/__screenshots__` och committa bilderna med ändringen.

Ett fel med texten "Sidan kastade fel innan bilden togs" betyder att sidan kastade ett
JavaScript-fel (t.ex. en misslyckad hydrering, som ritar om hela sidan och tappar mörkt läge).
Felet står i rapporten.

## Vad som täcks

Fyra projekt: `desktop-ljus` och `desktop-mork` (1440 × 900), `mobil-ljus` och `mobil-mork`
(390 × 844, pekskärm). Bilderna ligger i `__screenshots__/<projekt>/<testfil>/<namn>.png`.

| Testfil | Roll | Bilder per projekt |
| --- | --- | --- |
| `utloggad.spec.ts` | utloggad | 9: startsidan, logga in, registrera, glömt lösenord, Om, Hjälp, Integritet, kursinbjudan, 404 |
| `student.spec.ts` | `visual-student@kuggfri.test` | 21 (+ mobilmenyn på mobil): hem, områdesdialogen från radarn, kluriga kort- och duggadialogen, Min statistik, Kurser, kurssidan, Ditt pass i alla sex lägen med inställningar, stjärnmärkta korten, ett pass (framsida, vänt kort, sammanfattning), ett begreppskort (fram och bak), konto, tentaläget låst |
| `admin.spec.ts` | `admin@kuggfri.test` | 24 (+ mobilmenyn på mobil): översikt, statistik, innehåll, ett område, ett kort, nytt kort, granskning (att granska, ett kort, granskade, flaggade, ett flaggat kort), tentor, en tentas facit, förhandsgranskning (försättsblad, en uppgift), tentaläget som redaktör, studentvyn öppen och låst, felrapporter, importera, inställningar, alla kurser, ny kurs, designsystem |
| `examinator.spec.ts` | `visual-examinator@kuggfri.test` | 2 (+ mobilmenyn på mobil): översikten med sidomenyn, granskning |

Totalt 56 bilder på desktop och 59 på mobil, 230 i alla fyra projekt.

## Deterministiskt

- **Data.** `global-setup.ts` skapar teststudenten och testexaminatorn med service role-nyckeln ur
  `.env.local` (`data.ts`): 38 kort med fast progress i nio områden (skattningar 1–5, några
  kluriga), 121 repetitioner i `review_log` över fyra veckor, fyra pass och examinatorsraden med
  fast datum. `global-teardown.ts` tar bort dem igen (cascade). Materialteknik och
  `admin@kuggfri.test` används som de är; det enda setup skapar åt admin är ett påbörjat
  förhandsgranskningsförsök, som teardown tar bort.
- **Inloggning.** Setup loggar in de tre rollerna en gång och sparar sessionerna i `.state/`
  (gitignorerad). Supabase begränsar inloggningar per IP, och sessionen gäller en timme.
- **Klockan.** Klientens klocka börjar på `VISUAL_NOW` (onsdag 30 september 2026 kl. 10.00) och
  går sedan som vanligt, så att hälsningen, "i dag", streaken, aktivitetskartan och diagrammen
  blir desamma vilken dag testet än körs. En klocka som står helt still (`page.clock`) och en
  seedad `Math.random` fick inloggade sidor att hänga sig med flera parallella webbläsare, därför
  en egen minimal förskjutning av `Date` (`fixtures.ts`). Designsystemet körs med riktig klocka,
  eftersom sidan räknar ut datum redan på servern.
- **Slump.** Passen körs i fri repetition i kursens ordning (`ordning=kurs`) och i ett fast
  område, utan slump. Passets skrivningar till databasen stoppas (`blockProgressWrites`), så att
  teststudentens statistik inte ändras mellan bilderna.
- **Maskning** (rosa rutor i bilderna). Bara det som beror på serverns klocka eller på andra
  konton: kursstatistiken i admin (värden, diagram och listor som räknas över alla studenter,
  också E2E-testernas), granskningens "I dag"/"I går"-rubriker och relativa datum, skrivtiden
  som återstår i förhandsgranskningen samt nedräkningen och aktivitetskartan i designsystemet.
  Maskade rutor jämförs fortfarande till läge och storlek.
- **Stabilisering.** Animationer stängs av, markören döljs, och varje bild tas först när nätverket
  är tyst, typsnitten och bilderna laddade, inga laddningsskelett finns kvar och alla intoningar
  (också dialogernas mörka bakgrund) är klara. Långa sidor kapas vid 3 200 px (desktop) och
  4 800 px (mobil).
- **Hydrering.** Ungefär en gång på hundra visningar av `/hem` misslyckades hydreringen (React-fel
  #418) och sidan ritades om utan mörkt läge. `open()` laddar då om sidan, högst två gånger. Ett
  fel som kommer varje gång stoppar ändå testet med "Sidan kastade fel innan bilden togs".
- **Två arbetare.** Med fyra parallella webbläsare blev maskinen (16 GB, två Next-servrar och
  Docker igång) så långsam att sidor inte hann ladda. `VISUAL_WORKERS=4` går att prova.

## Tolerans

`maxDiffPixels: 0` och `threshold: 0.05` (`playwright.visual.config.ts`): ingen pixel får skilja
mer än 0,05 i färg (pixelmatchs YIQ-skala, 0 = exakt). Uppmätt brus mellan körningar utan
ändringar var upp till ~200 pixlar med färgskillnad under 0,05 (kantutjämning och oskärpan bakom
dialoger); med 0,05 var alla körningar gröna. En andel som `maxDiffPixelRatio: 0.001` hade på en
1440 × 3200-bild släppt igenom 4 600 pixlar, alltså en ändrad siffra eller ett ändrat ord. För
felsökning går värdena att skriva över: `VISUAL_THRESHOLD`, `VISUAL_MAX_DIFF_PIXELS`, och
`VISUAL_REAL_CLOCK=1` kör med den riktiga klockan.

Referensbilderna gäller den här maskinen (Windows, Chromium från Playwright 1.63). På en annan
dator eller efter en uppdatering av Playwright renderas typsnitt något annorlunda: ta då nya
referensbilder från utgångsläget (`git stash` eller taggen) innan jämförelsen.

## Om innehållet ändras

Bilderna visar Materialteknik som den ligger i den lokala databasen. Ändras innehållet (nya kort,
granskningsbeslut, `npm run db:reset`) ändras också bilderna av innehåll, granskning och kurssidan.
Ta i så fall nya referensbilder från utgångsläget innan nästa jämförelse.
