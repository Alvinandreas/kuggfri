# Brott och utmattning

## Varför är spröda material extra känsliga för defekter?
key: varfor-ar-sproda-material-extra
original: ja

Största förekommande defekten i en komponent ger störst spänning vilket innebär att brottet börjar där. Brottstyrkan blir då beroende av sannolikheten för att det finns en defekt i det belastade området och ju större komponenten är desto högre blir sannolikheten att det förekommer defekter. Eftersom sprickor uppträder lättare i spröda material blir de mer defektkänsliga.

## Vad har temperatur för inverkan på ett materials brottseghet?
key: vad-har-temperatur-for-inverkan-pa-ett
original: ja
status: utkast
källa: Rättelse: kortet sa att alla material blir sprödare när temperaturen sjunker, men metaller med FCC-struktur förblir duktila; Canvas, Kapitel_08 Seghet och Brott, s. 31; Canvas, Kapitel_08 Seghet och Brott, s. 37; Canvas, Fö 9 Brott och brottseghet, s. 3

Vid låga temperaturer blir vissa metaller och alla polymerer spröda. När temperaturen sjunker ökar sträckgränsen för de flesta material, vilket minskar den plastiska zonen vid sprickspetsen och därmed segheten. Endast metaller med FCC-struktur förblir duktila vid de lägsta temperaturerna.

Övergången mellan segt och sprött beteende (omslagstemperaturen) bestäms med slagprovning.

## Vad är skillnaden mellan ett segt- respektive sprött brott?
key: vad-ar-skillnaden-mellan-ett-segt
original: ja
status: utkast
källa: Rättelse: "deformeras plastiskt under en längre tid" var missvisande, det är mängden plastisk deformation och inte tiden som skiljer brotten åt; Canvas, Svarsförslag uppgift 4-6, IMS085 251030, s. 1; Canvas, Kapitel_08 Seghet och Brott, s. 27; Canvas, Kapitel_08 Seghet och Brott, s. 28

* **Segt brott** föregås av tydlig plastisk deformation och stora formändringar. Hålrum bildas vid inneslutningar, växer och går samman till brott. Brottytan är matt och ojämn (skål- och konformad). Typiskt för de flesta metaller vid rumstemperatur.
* **Sprött brott** sker utan nämnvärd plastisk deformation, ofta plötsligt. Brottytan är relativt jämn och glänsande med kornig struktur. Uppträder främst vid låga temperaturer, höga belastningshastigheter och i spröda material som keramer och härdat stål.

## Vad använder man för typ av test för att undersöka ett materials brottseghet?
key: vad-anvander-man-for-typ-av-test-for
original: ja
status: utkast
källa: Rättelse: kortet sa att brottseghet bestäms med slagprovning, men slagprovning mäter slagseghet; Canvas, Kapitel_08 Seghet och Brott, s. 8; Canvas, Kapitel_08 Seghet och Brott, s. 16; Canvas, Kapitel_08 Seghet och Brott, s. 21

Brottsegheten $K_{1c}$ bestäms med prov som har en skarp spricka, t.ex. CT-prov (compact tension) eller SENB-prov (single edge notched beam). Båda provstavstyperna har en utmattningsspricka. Provet måste vara så brett att plant töjningstillstånd råder längs sprickfronten; först då blir $K_{1c}$ en ren materialegenskap.

Slagprovning (Charpy) med en anvisad provstav mäter i stället slagseghet, energin för att slå av staven. Den gör det möjligt att jämföra materials seghet och bestämma omslagstemperaturen, men ger inget sätt att uttrycka seghet som en materialegenskap.

## Brottseghet
key: brottseghet
typ: begrepp
original: ja
aktiv: nej

Ett mått på materialets seghet, hur mycket energi som behövs för att driva en
spricka. Brott fås när spänningsintensiteten vid sprickspetsen är högre än brottsegheten.

## Högcykelutmattning
key: hogcykelutmattning
typ: begrepp
original: ja

Utmattning är brott som uppkommer vid cyklisk belastning. Vid högcykelutmattning är belastningen under sträckgränsen, och materialet plasticerar bara lokalt
vid sprickspetsen, vilket ger ett stort antal cykler till brott.

## Slagseghet
key: slagseghet
typ: begrepp
original: ja

Den energi som går åt för att slå av en anvisad provstav. Ett mått på hur segt eller sprött materialet är.

## Omslagstemperatur finns hos vanligt (ferritiskt) stål men inte hos aluminium och austenitiskt rostfritt stål.
key: ja-nej-omslagstemperatur-finns-hos
typ: sant-falskt
svar: sant
original: ja
status: utkast
källa: Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2; Canvas, Kapitel_08 Seghet och Brott, s. 31; Canvas, Fö 12 Stål, s. 17; Canvas, Fö 12 Stål, s. 18; Canvas, Fö 13 Aluminium och andra metaller, s. 3; Canvas, Short_dictionary_ v2026, s. 2

Sant. Vid låga temperaturer blir vissa metaller spröda, men metaller med FCC-struktur förblir duktila även vid de lägsta temperaturerna. Aluminium och austenit (FCC-järn) har FCC-struktur, så aluminium och austenitiska rostfria stål har ingen omslagstemperatur. Vanligt stål består av ferrit (BCC-järn) och perlit och går från segt till sprött beteende under omslagstemperaturen.

Tentan 2020 hade påståendet med bara "rostfritt stål" och facit ja; det gäller de austenitiska rostfria stålen, därför är påståendet preciserat.

## Utmattningsgränsen är antalet cykler till brott vid en viss spänning.
key: ja-nej-utmattningsgransen-ar-antalet
typ: sant-falskt
svar: falskt
original: ja
status: utkast
källa: Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 5; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 6

![S–N-kurva med draghållfastheten och utmattningsgränsen vid tio miljoner cykler](/kort/materialteknik/s-n-kurva.svg)

Falskt. Utmattningsgränsen är en spänningsamplitud, inte ett antal cykler: under den inträffar brott inte alls eller först efter ett mycket stort antal cykler (t.ex. fler än $10^7$). Antalet cykler till brott vid en viss spänningsamplitud är utmattningslivslängden $N_f$, som kan läsas av i S-N-kurvan.

## Vad visar en S–N-kurva?
key: sn-kurva-axlar
typ: alternativ
status: utkast
källa: Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 5, 15

- [x] Spänningsamplituden mot antalet cykler till brott, med antalet cykler i logaritmisk skala.
- [ ] Spänningen mot töjningen i ett dragprov.
- [ ] Spricktillväxten per cykel mot variationen i spänningsintensitetsfaktorn.
- [ ] Antalet cykler till brott mot temperaturen.

![S–N-kurva med draghållfastheten och utmattningsgränsen vid tio miljoner cykler](/kort/materialteknik/s-n-kurva.svg)

S–N-kurvan har spänningsamplituden $\sigma_a$ på y-axeln och antalet cykler till brott $N_f$ i logaritmisk skala på x-axeln. Kurvan börjar vid draghållfastheten $\sigma_{ts}$ och planar ut mot utmattningsgränsen $\sigma_e$, där brott inte inträffar alls eller först efter mycket många cykler (t.ex. fler än $10^7$). Spänning mot töjning är dragprovskurvan, och spricktillväxt per cykel mot $\Delta K$ är diagrammet för spricktillväxt vid cyklisk belastning.

## Spröda brott följer alltid korngränserna.
key: ja-nej-sproda-brott-foljer-alltid
typ: sant-falskt
svar: falskt
original: ja
status: utkast
källa: Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2; Canvas, Fö 9 Brott och brottseghet, s. 16; Canvas, Svar Materialteknik 2019-10-26, s. 2; Canvas, Kapitel_08 Seghet och Brott, s. 32

Falskt. En spröd brottyta kan vara både interkristallin (längs korngränserna) och transkristallin (genom kornen). Ett sprött klyvbrott följer atomplanen. Brott längs korngränserna uppstår när korngränserna har försvagats, t.ex. av föroreningar som samlats där eller av kemiskt angrepp.

## Utmattningsgräns
key: utmattningsgrans
typ: begrepp
original: ja

Den spänning under vilken inte utmattning sker.

## Segt brott
key: segt-brott
typ: begrepp
original: ja

Ett brott som föregås av mycket plasticering. Lång töjning innan brott sker med andra ord.

## Brott hos metaller: vilka påståenden är sanna?
key: quiz-brott-hos-metaller-2-rattta-svar
typ: alternativ
status: utkast
källa: Canvas, Quiz vecka 3, fråga 7; Canvas, Kapitel_08 Seghet och Brott, s. 14; Canvas, Kapitel_08 Seghet och Brott, s. 18; Canvas, Kapitel_08 Seghet och Brott, s. 37; Canvas, Fö 9 Brott och brottseghet, s. 7; Canvas, Tentamen med svarsförslag MTT085 251030, uppgift 1f

- [x] Brottegenskaper är tätt kopplade till energi.
- [ ] Material med hög E-modul har alltid hög brottseghet.
- [ ] Material med hög sträckgräns har alltid hög brottseghet.
- [x] En spricka växer när spänningsintensitetsfaktorn överskrider brottsegheten.

För att en spricka ska växa måste tillräckligt yttre arbete utföras, och brottsegheten beror på energin som krävs för att driva sprickan. Sprickor växer när spänningsintensitetsfaktorn överskrider det kritiska värdet $K_{1c}$. Hög E-modul ger inte hög brottseghet: keramer har hög styvhet men sprött beteende. Högre sträckgräns minskar den plastiska zonen vid sprickspetsen och ger lägre seghet.

I quizen stod "Segt brott fås när spänningsintensitetsfaktorn är större än brottsegheten". Villkoret gäller sprickväxt i allmänhet, inte specifikt segt brott, så alternativet är omformulerat.

## Brott i metaller och spröda material: vilka påståenden är sanna?
key: quiz-brott-2-ratta-svar
typ: alternativ
status: utkast
källa: Canvas, Quiz vecka 3, fråga 10; Canvas, Kapitel_08 Seghet och Brott, s. 15; Canvas, Kapitel_08 Seghet och Brott, s. 27; Canvas, Kapitel_08 Seghet och Brott, s. 28; Canvas, Kapitel_08 Seghet och Brott, s. 32; Canvas, Fö 9 Brott och brottseghet, s. 15

- [ ] Brott delas in i elastiska brott och plastiska brott.
- [ ] När en metall går sönder går brottet oftast längs korngränserna.
- [x] I metaller går brottet bara undantagsvis längs korngränserna, t.ex. när föroreningar har försvagat dem.
- [x] Hos spröda material är storleken på defekter som sprickor och porer avgörande för brottspänningen.

Kursen delar in brott i spröda och sega brott, inte elastiska och plastiska. Ett segt brott i en metall uppstår genom att hålrum bildas vid inneslutningar och växer samman, och ett sprött klyvbrott separerar atomerna; brott längs korngränserna kräver att korngränserna har försvagats, t.ex. av föroreningar eller kemiskt angrepp. I spröda material ger den största defekten störst spänning och brottet börjar där, eftersom $K_1 = Y\sigma\sqrt{\pi c}$ ökar med spricklängden.

## Vad menas med seghet (toughness) i kursen?
key: brott-seghet-definition
typ: alternativ
status: utkast
källa: Canvas, Kapitel_08 Seghet och Brott, s. 7; Canvas, Kapitel_08 Seghet och Brott, s. 2

- [ ] Ett materials motstånd mot plastisk deformation
- [x] Ett materials motstånd mot spricktillväxt
- [ ] Hur mycket ett material deformeras elastiskt när det belastas
- [ ] Hur mycket ett material kan förlängas innan brott i ett dragprov

Seghet är motståndet mot spricktillväxt. Motståndet mot plastisk deformation är hållfasthet, den elastiska deformationen beskrivs av styvheten och förlängningen till brott är duktilitet (brottförlängning). Seghet kan inte mätas med ett vanligt dragprov, eftersom provstaven inte har någon spricka att börja från.

## Hur beräknas spänningsintensitetsfaktorn $K_1$ för en spricka med längden $c$ i en plåt under dragspänningen $\sigma$?
key: brott-spanningsintensitetsfaktor
typ: alternativ
status: utkast
källa: Canvas, Kapitel_08 Seghet och Brott, s. 13; Canvas, Kapitel_08 Seghet och Brott, s. 14; Canvas, Fö 9 Brott och brottseghet, s. 9

- [x] $K_1 = Y\sigma\sqrt{\pi c}$
- [ ] $K_1 = Y\sigma\,\pi c$
- [ ] $K_1 = Y\sigma/\sqrt{\pi c}$
- [ ] $K_1 = YE\sqrt{\pi c}$

Den lokala spänningen framför sprickspetsen skalar med $\sigma\sqrt{\pi c}$, så $K_1 = Y\sigma\sqrt{\pi c}$, där $Y$ är en geometrisk konstant (för en spricka i en bred plåt, $c \ll w$, är $Y$ ungefär 1). Enheten blir $\text{MPa}\sqrt{\text{m}}$, samma som för brottseghet, och sprickan växer när $K_1$ överskrider $K_{1c}$. Det är spänningen och inte E-modulen som driver sprickan, och $K_1$ ökar med roten ur spricklängden, inte linjärt.

## Omslagstemperatur
key: brott-omslagstemperatur
typ: begrepp
status: utkast
källa: Canvas, Short_dictionary_ v2026, s. 4; Canvas, Svar Materialteknik 2019-10-26, s. 2; Canvas, Kapitel_08 Seghet och Brott, s. 10; Canvas, Kapitel_08 Seghet och Brott, s. 31

Den temperatur där ett material går från segt (duktilt) till sprött brottbeteende, duktilt/sprött omslag (ductile-to-brittle transition). Under omslagstemperaturen blir materialet sprött. Den bestäms med slagprovning. Vissa metaller, t.ex. vanligt (ferritiskt) stål, och alla polymerer har en omslagstemperatur, medan metaller med FCC-struktur förblir duktila även vid de lägsta temperaturerna.

## Lågcykelutmattning
key: utm-lagcykelutmattning
typ: begrepp
status: utkast
källa: Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 3; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 6; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 7

Utmattning där spänningsnivåerna varierar över sträckgränsen men under draghållfastheten, så att materialet deformeras både elastiskt och plastiskt i varje cykel (hysteresloop). Livslängden är kort räknat i antal cykler, den vänstra delen av livslängdsdiagrammet. Lågcykelutmattning provas oftast töjningsstyrt, och livslängden beskrivs av Coffins lag.

## Vilken lag beskriver utmattningslivslängden vid högcykelutmattning (HCF)?
key: utm-basquin-hcf
typ: alternativ
status: utkast
källa: Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 6; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 11; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 15

- [x] Basquins lag, $\Delta\sigma\,N_f^{\,b} = C_1$
- [ ] Coffins lag, $\Delta\varepsilon^{pl}N_f^{\,c} = C_2$
- [ ] Paris lag, $dc/dN = A\,\Delta K^m$
- [ ] Palmgren-Miners regel, $\sum N_i/N_{f,i} = 1$

Basquins lag beskriver högcykelutmattning, där spänningarna ligger under sträckgränsen och deformationen är elastisk. Coffins lag gäller lågcykelutmattning och använder det plastiska töjningsintervallet. Båda lagarna gäller komponenter som cyklas med konstant amplitud kring medelspänningen noll. Paris lag beskriver spricktillväxt per cykel och Palmgren-Miners regel skadeackumulering när amplituden varierar.

## En komponent följer Basquins lag med $b = 0{,}1$ och håller 200 000 cykler vid spänningsamplituden 100 MPa (medelspänning noll). Ungefär hur många cykler håller den om amplituden ökas till 120 MPa?
key: utm-exempel-basquin-livslangd
typ: alternativ
status: utkast
källa: Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 8; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 6

- [ ] 1 240 000 cykler
- [ ] 196 000 cykler
- [ ] 167 000 cykler
- [x] 32 300 cykler

Basquins lag ger $\Delta\sigma_1 N_1^{\,b} = \Delta\sigma_2 N_2^{\,b}$, alltså $N_2 = N_1\left(\dfrac{\Delta\sigma_1}{\Delta\sigma_2}\right)^{1/b} = 200\,000\left(\dfrac{200}{240}\right)^{10} \approx 32\,300$ cykler. En ökning av spänningsamplituden med 20 % minskar livslängden med 84 %: utmattning är mycket känslig för spänningsnivån.

167 000 cykler fås om exponenten $1/b$ glöms bort, 196 000 om man använder $b$ i stället för $1/b$ och 1 240 000 om kvoten vänds.

## Vad beskriver Paris lag, $dc/dN = A\,\Delta K^m$?
key: utm-paris-lag
typ: alternativ
status: utkast
källa: Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 14; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 15; Canvas, Läsanvisningar Kapitel 9, s. 1

- [x] Hur mycket en utmattningsspricka växer per cykel som funktion av det cykliska spänningsintensitetsintervallet
- [ ] Hur livslängden beror på spänningsamplituden vid högcykelutmattning
- [ ] Hur skadan ackumuleras när spänningsamplituden varierar
- [ ] Hur en medelspänning minskar det tillåtna spänningsintervallet

Paris lag beskriver spricktillväxten per cykel, $dc/dN$, som funktion av $\Delta K = K_{max} - K_{min} = \Delta\sigma\sqrt{\pi c}$. Eftersom sprickan växer ökar $\Delta K$ med tiden vid konstant cyklisk spänning, och snabbt brott inträffar när $K_{max}$ når $K_{1c}$. Lagen används för att beräkna hur många cykler som kan tillåtas innan sprickan når en farlig längd. De andra alternativen beskriver Basquins lag, Palmgren-Miners regel och Goodmans regel.

## Enligt Palmgren-Miners regel inträffar utmattningsbrott när summan $\sum N_i/N_{f,i}$ når 1.
key: utm-palmgren-miner
typ: sant-falskt
svar: sant
status: utkast
källa: Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 11

Sant. När den cykliska spänningsamplituden ändras beräknas livslängden med Palmgren-Miners regel för linjär skadeackumulering, $\sum_{i=1}^{n} N_i/N_{f,i} = 1$. Här är $N_i$ antalet cykler med amplitud $i$ och $N_{f,i}$ livslängden om hela belastningen hade haft den amplituden.

## Hur påverkar en medelspänning i drag utmattningslivslängden, enligt Goodmans regel?
key: utm-goodman-medelspanning
typ: alternativ
status: utkast
källa: Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 4; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 9; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 10

- [x] Livslängden minskar
- [ ] Livslängden ökar, eftersom materialet deformationshärdas
- [ ] Livslängden påverkas inte, bara spänningsamplituden spelar roll
- [ ] Medelspänningen påverkar bara lågcykelutmattning

Enligt Goodmans regel, $\Delta\sigma_{\sigma_m} = \Delta\sigma_{\sigma_m=0}\left(1 - \sigma_m/\sigma_{ts}\right)$, motsvarar ett spänningsintervall med medelspänningen $\sigma_m$ ett större intervall vid medelspänningen noll, och det korrigerade intervallet sätts in i Basquins lag. I exempel 9.2 ($\sigma_{ts} = 200$ MPa) sjunker livslängden från 200 000 till ungefär 11 550 cykler när medelspänningen ökar från 0 till 50 MPa. Utmattning är mycket känslig för medelspänningen, och därför bör restspänningar i ytan helst vara tryckspänningar.

## Vilka åtgärder ger bättre utmattningsegenskaper hos en metallkomponent?
key: utm-battre-utmattningsegenskaper
typ: alternativ
status: utkast
källa: Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 39; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 37; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 10; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 28

- [x] Liten kornstorlek
- [ ] Grov, obearbetad yta
- [x] Tryckrestspänningar i ytan, t.ex. genom kulbombning
- [ ] Dragrestspänningar i ytan

Goda utmattningsegenskaper fås med liten kornstorlek, små inneslutningar och porer, släta ytor utan spänningskoncentrationer, skydd mot korrosion och tryckspänningar i ytan (kulbombning, nitrering, karburisering). Sprickor växer bara under dragdelen av en cykel, så tryckspänningar i ytan håller sprickorna stängda och minskar medelspänningen där, medan dragrestspänningar ökar den. Utmattningssprickor initieras oftast vid ytan, så en grov yta försämrar livslängden.

## Utmattningssprickor initieras oftast vid ytan.
key: utm-initiering-vid-ytan
typ: sant-falskt
svar: sant
status: utkast
källa: Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 28; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 29

Sant. I ytliga korn med lämplig orientering bildas persistenta glidband (PSB) med mycket dislokationsaktivitet, som ger intrusioner och extrusioner i ytan. Atmosfär och oxidation skapar svaga zoner, och lokala spänningskoncentrationer gör att sprickan startar där. Sprickor kan initieras inne i materialet när ytan är jämn och har tryckrestspänningar, eller när det finns stora inre defekter som inneslutningar och porer.

## Beskriv de tre stadierna i ett utmattningsbrott och hur brottytan ser ut.
key: utm-tre-stadier-brottyta
status: utkast
källa: Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 28; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 30; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 32; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 33; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 15

1. **Initiering:** oftast som en skjuvspricka i ytliga korn med lämplig orientering (glidband), där ytan eller en spänningskoncentration hjälper till.
2. **Tillväxt:** sprickan korsar några korngränser och växer sedan som en lång spricka vinkelrätt mot huvudspänningen (mod 1). Materialet framför sprickspetsen deformeras plastiskt i varje cykel, och sprickan växer en liten bit per cykel. På brottytan syns striationer (avstånd typiskt ca 1 µm) och makroskopiska linjer (beach marks).
3. **Slutbrott (restbrott):** när spricklängden har blivit så stor att spänningsintensiteten når $K_{1c}$ vid den pålagda spänningen brister resten av tvärsnittet snabbt.

## Vilka kännetecken hör till ett sprött brott?
key: brott-sprott-brottyta-kannetecken
typ: alternativ
status: utkast
källa: Canvas, Svarsförslag uppgift 4-6, IMS085 251030, s. 1; Canvas, Kapitel_08 Seghet och Brott, s. 27; Canvas, Kapitel_08 Seghet och Brott, s. 28

- [x] Det sker utan nämnvärd plastisk deformation, ofta plötsligt
- [ ] Brottytan är matt och ojämn, skål- och konformad
- [x] Brottytan är relativt jämn och glänsande med kornig struktur
- [ ] Hålrum bildas vid inneslutningar och växer samman till brott

Ett sprött brott sker utan nämnvärd plastisk deformation och ger en relativt jämn, glänsande och kornig brottyta; i keramer och glas är klyvbrott karakteristiskt. En matt, ojämn skål- och konformad yta och hålrum som växer samman vid inneslutningar kännetecknar i stället segt brott. Sprött brott uppträder främst vid låga temperaturer, höga belastningshastigheter och i spröda material.

## Vad innebär ett högt värde på Weibullmodulen $m$ för en keram?
key: brott-weibullmodul
typ: alternativ
status: utkast
källa: Canvas, Kapitel_08 Seghet och Brott, s. 34; Canvas, Kapitel_08 Seghet och Brott, s. 35

- [x] Liten spridning i brottspänning och större säkerhet för överlevnad under referensspänningen
- [ ] Stor spridning i brottspänning
- [ ] Hög brottseghet $K_{1c}$
- [ ] Att brottspänningen inte beror på komponentens storlek

Weibullmodulen styr hur känslig brottsannolikheten är för spänningen: låga värden ger stor spridning, höga värden ger betydligt större säkerhet för överlevnad under referensspänningen. Weibullstatistik används för keramer eftersom sannolikheten att en komponent innehåller en defekt av kritisk storlek ökar med volymen, så brottspänningen beror på storleken. Referensspänningen och $m$ bestäms empiriskt och är inte ett mått på brottsegheten.

## Ett CT-prov ($K_{1c} = 25\ \text{MPa}\sqrt{\text{m}}$, $w = 50$ mm, $b = 20$ mm, sprickan $c = 10$ mm) följer $K_{1c} = 1{,}64\,\dfrac{F^*}{bw}\sqrt{\pi c}$. Vilken last $F^*$ krävs för brott?
key: brott-exempel-ct-prov-last
typ: alternativ
status: utkast
källa: Canvas, Kapitel_08 Seghet och Brott, s. 17; Canvas, Kapitel_08 Seghet och Brott, s. 14

- [ ] 50 kN
- [x] 86 kN
- [ ] 8,6 kN
- [ ] 141 kN

$F^* = \dfrac{K_{1c}\,b\,w}{1{,}64\sqrt{\pi c}} = \dfrac{25\cdot 10^6 \cdot 0{,}020 \cdot 0{,}050}{1{,}64\sqrt{\pi \cdot 0{,}010}} \approx 86$ kN. I exempel 8.2 räcker därför inte en provningsmaskin med maxlasten 50 kN. 141 kN fås om faktorn 1,64 glöms bort och 8,6 kN om en tiopotens blir fel.

## Vad är brottseghet?
key: vad-ar-brottseghet
typ: begrepp
original: ja
status: utkast
källa: Rättelse: brottvillkoret var omvänt (kortet sa att brott sker när K1c > K1, så stod det också på en bild 2025); Canvas, Kapitel_08 Seghet och Brott, s. 7; Canvas, Kapitel_08 Seghet och Brott, s. 14; Canvas, Fö 9 Brott och brottseghet, s. 7; Canvas, Fö 9 Brott och brottseghet, s. 10; Canvas, Kapitel_08 Seghet och Brott, s. 13; Canvas, Kapitel_08 Seghet och Brott, s. 18; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 15

Ett materials motstånd mot spricktillväxt. Brottsegheten $K_{1c}$ ($\text{MPa}\sqrt{\text{m}}$; 1 för lastmod 1, c för kritisk) är det kritiska värdet på spänningsintensitetsfaktorn.

* En spricka växer när spänningsintensitetsfaktorn $K_1$ överskrider $K_{1c}$. Vid statisk last växer sprickan inte så länge $K_1$ är mindre än $K_{1c}$ (vid cyklisk last kan en utmattningsspricka däremot växa lite för varje cykel, se Paris lag).
* $K_1 = Y\sigma\sqrt{\pi c}$ tar hänsyn till både last (spänningen $\sigma$) och spricklängd $c$.
* Brottsegheten beror på energin som krävs för att driva sprickan: $K_{1c} = \sqrt{E\,G_c}$.
