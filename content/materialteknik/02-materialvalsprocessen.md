# Materialvalsprocessen

## Vilka är de olika stegen i materialvalsprocessen?
key: vilka-ar-de-olika-stegen-i
original: ja
status: utkast
källa: Rättelse: iteration stod som ett femte steg, men strategin har fyra steg och iterationen är ett tillägg; Canvas, Kapitel_03 Materialval, s. 26, 42; Canvas, Ashby et al Materials 3 utgavan PRELIMINAR Lasanvisning och detaljerade larmal Kap 1-12, s. 2

1. Översätta
2. Sålla
3. Rangordna
4. Sök dokumentation

Utöver de fyra stegen itererar man: materialvalet behöver ofta förfinas i flera steg innan man hittar en bra lösning.

## Beskriv vad man gör i materialvalssteget: "Översätta".
key: beskriv-vad-man-gor-i
original: ja

Översätta krav på komponenten till krav på materialet:

* Funktion: talar om materialets huvudsakliga funktion i
komponenten.
Ex. leda värme, elektrisk isolering,
balk i böjning som inte plasticerar.
* Krav: egenskaper som måste vara uppfyllda för att komponenten skall fungera.
Ex. användningstemperatur, tåla
vatten, viss brottseghet
* Mål: egenskaper hos komponenten som vi vill optimera.
Ex. vikt, pris, miljöbelastning
* Fria variabler: variabler hos komponenten som vi kan ändra.
Ex. tvärsnitt, material

## Beskriv vad man gör i materialvalssteget: "Sålla".
key: beskriv-vad-man-gor-i-2
original: ja

Ta bort alla material som inte fyller kraven. (Använder vi dessa material så kommer komponenten inte att fungera som vi vill.) Materialegenskaper som vi använder i målfunktionen bör vi inte heller använda vid sållningen. (Ex. inget krav på densitet om målet är låg vikt.)

## Beskriv vad man gör i materialvalssteget: "Rangordna".
key: beskriv-vad-man-gor-i-3
original: ja

* Använd funktion, mål och fria variabler för att bestämma
materialindex.
* Materialindex = numeriskt värde som beskriver hur bra ett material uppfyller målen!
* Ta hjälp av materialindexet för att rangordna materialen.
Ex: E-modul/pris, E-modul^(1/2)/densitet

## Beskriv vad man gör i materialvalssteget: "Sök dokumentation".
key: beskriv-vad-man-gor-i-4
original: ja

Leta i dokumentation (handböcker, artiklar, standarder m.m.) för att se om det finns erfarenheter av materialet i liknande tillämpningar.

## Vad innebär det att iterera materialvalet, och varför är det viktigt?
key: beskriv-vad-man-gor-i-5
original: ja
status: utkast
källa: Rättelse: kortet sa att man utökar mängden material efter första iterationen, men kursen säger att man börjar brett med materialgrupperna och sedan begränsar sig; Canvas, Kapitel_03 Materialval, s. 26, 42; Canvas, Fo 2 Materialval, s. 9

Materialvalet måste ofta förfinas och förbättras i flera steg innan man hittar en bra lösning. Det är bra att först börja med materialgrupperna och sedan begränsa sig. I CES (Granta EduPack) börjar man med nivå 1 för att hitta materialgrupper och går sedan vidare till nivå 2 och 3.

## Vad har lastfall för inverkan på materialindexet?
key: vad-har-lastfall-for-inverkan-pa
original: ja
aktiv: nej

Lastfallet bestämmer vilket materialindex som är bäst lämpat för situationen. Materialindexet beskriver i sin tur hur bra ett material presterar i det aktuella lastfallet och kan därför med fördel användas för att rangordna en mängd material.

## Vad är ett lastfall och varför är det viktigt i materialvalsprocessen?
key: vad-ar-ett-lastfall-och-varfor-ar-det
original: ja
status: utkast
källa: Rättelse: påståendet att man ska använda det lastfall som förekommer oftast saknar stöd i kursmaterialet och är struket; dubbletten vad-har-lastfall-for-inverkan-pa är inaktiverad; Canvas, Fo 7 Styvhet, s. 15, 17; Canvas, Kapitel_03 Materialval, s. 33, 35

* Ett lastfall är en isolerad belastningssituation som materialet kan utsättas för.
* Ex: En stång i tryck/drag/vridspänning, en balk i böjning/knäckning eller utsatt för utbredd last, ett tryckkärl utsatt för tryckskillnader.
* Lastfallet (tillsammans med vad som ska optimeras) bestämmer vilket materialindex som är lämpligt. Alla fall av böjning av en balk har t.ex. samma inverkan av materialet, så för materialvalet behöver man bara bestämma typen av lastfall.
* Exempel vid minsta vikt: dragstång $\rho/E$ (styvhet) eller $\rho/\sigma_y$ (hållfasthet), balk i böjning $\rho/E^{1/2}$ eller $\rho/\sigma_y^{2/3}$; välj material med lägsta värde.

## Beskriv ingående vad ett materialindex är och hur det används.
key: beskriv-ingaende-vad-ett-materialindex
original: ja

* Ett numeriskt värde M som talar om hur effektivt ett material är i
ett visst lastfall och en viss form
* För att bestämma materialindex behöver vi veta vilken egenskap som skall optimeras (ex: styvhet, pris, vikt) och lastfall
* Detta bestäms av funktion, mål och fria variabler från
översättningen
* Materialindex används för att rangordna material i materialvalet

## När ska man använda materialindex för styvhet, kontra sträckgräns?
key: nar-ska-man-anvanda-materialindex-for
original: ja

* Använd materialindex för styvhet
om deformationen är
dimensionerande. (Krav på max
deformation)
* Använd materialindex för
sträckgräns om last utan plasticering
är dimensionerande. (Krav på max
spänning)

## Materialval: vilket påstående är sant?
key: quiz-materialval-vad-ar-sant-ett-ratt-svar
typ: alternativ
status: utkast
källa: Canvas, Quiz vecka 1, fråga 4; Canvas, Kapitel_03 Materialval, s. 8, 9, 25, 28, 43; Canvas, Fo 2 Materialval, s. 5, 6, 7

- [x] Materialvalet påverkas av möjliga tillverkningsmetoder.
- [ ] Miljöbelastningen kan inte tas med i materialvalet utan kräver en livscykelanalys.
- [ ] Ju fler material man har kvar efter sållningen, desto bättre.
- [ ] Om tvärsnittet inte är en fri variabel kan man inte göra ett materialval.

Material, form och process samverkar: en specificerad process begränsar valet av material och form. Minimal miljöpåverkan kan vara ett mål i materialvalet och uppskattas med en snabb eco audit, utan fullständig livscykelanalys. Sållningen tar bara bort material som inte klarar kraven och rangordningen avgör vilket av de kvarvarande som är bäst, så ett stort antal kvar är inget mål i sig. Fria variabler kan vara t.ex. tvärsnitt och material; i kursens kylflänsexempel är valet av material den enda fria variabeln.

## Materialval: vilka påståenden är sanna?
key: quiz-materialval-vad-ar-sant-tva-ratta-svar
typ: alternativ
status: utkast
källa: Canvas, Quiz vecka 1, fråga 5; Canvas, Fo 2 Materialval, s. 5, 6, 7

- [x] Material som inte klarar kraven kan inte användas i komponenten.
- [x] Material som finns kvar efter sållningen uppfyller kraven och kan därför användas i komponenten.
- [ ] Med översättning menas att översätta materialkraven till danska.
- [ ] Fria variabler är sådant som inte är nödvändigt.

Sållningen tar bort alla material som inte fyller kraven, eftersom komponenten annars inte fungerar. De material som finns kvar uppfyller kraven och kan användas; rangordningen med materialindex avgör sedan vilket som är bäst. Översättning innebär att krav på komponenten översätts till funktion, krav, mål och fria variabler, och fria variabler är variabler hos komponenten som vi kan ändra, t.ex. tvärsnitt och material. Quizens alternativ "Alla material som är kvar efter att vi sållat kan användas för att göra produkten" är omformulerat så att det tydligt gäller kraven.

## Vad behöver man veta för att bestämma ett materialindex?
key: quiz-for-att-bestamma-materialindex-behover
typ: alternativ
status: utkast
källa: Canvas, Quiz vecka 3, fråga 8; Canvas, Fo 7 Styvhet, s. 17; Canvas, Kapitel_03 Materialval, s. 26

- [x] Lastfall
- [x] Mål
- [ ] Densitet och pris
- [ ] Sträckgräns och E-modul

Vilket materialindex som gäller bestäms av vilken egenskap som ska optimeras (målet, t.ex. låg vikt) och av lastfallet, dvs. av funktion, mål och fria variabler från översättningen. Materialdata som densitet, pris, sträckgräns och E-modul behövs först när indexet räknas ut för de olika materialen, inte för att bestämma vilket index som ska användas.

## Materialindex: vilka påståenden är rätt?
key: quiz-materialindex-vad-ar-ratt-2-ratta-svar
typ: alternativ
status: utkast
källa: Canvas, Quiz vecka 3, fråga 9; Canvas, Fo 2 Materialval, s. 6, 7; Canvas, Kapitel_03 Materialval, s. 35; Canvas, Kapitel_03 Materialval Repetition och Inlamningsuppgift, s. 24, 25; Canvas, performance-indices-booklet-bokpeien22, s. 2

- [ ] Materialindex är ett numeriskt värde som används för att rangordna material efter hur bra de uppfyller kraven.
- [x] Ett materialindex kan innehålla en eller flera materialegenskaper.
- [x] Man kan behöva använda flera materialindex för att komma fram till ett bra materialval.
- [ ] Alla materialindex måste innehålla materialets densitet.

Materialindex rangordnar material efter hur väl de uppfyller målet; kraven används i sållningen, inte i rangordningen. Ett index kan vara en enda egenskap (t.ex. bara E om prestandan mäts som en balks styvhet) eller en kombination som $E/\rho$ eller $\sigma_y/\rho$, så det behöver inte innehålla densiteten. Finns det flera mål, t.ex. låg vikt och lågt pris, kan man behöva flera index och jämföra alternativen i ett paretodiagram.

## Vilka av följande är krav (och inte mål) i en översättning?
key: materialval-krav-eller-mal
typ: alternativ
status: utkast
källa: Canvas, Fo 2 Materialval, s. 5; Canvas, Kapitel_03 Materialval, s. 24, 25

- [x] Tåla vatten
- [x] Viss brottseghet
- [ ] Låg vikt
- [ ] Lågt pris

Krav är egenskaper som måste vara uppfyllda för att komponenten ska fungera, t.ex. användningstemperatur, att tåla vatten eller en viss brottseghet. Mål är egenskaper hos komponenten som vi vill optimera (minimera eller maximera), t.ex. vikt, pris och miljöbelastning. Kraven används i sållningen och målen i rangordningen.

## Om målet är låg vikt bör man inte ställa något krav på densiteten vid sållningen.
key: sallning-inget-krav-pa-malegenskap
typ: sant-falskt
svar: sant
status: utkast
källa: Canvas, Fo 2 Materialval, s. 6

Materialegenskaper som ingår i målfunktionen ska inte användas vid sållningen. Densiteten hanteras i stället i rangordningen, via materialindexet (t.ex. $\rho/\sigma_y$ för en lätt och stark dragstång).

## Lätt och stark dragstång (får inte plasticera): vilket materialindex ska minimeras?
key: materialindex-latt-stark-dragstang
typ: alternativ
status: utkast
källa: Canvas, Kapitel_03 Materialval, s. 35, 37

- [x] $\rho/\sigma_y$
- [ ] $\rho/E$
- [ ] $\rho/E^{1/2}$
- [ ] $\rho/\sigma_y^{2/3}$

För en dragstång med minsta massa gäller $\rho/\sigma_y$ när hållfastheten (ingen plasticering) är dimensionerande och $\rho/E$ när styvheten är det. $\rho/E^{1/2}$ och $\rho/\sigma_y^{2/3}$ är indexen för en lätt balk i böjning (styvhet respektive hållfasthet). Man väljer material med lägsta värde på indexet, vilket är samma sak som högsta $\sigma_y/\rho$.

## Lätt och styv balk i böjning (tvärsnittsarean fri): vilket materialindex ska minimeras?
key: materialindex-latt-styv-balk
typ: alternativ
status: utkast
källa: Canvas, Kapitel_03 Materialval, s. 35, 36; Canvas, Fo 7 Styvhet, s. 20

- [x] $\rho/E^{1/2}$
- [ ] $\rho/E$
- [ ] $\rho/E^{1/3}$
- [ ] $\rho/\sigma_y^{2/3}$

För en lätt och styv balk i böjning är indexet $\rho/E^{1/2}$ (minimeras), dvs. välj material med högsta $E^{1/2}/\rho$. $\rho/E$ gäller en styv dragstång, $\rho/E^{1/3}$ en styv panel i böjning och $\rho/\sigma_y^{2/3}$ en balk där hållfastheten är dimensionerande.

## Härled materialindex för en lätt och stark dragstång med given längd L och last F.
key: harled-materialindex-dragstang
status: utkast
källa: Canvas, Kapitel_03 Materialval, s. 37; Canvas, Ashby et al Materials 3 utgavan PRELIMINAR Lasanvisning och detaljerade larmal Kap 1-12, s. 4

Översättning: funktion dragstång; mål minsta massa; krav längden L given och stången får inte gå sönder (plasticera) under lasten F; fria variabler materialet och tvärsnittsarean A.

1. Massan: $m = A L \rho$
2. Kravet: $F/A \le \sigma_y$, dvs. minsta area $A = F/\sigma_y$
3. Eliminera A: $m = F L \,(\rho/\sigma_y)$

F och L är givna, så massan blir minst för det material som har lägst $\rho/\sigma_y$. Det är materialindexet.

## I ett diagram med $\log E$ mot $\log \rho$ ligger material med samma värde på $E^{1/2}/\rho$ på en linje. Vilken lutning har linjen?
key: materialindex-lutning-bubbeldiagram
typ: alternativ
status: utkast
källa: Canvas, Kapitel_03 Materialval, s. 36; Canvas, Fo 7 Styvhet, s. 23

- [x] 2
- [ ] 1
- [ ] 1/2
- [ ] 3

Om $E^{1/2}/\rho = C$ blir $E = C^2\rho^2$, och med logaritmer $\log E = 2\log\rho + 2\log C$: en rät linje med lutningen 2. Alla material på linjen har samma indexvärde och är lika bra; material längre upp till vänster är bättre.

## I konceptfasen av designen behövs detaljerade data för ett enda specifikt material.
key: konceptdesign-materialdata
typ: sant-falskt
svar: falskt
status: utkast
källa: Canvas, Kapitel_03 Materialval, s. 3, 8

I konceptdesign står alla material till förfogande och man använder data med låg precision, enkla egenskaper som är typiska för varje materialgrupp. I primärdesign jämförs ett fåtal material med mer detaljerade data, och först i detaljdesignen behövs välspecificerade data för ett material och en process.

## Vad är en Paretoyta (paretodiagram) i materialval och när används den?
key: paretoyta-materialval
status: utkast
källa: Canvas, Kapitel_03 Materialval Repetition och Inlamningsuppgift, s. 24, 25

Den används när det finns en konflikt mellan önskemål (mål), t.ex. låg vikt och lågt pris, och det är oklart vilken parameter som är viktigast. Ett paretodiagram visar vilka alternativ som är de bästa kompromisserna mellan målen.
