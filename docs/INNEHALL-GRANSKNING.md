# Innehållsgranskning – Materialteknik

Genererad 2026-09-14 av dåvarande `scripts/content-review.ts` (historiskt dokument; samma
kontroller görs numera av `npm run kuggfri -- kontrollera`). 10 av 144 kort har minst en anmärkning.

Inget här är ändrat. Alvin bockar i det som ska åtgärdas; Claude gör sedan bara formateringsändringar (aldrig innehåll).

## Sammanfattning per typ

- radbrytning mitt i mening utan lista: 10 kort

## Generella åtgärder (godkända av Alvin 2026-09-14, gjorda i `lib/import/normalize.ts`)

- [x] "=>" är utbytt mot "→"
- [x] Kemiska formler har nedsänkt text: Fe₃C, CO₂, Al₂O₃, SiO₂, O₂
- [x] Unicode-matte är KaTeX, t.ex. `$\sigma = E\,\varepsilon$`, `$\varepsilon_T = \alpha\,(T - T_0)$`
- [x] Sju dubbletter borttagna (alla i "Tillverkning och värmebehandling av stål", originalen finns i "Stål, värmebehandling och bearbetning")

Öppen fråga till Alvin: kortet om brottseghet anger `K1c = EGc`. Det fysikaliskt korrekta sambandet är
K_Ic = √(E·G_c); kvadratroten föll troligen bort i Brainscape-exporten. Det är en innehållsändring, så
Claude har inte rättat det. Säg till om det ska rättas.

Anmärkningen "radbrytning mitt i mening" nedan är ofarlig: markdown slår ihop raderna vid visning.

## Kort med anmärkning

### Stål, värmebehandling och bearbetning

- [ ] **Vad innebär kalldeformation?**
  - radbrytning mitt i mening utan lista
  - _Kallbearbetning, även känt som deformationshärdning eller kalldeformation, är en process som stärker metall genom plastisk deformation som exempelvis kallvalsni…_
### Termiska egenskaper, diffusion och krypning

- [ ] **Vad är ett krypbrott?**
  - radbrytning mitt i mening utan lista
  - _Krypbrott fås när det har ⏎ initierats porer som har tillväxt ⏎ till brott till följd av krypning.…_
### Begrepp och ja/nej-frågor

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
  - radbrytning mitt i mening utan lista
  - _En strukturbeståndsdel som består av två faser. Eutektikum bildas vid konstant temperatur ⏎ och koncentration genom en trefasreaktion där en smält fas L bildar tv…_
- [ ] **Mjukglödgning**
  - radbrytning mitt i mening utan lista
  - _En värmebehandling av stål där man får sfäriodiserad perlit, vilket ger ett material med lägre sträckgräns men som är lättare att maskinarbeta. Stålet värms upp…_
- [ ] **Strukturbeståndsdel**
  - radbrytning mitt i mening utan lista
  - _En urskiljbar del av materialet som består av en eller flera faser och kan ses som en enhet på ⏎ något sätt. Kan vara en fas, eutektikum eller eutektoid.…_
