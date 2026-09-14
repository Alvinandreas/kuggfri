# Innehållsgranskning – Materialteknik

Genererad 2026-09-14 av `scripts/content-review.ts`. 34 av 151 kort har minst en anmärkning.

Inget här är ändrat. Alvin bockar i det som ska åtgärdas; Claude gör sedan bara formateringsändringar (aldrig innehåll).

## Sammanfattning per typ

- pil "=>" (kan bli →): 14 kort
- radbrytning mitt i mening utan lista: 11 kort
- kemisk formel utan nedsänkt text (Fe3C, CO2 …): 7 kort
- unicode-matte (kan bli KaTeX): 4 kort
- dubblett-markering i framsidan: 1 kort

## Förslag på generella åtgärder (kräver ditt ja)

- [ ] Byt "=>" mot "→" överallt (ren typografi, ingen betydelseändring)
- [ ] Skriv kemiska formler med nedsänkt text: Fe₃C, CO₂, Al₂O₃, SiO₂
- [ ] Konvertera unicode-matte till KaTeX, t.ex. `𝜎 = 𝐸 𝜀` → `$\sigma = E\varepsilon$`
- [ ] Ta bort prefixet "Repetition:" på dubblettkort, eller ta bort dubbletten

## Kort med anmärkning

### Materialgrupper och egenskaper

- [ ] **Nämn minst två olika typer av atombindningar och redogör för deras karaktäristiska egenskaper.**
  - pil "=>" (kan bli →)
  - _* Kovalent bindning: ⏎   - Stark ⏎   - Riktningsberoende ⏎   - Keramer, polymerer ⏎ * Metallbindning: ⏎   - Stark ⏎   - Elektronmoln=>elektrisk och ⏎ termisk ledning ⏎   - Hos …_
- [ ] **Vad är en keram och vad kännetecknar dem?**
  - kemisk formel utan nedsänkt text (Fe3C, CO2 …)
  - _* Oorganiska, kemiska föreningar ⏎ mellan metal- och icke-metall ⏎ * Ex: Al2O3, SiC, SiO2 ⏎ * Använder sig av kovalent- eller jonbindning ⏎ * Cement, betong, tegel, por…_
- [ ] **Ge minst två exempel på miljöegenskaper.**
  - kemisk formel utan nedsänkt text (Fe3C, CO2 …)
  - _* CO2 footprint: mängd CO2-som ⏎ bildas vid framställning ⏎ * Embedded energy: mängd ⏎ energi som åtgår för ⏎ framställning ⏎ * Återvinningsbart ⏎ * Andra miljöbelastningar…_
### Kristallstruktur

- [ ] **Millerindex: Beskriv kortfattat vad det är och hur det tas fram.**
  - pil "=>" (kan bli →)
  - _Millerindex är en form av vektorbeteckning som används för att beskriva atomplans position. Origo för koordinatsystemet placeras i regel i ett av enhetscellens …_
### Styvhet, töjning och materialindex

- [ ] **Vad är töjning?**
  - unicode-matte (kan bli KaTeX)
  - _Töjning är en geometrisk storhet som beskriver den procentuella förlängningen av ett material under en given last eller annan typ av påfrestning. ⏎  ⏎ * Töjning kan…_
- [ ] **Vad kännetecknar ett isotropt material?**
  - pil "=>" (kan bli →)
  - _Ett isotropt material är ett material som kan beskrivas med minst två elastiska konstanter: ⏎  ⏎ * E-modul ⏎ * Poissons tal, tvärkontraktion ⏎  ⏎ Fler elastiska konstante…_
### Dislokationer, härdning och brott

- [ ] **Vad är deformationshärdning och hur går det till?**
  - pil "=>" (kan bli →)
  - _* Dislokationer hindrar andra ⏎ dislokationer att röra sig (låser ⏎ varandra) ⏎ * Mängden dislokationer ökar ⏎ kraftigt vid plastisk ⏎ deformation => plastiskt ⏎ hårdnande ⏎ …_
- [ ] **Vad är brottseghet?**
  - unicode-matte (kan bli KaTeX)
  - _Ett mått på ett materials naturliga motstånd mot propagering av sprickor. ⏎  ⏎ * Brottseghet K1c (MPam1/2), 1 för modus, c för kritisk ⏎ * Brott när K1c> K1 ⏎ * Tar hän…_
### Stål, värmebehandling och bearbetning

- [ ] **Vad är cementit och när uppstår det?**
  - kemisk formel utan nedsänkt text (Fe3C, CO2 …)
  - _Cementit, Fe3C, intermediär fas, 6,67 % C, mycket hård…_
- [ ] **Vad kännetecknar underkategorin: "Rostfritt stål"?**
  - pil "=>" (kan bli →)
  - _Legeras med Cr för att få ett kromoxidskikt på ytan => ⏎ korrosionsskydd ⏎  ⏎ * Ni, stabiliserar austenit vid rumstemperatur ⏎ * Tre typer: ferritiska (billiga), austen…_
- [ ] **Vad innebär kalldeformation?**
  - pil "=>" (kan bli →); radbrytning mitt i mening utan lista
  - _Kallbearbetning, även känt som deformationshärdning eller kalldeformation, är en process som stärker metall genom plastisk deformation som exempelvis kallvalsni…_
### Termiska egenskaper, diffusion och krypning

- [ ] **Vad är termisk utvidgning respektive termiska spänningar?**
  - unicode-matte (kan bli KaTeX)
  - _När temperaturen ökar i ett material uppstår "Termisk utvidgning/töjning" (procentuella förlängningen/utvidgningen av materialet) och "Termiska gradienter" (sto…_
- [ ] **Vad har atombindningar med termisk utvidgning att göra?**
  - unicode-matte (kan bli KaTeX)
  - _Den termiska utvidgningen är proportionell mot temperaturskillnaden*temperaturutvidgningskoefficienten alpha enl 𝜖𝑇 = 𝛼 (𝑇 − 𝑇0). ⏎  ⏎ Svaga atombindningar ger…_
- [ ] **Vilka faktorer är avgörande för ett materials termiska ledningsförmåga?**
  - pil "=>" (kan bli →)
  - _Temperatur fördelas med hjälp av nedanstående mekanismer: ⏎  ⏎ * Kristallvibrationer (fononer) ⏎ * Elektroner ⏎  ⏎ Kristallvibrationer och elektroner överför energi från …_
- [ ] **Vad är ett krypbrott?**
  - radbrytning mitt i mening utan lista
  - _Krypbrott fås när det har ⏎ initierats porer som har tillväxt ⏎ till brott till följd av krypning.…_
### Hållbarhet och återvinning

- [ ] **Vad i materialtillverkningsprocessen kräver energi och vad innebär detta för miljön?**
  - kemisk formel utan nedsänkt text (Fe3C, CO2 …)
  - _Energiintensiva processer: ⏎  ⏎ * Energi för reducering av mineral till metall ⏎ * Övrig energi för tillverkning och formning, transport, användning. Kan minskas geno…_
- [ ] **Hur bra är aluminium sett ur ett hållbarhetsperspektiv?**
  - pil "=>" (kan bli →)
  - _Aluminium: ⏎  ⏎ * Det vanligaste grundämnet i jordskorpan ⏎ * Framställning av primäraluminium kräver mycket energi ⏎ * Mycket mindre energi krävs för återvinning ⏎ => Lä…_
- [ ] **Vad är "CO2- footprint" respektive "Embodied Energy"?**
  - kemisk formel utan nedsänkt text (Fe3C, CO2 …)
  - _CO2 footprint: ⏎  ⏎ * Mängd CO2 som bildas vid produktion av 1 kg material ⏎  ⏎ För metaller: ⏎ - CO2 bildas vid produktion av energi ⏎ - CO2 bildas vid kemiska reaktioner …_
- [ ] **Sammanfatta lite kort hur metaller lämpar sig för återvinning.**
  - kemisk formel utan nedsänkt text (Fe3C, CO2 …)
  - _* Metaller lämpar sig väl för återvinning ⏎   - Sparar resurser och energi ⏎   - Ger lika bra material ⏎ * Problem med föroreningar och legeringsämne ⏎ * CO2 footprint …_
### Tillverkning och värmebehandling av stål

- [ ] **Vad innebär kallbearbetning?**
  - pil "=>" (kan bli →); radbrytning mitt i mening utan lista
  - _Kallbearbetning, även känt som deformationshärdning eller kalldeformation, är en process som stärker metall genom plastisk deformation som exempelvis kallvalsni…_
- [ ] **Beskriv stålets tillverkningsprocess i grova mått.**
  - pil "=>" (kan bli →)
  - _* Utgångsmaterial: järnoxid ⏎ * Reduceras i masugn: ⏎ järnoxid + kol + energi => tackjärn + koloxid ⏎ * Kolhalten i tackjärnet justeras till rätt kolhalt, stålet lege…_
- [ ] **Repetition: Beskriv vad en anlöpning är och hur den används.**
  - dubblett-markering i framsidan
  - _Anlöpning av härdat stål är en process som används för att öka materialets duktilitet och sänka dess hårdhet. ⏎  ⏎ För att uppnå detta återuppvärms stålet till en t…_
- [ ] **Ge minst två exempel på värmebehandlingar för stål.**
  - pil "=>" (kan bli →)
  - _* Normalisering: austenitisering + långsam kylning => primär ferrit eller cementit + perlit. Andel perlit ges av kolhalten. Ger ”normal” mikrostruktur, lämpligt…_
### Icke-järnmetaller

- [ ] **Vad kännetecknar Aluminium?**
  - pil "=>" (kan bli →)
  - _* Lägre vikt än stål, densiteten är 2,7 kg/dm3 ⏎ * FCC struktur => god plastisk formbarhet ⏎ * God maskinbarhet ⏎ * God elektrisk- och värmeledning ⏎ * Korrosionsskydd:…_
- [ ] **Vad kännetecknar Magnesium?**
  - pil "=>" (kan bli →)
  - _* Låg densitet 1,8 kg/dm3 ⏎ * HCP struktur => begränsad plastisk formbarhet ⏎ * God maskinbarhet ⏎ * God gjutbarhet, större delen används som gjutgods ⏎ * Bildar poröst…_
### Begrepp och ja/nej-frågor

- [ ] **CO2-foot print**
  - kemisk formel utan nedsänkt text (Fe3C, CO2 …)
  - _Den mängd CO2 som bildas vid produktion av ett kilo material.…_
- [ ] **TTT-diagram**
  - radbrytning mitt i mening utan lista
  - _Ett diagram som visar fastransformationer vid svalning som funktion av tid och ⏎ temperatur.…_
- [ ] **Krypning**
  - radbrytning mitt i mening utan lista
  - _Långsam plastisk deformation som beror på temperatur, tid och last. Sker vid temperaturer över halva smälttemperaturen i K, och töjningshastigheten ökar exponen…_
- [ ] **Brottseghet**
  - radbrytning mitt i mening utan lista
  - _Ett mått på materialets seghet, hur mycket energi som behövs för att driva en ⏎ spricka. Brott fås när spänningsintensiteten vid sprickspetsen är högre än brottse…_
- [ ] **Högcykelutmattning**
  - radbrytning mitt i mening utan lista
  - _Utmattning är brott som uppkommer vid cyklisk belastning. Vid högcykelutmattning är belastningen under sträckgränsen, och materialet plasticerar bara lokalt ⏎ vid…_
- [ ] **Aktiveringsenergi**
  - radbrytning mitt i mening utan lista
  - _Den energibarriär som måste övervinnas m.h.a. termisk energi för att vissa processer skall kunna ⏎ ske, t.ex. kemiska reaktioner, diffusion, krypning.…_
- [ ] **Eutektikum**
  - pil "=>" (kan bli →); radbrytning mitt i mening utan lista
  - _En strukturbeståndsdel som består av två faser. Eutektikum bildas vid konstant temperatur ⏎ och koncentration genom en trefasreaktion där en smält fas L bildar tv…_
- [ ] **Mjukglödgning**
  - radbrytning mitt i mening utan lista
  - _En värmebehandling av stål där man får sfäriodiserad perlit, vilket ger ett material med lägre sträckgräns men som är lättare att maskinarbeta. Stålet värms upp…_
- [ ] **Strukturbeståndsdel**
  - radbrytning mitt i mening utan lista
  - _En urskiljbar del av materialet som består av en eller flera faser och kan ses som en enhet på ⏎ något sätt. Kan vara en fas, eutektikum eller eutektoid.…_
