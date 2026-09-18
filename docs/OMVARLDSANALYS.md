# Omvärldsanalys och arbetsplan: Kuggfri till nästa nivå

Skriven 18 september 2026, fyra dagar före studentlanseringen. Underlaget är fyra parallella
researchgenomgångar (Duolingo/Brilliant; Quizlet/Anki/RemNote och flashcardkategorin;
Kahoot/Khan Academy/Mentimeter/Peerwise/Perusall och svensk kontext; inlärningsforskning och
UX-hantverk) med drygt 90 sökningar och ett femtiotal lästa källor, samt en genomgång av
Kuggfris kod, designtokens och skärmdumpar. Källorna listas sist.

Dokumentet är skrivet för att kunna läsas fristående av Alvin, och i ett senare skede av Johan.

**Status 19 september:** Alvin godkände planen och tog bort kodfrysningen till förmån för en
återställningsrutin (`docs/ATERSTALLNING.md`). Fas 0 och större delen av Fas 1 (dosering, slutpunkt,
streak med frysningar, tentadatum, skattningssemantik, fuzz, förstabesök, tangentbord, QR-kod, samt
"uppskattad kunskap" ur Fas 2) är byggda lokalt, se TASKS.md. Senare samma dag: utkorg (ingen
repetition tappas), aktiveringsmått i kursöversikten (Fas 1.9), provtenta och "Kan nu" per
kategori (Fas 2.1–2.2), påminnelser via mejl (2.4) och examinatorns veckobrev (2.7). Kvar i Fas 1:
fullt offlineläge med service worker. Senare på kvällen även kalibreringsexperimentet (2.3) och den
delbara beredskapsbilden (2.5): Fas 2 är därmed byggd i sin helhet, kvar att sätta i drift är SMTP.

---

## 1. Sammanfattning i fem teser

1. **Kuggfri står redan på rätt grund.** Retrieval practice och spacing är de två enda
   studieteknikerna med "hög nytta" i den mest citerade genomgången (Dunlosky m.fl. 2013).
   Kuggfri gör exakt det, med FSRS som är den bäst belagda schemaläggaren som finns
   (bättre än Ankis SM-2 för 99,6 % av användarna i den öppna benchmarken). Duolingos
   "Birdbrain" och Quizlets "Learn" är sämre modeller av minnet. Vi behöver inte byta motor,
   vi behöver göra motorn synlig och trevlig.

2. **Det som får folk att komma tillbaka är inte maskoten, det är sessionsdesignen.** Duolingos
   bäst dokumenterade vinster är tråkiga: att skjuta upp kontoskapandet (+20 % DAU), en tydlig
   slutpunkt per session, streak med generösa frysningar (7-dagars-streak → 2,4 gånger högre
   sannolikhet att återvända), och en widget som bara visar "klar i dag?". Kuggfri har redan
   gästläget (den svåraste delen) men saknar slutpunkt, streak och daglig dosering. Det är den
   största luckan just nu: en ny student möter "144 kort kvar" i första sessionen. Det är samma
   "backlog-ångest" som 82 % av läkarstudenter rapporterar om Anki.

3. **Allt som gör Duolingo och Kahoot irriterande ska vi inte bygga.** Hjärtan/energi,
   skuldnotiser vid midnatt, offentliga leaderboards i en betygsatt kurs, poäng för snabbhet,
   betalvägg framför inlärningsläget (Quizlet). Forskningen (Hanus & Fox 2015, Li m.fl. 2024)
   visar att individuella leaderboards sänker motivationen hos den nedre halvan, och Kahoot
   tog själva bort sina streak-poäng av rättviseskäl. Kuggfris löfte "gratis, ingen spårning,
   kursen äger innehållet" är en verklig differentiering mot alla kommersiella aktörer och ska
   vara bärande i allt vi gör.

4. **Ingen på marknaden kombinerar fyra saker som Kuggfri kan göra.** (a) Tentadatum-medveten
   schemaläggning (Cepeda 2008: optimalt intervall är en andel av tiden till provet), (b)
   examinatorinsyn per begrepp med anonymitetsgräns, (c) "tentaberedskap" per kategori byggd
   på FSRS:s egna sannolikheter (som UWorld/Amboss gör för läkarprov), (d) studentskapade kort
   med examinatorns kuratering (Peerwise-effekten, i ett modernt gränssnitt). Kollin är den
   svenska konkurrenten (gamla tentor, 29 lärosäten) men är betald, generisk och inte kursägd.

5. **Vägen till att "ta över Chalmers" går via föreläsaren, inte via appbutiken.** Alla
   verktyg som lyckats i föreläsningssalar (Mentimeter, Kahoot, Wooclap) delar ett mönster:
   permanent QR-kod på bild 1, inget konto före första svaret, resultat på projektorn direkt.
   Kuggfri ska bli verktyget som examinatorn använder *i* föreläsningen, så att studenten
   redan har decket när hen går hem. Det, plus att varje examinator får sin egen kurs på tio
   minuter, är tillväxtmotorn.

---

## 2. Var Kuggfri står i dag, ärligt

**Starkt (behåll och skydda)**
- Gästläge med progress i localStorage och sömlös migrering till konto. Detta är Duolingos
  dyraste lärdom, och vi har den redan.
- FSRS med ren, testad modul; fri repetition rör aldrig schemat; historik i `review_log`.
- "Kluriga kort" är i praktiken Duolingos "Mistakes review", som är deras mest uppskattade
  gratisfunktion.
- Sessionssammanfattningen med "behöver mest arbete" (det Johan reagerade på).
- Examinatorvyn: nyckeltal, svåraste områden, kluriga frågor, fördelning av hur långt
  studenterna kommit, anonymitetsgräns fem studenter. Detta motsvarar Khan Academys
  "Skills"-flik och Perusalls "Confusion report", och är bättre än vad Quizlet ger lärare
  ens i betalversionen.
- Felrapport från kortet till examinatorn: kvalitetsslinga som ingen konkurrent har.
- Visuell grund: varm off-white, en accentfärg, systemtypsnitt, kategorifärger, ljust/mörkt,
  reduced-motion. Det är precis den "skandinaviska varma minimalism" som åldras bäst
  (Things 3, Linear, Brilliant). Vi ska skärpa, inte byta stil.
- Integritet: EU-hosting, ingen analytics, noindex. Säljargument mot examinatorer och
  i linje med IMY/DIGG:s vägledning och Chalmers AI-riktlinjer.

**Svagt (luckorna, i prioritetsordning)**
1. **Ingen dosering.** Schemalagd repetition tar alla förfallna plus alla nya kort
   (`buildFsrsQueue` har inget tak). Första sessionen är 144 kort. Inget "klar för i dag".
   Detta är den enskilt största risken för att studenter provar en gång och inte kommer
   tillbaka.
2. **Ingen vana-mekanik.** "Dagar i rad" finns som siffra men det finns ingen streak med
   frysning, inget dagligt mål, ingen påminnelse, ingen hemskärmsyta.
3. **Inget tentadatum.** Schemat vet inte när tentan är. Det är den enda uppgift som gör
   att en schemaläggare kan vara smartare än studentens egen plan.
4. **Ingen "beredskap".** Progressen visar sedda/inlärda kort, inte "sannolikheten att du
   kan Kristallstruktur på tentan". FSRS har talet; vi visar det inte. Studenter
   överskattar sig med cirka 10 procentenheter (Intro Biology-studien 2021), och "80 % av korten
   sedda" läses som "80 % inlärt".
5. **Skattningsskalans semantik.** 3 "Sådär" mappas till Hard, som FSRS räknar som *godkänt*.
   En student som trycker 3 när hen egentligen inte kunde får för långa intervall. Anki
   behövde ett verktyg ("Remedy Hard Misuse") för exakt detta.
6. **Offline.** Manifestet finns, men ingen service worker. Repetition på spårvagnen utan
   täckning fungerar inte, och ett tappat svar är förtroendeförlust.
7. **Ett deck, en kurs.** Inget självbetjäningsflöde för nästa examinator. Ingen
   QR-kod i gränssnittet.
8. **Bara flip-kort.** Inga flerval, inga lucktexter, ingen "försök först, se sedan"
   (Brilliant). För en teknisk kurs vill man ibland skriva svaret.
9. **Tangentbord.** Siffror och pilar finns; mellanslag för vänd och en synlig
   genvägslista saknas. Anki-vana studenter förväntar sig det.

---

## 3. Aktörerna: vad de gör, varför det fungerar, vad vi tar och vad vi lämnar

### 3.1 Duolingo (56–59 miljoner dagliga användare, 2026)

**Loopen.** En lektion är 10–15 övningar, 3–5 minuter, en knapp från startskärmen.
Direkt grön/röd återkoppling, fel svar återkommer i slutet av samma lektion. Half-Life
Regression schemalägger per ord (+12 % aktivitet mot tidigare schemaläggare).

**Varför folk stannar (dokumenterade siffror).** Streak: över 50 % av dagliga användare har
sju dagar eller mer; en enda milstolpeanimation gav +1,7 % D7-retention; streak-vad (50
ädelstenar på sju dagar) gav +14 % D7. Streak freeze (2–5 st, appliceras tyst) finns för att
ta udden av "jag förlorade min streak, jag slutar", vilket deras egen tillväxtchef gjorde
efter 80 dagar. Ligor gav +17 % studietid. Kontoskapande efter första lektionen: cirka +20 %
DAU. Widgeten (streak + "klar i dag?") har 50 % av användarna på sex månaders streak.
Notiser väljs av en kontextuell bandit; den beryktade "vi slutar skicka påminnelser nu" är
en av deras mest effektiva.

**Det som gick fel.** Energi-systemet 2025 (drar ett steg per övning även vid rätt svar)
fick långvariga användare att sluta. Learning@Scale 2022 dokumenterar XP-farmande av lätta
lektioner för att klättra i ligor. Inget mörkt läge på webben. Efficacy-studierna är
huvudsakligen egna; oberoende genomgångar (2021) kallar evidensen tunn.

**Vi tar:** fördröjt konto (har vi), bunden sessionsstorlek med tydlig slutpunkt, streak med
tysta frysningar och reparationsfönster, "Mistakes review" (har vi), en hemskärmsyta som bara
säger "klar i dag?", en lugn påminnelse med faktiskt värde ("12 kort, cirka 4 minuter").
**Vi lämnar:** hjärtan/energi, XP-ligor, skuldnotiser, maskot, engagemang som mål i stället
för kunskap vid tentan.

### 3.2 Brilliant

**Loopen.** 5–10 interaktiva problem per lektion, cirka 15 minuter. Man *gör* något först
(drar en vikt, drar i en parameter) och får förklaringen efteråt. AI-handledaren Koji ger
steg utan att ge svaret. Ingen publicerad spacing-modell; retention via streak (tre problem
per dag), "Streak Charges", ligor med grundämnesnamn, dagliga utmaningar.

**Design.** Återhållsam, matematisk estetik, tema-färgade noder på kursvägen, Rive-animationer
för streak och noder, ljud och haptik. Ingenjörsbloggen behandlar bildfrekvens som en
inlärningsfråga. ustwo:s omdesign 2023 mätte på "retention efter vecka ett".

**Kritik.** Tvetydiga svar där man måste "gissa vad appen vill ha", kurser som försvinner,
ingen offline, betalvägg efter två lektioner per dag. En sexmånaders recension: "utöver
streaken finns inget skäl att fortsätta".

**Vi tar:** "försök innan du ser" som kortvariant (skriv svaret, se sedan), varför-förklaring
efter svar, per-kategori-färgad kursväg som speglar kursens veckor, återhållen estetik med
en tydlig men liten firandeyta vid sessionens slut. **Vi lämnar:** dagsbegränsning i
gratisversionen, ligor.

### 3.3 Quizlet (mainstream-standarden, 60+ miljoner månatliga användare)

**Lägen.** Flashcards, Learn (adaptivt flerval → skrivet), Test, Match, Blocks, Blast, Live
(lag där svarsalternativen delas mellan enheterna så att en dominant student inte kan ta
över), Checkpoint. AI: Magic Notes (anteckningar → kort). Q-Chat, deras AI-handledare,
lades ned i juni 2025.

**Det som gick fel.** Learn bakom betalvägg 2022, bilder och offline 2023, AI-förklaringar
2024. Trustpilot 1,4/5, vanligaste ordet "paywall". Helskärmsvideoannonser mellan sessioner.
Knowt byggde 8 miljoner användare på att kopiera Quizlets lägen gratis. Export är betald.
Common Sense: data delas med annonsnätverk.

**Vi tar:** flera övningsformer ur samma kortbas (flerval med genererade distraktorer,
skriv svaret, para ihop), Quizlet Lives princip att laget behöver alla. **Vi lämnar:** allt
om betalvägg, annonser, data utanför EU, "mastery-procent" utan minnesmodell.

### 3.4 Anki och FSRS-ekosystemet (maktanvändarnas standard)

**Vad de kan.** Kort-typer (cloze, bild-occlusion inbyggt sedan 23.10, skrivet svar), FSRS
som standard sedan 25.07, "desired retention" per deck (standard 90 %, 70–97 % dokumenterat;
+5 procentenheter retention kostar cirka 35 % fler repetitioner), fuzz, load balancing, Easy
Days, "sortera efter fallande retrievability" vid backlog, statistik med heatmap, prognos,
"true retention" och "uppskattad total kunskap".

**Priset.** 82 % av läkarstudenterna (UCF-enkäten 2025) tycker Anki är överväldigande,
68 % känner ångest, 34 % har tappat sömn. Onboardingklippan är känd. Det mest installerade
tillägget är en heatmap; det säger vad användare faktiskt vill se.

**Skattningsdebatten.** Anki-manualen välsignar två knappar ("Again för fel, Good för rätt").
FSRS-underhållaren om en tredje knapp: "inte alls klart att det ger någon påtaglig nytta".
Hard är ett *godkänt* i FSRS; feltryck ger orimligt långa intervall. Brainscape/SuperMemo
försvarar 1–5 med metakognitionsargumentet. RemNote döper om samma fyra knappar till
"Forgot / Partially recalled / Recalled with effort / Easily recalled".

**Vi tar:** FSRS (har vi), ett tak per dag i stället för oändlig kö, fuzz och load balancing,
Easy Days-tänket (helger, tentaveckor), heatmap, "kort du just nu kan" i stället för
"kort sedda", tangentbord först. **Vi lämnar:** deck-options med trettio fält, backlog som
gör ångest, statistik som kräver ordlista.

### 3.5 RemNote, Mochi, Knowt, Noji, Kollin

- **RemNote:** anteckningar-först, "Exam Scheduler" som räknar dagligt mål utifrån kommande
  prov, inlärningsfas (två korrekta), synlig ikappfas i stället för tyst omschemaläggning,
  "skakiga kort" kommer tillbaka snabbare, slutrepetition av allt före provet. Egen blogg
  medger brant inlärningskurva.
- **Mochi:** markdown-först, minimalistisk, lokalt-först, betalar bara för synk. Motpolen
  till feature-bloat.
- **Knowt:** gratis Quizlet-kopia med AI-generering från PDF/YouTube/föreläsning. Visar hur
  snabbt en marknad flyttar när incumbenten sätter betalvägg.
- **Noji:** 50 kort per dag i gratisversionen, tio dagars driftstopp, rickroll vid export,
  tvingat namnbyte. Cautionary tale om att hålla data som gisslan.
- **Kollin (KTH-startup):** gamla tentor sorterade efter ämne och svårighet, AI-chatt,
  studieplaner, progress mot kamrater. 29 lärosäten, cirka 4 250 kurser, Sveriges Ingenjörer
  ger medlemmar gratis första året. Närmaste svenska konkurrent, men betald, generisk och
  inte kopplad till examinatorn.

**Vi tar:** RemNotes tentaschemaläggning som helhet (den är den bästa specifikationen som
finns i det offentliga), Mochis återhållsamhet, Knowts lärdom att generering från
föreläsningsmaterial är tabbstakes 2026. **Vi lämnar:** att bli en anteckningsapp.

### 3.6 Kahoot!

**Loopen.** PIN och QR på projektorn, lobby med musik, nedräkning, fyra färgade former,
svarsfördelning och topp 5 efter varje fråga, podium. Poäng 0/1000/2000 skalade efter
svarstid. Streak-bonusen togs bort i mars 2020 eftersom den ökade gapet till svaga studenter.

**Evidens.** Wang & Tahir 2020 (93 studier): positiv effekt på prestation, dynamik, attityd
och ångest. Slitage finns men litet (dynamiken sjönk från 67 % till 52 % efter en termin
med Kahoot varje föreläsning). Kritik: hastighet före reflektion, gissningar, cirka 25 %
upplever poängen som ångestskapande, bottenplacerade blir obekväma. Gratisnivån tar bara
tio deltagare.

**Vi tar:** det synkrona ögonblicket (alla svarar samtidigt, alla ser fördelningen), QR utan
konto, lagläge, att det är ograderat och kort. **Vi lämnar:** poäng för snabbhet, offentliga
podier med namn, tiodeltagarbegränsningen.

### 3.7 Khan Academy och Khanmigo

**Mastery.** 100 poäng per färdighet i fyra nivåer; övningar når bara "Proficient",
quiz/enhetsprov/Mastery Challenge flyttar upp eller *ned*. Energipoäng är uttryckligen
"ansträngning, inte kunskap"; badges och avatarer har avvecklats. Lärarens "Skills"-flik är
en klass × färdighet-matris i fyra färger med drill-down till fel svar.

**Evidens.** 350 000 elever (2024): 30+ minuter per vecka gav cirka 20 % större framsteg,
effektstorlek 0,36, men bara 9 % nådde dosen. Khanmigo är sokratisk; att ge modellen
studentens historik gav +3,4 % korrekt nästa uppgift, förkunskapsluckor +2,7 %. Oberoende
studie (69 studenter) fann ingen skillnad mot Google.

**Vi tar:** mastery-nivåer som kan gå ned (ärligt), examinatorns matris (har vi i stort),
"ledtråd kostar inget men räknas inte som rätt". **Vi lämnar:** energipoäng, badges, AI-chatt
som huvudgränssnitt.

### 3.8 Mentimeter, Wooclap, Socrative (föreläsningsverktygen)

Alla tre: sparad presentation, bild 1 visar kod och QR, studenten svarar i mobilens
webbläsare utan konto, resultat live. Mentimeters QR är permanent per presentation.
Wooclap har LTI mot Canvas och per-studentrapporter; Mentimeter medvetet inte. Uppsala,
Lund och KTH har campuslicenser för Mentimeter; Lund säger uttryckligen "aldrig för
examination" och "alltid anonymt". Chalmers licens kunde inte verifieras.

**Vi tar:** permanent QR per deck, kod, noll konto före första svaret, anonymitet som
standard. Det är exakt mönstret för ett "Föreläsningsläge" i Kuggfri.

### 3.9 Peerwise, Perusall, Gimkit KitCollab (studenten som författare)

Peerwise (Auckland, gratis): studenter skriver flervalsfrågor med förklaring, svarar på
varandras, betygsätter 0–5. Aktiva användare presterar bättre på tentan, även på skrivna
frågor. Badges ökade *svarandet* 22 % men inte *författandet*. UI:t är serverrenderade
tabeller från 2008. Perusalls "Confusion Report" är en automatisk sammanställning av var
studenterna fastnat, läst av läraren morgonen före föreläsningen. Gimkits KitCollab låter
studenter skicka in frågor som läraren godkänner, live eller i efterhand.

**Vi tar:** "Föreslå ett kort" från studieläget med examinatorns godkännande (kvalitetsslingan
vi redan har för fel, utökad till innehåll), och en veckovis "konfusionsrapport" till
examinatorn. **Vi lämnar:** att låta ogranskade studentfrågor gå live.

### 3.10 UWorld och Amboss (guldstandarden för högriskprov)

Amboss "Score Predictor": bayesiansk modell på svarsandel, svårighet, täckning och
självtest; ger *intervall* och sannolikhet att klara, omkalibreras löpande, jämför med
kamrater. UWorld: kumulativ procent, per-ämne, percentil, tid per fråga, "baserat på N
frågor". Båda betonar att ett fullängdstest predikterar bättre än frågebankens procent.

**Vi tar:** "Tentaberedskap" som intervall, per kategori, med tydlig "baserat på N
repetitioner"; en frivillig "provtenta"-session (blandade kategorier, ingen ledtråd) som
kalibrerar. **Vi lämnar:** percentil mot kamrater som standard (opt-in).

---

## 4. Jämförelsematris

Skala: ✓ finns, (✓) delvis, – saknas, ✗ finns men skadligt. K = Kuggfri i dag.

| Funktion | K | Duolingo | Brilliant | Quizlet | Anki | RemNote | Kahoot | Khan | Kollin |
|---|---|---|---|---|---|---|---|---|---|
| Börja utan konto | ✓ | ✓ | – | (✓) | ✓ | – | ✓ | (✓) | – |
| Gratis för studenter, utan annonser | ✓ | ✗ | ✗ | ✗ | ✓ | (✓) | (✓) | ✓ | ✗ |
| Minnesmodell (FSRS-klass) | ✓ | (✓) | – | – | ✓ | ✓ | – | – | – |
| Daglig dosering / tak | – | ✓ | ✓ | (✓) | ✓ | ✓ | – | – | – |
| Tydlig slutpunkt per session | – | ✓ | ✓ | ✓ | (✓) | ✓ | ✓ | ✓ | – |
| Tentadatum styr schemat | – | – | – | (✓) | (✓) | ✓ | – | – | (✓) |
| Streak med frysning | – | ✓ | ✓ | – | (✓) | – | – | – | – |
| Felsvar-först-läge | ✓ | ✓ | – | (✓) | ✓ | ✓ | – | – | – |
| Beredskap / predikterad kunskap | – | (✓) | – | ✗ | ✓ | (✓) | – | ✓ | (✓) |
| Kalibrering (tror vs kan) | – | – | – | – | – | – | – | – | – |
| Flera övningsformer | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Matte (KaTeX) | ✓ | – | ✓ | (✓) | ✓ | ✓ | – | ✓ | ✓ |
| Offline | – | ✓ | – | ✗ | ✓ | ✓ | – | (✓) | – |
| Tangentbord först | (✓) | – | – | (✓) | ✓ | ✓ | – | – | – |
| Examinatorinsyn per begrepp | ✓ | – | – | ✗ | – | – | (✓) | ✓ | – |
| Anonymitetsgräns | ✓ | – | – | – | – | – | ✗ | – | – |
| Felrapport från kortet | ✓ | – | – | – | – | – | – | – | – |
| Studentförslag med kuratering | – | – | – | – | – | – | – | – | – |
| Föreläsningsläge (QR, live) | – | – | – | ✓ | – | – | ✓ | – | – |
| Innehåll ägs av kursen | ✓ | – | – | ✗ | (✓) | (✓) | (✓) | – | ✗ |
| AI-generering med granskning | – | – | – | ✓ | – | ✓ | ✓ | – | ✓ |
| Data i EU, ingen spårning | ✓ | ✗ | ✗ | ✗ | ✓ | – | ✗ | ✗ | ? |
| Lugna påminnelser med värde | – | ✗ | (✓) | – | – | – | – | – | – |

Läsning: Kuggfri vinner redan på raderna som handlar om förtroende och examinator. Det
som saknas är hela blocket "vana och dosering" samt "beredskap". Ingen aktör har kalibrering
eller kuraterade studentförslag; det är tomma rutor att ta.

---

## 5. Vad forskningen säger, kokat ner till designprinciper för Kuggfri

1. **Retrieval och spacing är nyttan; allt annat är förpackning.** Testing effect: 61 % mot
   40 % efter en vecka (Roediger & Karpicke 2006). Retrieval slår till och med
   begreppskartor på slutledningsfrågor (Karpicke & Blunt 2011). Spacing: d ≈ 0,71 över 317
   experiment (Cepeda 2006). → Förändra aldrig kärnloopen "fråga, försök, se, skatta".

2. **Optimalt intervall är en andel av tiden till provet** (Cepeda 2008: 20–40 % av en
   veckas horisont, 5–10 % av ett års). → Tentadatum är den viktigaste inställningen vi kan
   be om. Kortare intervall före tentan är inte fusk, det är modellens egen prediktion.

3. **Prestation under övning är en dålig mätare på lärande** (Soderstrom & Bjork 2015;
   interleaving fördubblade provresultat men sänkte övningskänslan, Rohrer & Taylor 2007).
   → Visa aldrig "sessionens träffprocent" som huvudmått; visa "kort du just nu kan".

4. **Studenter är överkonfidenta** (cirka 10 procentenheter; övningsprov hjälper
   snittstudenten men inte den lägsta kvartilen). Hypercorrection: säkra fel korrigeras
   bäst när återkopplingen är tydlig (Metcalfe & Finn 2011). → Gör "du trodde att du
   kunde, men skattade 1" visuellt högljutt; gör allt annat tyst.

5. **Successive relearning** (Rawson & Dunlosky 2013): återkalla till kriterium i sessionen,
   återkalla igen på nya dagar. → "Klar för i dag" när dagens kort är återkallade en gång,
   inte när kön är tom.

6. **Gamification: liten till måttlig effekt i snitt, negativ när den känns kontrollerande**
   (Sailer & Homner 2020 g≈0,49 kognitivt; Hanus & Fox 2015: leaderboard + badges sänkte
   motivation och tentaresultat över 16 veckor). Självbestämmandeteorin: informerande
   återkoppling om kompetens hjälper; påtvingad social jämförelse skadar. → Streak, mål,
   mastery-nivåer: ja. Leaderboards: bara opt-in och i små grupper. Poäng för snabbhet: nej.

7. **Låginsatsig retrieval minskar provångest** (72 % av 1 400 elever, Agarwal m.fl. 2014).
   → Sälj det så: "Öva här så att tentan inte är första gången du återkallar detta."

8. **Lärare vill ha ett ögonkast, inte loggar** (Karademir m.fl. 2024), och
   anonymitetsgränsen ska *sägas* i gränssnittet som ett löfte, inte se ut som ett hål.

9. **Rörelse: under 300 ms, ease-out, ingen animation på den 200:e vändningen** (Kowalski;
   Freiberg). Fira vid sessionens slut och vid mastery-milstolpar, inte per kort.
   Reduced-motion respekteras (har vi).

10. **AI: generera från föreläsningsmaterial med källhänvisning, människan väljer, inga
    studentdata till modellen.** GPT-4-flerval jämförbara med människoskrivna
    (2025-metaanalys); cirka hälften av genererade distraktorer användbara direkt. Chalmers
    har Copilot-licens, inte ChatGPT; IMY/DIGG kräver att persondata stryks. → EU-hosting,
    bara kursinnehåll skickas, examinatorn kan stänga av per kurs.

---

## 6. Det vi inte ska bygga (och varför)

| Mönster | Vem gör det | Varför inte |
|---|---|---|
| Hjärtan/energi som straffar fel | Duolingo 2025 | Motsatsen till en tentaförberedelse; långvariga användare slutade |
| Skuldnotiser 23:40 | Duolingo | Loss aversion som vapen; en kursstudent har redan en deadline |
| XP-ligor med globala främlingar | Duolingo, Brilliant | XP-farmande på lätta kort, ångest i nedre halvan |
| Poäng efter svarstid | Kahoot | Gissning före reflektion; Kahoot tog bort streak-poäng själva |
| Betalvägg framför inlärningsläget | Quizlet, Brilliant | Trustpilot 1,4/5; Knowt åt marknaden |
| Annonser mellan sessioner | Quizlet | Bryter loopen, spårning |
| Oändlig kö med "1 250 förfallna" | Anki | 82 % överväldigade, 68 % ångest |
| Trettio schemainställningar | Anki | Onboardingklippa; Anki tog bort "compute minimum retention" som förvirrande |
| AI-chatt som huvudgränssnitt | Quizlet Q-Chat (nedlagd) | Ersätter retrieval med omläsning, hallucinationer |
| Maskot och konfetti per kort | Duolingo | Fungerar bara med full commitment; halvhjärtat ser daterat ut, och vuxna med yttre motivation behöver det inte |
| Export bakom betalvägg, data som gisslan | Quizlet, Noji | Vi lovar motsatsen; det är vår positionering |
| Studentförslag som går live ogranskat | Peerwise utan moderering | Kvaliteten sjunker, examinatorn tappar förtroende |

---

## 7. Arbetsplan

Ramar: lansering tisdag 22 september; Alvin 20 % amanuens i tre månader (oktober till
december) plus Claude; tenta i Materialteknik i slutet av läsperiod 1 (datum bekräftas med
Johan). Principer: kodfrysning gäller före lanseringen; varje fas avslutas med grön
`npm run verify`; ingenting pushas före Alvins verifiering på 3001; inget tredjeparts-
analysverktyg, all mätning görs aggregerat i egen databas.

Storlek: S = timmar, M = en till två arbetsdagar, L = en vecka eller mer.

### Fas 0. Före lanseringen (18–21 september): en enda ändring

- **Tak på nya kort per session (S).** Standard 20 nya kort per session utöver förfallna,
  visat som "20 nya + 0 förfallna, cirka 6 minuter" under Starta-knappen. Sessionen slutar
  där, sammanfattningen säger "Klar för i dag. Nästa repetition i morgon." Detta är det
  enda i planen som jag rekommenderar att bryta kodfrysningen för, eftersom första intrycket
  ("144 kort kvar") avgör om andra sessionen händer. Liten ändring i `buildFsrsQueue` och
  sessionsbygget, testbar i enhetstester och ett E2E-fall. Alvin avgör.
- Allt annat i den befintliga lanseringslistan (SMTP, kurskod, verify, mobiltest) står kvar
  och påverkas inte.

### Fas 1. Vanan (v. 39–41, direkt efter lanseringen): "Kom tillbaka i morgon"

Mål: att en student som pluggat en gång gör en andra session inom tre dagar.

1. **Slutpunkt och dagligt mål (M).** "Klar för i dag"-skärm med tre siffror (kort i dag,
   dagar i rad, kort du just nu kan). Ett dagligt mål på kort som studenten kan ändra
   (10/20/40), progressring på decksidan. Firande bara här: en kort, lugn animation, ljud
   avstängt som standard.
2. **Streak med tysta frysningar (M).** Streak = dagar med minst en repetition. Två
   frysningar som fylls på automatiskt, helger fryser inte streaken om studenten valt
   "vardagar", tentaveckan räknas alltid. Reparationsfönster 24 timmar med en session.
   Visas som en diskret siffra, aldrig som en notis om att den "är i fara".
3. **Tentadatum (M).** Ett fält per deck (examinatorn sätter standard, studenten kan ändra).
   Tre beteenden: nya kort introduceras så att allt är sett minst fyra dagar före tentan;
   intervallen komprimeras så att varje kort är förfallet minst en gång de sista 48 timmarna;
   efter tentan frågar vi "Behåll för programmet (långsiktigt schema) eller arkivera?".
   Ikappläge visas öppet ("Du ligger 30 kort efter, vi höjer dagsmålet till 28 den här
   veckan"), aldrig tyst omschemaläggning. Följ RemNotes specifikation.
4. **Skattningsskalans semantik (S, beslut).** Behåll fem knappar (metakognition) men gör
   mappningen ärlig: visa nästa intervall på varje knapp ("3 → i morgon", "4 → om 4 dagar"),
   och överväg att 3 "Sådär" mappas till Again i stället för Hard. Alternativ: etiketter
   "Kunde inte / Nästan / Med möda / Kunde / Direkt" där "Nästan" är 2 och Again. Testa med
   fem studenter i första veckan, välj sedan.
5. **Fuzz och load balancing (S).** Slå på `enable_fuzz`, sprid förfallodagar så att
   måndagar inte blir berg. Easy Days i förenklad form: "Jag pluggar helst mån–fre".
6. **Onboarding vid första besöket (S).** En rad ovanför Starta: "Du kan börja utan konto.
   Cirka 5 minuter. Skatta ärligt, det är så schemat lär känna dig." Ingen modal, ingen
   rundtur. Kontoförslaget kommer efter första sessionen, framing "spara den här progressen".
7. **Tangentbord först (S).** Mellanslag vänder, 1–5 skattar, pilar navigerar, `?` visar
   genvägar. Synlig lista under kortet på desktop.
8. **Offline (M).** Service worker för skalet och senaste deck, IndexedDB som lokal källa,
   kö av repetitioner som synkas när nätet är tillbaka, senaste `last_review` vinner (samma
   regel som migreringen). Verifiera på spårvagnen.
9. **Mätning utan spårning (S).** Aggregerade tal i egen databas ur `review_log` och
   `study_sessions`: aktiveringsgrad (första session ≥ 20 kort + återbesök inom 3 dagar),
   veckoaktiva under läsperioden, sessioner per student per vecka. Visas i admin, aldrig
   per person.

### Fas 2. Beredskapen (v. 42–44, inför tentan): "Vet jag det här?"

Mål: att studenten litar på Kuggfri mer än på sin magkänsla veckan före tentan.

1. **Tentaberedskap per kategori (M).** Radardiagrammet och kategoritabellen visar
   predikterad återkallelse i dag (FSRS retrievability, medel per kategori), som intervall
   ("78–86 %") med "baserat på 41 repetitioner". Under fem repetitioner visas "för tidigt
   att säga". Ersätter "Inlärda" som huvudmått; "sedda" blir sekundärt.
2. **Provtenta-läge (M).** Blandade kategorier, ingen ledtråd, ingen föregående-knapp,
   30 kort, resultatet kalibrerar beredskapen (som UWorlds självtest). Frivilligt.
3. **Kalibrering (M, experiment).** Mät tid till vändning som implicit säkerhet. När ett
   kort vänds snabbt och skattas 1–2: tydligare röd stämpel och texten "Du var säker.
   Sådana här fastnar bäst nu." Ingen extra knapp per kort; friktionen ska vara noll.
   Utvärdera mot hypercorrection-litteraturen efter tentan.
4. **Lugna påminnelser (M).** Opt-in-mejl (vi har SMTP), max ett per dag vid vald tid,
   innehåll med värde: "14 kort förfallna, cirka 5 minuter. Tentan om 9 dagar." Tystnad
   efter tentan. Duolingos "vi slutar skicka om du inte öppnar" kopieras ordagrant.
   Hemskärmsgenväg (manifest finns) med badge om möjligt.
5. **Delbar beredskapsbild (S).** "Jag kan 91 % av Kristallstruktur" som bild att skicka i
   klasschatten. Det är den skärm som blir skärmdumpad, inte streaken.
6. **QR-kod i gränssnittet (S).** På decksidan och i admin, för föreläsningsbild och
   affisch. Nuvarande "Kopiera länk" behålls.
7. **Examinatorns veckobrev (M).** Måndag 07:00 till examinatorn: aktiva studenter, tre
   svåraste kategorierna, fem svåraste korten, nya felrapporter, med anonymitetsgränsen
   utskriven. Detta är "konfusionsrapporten" och överleveransen Johan bad om. Export som
   PDF/CSV från samma data.

### Fas 3. Innehållet och föreläsningen (november–december, efter tentan): "Kursen bygger sig själv"

Mål: att Kuggfri används *i* föreläsningen och att innehållet växer utan att Alvin skriver kort.

1. **Fler kortformer ur samma bas (L).** Skriv svaret (fritext, jämförs normaliserat, "var
   det rätt?"-knapp), flerval med distraktorer, lucktext (cloze) i redigeraren. Samma
   kort kan övas i flera former; FSRS-progress delas per kort.
2. **Föreslå ett kort (M).** Knapp i studieläget: "Saknas något? Föreslå ett kort." Går till
   examinatorns kö, godkänns eller redigeras, publiceras med kreditering "föreslaget av en
   student". Peerwise-effekten utan Peerwise-UI:t. Enkelt erkännande i profilen (antal
   godkända kort), inga badges.
3. **AI-utkast från föreläsningsmaterial (L).** Examinatorn laddar upp en PDF; vi föreslår
   kort med sidhänvisning; examinatorn bockar av. Överproducera, människan väljer, inget
   publiceras automatiskt. Bara kursinnehåll skickas till modellen, EU-region, kan stängas av
   per kurs, loggas. Även distraktorer till flerval genereras här.
4. **Föreläsningsläge (L).** Examinatorn väljer 5–10 kort, projektorn visar QR och kod,
   studenterna svarar i mobilen utan konto, fördelningen visas live, inga poäng, ingen
   ranking, anonymt. Korten läggs sedan i studentens kö som "från föreläsningen 14/11".
   Realtid via Supabase Realtime. Detta är vår Kahoot/Mentimeter, och det är så vi kommer in
   i nästa kurs.
5. **Självbetjäning för nästa examinator (M).** "Skapa en kurs" med import, inbjudan av
   examinator (finns), QR, en sida "För kursansvariga" med tio-minuters-flödet. Mål: tre
   kurser på Chalmers till vårterminen.

### Fas 4. Plattformen (vårterminen 2027)

- Canvas via LTI eller åtminstone inbäddningsbar länk med SSO-fri start (Möbius-mönstret
  på Chalmers visar hur duggor kopplas).
- Flera deck per student med en gemensam "i dag"-vy och en heatmap över terminen.
- Gamla tentor som kortkälla (Kollins innehåll, vår modell): frågor ur tentor taggade per
  kategori, med examinatorns tillstånd.
- Studiegrupp (opt-in, 2–6 personer): gemensamt dagsmål, "3 av 5 klara i dag". Aldrig
  rangordning.
- Designspråk 2.0: ett eget typsnitt (självhostat, humanistisk sans), tydligare
  kursväg per vecka på decksidan, illustrationsfri men färgstark identitet i kategorierna.

### Vad som mäts, per fas

| Fas | Mått | Mål |
|---|---|---|
| 1 | Andel som gör session 2 inom 3 dagar | ≥ 40 % (utbildningsappar ligger på 5–7 % D7; kursverktyg med lärarstöd ska ligga långt över) |
| 1 | Veckoaktiva av kursens studenter | ≥ 50 % under läsperioden |
| 2 | Predikterad återkallelse dagen före tentan, medel | ≥ 85 % för aktiva |
| 2 | Examinatorn öppnar veckobrevet | varje vecka |
| 3 | Studentförslag godkända per vecka | ≥ 5 |
| 3 | Kurser på Chalmers | 3 till VT27 |

---

## 8. Öppna frågor till Alvin

1. Får jag bryta kodfrysningen för taket på nya kort per session (Fas 0), eller ska det
   vänta till onsdagen efter lanseringen?
2. Tentadatum för Materialteknik LP1, så att Fas 1.3 kan byggas mot ett riktigt datum.
3. Skattningsskalan: behålla fem knappar med intervallvisning, eller fyra med Anki-semantik?
   Jag rekommenderar fem med visat intervall och 3 → Again, testat på studenter första veckan.
4. Föreläsningsläget kräver att Johan vill använda det i sal. Värt att fråga honom när han
   sett studenternas första veckor.
5. AI-generering: vill du ha det över huvud taget i år, eller är "Föreslå ett kort" plus
   Alvins egna set nog för LP2?

---

## 9. Källor (urval; fullständiga listor finns i researchunderlaget)

Duolingo/Brilliant: lennysnewsletter.com/p/how-duolingo-reignited-user-growth;
growth.design/case-studies/duolingo-user-retention; blog.duolingo.com (path, widget,
practice hub, shape language; HLR-artikeln research.duolingo.com/papers/settles.acl16.pdf);
sensortower.com/blog/duolingo-streak-feature-app-engagement-growth;
dl.acm.org/doi/10.1145/3491140.3528274 (Learning@Scale 2022); androidauthority.com (energy);
rive.app/blog (Brilliant); ustwo.com/work/brilliant; screensdesign.com/showcase/brilliant-learn-by-doing.

Flashcards/FSRS: docs.ankiweb.net (studying, deck-options, stats); github.com/open-spaced-repetition
(fsrs4anki, srs-benchmark, awesome-fsrs); expertium.github.io (Benchmark, Retention);
forums.ankiweb.net; pmc.ncbi.nlm.nih.gov/articles/PMC12662189 (UCF Anki-enkät 2025);
help.remnote.com (exam scheduler); mochi.cards/docs; quizlet.com/blog;
privacy.commonsense.org/privacy-report/quizlet; wordsonrepeat.com (Quizlet paywall 2026);
knowt.com; noji.io; brainscape.com/academy.

Klassrum: support.kahoot.com (points); medium.com/inside-kahoot (answer streaks);
sciencedirect.com/science/article/pii/S0360131520300208 (Wang & Tahir 2020);
kahoot.com/blog/2026 (high-stakes lectures, competition research); support.khanacademy.org
(mastery, skills tab); blog.khanacademy.org (efficacy 2024, AI tutor learnings);
help.mentimeter.com; intra.kth.se (Mentimeter, generativ AI); education.lu.se/digitala-verktyg/mentimeter;
peerwise.cs.auckland.ac.nz/docs/community/do_badges_work;
bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.12754;
frontiersin.org/articles/10.3389/feduc.2018.00008 (Perusall); community.canvaslms.com (item analysis);
math.chalmers.se/intern/lararinfo/MapleTA/canvas; support.amboss.com (score predictor);
medical.uworld.com/usmle/features; kollin.io; kth.se (Kollin); chalmerstenta.se; tenta.chs.se.

Forskning: aft.org/ae/fall2013/dunlosky; laplab.ucsd.edu (Cepeda 2008); yorku.ca/ncepeda (Cepeda 2006);
learninglab.psych.purdue.edu (Karpicke & Blunt 2011); Rohrer & Taylor 2007/2010; Soderstrom & Bjork 2015;
Rawson & Dunlosky 2013/2022; Metcalfe & Finn 2011; pmc.ncbi.nlm.nih.gov/articles/PMC8442020 (kalibrering);
Agarwal m.fl. 2014; Sailer & Homner 2020; Huang m.fl. 2020; Bai, Hew & Huang 2020; Hanus & Fox 2015;
onlinelibrary.wiley.com/doi/10.1111/jcal.13077 (Li 2024, leaderboards); jcal.12997 (Karademir 2024).

UX/policy: lennysnewsletter.com/p/what-is-a-good-activation-rate; businessofapps.com/data/education-app-benchmarks;
emilkowal.ski/ui/7-practical-animation-tips; rauno.me/craft/interaction-design; calmtech.institute;
w3.org/WAI/standards-guidelines/wcag/new-in-22; bdadyslexia.org.uk (style guide 2023);
guides.lib.chalmers.se/c.php?g=728318&p=5304143 (Chalmers AI för lärare); dataguidance.com (IMY-vägledning);
ncbi.nlm.nih.gov/pmc/articles/PMC12758716 (AI-genererade flerval, metaanalys 2025).
