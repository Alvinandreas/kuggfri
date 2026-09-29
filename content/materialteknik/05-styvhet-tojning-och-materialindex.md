# Styvhet och elastisk deformation

## Vad beror ett materials densitet på för faktorer?
key: vad-beror-ett-materials-densitet-pa-for
original: ja

* Atomvikten hos atomerna i materialet
* Antalet atomer/volym
* Densiteten hos kompositer beror på volymandel och densitet på de ingående materialen
* Densiteten i polymerskum, trä m.m blir låg p.g.a. hålrummen.

## Atombindningar kan jämföras med linjära fjädrar. Hur kommer detta sig och varför gör man det?
key: atombindningar-kan-jamforas-med-linjara
original: ja
flagga: Kortet anger "E-modulen = S x n" med S som bindningens styvhet och n som antalet bindningar per area, ordagrant från Fö 7 Styvhet 2025. Sambandet går inte ihop i enheter (N/m gånger 1/m² ger N/m³, inte Pa); fjädermodellen ger E ≈ S/r0 där r0 är atomavståndet (Ashby). Ska formeln rättas, eller skrivas som ett proportionalitetssamband?

Man brukar likna atombindningar med linjära fjädrar för att de har liknande egenskaper.
Om:
S = styvheten hos atombindningen
n = antalet bindningar/area
Får vi:
E-modulen = S x n

* Elastiskt beteende = materialet beter sig
som en fjäder, fjädrar tillbaka vid
avlastning
* Djup bindningsenergikurva ger:
  - Stor E-modul
  - Hög smälttemperatur

## Vad har ett materials atombindningar för inverkan på dess egenskaper?
key: vad-har-ett-materials-atombindningar
original: ja

* Påverkar styvhet, termisk utvidgning,
smälttemperatur, elektrisk ledningsförmåga m.m.
* Kan ej förändras med processer

## Hur ser ett typiskt dragprov ut för ett sprött material?
key: hur-ser-ett-typiskt-dragprov-ut-for-ett
original: ja

* Elastiskt beteende upp till
brottgränsen
* Brottgränsen =den spänning
där brott sker
* Keramer, glas

## Hur ser ett typiskt dragprov ut för ett segt material?
key: hur-ser-ett-typiskt-dragprov-ut-for-ett-2
original: ja
status: utkast
källa: Rättelse: "polymerer" som exempel på sega material stämmer inte generellt, eftersom amorfa termoplaster (med undantag som PC) och härdplaster är spröda vid rumstemperatur; det är de delkristallina termoplasterna, mellan Tg och Tm, som är sega; Canvas, MTT085 Polymeric materials L6, s. 7, 8; Canvas, Lab-PM Polymer_MTT085-1, s. 2; Canvas, MTT085-Turorials-Part12, s. 3; Canvas, Fo 7 Styvhet, s. 7
flagga: Rättelse av originalkortet: exemplen på sega material var "Metaller, polymerer" (ordagrant Fö 7 Styvhet s. 7), men amorfa termoplaster (utom t.ex. PC) och härdplaster är spröda vid rumstemperatur (L6 s. 7, 8; Lab-PM Polymer s. 2). Nu står "Metaller, delkristallina termoplaster (mellan Tg och Tm)", vilket avviker från metalldelens bild. Godkänns rättelsen?

* Elastiskt beteende upp till
sträckgränsen
* Sträckgränsen = den spänning där
materialet börjar plasticera
* Brottgränsen = högsta spänningen
* Elastisk avlastning även i plastiska
området
* Metaller, delkristallina termoplaster (mellan Tg och Tm)

## Vilka egenskaper kan observeras/kartläggas med hjälp av dragprov?
key: vilka-egenskaper-kan-observeras
original: ja
status: utkast
källa: Rättelse: "seghet = arean under dragprovkurvan" (2025) krockar med 2026 års definition av seghet som motstånd mot spricktillväxt, som inte kan fås ur dragprov; arean beskrivs nu som brottarbete; Canvas, Kapitel_08 Seghet och Brott, s. 2, 7; Canvas, Fo 9 Brott och brottseghet, s. 11; Canvas, Kapitel_04 Elastisk deformation, s. 20; Canvas, Fo 7 Styvhet, s. 9; Canvas, Kapitel_03 Materialval, s. 15; Canvas, Fo 8 Plasticitet, s. 2
flagga: Rättelse av originalkortet: "Seghet = arean under dragprovkurvan" (Fö 7 Styvhet 2025 s. 9) krockar med 2026 års definition av seghet som motstånd mot spricktillväxt, som enligt Kapitel_08 s. 2 inte kan fås från dragprov. Arean kallas nu brottarbete (Fö 9 s. 11). Godkänns rättelsen?

![Spännings–töjningskurva från dragprov med E, Rp0,2, Rm och brottförlängning](/kort/materialteknik/dragprovkurva.svg)

* E-modul (styvhet) GPa
* Sträckgräns (börjar plasticera) MPa
* Brottgräns (största spänningen innan brott) MPa
* Brottförlängning (plastisk töjning efter brott) %
* Arean under kurvan: brottarbetet, dvs. energin per volymenhet fram till brott. (Seghet i betydelsen motstånd mot spricktillväxt, brottseghet, kan däremot inte mätas med dragprov, eftersom provet saknar spricka.)

## Hur bestäms sträckgränsen $R_{p0{,}2}$ ur en dragprovkurva?
key: dragprov-rp02-bestamning
typ: alternativ
status: utkast
källa: Canvas, Kapitel_03 Materialval, s. 15; Canvas, Kapitel_04 Elastisk deformation, s. 10; Canvas, Fo 8 Plasticitet, s. 2

- [x] En linje dras parallellt med kurvans elastiska del, förskjuten 0,2 % töjning, och sträckgränsen är spänningen där linjen skär kurvan.
- [ ] Den är kurvans högsta spänning.
- [ ] Den är spänningen när provet går av.
- [ ] Den är lutningen hos kurvans elastiska del.

![Spännings–töjningskurva från dragprov med E, Rp0,2, Rm och brottförlängning](/kort/materialteknik/dragprovkurva.svg)

Sträckgränsen bestäms med en standardiserad offsetmetod: $R_{p0{,}2}$ är spänningen vid 0,2 % kvarstående (plastisk) töjning. Kurvans högsta spänning är brottgränsen $R_m$ (draghållfastheten), och lutningen i det elastiska området är E-modulen, $E = \Delta\sigma/\Delta\varepsilon$.

## Brottgränsen $R_m$ är spänningen i det ögonblick provstaven går av i ett dragprov av en seg metall.
key: dragprov-rm-vid-brott
typ: sant-falskt
svar: falskt
status: utkast
källa: Canvas, Kapitel_03 Materialval, s. 15; Canvas, Kapitel_04 Elastisk deformation, s. 10; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 3

![Spännings–töjningskurva från dragprov med E, Rp0,2, Rm och brottförlängning](/kort/materialteknik/dragprovkurva.svg)

Falskt. Brottgränsen (draghållfastheten) $R_m$ är kurvans högsta spänning. För en seg metall sjunker den tekniska spänningen efter maximum, när provet får en midja, så spänningen vid brott är lägre än $R_m$.

## Styvheten hos kompositer beror på fler faktorer än homogena material gör, nämn minst två av dessa.
key: styvheten-hos-kompositer-beror-pa-fler
original: ja

Styvheten beror på:

* De ingående komponenternas
egenskaper
* Volymfraktion
* Orientering
* Form

Ex: Fiberriktning

## Vad är töjning?
key: vad-ar-tojning
typ: begrepp
original: ja
status: utkast
källa: Rättelse: töjning beskrevs som den procentuella förlängningen, men är den relativa längdändringen, dimensionslös och negativ vid tryck; Canvas, Kapitel_04 Elastisk deformation, s. 6, 7, 22; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 2; Canvas, Fo 7 Styvhet, s. 12
flagga: Rättelse av originalkortet: töjning beskrevs som "den procentuella förlängningen", men enligt Kapitel_04 s. 6 och 7 är den den relativa längdändringen ΔL/L0, dimensionslös och negativ vid tryck, och anges ofta i procent. Godkänns rättelsen?

Töjning är en geometrisk storhet: den relativa längdändringen, $\varepsilon = (L - L_0)/L_0$. Den är dimensionslös och anges ofta i procent (0,05 = 5 %). Dragspänning ger positiv töjning och tryckspänning negativ.

* Töjning kan orsakas av:

Mekaniska laster:
$\sigma = E\,\varepsilon$
Temperatur:
$\varepsilon = \alpha\,\Delta T$
$\alpha$ = längdutvidgningskoefficienten
Elektriska och magnetiska fält
Fukt m.m.

## Vad kännetecknar ett isotropt material?
key: vad-kannetecknar-ett-isotropt-material
typ: begrepp
original: ja
status: utkast
källa: Rättelse: isotropi definierades som att materialet kan beskrivas med minst två elastiska konstanter, men definitionen är att egenskaperna är lika i alla riktningar; Canvas, Kapitel_04 Elastisk deformation, s. 15, 21, 23; Canvas, Short_dictionary_ v2026, s. 8; Canvas, Fo 7 Styvhet, s. 13
flagga: Rättelse av originalkortet: isotropi definierades som att materialet "kan beskrivas med minst två elastiska konstanter" (en läsning av Fö 7 Styvhet 2025 s. 13), men definitionen är att egenskaperna är desamma i alla riktningar (Kapitel_04 s. 23); E och ν står kvar och G = E/(2(1+ν)) är tillagt (Kapitel_04 s. 21). Godkänns rättelsen?

Ett isotropt material har samma egenskaper oavsett i vilken riktning de mäts. Dess elastiska beteende beskrivs av två elastiska konstanter:

* E-modul
* Poissons tal, tvärkontraktion

Övriga moduler följer av dem, t.ex. skjuvmodulen $G = E/(2(1+\nu))$. Fler elastiska konstanter behövs i t.ex. kompositer och trä → anisotropt material.

## Anisotropt
key: anisotropt
typ: begrepp
original: ja

Olika egenskaper i olika riktningar

## Styvhet
key: styvhet
typ: begrepp
original: ja

Ett mått på hur mycket ett material deformeras elastiskt när det utsätts för en last.

## Det bästa sättet att öka en metalls E-modul är att värmebehandla (härda) den.
key: ja-nej-basta-sattet-att-oka-e-modulen
typ: sant-falskt
svar: falskt
original: ja
status: utkast
källa: Canvas, Kapitel_04 Elastisk deformation, s. 12, 24, 26; Canvas, Fo 7 Styvhet, s. 4, 5; Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2

E-modulen bestäms av atombindningarnas styvhet och antalet bindningar per area, och i metaller påverkar värmebehandling och bearbetning inte E-modulen. Härdning höjer i stället sträckgräns och hårdhet. Vill man ändra E-modulen är det mest effektivt att kombinera material i makroskala, t.ex. styva fibrer i en mindre styv matris i en komposit.

## Dislokationer är lika viktiga för ett materials E-modul som för dess sträckgräns.
key: ja-nej-dislokationer-ar-lika-viktiga
typ: sant-falskt
svar: falskt
original: ja
status: utkast
källa: Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 18, 30; Canvas, Kapitel_04 Elastisk deformation, s. 12; Canvas, Fo 7 Styvhet, s. 4; Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2

Dislokationsrörelse ger plastisk deformation, och genom att försvåra den höjs sträckgränsen. E-modulen beskriver elastisk deformation och bestäms av atombindningarnas styvhet; den påverkas inte av värmebehandling och bearbetning, som ändrar dislokationsstrukturen.

## Styvhet: vilka påståenden är sanna?
key: quiz-styvhet-vad-ar-sant-tva-ratta-svar
typ: alternativ
status: utkast
källa: Canvas, Quiz vecka 1, fråga 8; Canvas, Kapitel_04 Elastisk deformation, s. 2, 9, 12; Canvas, Kapitel_01 Intro till Material, s. 16

- [x] Material med låg E-modul är lätta att deformera elastiskt.
- [x] Material med låg E-modul är veka.
- [ ] Material med hög E-modul kan deformeras mycket.
- [ ] Material med låg E-modul är spröda.

Styvhet är motståndet mot elastisk formförändring, och E-modulen är lutningen i den elastiska delen av spännings-töjningskurvan ($\sigma = E\varepsilon$). Låg E-modul ger alltså stor elastisk töjning vid en given spänning, ett vekt material, medan hög E-modul ger liten deformation. Sprödhet hänger ihop med låg brottseghet, inte med låg E-modul. Quizens "lätta att deformera" är preciserat till elastisk deformation.

## Styvhet: vilka påståenden om E-modul och elastisk deformation är rätt?
key: quiz-vad-ar-ratt-for-styvhet-2-ratta-svar
typ: alternativ
status: utkast
källa: Canvas, Quiz vecka 3, fråga 1; Canvas, Kapitel_04 Elastisk deformation, s. 12, 14; Canvas, 2026-09-25 Kapitel_12 Material och varme, s. 15

- [ ] Stål kan inte deformeras elastiskt.
- [x] E-modul och Poissons tal beskriver båda elastisk deformation.
- [ ] E-modulen är olika vid dragbelastning och böjbelastning.
- [x] Material med hög E-modul har oftast låg termisk utvidgningskoefficient.

Metaller som stål har en linjärt elastisk del av spännings-töjningskurvan (E ≈ 210 GPa för stål). Poissons tal är bara definierat i det elastiska området och beskriver, liksom E-modulen, elastisk deformation. E-modulen är en materialegenskap och kan bestämmas med både drag- och böjprov. Hög E-modul hänger ihop med starka atombindningar, och empiriskt har material med hög E-modul låg expansionskoefficient.

## Styvhet: vilka påståenden om att ändra E-modulen är rätt?
key: quiz-styvhet-vad-ar-ratt-2-ratta-svar
typ: alternativ
status: utkast
källa: Canvas, Quiz vecka 3, fråga 2; Canvas, Kapitel_04 Elastisk deformation, s. 12, 23, 24, 26, 42; Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 14

- [ ] Man kan öka en metalls E-modul genom härdning.
- [ ] Ett vanligt sätt att öka en metalls E-modul är att legera med en tyngre metall.
- [x] E-modulen hos en komposit kan vara olika i olika riktningar.
- [x] Polymerers relativt låga E-modul förklaras av de svaga bindningarna mellan polymerkedjorna.

I metaller påverkar värmebehandling och bearbetning inte E-modulen, och att ändra modulen genom legering (mikroskala) är mindre effektivt än att kombinera material i makroskala, t.ex. i en komposit. En komposit med orienterade fibrer är anisotrop och har olika E-modul i olika riktningar. I polymerer är kedjorna kovalent bundna, men bindningarna mellan kedjorna (van der Waals- och vätebindningar) är svaga. Quizens "de svaga atombindningarna" är preciserat till bindningarna mellan kedjorna.

## Poissons tal är bara definierat i det elastiska området.
key: poissons-tal-elastiska-omradet
typ: sant-falskt
svar: sant
status: utkast
källa: Canvas, Kapitel_04 Elastisk deformation, s. 14

Poissons tal $\nu$ är den negativa kvoten mellan tvärtöjning och längstöjning vid dragbelastning, och det är definierat bara i det elastiska området. Typiska värden: metaller ca 0,3, keramer 0,2 till 0,3, polymerer ca 0,4 och gummi nära 0,5.

## Stål har E = 210 GPa och $\nu = 0{,}3$. Vilken skjuvmodul G ger det?
key: skjuvmodul-stal-berakning
typ: alternativ
status: utkast
källa: Canvas, Kapitel_04 Elastisk deformation, s. 12, 14, 21

- [x] Ca 81 GPa
- [ ] Ca 105 GPa
- [ ] Ca 162 GPa
- [ ] Ca 273 GPa

För ett isotropt material gäller $G = \dfrac{E}{2(1+\nu)} = \dfrac{210}{2 \cdot 1{,}3} \approx 81$ GPa. 105 GPa fås om man glömmer faktorn $(1+\nu)$, 162 GPa om man glömmer faktorn 2, och 273 GPa är $E(1+\nu)$, dvs. man har multiplicerat med $(1+\nu)$ och glömt faktorn 2.

## Blandningsregeln
key: blandningsregeln
typ: begrepp
status: utkast
källa: Canvas, Short_dictionary_ v2026, s. 12; Canvas, Kapitel_04 Elastisk deformation, s. 26, 27, 28

En egenskap hos en komposit eller hybrid uppskattas genom att de ingående materialens egenskaper viktas med volymandelarna. För densiteten gäller $\rho = f\rho_A + (1-f)\rho_B$, där f är volymandelen av material A. För E-modulen ger blandningsregeln i stället en övre och en nedre gräns. I kursens exempel räknas modulen för långa parallella fibrer (längs fibrerna) och för små partiklar, som motsvarar den nedre gränsen.
