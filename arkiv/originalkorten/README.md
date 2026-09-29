# Originalkorten

Alvins flashcardset i Materialteknik: 144 kort som ursprungligen låg i Brainscape och användes av
närmare 200 studenter över två årskullar. Det är den beprövade kärnan i Kuggfri.

`materialteknik/` innehåller korten **exakt som de såg ut före omarbetningen 28 sep 2026**, i samma
format som `content/` (se docs/INNEHALL.md): 11 områden, kurs.json och alla 144 kort med sina
nycklar. Filerna är tagna ur commit `d1b9359` och skiljer sig från importen 19 sep (`e04a156`)
bara i kurskod och kreditering i kurs.json.

## Regler

- **Arkivet ändras aldrig.** Rättelser och nya formuleringar görs i `content/`, inte här. Testet
  `tests/unit/content/originalkorten.test.ts` kontrollerar en kontrollsumma över filerna.
- **Inget originalkort får försvinna.** Samma test kontrollerar att varje nyckel i arkivet finns
  kvar i `content/materialteknik/` med `original: ja`. Ett kort får inaktiveras (`aktiv: nej`) eller
  rättas, men inte raderas.
- Pipelinen läser bara `content/`, så arkivet synkas aldrig till databasen.

## Hitta och återställa

- Se hur ett kort såg ut från början: sök på nyckeln här, t.ex. `grep -rn "key: slagseghet" arkiv/`.
- Se vad som ändrats sedan dess i ett kort: jämför med samma nyckel i `content/materialteknik/`,
  eller öppna kortets historik i admin (Innehåll → kortet → Historik).
- Återställ ett kort till originalet: kopiera fram- och baksidan härifrån till kortet i `content/`
  (behåll nyckeln och `original: ja`) och kör `npm run kuggfri -- plan materialteknik`.
- Hela kursen kan också återställas till en utgåva med `npm run kuggfri -- aterga`, se
  docs/INNEHALL.md. Utgåvorna ligger i `utgavor/`.
