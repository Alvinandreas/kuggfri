# Tentaläget och tentabanken

Alvins beslut 29 sep 2026: alla gamla tentafrågor samlas i ett eget fack och blandas inte med
studiematerialet. Studenterna övar obegränsat på korten och testar sig sedan på riktiga tentor i
**tentaläget**: en hel tenta i taget, rakt igenom, med samma förutsättningar som på riktigt
(tid, poäng, hjälpmedel, inget facit förrän man lämnat in), i en layout inspirerad av Inspera.
Tentaläget är synligt låst för studenterna tills examinatorn öppnar det (när föreläsningarna har
slutat introducera nytt material).

Förtydligat 29–30 sep:

- **Gallringen gäller bara kort som agenter kopierat direkt från tentafrågor.** Originalkorten
  (`original: ja`, se `arkiv/originalkorten/`) är kvar även när de liknar en tentafråga, och kort
  som bygger på föreläsningsmaterial får likna en tentafråga.
- **Målet är att den som kan allt i pluggmaterialet får alla rätt på tentan.** Tentornas kunskap
  ska därför täckas av korten, med egen formulering och egna siffror (täckningsanalyserna i
  `material/<kurs>/analys/tackning-tentor-*.md`). Ett begrepp som är viktigt för kursen får aldrig
  bli omöjligt att öva på.
- **Frågetexterna följer originalets ordalydelse, på originalets språk** (Alvin 30 sep): är
  uppgiften tvåspråkig i originalet står båda språken med, ordagrant och i originalets ordning
  (alternativ som "Ferrit / Ferrite"). Finns bara ett språk står det språket ordagrant. Inget
  översätts. Lösningsförslagen får vara på svenska.

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
| `para` | väljer ett svar i en lista för varje led (begrepp till definition, siffra i bild till namn, lucka i text) | poängen delas lika på leden | `alternativ: Ferrit \| Austenit \| Perlit` och `- Led => Svar` per led; svaret måste finnas bland alternativen. Egen lista per led (lucktexter där varje lucka har sina alternativ): `- Led => 0,02 % \| [x] 0,77 % \| 2,1 %`, alternativen i visningsordning och det rätta markerat med `[x]` (då behövs inget `alternativ:`; led utan egen lista använder `alternativ:`) |
| `numerisk` | skriver ett tal | inom toleransen = full poäng | `svar: 0,727`, `tolerans: 0,01` eller `tolerans: 2 %`, `enhet: MPa` (valfri) |
| `text` | skriver fritt | studenten bedömer själv mot lösningen (0 till `poäng`, halva poäng) | frågetext + `### Lösning` |

**Minuspoäng** (som i Inspera, "varje fel svar ger −0,25 poängavdrag"): `minuspoäng: 0,25` under
uppgiftens rubrik, för `sant-falskt`, `flera` och `para`. Varje rätt svar ger sin andel av
uppgiftens poäng (poäng / antal påståenden, rätta alternativ eller led), varje fel svar (fel
besvarat påstående, fel valt alternativ, fel valt led) ger avdraget, obesvarat ger 0, och
uppgiften ger aldrig under 0 eller över sin poäng. Studenten ser regeln i uppgiften. För `flera`
ersätter minuspoängen `poängsättning`.

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

## Tentaläget i appen

- **Försättsbladet** (`/d/<kurs>/tenta/<nyckel>`): tid, poäng, betygsgränser, hjälpmedel. Starta
  tentan skapar ett försök; klockan räknar mot serverns tid.
- **Tentan** (`?forsok=<id>`): en uppgift i taget i Insperas form, navigeringsrad med en ruta per
  uppgift, flaggor, svaren sparas löpande. Inget facit i sidan.
- **Rättningsläget** (efter inlämning, om tentan har skrivuppgifter eller uppgifter utan facit):
  studenten bedömer de uppgifterna mot lösningsförslagen, en i taget, utan att se något resultat.
  Bedömningarna sparas löpande (`exam_attempts.self_grades`); poäng och betyg är `null` och
  `result.pending` är sant tills studenten trycker **Rätta**. Då räknar servern ut totalen och
  betyget och sidan visar resultatet. Bedömningen kan inte ändras efteråt.
- **Resultatet**: totalpoäng, betyg och betygsgränserna överst, uppdelat i automaträttat och
  självbedömt, sedan alla uppgifter med svar, facit och lösning. **Tänk om** låter studenten pröva
  andra poäng på valfria uppgifter och se hur totalen och betyget hade ändrats; inget sparas.
- **Figurerna** skickas aldrig inbäddade i sidan: de hämtas från
  `/d/<kurs>/tenta/<nyckel>/bild/<uppgift>/<nr>` med samma åtkomst som tentan (stora data-URI:er i
  sidans data fick klientnavigeringen i produktionsbygget att fastna). Varje figur kan förstoras;
  höga tabeller visas beskurna med "Visa hela".
- **Redaktörer** (admin och kursens examinatorer) ser alla tentor, även utkast. Förhandsgranska i
  admin → Tentor öppnar tentan med `?fran=admin`, och alla vägar ut leder tillbaka dit.
  **Visa som student** (tentaläget och admin → Tentor) visar tentaläget exakt som en student ser
  det, med utkasten medtagna och en rad överst där man växlar mellan öppet och låst och avslutar
  studentvyn. Studentvyn är en kaka som servern bara respekterar för redaktörer av just den kursen
  (`lib/tentor/server.ts`); för alla andra gör den ingenting.
