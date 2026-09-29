# Tentaläget och tentabanken

Alvins beslut 29 sep 2026: alla gamla tentafrågor samlas i ett eget fack och blandas inte med
studiematerialet. Studenterna övar obegränsat på korten och testar sig sedan på riktiga tentor i
**tentaläget**: en hel tenta i taget, rakt igenom, med samma förutsättningar som på riktigt
(tid, poäng, hjälpmedel, inget facit förrän man lämnat in), i en layout inspirerad av Inspera.
Tentaläget är synligt låst för studenterna tills examinatorn öppnar det (när föreläsningarna har
slutat introducera nytt material).

## Var tentorna finns

Tentorna är kursens egna tentor med facit. **De ligger aldrig i git** (repot är publikt): de skrivs
i `material/<kurs>/tentor/<nyckel>.md` (gitignorerad) och synkas till databasen med
`npm run kuggfri -- tentor kontrollera|plan|apply <kurs> [--mal prod]`. Studenterna får frågorna
från servern; facit lämnar servern först när tentan är inlämnad. Bilder ligger bredvid i
`material/<kurs>/tentor/bilder/` och bäddas in i databasen vid synken.

## Filformatet

En fil per tenta, nyckeln = datumet (`2024-10-31.md`; två tentor samma dag: `2024-10-31-b.md`).

```markdown
# Tentamen MTT085 2024-10-31
datum: 2024-10-31
tid: 240
poäng: 50
betyg: 3=20, 4=30, 5=40
hjälpmedel: Typgodkänd räknare
anvisning: Svar ska alltid åtföljas av motivering.
källa: Canvas, Tentamen MTT085 24-10; Canvas, Svarsförslag Tentamen MTT085 24-10
status: utkast

## 1a
del: Metaller
typ: flerval
poäng: 1
sida: 2

Definiera "eutektisk reaktion".

- [ ] Eutektisk reaktion är en process där två flytande faser …
- [x] Eutektisk reaktion är en fasomvandling där en flytande fas omvandlas till två fasta faser …

### Lösning

Valfri förklaring eller svarsförslagets text. Visas efter inlämning.
```

- `# Titel` först, sedan tentans egenskaper (en per rad) fram till första tomma raden.
  `tid` i minuter, `poäng` = maxpoäng, `betyg` = gränser i poäng (procent räknas om:
  40 % av 50 = 20). `status: utkast | publicerad` (bara publicerade syns för studenter).
- Varje `## <nummer>` är en uppgift (numret som på tentan: `1a`, `2`, `3b`). Egenskaper direkt
  under rubriken: `typ`, `poäng` (decimalkomma tillåtet), `del` (valfritt, t.ex. Metaller /
  Polymerer; visas som rubrik i navigeringen), `sida` (sida i källan), `bild: bilder/<fil>`
  (valfritt, visas över frågan; flera figurer med kommatecken: `bild: bilder/a.webp, bilder/b.webp`), `poängsättning: alltelleringet | delpoäng` (för `flera`).
- Frågetexten är markdown med KaTeX (`$…$`). Uppgiftens facitdel står efter svarsdelen.
- `### Lösning` (valfritt för deterministiska typer, **obligatoriskt för `text`**) = det som visas
  efter inlämning: svarsförslaget eller en förklaring.
- Frågetexter och alternativ skrivs **ordagrant som på tentan** (rätta bara uppenbara fel i
  textuttaget). Facit tas ur svarsförslaget och kontrolleras (se nedan).

### Uppgiftstyper

| `typ` | Studenten | Rättas | Syntax i filen |
|---|---|---|---|
| `flerval` | väljer ett alternativ | exakt rätt = full poäng | `- [x]` / `- [ ]`, exakt ett `[x]` |
| `flera` | väljer ett eller flera | `alltelleringet` (standard): exakt de rätta; `delpoäng`: poäng × max(0, (rätt valda − fel valda) / antal rätta) | `- [x]` / `- [ ]`, minst ett `[x]` |
| `sant-falskt` | sant/falskt per påstående | poängen delas lika på påståendena | `- [sant] Påstående` / `- [falskt] Påstående` |
| `para` | väljer ett svar i en lista för varje led (begrepp till definition, siffra i bild till namn, lucka i text) | poängen delas lika på leden | `alternativ: Ferrit \| Austenit \| Perlit` och `- Led => Svar` per led; svaret måste finnas bland alternativen |
| `numerisk` | skriver ett tal | inom toleransen = full poäng | `svar: 0,727`, `tolerans: 0,01` eller `tolerans: 2 %`, `enhet: MPa` (valfri) |
| `text` | skriver fritt | studenten bedömer själv mot lösningen (0 till `poäng`, halva poäng) | frågetext + `### Lösning` |

Deluppgifter som hänger ihop (samma figur, olika frågor) blir separata uppgifter (`3a`, `3b`) med
samma `bild`. En räkneuppgift där tentan kräver uträkning men har ett entydigt slutsvar blir
`numerisk` med lösningen under `### Lösning`; kräver den resonemang blir den `text`.

## Källkritik för tentabanken

- Frågor och alternativ ska vara ordagranna; facit kommer ur tentans svarsförslag.
- Säger svarsförslaget emot föreläsningsmaterialet, eller är det uppenbart fel, ändras inte
  frågan. Facit följer svarsförslaget och `### Lösning` får en rad **"Obs: …"** som beskriver
  avvikelsen med källa. Avvikelsen läggs också i rapporten till examinatorn.
- Saknas svarsförslag för en uppgift, eller går det inte att läsa: `typ: text` med den lösning
  som går att belägga, eller utelämna facit och markera uppgiften `status: saknar-facit` (den
  visas då utan rättning, med en förklaring).
- Allt ligger som `status: utkast` tills examinatorn har sett tentan.
