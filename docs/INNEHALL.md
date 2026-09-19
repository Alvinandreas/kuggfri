# Innehållspipelinen: kurser, kategorier och kort som kod

Handbok för innehållspipelinen. Designen skrevs 19 september 2026 och byggdes samma dag; det här
dokumentet är uppdaterat till att beskriva det som faktiskt finns. Syftet: att lägga till, ändra och
ta bort kort, kategorier och kurser ska vara enkla, deterministiska operationer som går att köra om
utan att något går sönder, och som aldrig tappar en students progress av misstag.

**Två gränssnitt, en sanning.** Alvin och examinatorerna redigerar innehåll i admin-gränssnittet.
Claude redigerar samma innehåll i markdown-filerna under `content/`. Pipelinen håller ihop de två:
den skriver aldrig över en ändring som gjorts i admin, utan ber om `pull` först.

## 1. Bakgrund: varför det gamla upplägget inte räckte

Fram till 19 september låg innehållet på två ställen som gled isär:

- `seed/materialteknik/` (Brainscape-CSV + `deck.json`) → `supabase/seed.sql`, som används vid
  `db reset` lokalt och lades in i molnet en gång. Kort-id:n är UUID v5 av
  `slug + kategori + framsidans text`.
- Databasen i produktion, som examinatorn ändrar i admin (kort, kategorier, ordning) och via
  CSV/JSON-import i webbläsaren (diff på framsidans text).

Konsekvenserna: ett kort vars framsida rättades i admin blev ett *nytt* kort vid nästa seed-bygge
(id:t byggdes av texten), det fanns inget kommando som lade nytt material i produktion i bulk,
borttagning fanns bara som klick i admin, och ingen visste vilken version som var "sanningen" när
filerna och databasen skilde sig. Formatet CSV passade dessutom dåligt för flerradiga svar med
KaTeX och listor.

## 2. Principer

1. **Innehållet är kod.** Kursens innehåll ligger i vanliga textfiler i repot under `content/`,
   versionerade i git. Databasen är det driftsatta läget, aldrig källan. Admin är ett verktyg för
   snabba rättelser som dras tillbaka till filerna, inte en andra källa.
2. **Stabila nycklar, inte texter.** Varje kurs, kategori och kort har en `key` (kort, ASCII,
   unik inom kursen) som aldrig ändras. Framsida, baksida, kategori och ordning får ändras fritt
   utan att kortet byter identitet. Progress följer nyckeln.
3. **Deterministiskt.** Samma filer ger samma databas, samma id:n (UUID v5 av nyckeln), samma
   ordning. Att köra `apply` två gånger ändrar ingenting andra gången.
4. **Plan före apply.** Varje ändring visas som en plan (skapa, ändra, flytta, inaktivera, ta bort)
   med konsekvenser för progress innan något skrivs. Inga överraskningar.
5. **Progress är heligt.** Ett kort som försvinner ur filerna inaktiveras (studenterna ser det inte,
   deras historik finns kvar). Hård radering kräver en uttrycklig flagga. Kategorier och kurser
   likadant.
6. **Tre lägen, en väg.** Samma verktyg och samma databasfunktion mot lokal databas, testkopia
   och produktion. Produktion nås via Supabase CLI:s inloggning (`supabase db query --linked`),
   så inga nycklar behövs i repot.
7. **Inget AI.** Konvertering från källor (CSV, JSON, Brainscape) är regelstyrd och granskas som en
   diff i git innan den appliceras.

## 3. Filformatet: kortfiler

```
content/
  materialteknik/
    kurs.json
    01-materialgrupper-och-egenskaper.md
    02-materialvalsprocessen.md
    ...
```

**`kurs.json`** (kursen och kategoriernas ordning):

```json
{
  "key": "materialteknik",
  "title": "Materialteknik",
  "course_code": "MTM081",
  "description": "Frågor och begrepp från kursen …",
  "source_credit": "Sammanställt av Alvin …",
  "exam_date": "2026-10-27",
  "published": true,
  "categories": [
    { "key": "materialgrupper", "file": "01-materialgrupper-och-egenskaper.md" },
    { "key": "materialval", "file": "02-materialvalsprocessen.md" }
  ]
}
```

`key` är kursens slug i URL:en (`/d/materialteknik`). Kategorins `key` är stabil; titeln står i
filen och får bytas.

**Kortfil** (en per kategori, ren markdown så att den kan läsas och redigeras i vilken editor
som helst och diffas i git):

```markdown
# Kristallstruktur

## Vad är en enhetscell?
key: enhetscell

Den minsta upprepade byggstenen i ett kristallgitter. Hela kristallen kan
byggas av enhetsceller som staplas i tre riktningar.

## Vad skiljer BCC från FCC?
key: bcc-fcc
ledtråd: Tänk på antalet atomer per enhetscell.

- BCC: 2 atomer per cell, t.ex. ferrit
- FCC: 4 atomer per cell, t.ex. austenit

Packningsgrad $0{,}68$ respektive $0{,}74$.
```

Regler:

- `# Rubrik` överst är kategorins titel.
- Varje `## …` är ett korts framsida (en rad, markdown och `$…$` tillåtet).
- Raderna direkt under rubriken av formen `nyckel: värde` är kortets egenskaper: `key`
  (obligatorisk efter första `apply`; verktyget skriver in den om den saknas), `ledtråd`
  (valfri). Fler kan komma senare (t.ex. `typ: flerval`) utan att formatet ändras.
- Allt därefter fram till nästa `##` är baksidan, i markdown med KaTeX.
- Kortens ordning i filen är ordningen i kursen. Kategoriernas ordning är ordningen i `kurs.json`.
- Ett kort som ska finnas kvar men inte visas: `aktiv: nej`.

CSV och JSON försvinner inte: de blir *inmatningsformat* som konverteras till kortfiler
(`kuggfri konvertera`), aldrig källa.

## 4. Datamodellen: vad som läggs till (expanderande, ÅNGRA-bart)

Migration `20260920000000_content_keys.sql`:

- `categories.key text` och `cards.key text`, unika per deck (partiella index där key inte är
  null). Befintliga rader får nyckel vid första `apply` (se avsnitt 7).
- `cards.source_hash text` och `categories.source_hash text`: hash av innehållet så som det
  senast applicerades från fil. Skiljer sig databasens innehåll från hashen har någon ändrat i
  admin sedan senaste synk. Det gör en riktig trevägsjämförelse möjlig: fil, senast applicerat,
  databas. Hashen täcker framsida, baksida, ledtråd, aktiv och kategori, **men inte ordningen**
  (se avsnitt 6).
- Funktion `sync_deck(p_deck_id, p_plan jsonb) returns jsonb`: tar en färdig plan (skapa, uppdatera,
  flytta, ordna, inaktivera, radera) och utför allt i en transaktion. `security invoker`, så RLS
  avgör skrivningarna; `can_sync_deck()` ger dessutom ett begripligt fel. Returnerar räkneverk.
- Funktion `deck_snapshot(p_deck_id) returns jsonb`: databasens nuvarande innehåll i samma form
  som filerna, för `plan` och `pull`. Läsbar för redaktörer.

Ingen befintlig kolumn ändrar betydelse. Admin-UI:t fortsätter fungera oförändrat; kort som
skapas i admin får ingen nyckel förrän de dras in i filerna med `pull`.

## 5. Verktyget: `kuggfri`

Ett kommandoradsverktyg i repot (`scripts/kuggfri.ts`, körs med `npm run kuggfri -- <kommando>`).
Alla kommandon tar `--mal lokal|prod` (standard lokal) och gör ingenting utan att först visa vad
de tänker göra.

| Kommando | Gör |
|---|---|
| `kuggfri kontrollera [kurs]` | Läser filerna och rapporterar fel: saknade nycklar, dubbla nycklar, tomma fält, dubbletter (samma baksida), ogiltig KaTeX, för långa texter. Ändrar inget. Körs i `npm run verify`. |
| `kuggfri plan [kurs] [--mal prod]` | Trevägsjämförelse fil ↔ senast applicerat ↔ databas. Skriver ut planen: nya, ändrade, flyttade, omordnade, inaktiverade kort; kategorier; kursfält. Varnar för progress som påverkas och för kort som ändrats i admin sedan senaste synk. |
| `kuggfri apply [kurs] [--mal prod] [--ja] [--radera] [--tvinga] [--sajt <url>]` | Visar planen, ber om bekräftelse (`--ja` hoppar över), kör `sync_deck` i en transaktion. Kort som saknas i filerna inaktiveras; `--radera` tar bort dem (och deras progress) på riktigt. `--tvinga` skriver över admin-ändringar; annars stoppar de planen. Mot prod: backup tas först. Rensar sajtens innehållscache efteråt (kräver `CRON_SECRET`; annars syns ändringen inom fem minuter). |
| `kuggfri pull <kurs> [--mal prod]` | Skriver databasens innehåll till filerna (kort som ändrats eller skapats i admin får nycklar). Resultatet granskas som en git-diff. |
| `kuggfri konvertera <fil.csv/json> --kurs <key> --kategori <key> [--titel …]` | Brainscape-/CSV-/JSON-material → ny eller utökad kortfil, med samma normalisering som i dag (typografi, `→`, nedsänkta formler, dubbletter markerade). |
| `kuggfri ny-kurs <key> --titel …` | Skapar `content/<key>/kurs.json` och en första kortfil. |
| `kuggfri ny-kategori <kurs> <key> --titel …` | Skapar kortfilen och lägger in den i `kurs.json`. |
| `kuggfri ta-bort-kurs <key> [--radera]` | Avpublicerar kursen (standard) eller raderar den med all progress (kräver att nyckeln skrivs igen). |
| `kuggfri seed` | Bygger `supabase/seed.sql` ur `content/` (ersätter `seed:build`), så att `db reset` och E2E fortsätter fungera. |

Exempel, hela flödet för nytt material från Johan:

```bash
npm run kuggfri -- konvertera ~/Downloads/korrosion.csv --kurs materialteknik --kategori korrosion --titel "Korrosion"
# granska content/materialteknik/12-korrosion.md i editorn, rätta, committa
npm run kuggfri -- kontrollera materialteknik
npm run kuggfri -- plan materialteknik --mal prod
npm run kuggfri -- apply materialteknik --mal prod
```

## 6. Semantik i detalj

**Matchning.** Kort matchas på `key`. Ett kort utan nyckel i databasen (skapat i admin, eller från
tiden före pipelinen) matchas en gång på kategori + framsida, får då sin nyckel skriven i
databasen, och matchas därefter bara på nyckel.

**Id:n.** Nya objekt får UUID v5 av `kurs:<key>`, `kategori:<kurs>:<key>`, `kort:<kurs>:<key>`
med samma namnrymd som i dag. Befintliga objekt behåller sina id:n. Lokalt och i produktion får
alltså samma fil samma id, vilket gästers localStorage-progress kräver.

**Ändringar.** Framsida, baksida, ledtråd, kategori, ordning och aktiv-flagga uppdateras i plats.
Progress rörs aldrig av en uppdatering.

**Borttagning.** Saknas ett kort i filerna: `is_active = false` (progress kvar, kortet syns inte,
det räknas inte i statistik för studenten). `--radera`: raden tas bort, progress och historik
kaskaderar. Saknas en kategori: dess kort måste antingen ha flyttats till en annan kategori i
filerna eller inaktiveras; kategorin tas bort först när den är tom. Saknas en kurs: inget händer
(kurser tas bara bort med sitt eget kommando).

**Konflikter.** Skiljer sig databasens kort från `source_hash` (ändrat i admin) och filen också
ändrats sedan senaste synk, stoppar planen och listar korten. Lösningen är `pull` (ta in
admin-ändringen i filerna) eller `--tvinga` (filen vinner). Är bara databasen ändrad och filen
orörd, vinner databasen tyst tills någon kör `pull`; en varning visas.

**Ordning.** `sort_order` sätts globalt inom kursen ur filordningen, så att "deckets ordning" i
admin och kronologisk ordning för studenten stämmer med filerna. Ordningen ingår medvetet **inte**
i konfliktkontrollen: den bär ingen information som kan gå förlorad, och en enda radering i admin
lämnar en lucka i numreringen som annars skulle få varje följande kort att se ändrat ut. Filerna
vinner alltså alltid om ordningen, och en omordning gjord i admin kommer in i filerna med `pull`.
Att flytta ett kort till en annan *kategori* räknas däremot som innehåll och skyddas.

## 7. Migreringen av det befintliga innehållet (genomförd lokalt 19 sep)

1. `kuggfri konvertera` körs en gång på `seed/materialteknik/*.csv` med samma normalisering som
   seed-bygget (typografi, dubblettregel). Resultatet blir `content/materialteknik/` med elva
   kortfiler och nycklar härledda ur framsidan (`enhetscell`, `bcc-fcc`, …). Granskas i git-diffen.
2. Migrationen läggs i molnet (`db push`) före koden, som vanligt.
3. `kuggfri plan materialteknik` ska visa: 144 kort matchade på kategori + framsida, 0 nya,
   0 inaktiverade. Det är testet på att migreringen är korrekt. Avviker det stoppar vi.
   **Utfall lokalt:** 144 "knyts ihop", 11 kategorier, 1 kursuppdatering, noll nya och noll
   borttagna. Efter `apply` var nästa plan tom.
4. `kuggfri apply` skriver nycklar och hashar. Inga id:n ändras, ingen progress rörs.
5. `seed/` togs bort och `seed:build` pekar nu på `content/` (`kuggfri seed`).
6. **Kvar:** samma torrkörning mot produktion efter att migrationen pushats
   (`npm run kuggfri -- plan materialteknik --mal prod`). Den ska visa samma sak som lokalt.

## 8. Tester

- **Parser:** kortfil → modell → kortfil ger identisk text (rundtur), felmeddelanden med radnummer,
  KaTeX i rubrik, `aktiv: nej`, ledtråd, saknad nyckel.
- **Planerare (ren modul):** givet fil, senast applicerat och databas ger den deterministiska
  planer för varje fall: nytt, ändrat, flyttat mellan kategorier, omordnat, saknat (inaktivera
  respektive radera), admin-ändrat (konflikt respektive tyst vinst), legacy-matchning på framsida,
  idempotens (plan mot en synkad databas är tom).
- **`sync_deck` mot riktig Postgres (PGlite som RLS-testerna):** apply två gånger är idempotent;
  inaktivering behåller `card_progress`; radering kaskaderar; en student nekas; en examinator får
  sin egen kurs men inte andras; omordning ger global `sort_order`.
- **Konverterare:** Brainscape-CSV → kortfil ger exakt samma 144 kort som dagens seed (jämförs
  framsida/baksida/kategori/ordning mot `supabase/seed.sql`).
- **E2E:** oförändrade (seeden byggs ur `content/`), plus ett test att admin-import fortfarande
  fungerar och att ett kort som inaktiverats via apply inte syns för studenten.
- `kuggfri kontrollera` ingår i `npm run verify`.

## 9. Cachen

Publikt innehåll cachas fem minuter på servern och rensas normalt av admin-gränssnittet när något
sparas där. Pipelinen skriver direkt till databasen och kan inte rensa cachen den vägen, så `apply`
anropar `POST /api/revalidate` (skyddad med `CRON_SECRET`) efteråt. Utan hemligheten syns ändringen
ändå, men först när cachen går ut.

## 10. Vad som inte ändras

- Admin-UI:t och examinatorns redigering fungerar som i dag. Examinatorn kan fortsätta rätta
  kort i webbläsaren; pipelinen drar in ändringarna med `pull`.
- Import i admin finns kvar för examinatorer utan repo, men rekommenderad väg för nytt material i
  bulk är `konvertera` + `apply`.
- Studentsidan, schemat, statistiken: orörda. `is_active = false` respekteras redan överallt.

## 11. Felsökning

| Symptom | Orsak och åtgärd |
|---|---|
| `plan` säger "ändrat i admin. Kör pull" | Någon har redigerat kortet i gränssnittet sedan senaste synk. Kör `pull`, granska git-diffen, committa. Planen blir då ren. |
| `plan` visar konflikter | Samma kort är ändrat både i filen och i admin. `pull` tar in admin-versionen (filens ändring skrivs över), `apply --tvinga` låter filen vinna. |
| "N kort finns bara i databasen" | Kort som skapats i admin och saknar nyckel. De rörs aldrig av `apply`. Kör `pull` för att ta in dem i filerna. |
| `apply` vill inaktivera kort du inte tagit bort | Kortets `key` i filen har ändrats. Nycklar ska aldrig ändras; återställ nyckeln, eller acceptera att kortet blir ett nytt kort utan progress. |
| Planen vill skriva om alla kort efter att du lagt till ett i mitten | `sort_order` är global i kursen, så allt efter det nya kortet flyttas. Det visas som "kort byter bara ordning" och är ofarligt. |
| `deck_snapshot` finns inte (mot prod) | Migrationen är inte pushad än. Kör `supabase db push` först. |
| `apply --mal prod` klagar på storleken | Planen skickas som en JSON-sats via Management API:t. Vid mycket stora ändringar: dela upp i flera `apply` (t.ex. en kategori i taget genom att lägga till kategorierna stegvis), eller kör en gång med `--db-url "<connection string från Supabase → Settings → Database>"`, som inte har någon sådan gräns. |

## 12. Arbetsordning i sessionen

1. Migration (nycklar, hashar, `deck_snapshot`, `sync_deck`) med RLS-tester.
2. `lib/content/`: modell, kortfilsparser och -skrivare, nyckelhärledning, hashning, planerare.
   Enhetstester för varje del.
3. `scripts/kuggfri.ts`: kommandona, körning mot lokal och `--linked`, backup före prod-apply.
4. Konvertering av dagens seed till `content/materialteknik/`, `kuggfri seed`, `seed/` bort,
   full E2E.
5. Torrkörning mot produktion (`plan --mal prod`) med det förväntade resultatet i avsnitt 7.3.
6. Dokumentation: det här dokumentet blir handboken (kommandon, exempel, felsökning), README,
   DECISIONS, TASKS, ATERSTALLNING (ÅNGRA-sektion, backup före apply).

Uppskattad omfattning: en till två arbetsdagar. Inget av det ovanstående behöver vara live till
tisdagen; det kan byggas parallellt med lanseringsveckan och appliceras när planen mot produktion
visar noll ändringar i innehållet.

## 13. Beslut

- Markdown-kortfiler som källformat, CSV/JSON som inmatning.
- Inaktivera i stället för radera som standard.
- Produktion nås via Supabase CLI:s inloggning, inga nycklar i repot.
- Nycklar härleds ur framsidan vid konvertering (max 40 tecken, kapas vid ordgräns) och skrivs in
  i filen så att de är explicita därefter.
- **Admin-gränssnittet är Alvins och examinatorernas väg in; pipelinen är Claudes** (Alvins besked
  19 sep). `sync_deck` exponeras därför inte i admin-UI:t, och `pull` är huvudvägen tillbaka.
- Svenska nyckelord i kortfilerna (`key`, `ledtråd`, `aktiv`), engelska fältnamn i databasen.
  Engelska nyckelord (`hint`, `active`) godtas också vid inläsning.
