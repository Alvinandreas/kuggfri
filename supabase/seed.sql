-- GENERERAD FIL. Ändra inte här; ändra i content/ och kör `npm run kuggfri -- seed`.
-- Innehållet och dess kreditering står i content/<kurs>/kurs.json.

begin;
-- Kurs: Materialteknik
insert into public.decks (id, slug, title, description, course_code, source_credit, exam_date, is_published, sort_order, source_hash) values ('1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$materialteknik$kuggfri$, $kuggfri$Materialteknik$kuggfri$, $kuggfri$Frågor och begrepp från kursen Materialteknik på Maskinteknik, Chalmers. Sammanställt av studenter och använt av två årskullar.$kuggfri$, $kuggfri$MTM081$kuggfri$, $kuggfri$Sammanställt av Alvin utifrån föreläsningar och kursmaterial i Materialteknik (Maskinteknik, Chalmers). Ursprungligen publicerat som flashcardset i Brainscape och använt av närmare 200 studenter över två årskullar.$kuggfri$, null, true, 0, $kuggfri$c34433c5e$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('97aae7d0-af93-5132-ad15-c840e2825cb2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$materialgrupper-och-egenskaper$kuggfri$, $kuggfri$Materialgrupper och egenskaper$kuggfri$, 0, $kuggfri$c3077a3e9$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('e2f719bb-f9eb-549f-acbb-a21921adb0bc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$materialvalsprocessen$kuggfri$, $kuggfri$Materialvalsprocessen$kuggfri$, 1, $kuggfri$c697dc3eb$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('d63240aa-9a49-52d8-8170-a0180269bc83', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$kristallstruktur$kuggfri$, $kuggfri$Kristallstruktur$kuggfri$, 2, $kuggfri$cbf9dc862$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('7b4bdbf7-ac7f-5d46-8266-31205b083f96', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$styvhet-tojning-och-materialindex$kuggfri$, $kuggfri$Styvhet, töjning och materialindex$kuggfri$, 3, $kuggfri$c98cec974$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('b1e2c1c7-3222-5068-b863-314ad83c0320', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$dislokationer-hardning-och-brott$kuggfri$, $kuggfri$Dislokationer, härdning och brott$kuggfri$, 4, $kuggfri$c1605f21d$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('86266117-7fc7-5ca1-b416-41853cb7dbce', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$stal-varmebehandling-och-bearbetning$kuggfri$, $kuggfri$Stål, värmebehandling och bearbetning$kuggfri$, 5, $kuggfri$c785708b3$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('6aaaf25d-9bb7-5fe8-81a0-52e742379456', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$termiska-egenskaper-diffusion-och$kuggfri$, $kuggfri$Termiska egenskaper, diffusion och krypning$kuggfri$, 6, $kuggfri$c363a2bb0$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('2a0cb9e4-83a2-5694-93d8-c2458390173a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$hallbarhet-och-atervinning$kuggfri$, $kuggfri$Hållbarhet och återvinning$kuggfri$, 7, $kuggfri$c819a35ce$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('6a606b07-da96-5efe-95d6-68de9be03181', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$tillverkning-och-varmebehandling-av-stal$kuggfri$, $kuggfri$Tillverkning och värmebehandling av stål$kuggfri$, 8, $kuggfri$c677a67b2$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$icke-jarnmetaller$kuggfri$, $kuggfri$Icke-järnmetaller$kuggfri$, 9, $kuggfri$c576603a0$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('bfff339c-3a73-562e-b919-e03c3b7521e8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$begrepp-och-ja-nej-fragor$kuggfri$, $kuggfri$Begrepp och ja/nej-frågor$kuggfri$, 10, $kuggfri$cde6eca44$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('95878deb-67fa-5595-8451-bc211dd37659', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$vilka-materialgrupper-finns-det$kuggfri$, $kuggfri$Vilka materialgrupper finns det?$kuggfri$, $kuggfri$* Metaller
* Keramer
* Polymerer

Ibland anses glas och elastomerer som separata materialgrupper men de kan annars ses som undergrupper till keramer respektive polymerer. En kombination av två eller flera material kallas för en komposit eller hybrid och kan ibland också ses som sina egna materialgrupp.$kuggfri$, null, 0, true, $kuggfri$c0471c1e9$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('2253132b-19e3-59ee-af46-2564a6a96d2f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$namn-minst-tva-olika-typer-av$kuggfri$, $kuggfri$Nämn minst två olika typer av atombindningar och redogör för deras karaktäristiska egenskaper.$kuggfri$, $kuggfri$* Kovalent bindning:
  - Stark
  - Riktningsberoende
  - Keramer, polymerer
* Metallbindning:
  - Stark
  - Elektronmoln → elektrisk och
termisk ledning
  - Hos metaller
* Jonbindning
  - Stark
  - Bindning mellan positiva och
negativa joner
  - Keramer
* Van der Waal, vätebindning,
polära bindningar
  - Svaga
  - Mellan polymerkedjor$kuggfri$, null, 1, true, $kuggfri$c78a92cf6$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('0d9a7110-1d1f-5b25-bf5c-acfd6d154fc1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$vad-ar-en-keram-och-vad-kannetecknar-dem$kuggfri$, $kuggfri$Vad är en keram och vad kännetecknar dem?$kuggfri$, $kuggfri$* Oorganiska, kemiska föreningar
mellan metal- och icke-metall
* Ex: Al₂O₃, SiC, SiO₂
* Använder sig av kovalent- eller jonbindning
* Cement, betong, tegel, porslin,
glas, tekniska keramer

Egenskaper:
* Hög smälttemperatur
* Kemiskt stabila
* Hög styvhet, bra slitstyrka
* Spröda, tål inte dragbelastning,
bättre i tryckbelastning
* Elektriskt och termiskt
isolerande

Tillägg gjort av examinatorn i admin.$kuggfri$, null, 2, true, $kuggfri$c7030d514$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('647b3aed-fdfc-574a-8d18-5329c3c1415d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$hur-tillverkas-vanligtvis-en-produkt$kuggfri$, $kuggfri$Hur tillverkas vanligtvis en produkt gjord i någon form av keram?$kuggfri$, $kuggfri$* Keramer tillverkas av olika
mineral
* Utgångsmaterial i form av lera
eller pulver
* Formas till produktens form
* Sintras (bränns) vid ca. 2/3 av
keramens smälttemperatur$kuggfri$, null, 3, true, $kuggfri$c7698fec8$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('6c5a5c2b-5572-53bc-8983-06fafcb0c100', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$vad-ar-en-metall-och-vad-kannetecknar$kuggfri$, $kuggfri$Vad är en metall och vad kännetecknar dem?$kuggfri$, $kuggfri$* Vanliga metaller
  - Stål
  - Aluminium
  - Cu, Mg, Ti, Ni
* Används oftast i legering
(blandning)
  - Stål = Fe + C
  - Brons = Cu +Sn
  - Mässing = Cu + Zn

Egenskaper:
* Kristallin struktur
* Medel till hög smälttemperatur
* Elektriskt och termiskt ledande
* Hög styvhet
* Hög sträckgräns (hårdhet)
* Ej spröda
* Hög densitet
* Kan gjutas
* Kan formas med plastiska
metoder: valsning, pressning
* Kan maskinbearbetas:
borrning, svarvning, fräsning$kuggfri$, null, 4, true, $kuggfri$c385d1902$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('937feb6b-7a15-5b8b-8928-af9139054624', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$vad-ar-en-polymer-och-vad-kannetecknar$kuggfri$, $kuggfri$Vad är en polymer och vad kännetecknar dem?$kuggfri$, $kuggfri$* Organiska material som består
av makromolekyler
* Tillverkas av olja, men även
annan organisk råvara
* Plast = polymer + tillsatser

Egenskaper:
* Låg användningstemperatur
* Relativt låg styvhet och
sträckgräns
* Låg densitet
* Elektriskt och termiskt
isolerande
* Enkla att forma$kuggfri$, null, 5, true, $kuggfri$cff1b9028$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('6d7e0d18-64af-599f-81cf-b01a66a055f3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$namn-minst-tva-olika-typer-av-polymerer$kuggfri$, $kuggfri$Nämn minst två olika typer av polymerer och vad som kännetecknar dem.$kuggfri$, $kuggfri$* Termoplaster
  - Långa polymerkedjor
  - Svaga bindningar mellan
kedjorna
  - Kan formas med värme
  - Återvinningsbara
* Härdplaster
  - Nätverk av molekyler
  - Kovalenta bindningar
  - Kan inte formas med värme
  - Inte återvinningsbara
* Gummi (elastomerer)
  - Glest tvärbundna
polymerkedjor
  - Kan inte formas med värme
  - Inte återvinningsbara$kuggfri$, null, 6, true, $kuggfri$c1ae318f3$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('180536c9-4513-56b0-811d-c76ce7f2bc38', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$vad-ar-en-komposit-och-vad-kannetecknar$kuggfri$, $kuggfri$Vad är en komposit och vad kännetecknar dem?$kuggfri$, $kuggfri$* Kombination av två eller flera
material, ex. plast och kolfiber
* Vanliga fiber: kolfiber, glasfiber,
aramidfiber
* Förstärkningen kan vara i olika
form: långa fiber, korta fiber,
partiklar
* Andra exempel:
  - Betong = cement och sten
  - Hårdmetall = Co och WC$kuggfri$, null, 7, true, $kuggfri$cd8dc718d$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('294e701d-33be-5360-ac9b-fb5ccb2fa092', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$namn-minst-tva-olika-typer-av-2$kuggfri$, $kuggfri$Nämn minst två olika typer av tillverkningsmetoder.$kuggfri$, $kuggfri$* Primär formning
* Sekundär formning
* Fogning
* Ytbehandling$kuggfri$, null, 8, true, $kuggfri$cf7ded39c$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('700df2ca-94ec-5b7e-abf2-f4c30cd1c7c5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$materialegenskaper-brukar-delas-upp-i$kuggfri$, $kuggfri$"Materialegenskaper" brukar delas upp i ett antal underkategorier, nämn minst tre av dessa.$kuggfri$, $kuggfri$* Allmänna egenskaper
* Mekaniska egenskaper
* Elektriska, magnetiska och
optiska egenskaper
* Termiska egenskaper
* Kemiska egenskaper
* Miljö$kuggfri$, null, 9, true, $kuggfri$cc18f53a2$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('8156781b-68eb-581c-9096-1d41e140dd51', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$ge-minst-tva-exempel-pa-mekaniska$kuggfri$, $kuggfri$Ge minst två exempel på mekaniska egenskaper.$kuggfri$, $kuggfri$* Styvhet
  - Hur mycket ett material
deformeras vid en viss last.
* Sträckgräns
  - Vid vilken last (spänning) ett
material deformeras
permanent.
* Brottseghet
  - Vid vilken last ett material
går sönder.$kuggfri$, null, 10, true, $kuggfri$c2768ba11$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('d9ec0e04-5a53-538f-a717-d0d8db6eb3c3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$ge-minst-tva-exempel-pa-elektriska$kuggfri$, $kuggfri$Ge minst två exempel på elektriska, magnetiska och optiska egenskaper.$kuggfri$, $kuggfri$* Elektisk ledningsförmåga
* Elektrisk isolering
* Magnetiska
* Genomskinligt, reflexion, färg

Beror på växelverkan mellan
elektronerna i materialet$kuggfri$, null, 11, true, $kuggfri$c7f5605ee$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('745893a2-88da-5bc5-b672-f8e09ad3e43b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$ge-minst-tva-exempel-pa-termiska$kuggfri$, $kuggfri$Ge minst två exempel på termiska egenskaper.$kuggfri$, $kuggfri$* Smälttemperatur
* Min och max
användningstemperatur
* Värmeledning
* Specifik värmekapacitivitet
* Termisk utvidgning$kuggfri$, null, 12, true, $kuggfri$cba9f5883$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('ec4061e1-5ae9-56ea-8933-56c1d16de866', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$ge-minst-tva-exempel-pa-kemiska$kuggfri$, $kuggfri$Ge minst två exempel på kemiska egenskaper.$kuggfri$, $kuggfri$* Korrosion (“rostar”)
* Oxidation (reagerar med syre)
* Reaktioner i användningsmiljön
* Giftigt$kuggfri$, null, 13, true, $kuggfri$cec0cea10$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('4ea2d46c-c084-5a37-8ce0-0c1858d1cdd7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$ge-minst-tva-exempel-pa-miljoegenskaper$kuggfri$, $kuggfri$Ge minst två exempel på miljöegenskaper.$kuggfri$, $kuggfri$* CO₂ footprint: mängd CO₂-som
bildas vid framställning
* Embedded energy: mängd
energi som åtgår för
framställning
* Återvinningsbart
* Andra miljöbelastningar vid
utvinning, framställning,
produkttillverkning,
användning och skrotning$kuggfri$, null, 14, true, $kuggfri$cb3effb7d$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('2be1d410-d260-5f60-b5a3-198d0c0cf76a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$vilka-ar-de-olika-stegen-i$kuggfri$, $kuggfri$Vilka är de olika stegen i materialvalsprocessen?$kuggfri$, $kuggfri$1. Översätta
2. Sålla
3. Rangordna
4. Sök dokumentation
5. Iterera$kuggfri$, null, 15, true, $kuggfri$c5e63575a$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('a3576869-1462-5637-89ae-52b6fa1768a4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-vad-man-gor-i$kuggfri$, $kuggfri$Beskriv vad man gör i materialvalssteget: "Översätta".$kuggfri$, $kuggfri$Översätta krav på komponenten till krav på materialet:

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
Ex. tvärsnitt, material$kuggfri$, null, 16, true, $kuggfri$c62e55491$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('a7bb3469-b345-53df-8186-e4c1cb157b04', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-vad-man-gor-i-2$kuggfri$, $kuggfri$Beskriv vad man gör i materialvalssteget: "Sålla".$kuggfri$, $kuggfri$Ta bort alla material som inte fyller kraven. Använder vi dessa material så kommer komponenten inte att fungera som vi vill.) Materialegenskaper som vi använder i målfunktionen bör vi inte heller använda vid sållningen. (ex. inget krav på densitet om målet är låg vikt.)$kuggfri$, null, 17, true, $kuggfri$c324a51a2$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('3376edce-7584-52be-92d7-dcb736609e56', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-vad-man-gor-i-3$kuggfri$, $kuggfri$Beskriv vad man gör i materialvalssteget: "Rangordna".$kuggfri$, $kuggfri$* Använd funktion, mål och fria variabler för att bestämma
materialindex.
* Materialindex = numeriskt värde som beskriver hur bra ett material uppfyller målen!
* Ta hjälp av materialindexet för att rangordna materialen.
Ex: E-modul/pris, E-modul^(1/2)/densitet$kuggfri$, null, 18, true, $kuggfri$c3d2a8494$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('6a60025f-71d7-542e-98c2-4fba34214cb2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-vad-man-gor-i-4$kuggfri$, $kuggfri$Beskriv vad man gör i materialvalssteget: "Sök dokumentation".$kuggfri$, $kuggfri$Leta i dokumentation (handböcker, artiklar, standarder m.m.) för att se om det finns erfarenheter av materialet i liknande tillämpningar.$kuggfri$, null, 19, true, $kuggfri$ccedab15a$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('352114ee-0597-5fa4-b1f4-d4c6f6844374', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-vad-man-gor-i-5$kuggfri$, $kuggfri$Beskriv vad man gör i materialvalssteget: "Iterera". Varför är det så viktigt att iterera sitt materialval?$kuggfri$, $kuggfri$Materialvalet måste ofta förfinas och förbättras i flera steg innan man hittar den bästa möjliga lösningen. För att säkerställa att man inte missat potentiellt aktuella material utökar man vanligtvis mängden valbara material efter den första iterationen efter att man skaffat sig en upplevelse av vad för typ av material som passar uppdragsbeskrivningen.$kuggfri$, null, 20, true, $kuggfri$c34974387$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('71baf9d6-ddeb-5b91-b705-dfb55d49290b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$vad-ar-skillnaden-mellan-kristallin-och$kuggfri$, $kuggfri$Vad är skillnaden mellan kristallin- och amorf mikrostruktur?$kuggfri$, $kuggfri$* Kristallin = ordnad struktur
  - Metaller, keramer, vissa polymerer
* Amorf = oordnad struktur
  - Polymerer, glas$kuggfri$, null, 21, true, $kuggfri$c57cd6dbb$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('71bc6e75-1c5f-580e-ab9e-43cdbb002348', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$vad-ar-en-enhetscell-namn-minst-tva$kuggfri$, $kuggfri$Vad är en enhetscell? Nämn minst två olika typer av enhetsceller.$kuggfri$, $kuggfri$* En liten volym som kan beskriva hela kristallen
* I varje punkt sitter det en atom eller molekyl
* Sex parametrar: 3 längder, 3 vinklar

Ex: FCC (Face Centered Cubic), BCC (Body Centered Cubic), Triclinic, Simple Cubic, Close-Packed Hexagonal.$kuggfri$, null, 22, true, $kuggfri$c3dfd4dc6$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('488e66a6-cc96-548e-b7d8-bf2bf19fe9fe', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$vad-kannetecknar-enhetscellen-fcc$kuggfri$, $kuggfri$Vad kännetecknar enhetscellen: "FCC"?$kuggfri$, $kuggfri$* Face centered cubic
* Ytcentrerad kubisk
* Ex: Al, Cu, Ni, Au, Ag, Rostfritt stål
* Kantlängd a, vinkel 90 grader
* Tätpackad ytdiagonal$kuggfri$, null, 23, true, $kuggfri$c69967710$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('e0c74db4-eaf6-56f1-940d-2d603cf7e3fd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$vad-kannetecknar-enhetscellen-bcc$kuggfri$, $kuggfri$Vad kännetecknar enhetscellen: "BCC"?$kuggfri$, $kuggfri$* Body centered cubic
* Rymdcentrerat kubisk
* Ex: Fe
* Kantlängd a, vinkel 90 grader
* Tätpackad rymddiagonal$kuggfri$, null, 24, true, $kuggfri$c4a4ea733$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('affc638b-908b-5e1c-ba33-b645f4bb8fa3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$det-finns-olika-typer-av-hal-i$kuggfri$, $kuggfri$Det finns olika typer av hål i kristallstrukturer, vad innebär detta?$kuggfri$, $kuggfri$* Mellan atomerna finns
hålrum med olika form
och storlek
* Avgör om små atomer
kan lösas in i
materialet (ex. C i Fe)$kuggfri$, null, 25, true, $kuggfri$c27584d70$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('05549803-b3c4-5c64-9b20-5bb35005788b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$millerindex-beskriv-kortfattat-vad-det$kuggfri$, $kuggfri$Millerindex: Beskriv kortfattat vad det är och hur det tas fram.$kuggfri$, $kuggfri$Millerindex är en form av vektorbeteckning som används för att beskriva atomplans position. Origo för koordinatsystemet placeras i regel i ett av enhetscellens hörn. På följande sätt härleds en enhetscells Millerindex:
1. Bestäm planets skärningar med koordinataxlarna
2. Invertera
3. Gör heltalig → Millerindex (hkl)
(hkl) = specifikt plan
{hkl} = familj av plan

På ett liknande sätt kan man beskriva en kristalls riktningar, men då kallas det inte längre för Millerindex och följande beteckning används istället:
[hkl] = specifik riktning
\<hkl> = familj av riktningar$kuggfri$, null, 26, true, $kuggfri$ce2d4f34e$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('1f10e3ac-c277-5ae0-99d3-e1f78cbfaffe', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vad-beror-ett-materials-densitet-pa-for$kuggfri$, $kuggfri$Vad beror ett materials densitet på för faktorer?$kuggfri$, $kuggfri$* Atomvikten hos atomerna i materialet
* Antalet atomer/volym
* Densiteten hos kompositer beror på volymandel och densitet på de ingående materialen
* Densiteten i polymerskum, trä m.m blir låg p.g.a. hålrummen.$kuggfri$, null, 27, true, $kuggfri$c150c6c87$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('a5d5e6cf-4695-5d9d-919c-45aca7d7469a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$atombindningar-kan-jamforas-med-linjara$kuggfri$, $kuggfri$Atombindningar kan jämföras med linjära fjädrar. Hur kommer detta sig och varför gör man det?$kuggfri$, $kuggfri$Man brukar likna atombindningar med linjära fjädrar för att de har liknande egenskaper.
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
  - Hög smälttemperatur$kuggfri$, null, 28, true, $kuggfri$c91c16c6d$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('b6fbe14c-8a65-5414-8cd1-c8a662b058b5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vad-har-ett-materials-atombindningar$kuggfri$, $kuggfri$Vad har ett materials atombindningar för inverkan på dess egenskaper?$kuggfri$, $kuggfri$* Påverkar styvhet, termisk utvidgning,
smälttemperatur, elektrisk ledningsförmåga m.m.
* Kan ej förändras med processer$kuggfri$, null, 29, true, $kuggfri$c5eadba40$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('2eaf03ac-75d0-5f23-96b7-17e66a9784d8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$hur-ser-ett-typiskt-dragprov-ut-for-ett$kuggfri$, $kuggfri$Hur ser ett typiskt dragprov ut för ett sprött material?$kuggfri$, $kuggfri$* Elastiskt beteende upp till
brottgränsen
* Brottgränsen =den spänning
där brott sker
* Keramer, glas$kuggfri$, null, 30, true, $kuggfri$c16702519$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('b9598645-8b12-5add-b41c-ea6dda4985cf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$hur-ser-ett-typiskt-dragprov-ut-for-ett-2$kuggfri$, $kuggfri$Hur ser ett typiskt dragprov ut för ett segt material?$kuggfri$, $kuggfri$* Elastiskt beteende upp till
sträckgränsen
* Sträckgränsen = den spänning där
materialet börjar plasticera
* Brottgränsen = högsta spänningen
* Elastisk avlastning även i plastiska
området
* Metaller, polymerer$kuggfri$, null, 31, true, $kuggfri$ca03cac01$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('33289dc7-b673-55d4-a065-92d76b09c55a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vilka-egenskaper-kan-observeras$kuggfri$, $kuggfri$Vilka egenskaper kan observeras/kartläggas med hjälp av dragprov?$kuggfri$, $kuggfri$* E-modul (styvhet) GPa
* Sträckgräns (börjar plasticera) MPa
* Brottgräns (största spänningen innan brott) MPa
* Brottförlängning (plastisk töjning efter brott) %
* Seghet – arean under dragprovkurvan$kuggfri$, null, 32, true, $kuggfri$c7e21d134$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('b00edef7-d562-5966-b3b2-4ef281fd25df', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$styvheten-hos-kompositer-beror-pa-fler$kuggfri$, $kuggfri$Styvheten hos kompositer beror på fler faktorer än homogena material gör, nämn minst två av dessa.$kuggfri$, $kuggfri$Styvheten beror på:

* De ingående komponenternas
egenskaper
* Volymfraktion
* Orientering
* Form

Ex: Fiberriktning$kuggfri$, null, 33, true, $kuggfri$cda3e3fa5$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('60ee4565-6c5e-5669-b67f-8858de7bd4ca', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vad-ar-tojning$kuggfri$, $kuggfri$Vad är töjning?$kuggfri$, $kuggfri$Töjning är en geometrisk storhet som beskriver den procentuella förlängningen av ett material under en given last eller annan typ av påfrestning.

* Töjning kan orsakas av:

Mekaniska laster:
$\sigma = E\,\varepsilon$
Temperatur:
$\varepsilon = \alpha\,\Delta T$
$\alpha$ = längdutvidgningskoefficienten
Elektriska och magnetiska fält
Fukt m.m.$kuggfri$, null, 34, true, $kuggfri$c09638b7e$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('fc3d7020-a55c-5b64-8d7c-0ab7141a10cd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vad-kannetecknar-ett-isotropt-material$kuggfri$, $kuggfri$Vad kännetecknar ett isotropt material?$kuggfri$, $kuggfri$Ett isotropt material är ett material som kan beskrivas med minst två elastiska konstanter:

* E-modul
* Poissons tal, tvärkontraktion

Fler elastiska konstanter i t.ex.
kompositer, trä → anisotropt material$kuggfri$, null, 35, true, $kuggfri$c0425e860$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('7c7811c1-f9b4-53d9-b8cf-7f11fbb36aaa', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vad-har-lastfall-for-inverkan-pa$kuggfri$, $kuggfri$Vad har lastfall för inverkan på materialindexet?$kuggfri$, $kuggfri$Lastfallet bestämmer vilket materialindex som är bäst lämpat för situationen. Materialindexet beskriver i sin tur hur bra ett material presterar i det aktuella lastfallet och kan därför med fördel användas för att rangordna en mängd material.$kuggfri$, null, 36, true, $kuggfri$c7d014efc$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('a446e3f7-5f57-5f56-987d-dbde37915688', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vad-ar-ett-lastfall-och-varfor-ar-det$kuggfri$, $kuggfri$Vad är ett lastfall och varför är det viktigt i materialvalsprocessen?$kuggfri$, $kuggfri$* Ett lastfall är en isolerad belastningssituation som materialet kan utsättas för.
* Ex: En stång i tryck/drag/vridspänning, en balk i böjning/knäckning eller utsatt för utbredd last, ett tryckkärl utsatt för tryckskillnader.
* Lastfall används för att definiera vilket materialindex som är bäst lämpat för materialvalet.
* För att få den mest rättvisa jämförelsen av materialindex bör man använda lastfallet som förekommer oftast!$kuggfri$, null, 37, true, $kuggfri$cecfcc86c$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('c67240d8-2f57-5d95-902d-05aae6a70542', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$beskriv-ingaende-vad-ett-materialindex$kuggfri$, $kuggfri$Beskriv ingående vad ett materialindex är och hur det används.$kuggfri$, $kuggfri$* Ett numeriskt värde M som talar om hur effektivt ett material är i
ett visst lastfall och en viss form
* För att bestämma materialindex behöver vi veta vilken egenskap som skall optimeras (ex: styvhet, pris, vikt) och lastfall
* Detta bestäms av funktion, mål och fria variabler från
översättningen
* Materialindex används för att rangordna material i materialvalet$kuggfri$, null, 38, true, $kuggfri$c1368d84e$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('868c4718-d4ed-5563-adc5-688f003a52db', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$hur-mats-ett-materials-hardhet$kuggfri$, $kuggfri$Hur mäts ett materials hårdhet?$kuggfri$, $kuggfri$* Mäts med intryck
* Olika metoder med
olika form på
indenter och olika
last
* Kopplar till
sträckgräns$kuggfri$, null, 39, true, $kuggfri$cee9f8e6b$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('9572836a-8873-57b7-acba-30ec59fa647d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-kan-det-finnas-for-defekter-i$kuggfri$, $kuggfri$Vad kan det finnas för defekter i kristaller?$kuggfri$, $kuggfri$* Vakanser = atomer saknas
* Inlösta atomer = atom av
annan sort
* Dislokationer = extra
atomplan
* Korngränser$kuggfri$, null, 40, true, $kuggfri$c2ea3dfd4$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('d7a8223b-69cb-5f19-8d0a-6c9a30699b40', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$beskriv-ingaende-vad-dislokationer-och$kuggfri$, $kuggfri$Beskriv ingående vad dislokationer och dislokationsrörelser är och vad det innebär för materialet.$kuggfri$, $kuggfri$Dislokationer är en typ av strukturmässig avvikelse i kristallen i form av "extra atomplan". De bryter alltså det annars uniforma mönstret hos kristallen.

* När kristallen belastas över sträckgränsen kan dislokationer röra sig
* Dislokationerna rör sig på glidsystem = glidplan + glidriktning
* Glidningen ger upphov till en förskjutning som har storlek och riktning som glidvektorn, Burges vektor

Dislokationen kan sättas i rörelse av skjuvspänningar och rör sig sedan i små steg. Detta ger upphov till små förskjutningar eller annars kallat; plastiska deformationer i kristallstrukturen.

* Dislokationerna rör sig lättast i
riktningar nära 45 grader mot
belastningsriktningen
* Plasticering sker under
konstant volym
* Ger upphov till skjuvband =
band av plasticerat material$kuggfri$, null, 41, true, $kuggfri$c4d64a99c$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('bdde4b07-0a8c-5e79-930a-1ec43cabd094', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-en-hardningsmekanism-namn-minst$kuggfri$, $kuggfri$Vad är en härdningsmekanism? Nämn minst två olika typer av härdningsmekanismer.$kuggfri$, $kuggfri$En förändring av mikrostrukturen för att göra dislokationsrörelser svårare. Det resulterar i högre sträckgräns, hårdhet och ofta lägre brottförlängning. De olika typerna av härdningsmekanismer är:

1. Lösningshärdning
2. Utskiljningshärdning
3. Deformationshärdning
4. Korngränshärdning$kuggfri$, null, 42, true, $kuggfri$c36710b97$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('19c6729c-f900-5e59-a867-310a3bddcac4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-losningshardning-och-hur-gar-det$kuggfri$, $kuggfri$Vad är lösningshärdning och hur går det till?$kuggfri$, $kuggfri$* Atomer av annan sort löses in i
kristallen
* Spänningsfältet kring atomerna
hindrar dislokationsrörelse
* Större effekt med större
koncentration och större skillnad i
atomstorlek
* Sker med legering i smälta$kuggfri$, null, 43, true, $kuggfri$c44ac7e18$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('695a24b3-4bad-5386-8dcf-34119a088d8c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-utskiljningshardning-och-hur-gar$kuggfri$, $kuggfri$Vad är utskiljningshärdning och hur går det till?$kuggfri$, $kuggfri$* Partiklar av annan fas
bildas i materialet
* Partiklarna hindrar
dislokationsrörelse
* Sker med legering i smälta
och värmebehandling i
fast form$kuggfri$, null, 44, true, $kuggfri$c1b63f6b3$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('27d1e234-cb5f-5cc9-8017-ecd793b9a6be', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-deformationshardning-och-hur-gar$kuggfri$, $kuggfri$Vad är deformationshärdning och hur går det till?$kuggfri$, $kuggfri$* Dislokationer hindrar andra
dislokationer att röra sig (låser
varandra)
* Mängden dislokationer ökar
kraftigt vid plastisk
deformation → plastiskt
hårdnande
* Sker vid kallbearbetning
(pressning, valsning, smide ...)$kuggfri$, null, 45, true, $kuggfri$c85187225$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('6fbfcc5e-7066-58f1-8030-8b3841e89331', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-korngarnshardning-och-hur-gar$kuggfri$, $kuggfri$Vad är korngärnshärdning och hur går det till?$kuggfri$, $kuggfri$* Minska storleken på kornen som utgör materialet så att antalet korngränser ökar
* Korngränser hindrar
dislokationer
* Små korn ger hårdare material
* Viktigt hos BCC-metaller (vissa
stål)$kuggfri$, null, 46, true, $kuggfri$cb7daf8f4$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('55f44335-263b-5f37-aa6f-9617704990b5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$nar-ska-man-anvanda-materialindex-for$kuggfri$, $kuggfri$När ska man använda materialindex för styvhet, kontra sträckgräns?$kuggfri$, $kuggfri$* Använd materialindex för styvhet
om deformationen är
dimensionerande. (Krav på max
deformation)
* Använd materialindex för
sträckgräns om last utan plasticering
är dimensionerande. (Krav på max
spänning)$kuggfri$, null, 47, true, $kuggfri$c9c2bb4ff$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('821db7af-efc3-5e48-ad7d-4dd5d12bc613', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-brottseghet$kuggfri$, $kuggfri$Vad är brottseghet?$kuggfri$, $kuggfri$Ett mått på ett materials naturliga motstånd mot propagering av sprickor.

* Brottseghet $K_{1c}$ ($\text{MPa}\sqrt{\text{m}}$), 1 för modus, c för kritisk
* Brott när $K_{1c}$> $K_1$
* Tar hänsyn till last och spricklängd
* Beror på energin som krävs för att driva sprickan
* ($K_{1c} = \sqrt{E\,G_c}$)$kuggfri$, null, 48, true, $kuggfri$cc5dc8990$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('d181901e-43d2-5b1c-b4b2-b828384d3ce2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$varfor-ar-sproda-material-extra$kuggfri$, $kuggfri$Varför är spröda material extra känsliga för defekter?$kuggfri$, $kuggfri$Största förekommande defekten i en komponent ger störst spänning vilket innebär att brottet börjar där. Brottstyrkan blir då beroende av sannolikheten för att det finns en defekt i det belastade området och ju större komponenten är desto högre blir sannolikheten att det förekommer defekter. Eftersom sprickor uppträder lättare i spröda material blir de mer defektkänsliga.$kuggfri$, null, 49, true, $kuggfri$c9f28fb3a$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('1cbdc93f-ab00-5877-9864-891fd35453e0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-har-temperatur-for-inverkan-pa-ett$kuggfri$, $kuggfri$Vad har temperatur för inverkan på ett materials brottseghet?$kuggfri$, $kuggfri$När temperaturen sjunker blir materialen sprödare, och sannolikheten för sprickbildning ökar.$kuggfri$, null, 50, true, $kuggfri$c21759664$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('14881e99-7c46-5d30-a7b6-0f202f4270f1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-skillnaden-mellan-ett-segt$kuggfri$, $kuggfri$Vad är skillnaden mellan ett segt- respektive sprött brott?$kuggfri$, $kuggfri$Ett segt material deformeras plastiskt under en längre tid innan brott uppstår, till skillnad från ett sprött material som deformeras betydligt mindre innan brott sker.$kuggfri$, null, 51, true, $kuggfri$cbc163ce6$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('2c88472e-7c27-5189-9afe-e136a56bbef9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-anvander-man-for-typ-av-test-for$kuggfri$, $kuggfri$Vad använder man för typ av test för att undersöka ett materials brottseghet?$kuggfri$, $kuggfri$För att bestämma brottseghet hos ett material används slagprovning.

* Det är ett enkelt test för att mäta energin som krävs för sprickpropagering
* Provstav med anvisning används för att standardisera testet
* Används för kvalitetstest och omslagstemperatur
(omslag mellan sprött och segt beteende)$kuggfri$, null, 52, true, $kuggfri$ce311f8a0$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('21ec6dcd-d6ff-57d5-83b7-8f9c9e551096', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-utgor-stal$kuggfri$, $kuggfri$Vad utgör stål?$kuggfri$, $kuggfri$Stål är järn legerat med kol som beroende på kolhalt och tillverkningsförhållanden kan ges olika egenskaper.$kuggfri$, null, 53, true, $kuggfri$c865d33cb$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('37e85615-60cb-5f0b-aad8-3c081af15a0f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-ar-ett-fasdiagram-och-vad-anvands$kuggfri$, $kuggfri$Vad är ett fasdiagram och vad används det till?$kuggfri$, $kuggfri$Ett fasdiagram visar vilka faser som är stabila vid vilka specifika temperaturer och sammansättningar av de ingående metallerna i en legering (även tryck m.m.). Gäller vid långsamma förlopp så att utjämning av koncentrationsskillnader kan ske m.h.a. diffusion = jämvikt uppnås.$kuggfri$, null, 54, true, $kuggfri$c62c08785$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('b7f718c4-fd46-589a-b120-4292ac949dfc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-ar-ferrit-och-nar-uppstar-det$kuggfri$, $kuggfri$Vad är Ferrit och när uppstår det?$kuggfri$, $kuggfri$Ferrit är rent järn upp till 910°C, BCC, låg löslighet av C.$kuggfri$, null, 55, true, $kuggfri$c29545e10$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('b75e3374-5e46-5d9c-8da7-6108d70dec27', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-ar-austenit-och-nar-uppstar-det$kuggfri$, $kuggfri$Vad är Austenit och när uppstår det?$kuggfri$, $kuggfri$Austenit, rent järn upp över 910 °C, FCC, upp till 2.1 % löslighet av C.$kuggfri$, null, 56, true, $kuggfri$cc574ee16$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('98158a2f-4921-5d45-87ce-a327352ae79f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-ar-cementit-och-nar-uppstar-det$kuggfri$, $kuggfri$Vad är cementit och när uppstår det?$kuggfri$, $kuggfri$Cementit, Fe₃C, intermediär fas, 6,67 % C, mycket hård$kuggfri$, null, 57, true, $kuggfri$c3ae706d1$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('57c5d9f0-71a4-5cb9-a79f-f28430b575bf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$beskriv-vad-en-anlopning-ar$kuggfri$, $kuggfri$Beskriv vad en anlöpning är.$kuggfri$, $kuggfri$Anlöpning av härdat stål är en process som används för att öka materialets duktilitet och sänka dess hårdhet.

För att uppnå detta återuppvärms stålet till en temperatur beroende på stålsort och produkt precis under den punkt där ferrit omvandlas till austenit (cirka 910 °C).

* En uppvärmning till en temperatur under
austenittemeraturen ger fasomvandling till
anlöpt martensit = perlit + cementit (mycket
fina utskiljningar)
* Minskar hårdhet något, men mycket segare
* Kan bestämma hårdhet med
anlöpningstemperatur$kuggfri$, null, 58, true, $kuggfri$cdf1bdecf$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('fea1c5f8-d9ee-5264-bab3-991773e7f3b2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vilken-inverkan-har-kolhalten-pa$kuggfri$, $kuggfri$Vilken inverkan har kolhalten på stålets egenskaper?$kuggfri$, $kuggfri$Kolet gör att järnet blir brukbart som konstruktionsmaterial överhuvudtaget. Stålet blir sprödare ju mer kol som introduceras.$kuggfri$, null, 59, true, $kuggfri$c7b0dbf11$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('78f5947a-cb47-5cfd-9277-dbff23e2f513', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-ar-martensit-och-hur-uppstar-det$kuggfri$, $kuggfri$Vad är martensit och hur uppstår det?$kuggfri$, $kuggfri$Kan fås vid snabbkylning av stål från austenitområdet. Det är utöver det en metastabil fas med tetragonal struktur = distorderad BCC.$kuggfri$, null, 60, true, $kuggfri$cddf062dc$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('dbff3869-409d-5fe7-bf89-3617ef5b2173', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-ar-ett-ttt-diagram-och-vad-anvands$kuggfri$, $kuggfri$Vad är ett TTT-diagram och vad används det till?$kuggfri$, $kuggfri$TTT-diagram står för Time Temperature Transformation- diagram och används för att bestämma tid och temperatur för värmebehandlingar.$kuggfri$, null, 61, true, $kuggfri$ccd0d35fe$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('f8e9dc00-4834-5ba7-9185-3b93ea3001f1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$varfor-legerar-man-stal-namn-minst-tva$kuggfri$, $kuggfri$Varför legerar man stål? Nämn minst två anledningar.$kuggfri$, $kuggfri$Man legerar stål för att öka hållfastheten eller tilldela det ytterligare egenskaper! Några exempel på detta är ökad härdbarhet och bättre högtemperatursegenskaper. Om man legerar stålet med krom (Cr) får man ett kromoxidskikt på ytan av det färdiga materialet som innebär korrosionsmotstånd (rostfritt stål).$kuggfri$, null, 62, true, $kuggfri$c09f7f808$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('63539781-4cc7-5fa0-b1cc-2f71d7545490', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-kannetecknar-underkategorin$kuggfri$, $kuggfri$Vad kännetecknar underkategorin: "Konstruktionsstål"?$kuggfri$, $kuggfri$* Kolhalt: < 0.25%

Konstruktionsstål kan delas in i två grupper; Kolstål och HSLA (High Strength Low Alloy)-steels, där låg kolhalt definieras som < 0.25%. Båda är svetsbara men kan ej härdas. Kolstål är billigt och används i exempelvis byggnader eller skepp. HSLA tillverkas mha en termomekanisk process som ger fin mikrostruktur och således hög sträckgräns. Används till exempel i fordonsplåtar och broar.$kuggfri$, null, 63, true, $kuggfri$c09eadd4a$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('97a3f631-75e9-5e4d-bda7-23035aa7f102', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-kannetecknar-underkategorin-2$kuggfri$, $kuggfri$Vad kännetecknar underkategorin: "Maskinstål"?$kuggfri$, $kuggfri$* Kolhalt: 0.25-0.75 %

Maskinstål kan härdas och är legerat för att öka härdbarheten. Dock är det svårare att svetsa än exempelvis konstruktionsstål. Exempel på användningsområden är järnvägsräls, handverktyg, maskindelar etc.$kuggfri$, null, 64, true, $kuggfri$c6c4e70ed$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('1021c448-1f6f-58eb-8cfc-b6b301f1aa6b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-kannetecknar-underkategorin-3$kuggfri$, $kuggfri$Vad kännetecknar underkategorin: "Verktygsstål"?$kuggfri$, $kuggfri$* Kolhalt: 0.5-1.7 % C

Verktygsstål är legerat för att erhålla stabila karbider vid hög temperatur. Används i exempelvis gjutformar, pressverktyg, skärverktyg och kullager.$kuggfri$, null, 65, true, $kuggfri$c647a9d64$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('787e3a63-a165-5f3f-85c8-ac86e07302bf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-kannetecknar-underkategorin-4$kuggfri$, $kuggfri$Vad kännetecknar underkategorin: "Rostfritt stål"?$kuggfri$, $kuggfri$Legeras med Cr för att få ett kromoxidskikt på ytan → korrosionsskydd

* Ni, stabiliserar austenit vid rumstemperatur
* Tre typer: ferritiska (billiga), austenitiska (bäst korrosionsmotstånd, lågtemperaturegenskaper), martensitiska (kan härdas)$kuggfri$, null, 66, true, $kuggfri$cc3d58592$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('87e465c8-9701-5028-b0ea-a8a44b73122a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-innebar-kalldeformation$kuggfri$, $kuggfri$Vad innebär kalldeformation?$kuggfri$, $kuggfri$Kallbearbetning, även känt som deformationshärdning eller kalldeformation, är en process som stärker metall genom plastisk deformation som exempelvis kallvalsning och tråddragning.

Mycket högre dislokationsdensitet efter
kallbearbetning → högre sträckgräns
(deformationshärdning)$kuggfri$, null, 67, true, $kuggfri$ca7c2ae88$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('ce391e59-9f19-59e1-b08f-c877fba14f51', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-innebar-rekristallation$kuggfri$, $kuggfri$Vad innebär rekristallation?$kuggfri$, $kuggfri$Rekristallation är en process inom metallbearbetning där en deformerad metall omstrukturerar sin inre kristallstruktur för att minska spänningar och återställa dess ursprungliga egenskaper. När metallen deformeras plastiskt, till exempel genom valsning eller smidning, blir dess kristallstruktur och dislokationer störda, vilket leder till hårdare och sprödare egenskaper (detta kallas kallbearbetning).
Rekristallation sker när en deformerad metall värms upp till en specifik temperatur, kallad rekristallationstemperaturen. Vid denna temperatur börjar nya, icke-deformerade korn att bildas inuti materialet. Dessa nya korn ersätter de gamla, deformerade kornen och bidrar till att:

* Sänka metallens hårdhet och öka dess duktilitet – metallen blir mjukare och mer formbar.
* Minska inre spänningar – som byggts upp under deformationen.
* Förbättra materialets struktur – den får en jämnare och mer homogen kornstruktur.$kuggfri$, null, 68, true, $kuggfri$c1c9af1db$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('4318305f-f0ff-5d20-a30b-5400f1b1e1a3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-innebar-varmdeformation$kuggfri$, $kuggfri$Vad innebär varmdeformation?$kuggfri$, $kuggfri$Varmdeformation är en process där metaller deformeras vid temperaturer som är högre än deras rekristallationstemperatur (ofta över cirka 0,5 gånger smälttemperaturen i kelvin). Vid dessa temperaturer kan metallens kristallstruktur rekonstrueras samtidigt som deformationen sker, vilket gör att nya korn kan bildas kontinuerligt under bearbetningen. Detta innebär att materialet inte härdas, och det behåller sin duktilitet och formbarhet. Varmdeformation används ofta för stora formändringar, exempelvis vid smidning och valsning i höga temperaturer.

Kortfattat:

* Ger deformation utan att höja sträckgänsen
* Stora deformationer är möjliga$kuggfri$, null, 69, true, $kuggfri$c222c5c9b$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('04a05efb-e55c-5270-8122-0b1ac989b140', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$beskriv-kortfattat-vad-skillnaden$kuggfri$, $kuggfri$Beskriv kortfattat vad skillnaden mellan kall- och varmdeformation är.$kuggfri$, $kuggfri$Skillnader kortfattat:

* Varmdeformation: Hög temperatur, inga spänningar byggs upp, materialet behåller sin formbarhet och stora dimensionsändringar kan ske under en och samma behandling.
* Kalldeformation: Låg temperatur, spänningar och hårdhet ökar, materialet blir starkare men samtidigt sprödare.$kuggfri$, null, 70, true, $kuggfri$cdb10c5ee$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('16fb1c72-7d7a-5f85-8134-7aac280e17f9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$ge-exempel-pa-minst-tva-plastiska$kuggfri$, $kuggfri$Ge exempel på minst två plastiska formningsmetoder.$kuggfri$, $kuggfri$Exempel:

* Smide
* Valsning
* Pressning
* Tråddragning$kuggfri$, null, 71, true, $kuggfri$c8031b410$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('6f43d038-81cf-5128-a84d-8b8555e8f8e7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$redogor-for-vad-gjutning-innebar-for$kuggfri$, $kuggfri$Redogör för vad gjutning innebär för materialet och ge exempel på minst två gjutningsmetoder.$kuggfri$, $kuggfri$* Gjutstruktur – Olika struktur i
olika delar av gjutgodset
* Defekter – porer, sprickor
* Ofta något sämre mekaniska
egenskaper än valsade eller
smidda material

Exempel:

* Formgjutning
(högt och lågt tryck)
* Sandgjutning
* Lost wax- casting$kuggfri$, null, 72, true, $kuggfri$cfe31cef5$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('2cd30d20-0100-53dd-bc85-68219f3627eb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$redogor-for-vad-svetsning-innebar-for$kuggfri$, $kuggfri$Redogör för vad svetsning innebär för materialet och ge exempel på minst två svetsmetoder.$kuggfri$, $kuggfri$* Svets där materialet har smält och
stelnat – gjutstruktur
* Värmepåverkad zon (HAZ) –
förändrad mikrostruktur,
korntillväxt, förändrad härdning
* Ofta sprickor

Ex: TIG/MIG/MAG$kuggfri$, null, 73, true, $kuggfri$cd7c1190e$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('42cd2906-dbe4-574a-95b4-939dbae3d88c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-hander-med-material-nar$kuggfri$, $kuggfri$Vad händer med material när temperaturen höjs?$kuggfri$, $kuggfri$* Atomerna börjar vibrera
* Atombindningarna blir svagare
* Atomerna rör sig lättare (diffusion)
* Fasomvandlingar
* Kemiska reaktioner$kuggfri$, null, 74, true, $kuggfri$c2c3861d7$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('4e2ac4fa-a0d0-54ee-9c03-80217a77bd04', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$beskriv-utforligt-vad-smalttemperatur$kuggfri$, $kuggfri$Beskriv utförligt vad smälttemperatur och glasomvandlingstemperatur är och vilka material respektive är relevant för.$kuggfri$, $kuggfri$Smälttemperatur:

* Kristallina material
* Metaller, keramer
* Går från fast till "lågviskös"
vätska vid smälttemperaturen, "Tm"

Glasomvandlingstemperatur

* Amorfa material
* Termoplaster, glas
* Gradvis övergång från fast till "viskös" vid
glasomvandlingstemperaturen "Tg".$kuggfri$, null, 75, true, $kuggfri$ce6204954$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('e7f65988-e404-597e-8ffe-eb9835e1a120', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-definierar-ett-materials-relevanta$kuggfri$, $kuggfri$Vad definierar ett materials relevanta användningstemperatur?$kuggfri$, $kuggfri$Maximal användningstemperatur begränsas
t.ex. av:

* Försämrade mekaniska egenskaper
* Fasomvandlingar och kemiska förändringar
* Oxidation

Minimal användningstemperatur
begränsas t.ex. av:

* Sprödhet$kuggfri$, null, 76, true, $kuggfri$c887d6ae8$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('c455cea6-92aa-5e5b-8caa-56330ef26788', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$beskriv-vad-ett-materials-specifika$kuggfri$, $kuggfri$Beskriv vad ett materials specifika värmekapacitet innebär för materialet.$kuggfri$, $kuggfri$Värmekapacitet är ett mått på hur mycket energi som krävs för att höja temperaturen i ett material.$kuggfri$, null, 77, true, $kuggfri$cb091c694$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('dd31f06f-87e6-5917-b386-e6757657c8cb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-ar-termisk-utvidgning-respektive$kuggfri$, $kuggfri$Vad är termisk utvidgning respektive termiska spänningar?$kuggfri$, $kuggfri$När temperaturen ökar i ett material uppstår "Termisk utvidgning/töjning" (procentuella förlängningen/utvidgningen av materialet) och "Termiska gradienter" (storleken och riktningen av utvidgningen på vektorform) eftersom materialet expanderar. Den termiska utvidgningen är proportionell mot temperaturskillnaden*temperaturutvidgningskoefficienten alpha enl: $\varepsilon_T = \alpha\,(T - T_0)$.

Termiska spänningar är de spänningar som uppstår till följd av att:

* Olika material fogas samman under temperaturförändring
* Termisk utvidgning ger upphov till termiska gradienter

Detta resulterar sammantaget i "Termisk utmattning" över tid.$kuggfri$, null, 78, true, $kuggfri$c45fa9606$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('66a397bd-fb7c-5288-af49-d83c48ac3e8b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-har-atombindningar-med-termisk$kuggfri$, $kuggfri$Vad har atombindningar med termisk utvidgning att göra?$kuggfri$, $kuggfri$Den termiska utvidgningen är proportionell mot temperaturskillnaden*temperaturutvidgningskoefficienten alpha enl $\varepsilon_T = \alpha\,(T - T_0)$.

Svaga atombindningar ger stor termisk utvidgning och eftersom styrkan hos atombindningarna beror på temperaturen gör också den termiska utvidningskoefficienten det!$kuggfri$, null, 79, true, $kuggfri$c69458d72$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('612ccd11-7365-5b5f-adc2-520a883bccf1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vilka-faktorer-ar-avgorande-for-ett$kuggfri$, $kuggfri$Vilka faktorer är avgörande för ett materials termiska ledningsförmåga?$kuggfri$, $kuggfri$Temperatur fördelas med hjälp av nedanstående mekanismer:

* Kristallvibrationer (fononer)
* Elektroner

Kristallvibrationer och elektroner överför energi från område med hög temperatur till område med låg energi! Metaller har därför väldigt bra termisk ledningsförmåga exempelvis (till följd av elektronmoln).

* Fononer = kristallvibrationer
(vågor/partiklar)
* Fononerna sprids i materialet
* Hindras och sprids på
kristallstörningar

Notera särskilt att:

* Rena legeringar har bäst termisk
ledningsförmåga
* Dislokationer, inlösta atomer och
utskiljningar hindrar/sprider
fononerna → lägre
värmeledningsförmåga$kuggfri$, null, 80, true, $kuggfri$c666aef98$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('7b0b11c5-e7d0-5cdb-9636-62bbd41a124e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$beskriv-kort-vad-varmeflode-ar-och-hur$kuggfri$, $kuggfri$Beskriv kort vad värmeflöde är och hur det beräknas$kuggfri$, $kuggfri$Värmeflödet i ett material är proportionellt mot den partiella derivatan av temperaturen med avseende på avståndet från ytan. Temperaturförändringen över tid är istället proportionellt mot andraterivatan av temperaturen med avseende på avståndet  från ytan.

Beräkningen av värmeflöde och värmeledning tillhör området "Termodynamik" och är inget vi har gått närmare in på i kursen.$kuggfri$, null, 81, true, $kuggfri$cd488d3f0$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('40372cb8-24a4-5720-9294-3325e3b400fd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-ar-diffusion$kuggfri$, $kuggfri$Vad är diffusion?$kuggfri$, $kuggfri$Diffusion är den spontana spridningsprocess som äger rum när något, oftast gaser eller vätskor, med en egenskap skilt från omgivningen sprids, blandas och jämnas ut. I fallet av temperaturspridning är diffusion och diffusionshastighet mått på hur temperaturen tillåts fördelas i materialet över tid. Notera särskilt att:

* Diffusionshastigheten ökar exponentiellt
med temperaturen
* Beror på vilken atom som rör sig i vilken
kristall$kuggfri$, null, 82, true, $kuggfri$cf7a5f29c$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('7304b2bd-fdea-5abb-a6ea-26586c4eabf9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vilka-ar-ficks-1-a-och-2-a-lag$kuggfri$, $kuggfri$Vilka är Ficks 1:a och 2:a lag?$kuggfri$, $kuggfri$Ficks lagar beskriver allmänt hur diffusion beter sig i ett material, det behöver nödvändigtvis inte vara relaterat till temperatur.

Fick's 1:a lag beskriver hur flödet (J) är proportionellt mot den partiella derivatan av koncentrationen och Fick's 2:a beskriver hur den partiella derivatan av koncentrationen med avseende på tiden är proportionell mot andraderivatan av koncentrationen.

Man får en uppsättning partiella differentialekvationer som bäst löses numeriskt.$kuggfri$, null, 83, true, $kuggfri$c45b5737a$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('461261dc-a5f2-5329-b11d-66bcc119e764', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-ar-krypning-vad-finns-det-for-olika$kuggfri$, $kuggfri$Vad är krypning? Vad finns det för olika typer av krypning?$kuggfri$, $kuggfri$* Krypning sker vid över cirka ½ av smälttemperaturen
* Ger plastisk (permanent) deformation
* Två typer:
  - Diffusionskrypning
  - Dislokationskrypning

* Primär krypning = snabb deformation tills dislokationer möter hinder
* Steady-state = krypning med konstant töjningshastighet
* Tertiär krypning = Skador i materialet

* Kryphastigheten beror på krypningsmekanism men är allmänt exponentiellt beroende av temperaturen
* Spänningen kan ändra krypmekanism$kuggfri$, null, 84, true, $kuggfri$cac921c50$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('c243a915-c6e2-5c03-af1c-d492dc7cec90', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$beskriv-narmare-vad-diffusionskrypning$kuggfri$, $kuggfri$Beskriv närmare vad diffusionskrypning är.$kuggfri$, $kuggfri$Diffusionskrypning:

* Förändring av kristallernas korn
m.h.a. diffusion
* Kornen förlängs i
belastningsriktningen$kuggfri$, null, 85, true, $kuggfri$c35af14ee$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('90041ba4-0b37-5e7b-bfe3-f589755386f3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$beskriv-narmare-vad-dislokationskrypning$kuggfri$, $kuggfri$Beskriv närmare vad dislokationskrypning är.$kuggfri$, $kuggfri$Dislokationskrypning:

* Plastisk deformation m.h.a.
dislokationsrörelse
* Diffusion hjälper dislokationerna att
komma runt hinder$kuggfri$, null, 86, true, $kuggfri$cdb3ecf0f$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('f0ade95a-2159-538e-9fc9-7a71b74ba8c4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-ar-ett-krypbrott$kuggfri$, $kuggfri$Vad är ett krypbrott?$kuggfri$, $kuggfri$Krypbrott fås när det har
initierats porer som har tillväxt
till brott till följd av krypning.$kuggfri$, null, 87, true, $kuggfri$cb69a5534$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('acfeec12-ffff-579e-977d-1aa9cb574cd3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$vad-i-materialtillverkningsprocessen$kuggfri$, $kuggfri$Vad i materialtillverkningsprocessen kräver energi och vad innebär detta för miljön?$kuggfri$, $kuggfri$Energiintensiva processer:

* Energi för reducering av mineral till metall
* Övrig energi för tillverkning och formning, transport, användning. Kan minskas genom att återanvända värme.

Miljöbelastning:

* Ingrepp i naturen
* Utsläpp av CO₂
* Andra utsläpp och föroreningar
* CO₂ används som mått på miljöbelastning (carbon footprint)$kuggfri$, null, 88, true, $kuggfri$cbec4ba91$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('a5f96185-f3ee-560e-9cff-60712edba982', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hur-ateranvandningsbara-ar-egentligen$kuggfri$, $kuggfri$Hur återanvändningsbara är egentligen metaller? Vad finns det för utmaningar med det?$kuggfri$, $kuggfri$* Metallskrot är en utmärkt råvara för metalltillverkning
* Kräver mindre energi än tillverkning från malm: 1/10 för Al och 1/3 för stål
* Ger mindre miljöbelastning
* Metall tillverkad från skrot har samma egenskaper som metall tillverkad från mineral

Utmaningar:

* Legeringshalten måste kontrolleras – problem med blandat skrot och metallföroreningar
* Koppar och tenn förstör stål
* Fe försprödar Al
* Bly, kadmium och kvicksilver är ofta oönskat i
legeringar
* Skrotet måste samlas in, transporteras, sorteras$kuggfri$, null, 89, true, $kuggfri$cfaa45edd$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('6ef88389-170e-583b-a2ae-e3dc3e9e2f82', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hur-bra-ar-aluminium-sett-ur-ett$kuggfri$, $kuggfri$Hur bra är aluminium sett ur ett hållbarhetsperspektiv?$kuggfri$, $kuggfri$Aluminium:

* Det vanligaste grundämnet i jordskorpan
* Framställning av primäraluminium kräver mycket energi
* Mycket mindre energi krävs för återvinning → Lämpligt för produkter som kan återvinnas, mindre lämpligt för
produkter som inte kan återvinnas.

Problem med återvinning av aluminium

* Gjutlegeringar innehåller mycket Si, 8-14%
* Övriga legeringar (smideslegeringar) innehåller små mängder Si
* Förorenas av Fe → Blandat skrot kan bara användas i begränsade mängder för återvinning till smideslegeringar.$kuggfri$, null, 90, true, $kuggfri$c55d5b4e0$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('da15976c-ee6f-565e-9b8e-3c68a9d4267e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hur-bra-ar-stal-respektive-rostfritt$kuggfri$, $kuggfri$Hur bra är stål respektive rostfritt stål sett ur ett hållbarhetsperspektiv?$kuggfri$, $kuggfri$Stål:

* God tillgång i jordskorpan
* Relativt låg miljöbelastning per kg
* Hög hållfasthet i förhållande till miljöbelastning
* Korroderar, kräver ofta ytbehandling
* Höghållfasta stål kan användas i lättkonstruktioner

Rostfritt stål:

* Legering med järn, Cr (ca 18 %), Ni (ca 8 %), ev Mo (2 %)
* Tillgången av legeringsämne i jordskorpan är förhållandevis liten
* Legeringsämnena kan vara ohälsosamma och allergena i fri form.
Oftast inte bundna i rostfritt stål.
* Bra korrosionsmotstånd och livslängd. Bör återvinnas.$kuggfri$, null, 91, true, $kuggfri$cd9a049ce$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('5f8b0978-8f26-57e6-be83-caa802e2a03c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$vad-finns-det-for-problem-med$kuggfri$, $kuggfri$Vad finns det för problem med återvinningen av blandat skrot?$kuggfri$, $kuggfri$* Vid återanvändning av skrot är kontroll av legeringsämne ett problem
* Överflödiga legeringsämne och förorenande metaller kan vara eller är oekonomiska att ta bort
* Sorterat skrott är mer användbart och har högre värde$kuggfri$, null, 92, true, $kuggfri$cd0b4281b$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('8b76e766-64a5-5f1a-8d74-b664b0cff35d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$vad-ar-co-footprint-respektive-embodied$kuggfri$, $kuggfri$Vad är "CO₂- footprint" respektive "Embodied Energy"?$kuggfri$, $kuggfri$CO₂ footprint:

* Mängd CO₂ som bildas vid produktion av 1 kg material

För metaller:
- CO₂ bildas vid produktion av energi
- CO₂ bildas vid kemiska reaktioner vid reduktion av malm till metall

Embodied energy:

* Energin som krävs för att producera 1 kg av materialet

För metaller:
- Energi som krävs för reduktionsreaktionen
- Transport, värmning, processer$kuggfri$, null, 93, true, $kuggfri$ca150a3db$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('76812786-40c0-56b4-aafa-370453362126', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hur-ser-tillgangen-pa-metaller-i$kuggfri$, $kuggfri$Hur ser tillgången på metaller i jordskorpan ut?$kuggfri$, $kuggfri$* De vanligaste metallerna finns i stor omfattning i jordskorpan: Fe, Al, Mg, Ti
* Vissa legeringsämnen finns i begränsad mängd i jordskorpan
* 69 element räknas som strategiska eller kritiska: sällsynta
jordartsmetaller, platina-gruppen, fissionsämne (U, Th, Pu), W, Ta, Nb, Ga, In$kuggfri$, null, 94, true, $kuggfri$cea97cc39$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('6373f8d9-c953-5059-a85d-59b636e61cda', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$sammanfatta-lite-kort-hur-metaller$kuggfri$, $kuggfri$Sammanfatta lite kort hur metaller lämpar sig för återvinning.$kuggfri$, $kuggfri$* Metaller lämpar sig väl för återvinning
  - Sparar resurser och energi
  - Ger lika bra material
* Problem med föroreningar och legeringsämne
* CO₂ footprint och embodied energy ger viss
vägledning – kan användas i materialindex
* Bör titta på totala miljöbelastningen under
livscykeln$kuggfri$, null, 95, true, $kuggfri$c6876d717$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('d83e65a5-c7e8-5056-af99-d6be43aa4222', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6a606b07-da96-5efe-95d6-68de9be03181', $kuggfri$beskriv-stalets-tillverkningsprocess-i$kuggfri$, $kuggfri$Beskriv stålets tillverkningsprocess i grova mått.$kuggfri$, $kuggfri$* Utgångsmaterial: järnoxid
* Reduceras i masugn:
järnoxid + kol + energi → tackjärn + koloxid
* Kolhalten i tackjärnet justeras till rätt kolhalt, stålet legeras, skrot kan tillsättas
* Processen kräver energi
  - processenergi
  - energi till reducering (är konstant)
* Återvinning sparar energi och råvaror, ger mindre utsläpp av koldioxid

Därefter behandlas stålet:

* Färskning = kolhalten justeras
* Legering
* Kontinuerlig gjutning
* Varmvalsning
* Kallbearbetning
* Kallvalsning, tråddragning, m.m. → plåt, räls, balkar, stång, tråd$kuggfri$, null, 96, true, $kuggfri$c617ac648$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('29143e99-410b-5029-a80c-b4b741b849c0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6a606b07-da96-5efe-95d6-68de9be03181', $kuggfri$ge-minst-tva-exempel-pa$kuggfri$, $kuggfri$Ge minst två exempel på värmebehandlingar för stål.$kuggfri$, $kuggfri$* Normalisering: austenitisering + långsam kylning → primär ferrit eller cementit + perlit. Andel perlit ges av kolhalten. Ger ”normal” mikrostruktur, lämpligt för konstruktioner där styvheten är viktig.
* Mjukglödgning: värmning till temperatur under austenittemperatur (723 C) → diffusion och korntillväxt, sfäriodiserad perlit, lägre sträckgräns. Används för
stål som skall maskinbearbetas och därefter härdas.
* Martensithärdning:
1. Värmning till austenitområdet
2. Snabbskylning → martensit
3. Anlöpning → anlöpt martensit = ferrit med mycket små cementitpartiklar
Kolhalten avgör andelen cementit. Temperatur och tid för anlöpningen avgör storleken på cementitpartiklarna. Används när hårdhet och sträckgräns är viktigt.$kuggfri$, null, 97, true, $kuggfri$c96ee343a$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('d48867d7-f794-5d1c-8520-b18ff8a7f054', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6a606b07-da96-5efe-95d6-68de9be03181', $kuggfri$namn-minst-tva-produktionsmassiga$kuggfri$, $kuggfri$Nämn minst två produktionsmässiga anledningar till att man legerar stål.$kuggfri$, $kuggfri$Stål legeras bland annat för att:

* Öka hållfastheten – Genom att tillsätta legeringsämnen som nickel eller krom kan stålets styrka och hållfasthet förbättras.

* Förbättra korrosionsbeständigheten – Krom och nickel ökar stålets motståndskraft mot rost och korrosion, vilket är särskilt viktigt för rostfria stål.

* Förbättra hårdheten och slitstyrkan – Tillsatser som kol, mangan och vanadin gör stålet hårdare och mer motståndskraftigt mot slitage, vilket är fördelaktigt i verktygsstål.

* Höja duktiliteten och segheten – Vissa legeringsämnen, som nickel, kan öka segheten och duktiliteten, vilket gör stålet mindre sprött vid låga temperaturer.

* Förbättra värmebeständigheten – Legeringar med ämnen som molybden och volfram hjälper stålet att behålla sina egenskaper vid höga temperaturer, vilket är viktigt för verktygsstål och höglegerat stål.

* Förbättra härdbarheten – Legeringar med ämnen som krom och molybden ökar stålets förmåga att härdas djupt, vilket gör att materialet får en jämn hårdhet vid härdning.$kuggfri$, null, 98, true, $kuggfri$c2a985e81$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('3b75db4a-1061-5ff9-8d7b-e716bf614bf0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$vad-kannetecknar-aluminium$kuggfri$, $kuggfri$Vad kännetecknar Aluminium?$kuggfri$, $kuggfri$* Lägre vikt än stål, densiteten är 2,7 kg/dm3
* FCC struktur → god plastisk formbarhet
* God maskinbarhet
* God elektrisk- och värmeledning
* Korrosionsskydd: Al reagerar med O₂ och bildar ett
skyddande oxidskikt på ytan$kuggfri$, null, 99, true, $kuggfri$cc76c083d$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('ef2b31d6-ec9b-515d-b7fb-bc7a3776a9dc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$vad-kannetecknar-magnesium$kuggfri$, $kuggfri$Vad kännetecknar Magnesium?$kuggfri$, $kuggfri$* Låg densitet 1,8 kg/dm3
* HCP struktur → begränsad plastisk formbarhet
* God maskinbarhet
* God gjutbarhet, större delen används som gjutgods
* Bildar poröst oxidskikt, sämre korrosionsskydd
* Brännbart – men bara som pulver eller tunn plåt
* Energikrävande produktion$kuggfri$, null, 100, true, $kuggfri$c80d640a8$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('9b03ecd8-4974-5c17-942b-5a4cef3f2271', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$vad-kannetecknar-titan$kuggfri$, $kuggfri$Vad kännetecknar Titan?$kuggfri$, $kuggfri$* Medel densitet 4,1 kg/dm3
* Utmärkt hållfasthet
* Utmärkt korrosionsskydd
* Dyrt på grund av tillverkningsprocessen
* Används i ren form eller legerat
* Titan är den enda metallen som är biokompatibel (inte är
negativ för kroppen)$kuggfri$, null, 101, true, $kuggfri$c73c82934$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('8ebec9f1-1a10-5584-8632-c04eaa66a0cc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$vad-kannetecknar-koppar-och-dess$kuggfri$, $kuggfri$Vad kännetecknar Koppar och dess legeringar?$kuggfri$, $kuggfri$* Hög densitet 8,9 kg/dm3
* Koppar: Utmärkt formbarhet, hög elektrisk och termisk
ledningsförmåga, pris=50 SEK/kg
* Mässing: legerat med 5-40 % Zn, bra form- och maskinbarhet.
* Brons: legerat med 5-25 % Sn, bra hållfasthet men lite
duktilitet, gjuts ofta
* Lagerbrons har bra tribologiska egenskaper$kuggfri$, null, 102, true, $kuggfri$cef6a5bdc$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('5ce3fa31-862d-55e9-a2ff-d4e5d50e41de', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$vad-kannetecknar-nickel-och-sa-kallade$kuggfri$, $kuggfri$Vad kännetecknar Nickel- och så kallade superlegeringar?$kuggfri$, $kuggfri$* Medel densitet 7,9-8,7 kg/dm3
* E-modul: 200-220 GPa
* Sträckgräns: 272-900 MPa
* Brottseghet: 127-251 $\text{MPa}\sqrt{\text{m}}$
* Användningstemperatur: -273-1040 C
* Carbon footprint: 13 kg/kg
* Pris: 150 SEK/kg (för superlegeringar)
* Exceptionella högtemperatur- egenskaper med god
oxidations och korrosionsegenskaper
* Legeras med Cr, Co, Al, Ti Mo,
Zr, Fe, Hf$kuggfri$, null, 103, true, $kuggfri$ce0b76d48$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('ba1b61a0-ef02-5e39-9723-449237f645f9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$varfor-anvander-man-inte-alltid-stal$kuggfri$, $kuggfri$Varför använder man inte alltid stål eftersom det är billigast?$kuggfri$, $kuggfri$Stål har bra mekaniska egenskaper, låg miljöbelastning per kilo och återfinns i många olika varianter för olika användningsområden till det billigaste priset, men aluminium har lägre densitet, fortfarande bra pris, är lättbearbetat och har bra naturligt korrosionsskydd.

Stål är bra, men i vissa situationer väljs andra material för att deras speciella egenskaper gör de särskilt fördelaktiga.$kuggfri$, null, 104, true, $kuggfri$ca3b5d2aa$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('35410586-b689-51cf-b5f3-b1f791bf2152', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$aldring$kuggfri$, $kuggfri$Åldring$kuggfri$, $kuggfri$Åldring av metaller (eller åldringshärdning) är en process där metallens mikrostruktur och egenskaper förändras över tid, antingen genom naturlig åldring vid rumstemperatur eller genom en kontrollerad värmebehandling som kallas artificiell åldring. Åldring används ofta för att förbättra mekaniska egenskaper som hårdhet och hållfasthet i metallegeringar, särskilt aluminium-, titan- och nickelbaserade legeringar.$kuggfri$, null, 105, true, $kuggfri$c9fd6ad8e$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('4a90b17b-5925-5e27-9d4a-1c775d3725af', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$brottforlangning$kuggfri$, $kuggfri$Brottförlängning$kuggfri$, $kuggfri$Den plastiska förlängningen som kvarstår efter ett material har belastats till brott.$kuggfri$, null, 106, true, $kuggfri$c3378edc0$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('0d934389-0908-50df-8ec9-5474b9faa25d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$keram$kuggfri$, $kuggfri$Keram$kuggfri$, $kuggfri$Ett material som är uppbyggt av en metall och en icke-metall (minst).$kuggfri$, null, 107, true, $kuggfri$cc2bc6859$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('6a417f80-0c34-5ad4-89f5-90a0c4e7963c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$co-foot-print$kuggfri$, $kuggfri$CO₂-foot print$kuggfri$, $kuggfri$Den mängd CO₂ som bildas vid produktion av ett kilo material.$kuggfri$, null, 108, true, $kuggfri$ce4b54976$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('fa1984b2-f558-570c-a331-a604f2b4d29c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$anisotropt$kuggfri$, $kuggfri$Anisotropt$kuggfri$, $kuggfri$Olika egenskaper i olika riktningar$kuggfri$, null, 109, true, $kuggfri$cccb59510$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('a07dfcae-611f-59ba-a558-0bb5070999d1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ttt-diagram$kuggfri$, $kuggfri$TTT-diagram$kuggfri$, $kuggfri$Ett diagram som visar fastransformationer vid svalning som funktion av tid och
temperatur.$kuggfri$, null, 110, true, $kuggfri$cb074c9e7$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('a2697d01-2f97-5e6b-ba82-dc00af47da4a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$krypning$kuggfri$, $kuggfri$Krypning$kuggfri$, $kuggfri$Långsam plastisk deformation som beror på temperatur, tid och last. Sker vid temperaturer över halva smälttemperaturen i K, och töjningshastigheten ökar exponentiellt med
temperaturen.$kuggfri$, null, 111, true, $kuggfri$c1047d9ba$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('99cb64e2-2ad5-5bf6-a9cf-01fdd9571678', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$brottseghet$kuggfri$, $kuggfri$Brottseghet$kuggfri$, $kuggfri$Ett mått på materialets seghet, hur mycket energi som behövs för att driva en
spricka. Brott fås när spänningsintensiteten vid sprickspetsen är högre än brottsegheten.$kuggfri$, null, 112, true, $kuggfri$c3d54b3e0$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('95ce58de-0758-5300-b2da-cfeda7f1e9dd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$hogcykelutmattning$kuggfri$, $kuggfri$Högcykelutmattning$kuggfri$, $kuggfri$Utmattning är brott som uppkommer vid cyklisk belastning. Vid högcykelutmattning är belastningen under sträckgränsen, och materialet plasticerar bara lokalt
vid sprickspetsen, vilket ger ett stort antal cykler till brott.$kuggfri$, null, 113, true, $kuggfri$c75b3de99$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('ec0cbb3f-b72d-511a-a44b-4f2de7843737', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$aktiveringsenergi$kuggfri$, $kuggfri$Aktiveringsenergi$kuggfri$, $kuggfri$Den energibarriär som måste övervinnas m.h.a. termisk energi för att vissa processer skall kunna
ske, t.ex. kemiska reaktioner, diffusion, krypning.$kuggfri$, null, 114, true, $kuggfri$c2b59206b$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('8c55cc97-bd3e-51dd-99fa-c4487047393e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$specifik-varmekapacitet$kuggfri$, $kuggfri$Specifik värmekapacitet$kuggfri$, $kuggfri$Värmekapacitet är den mängd energi som krävs för att höja temperaturen med en grad Kelvin i en viss mängd material.
Specifik värmekapacitet är den mängd energi som går åt för att värma upp specifikt ett kilogram av ämnet.$kuggfri$, null, 115, true, $kuggfri$cbfff992d$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('57418a68-f6a4-50bb-9f40-1b3abe8fd4e8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$diffusionskoefficient$kuggfri$, $kuggfri$Diffusionskoefficient$kuggfri$, $kuggfri$Ett mått på hur snabbt atomer rör sig (diffunderar) i ett material. Beror på temperaturen och vilka atomer som diffunderar, och i vilket material.$kuggfri$, null, 116, true, $kuggfri$c4109306c$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('3b439075-5235-5d41-804f-c8306d0daaf4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$metastabil$kuggfri$, $kuggfri$Metastabil$kuggfri$, $kuggfri$Ett tillstånd i ett lokalt energiminimum. För att uppnå tillståndet med lägst energi (stabilt) måste en energibarriär övervinnas genom tillförsel av termisk energi. Fasen har högre Gibbs fria energi men antar spontant inte den mer stabila fasen.$kuggfri$, null, 117, true, $kuggfri$c338116fa$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('7c74f111-e32c-5294-a214-27bd32c6695f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$intermetall$kuggfri$, $kuggfri$Intermetall$kuggfri$, $kuggfri$En fas bestående av minst två metaller som finns mellan två metaller i fasdiagrammet.$kuggfri$, null, 118, true, $kuggfri$ce8517b5f$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('3d74f292-698d-5b70-8b4a-61d1b81dc3a1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$adhesiv-forslitning$kuggfri$, $kuggfri$Adhesiv förslitning$kuggfri$, $kuggfri$Vid nötningen binds materialen samman med atomära bindningar, och material rycks bort när ytorna glider mot varandra. De två materialen svetsas punktvis samman, och slits isär.$kuggfri$, null, 119, true, $kuggfri$c2c53cfa7$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('aec8731f-4b78-5bd7-82c7-91d8f13fa20b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$slagseghet$kuggfri$, $kuggfri$Slagseghet$kuggfri$, $kuggfri$Den energi som går åt för att slå av en anvisad provstav. Ett mått på hur segt eller sprött materialet är.$kuggfri$, null, 120, true, $kuggfri$c0925b3cf$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('c3c66c32-5ded-5101-8c9e-271dc8f5b15b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$styvhet$kuggfri$, $kuggfri$Styvhet$kuggfri$, $kuggfri$Ett mått på hur mycket ett material deformeras elastiskt när det utsätts för en last.$kuggfri$, null, 121, true, $kuggfri$c59041a7a$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('33f94e1a-b83d-5559-8184-a4a14ee15928', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$eutektikum$kuggfri$, $kuggfri$Eutektikum$kuggfri$, $kuggfri$En strukturbeståndsdel som består av två faser. Eutektikum bildas vid konstant temperatur
och koncentration genom en trefasreaktion där en smält fas L bildar två fasta faser: L → alpha + beta$kuggfri$, null, 122, true, $kuggfri$c43a75d5e$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('46a9fe24-7e1b-5258-b01f-6e1daf283cc8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$mjukglodgning$kuggfri$, $kuggfri$Mjukglödgning$kuggfri$, $kuggfri$En värmebehandling av stål där man får sfäriodiserad perlit, vilket ger ett material med lägre sträckgräns men som är lättare att maskinarbeta. Stålet värms upp till en temperatur under austenitiseringstemperaturen, och
diffusion ger sfäriodiserad cementit.$kuggfri$, null, 123, true, $kuggfri$c2e090194$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('eaa580ff-ee2d-5af3-b2b2-7bc74bd0971f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$kristallin$kuggfri$, $kuggfri$Kristallin$kuggfri$, $kuggfri$Atomer eller molekyler som sitter i en ordnad struktur.$kuggfri$, null, 124, true, $kuggfri$c56b92c75$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('f713be65-1239-5baa-8de6-e4180f688183', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$krypning-metaller$kuggfri$, $kuggfri$Krypning (metaller)$kuggfri$, $kuggfri$Plastisk deformation som beror på tid, temperatur och last.$kuggfri$, null, 125, true, $kuggfri$c435ab0eb$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('c5d3fc0c-c96d-53ef-812b-440f3f7dc952', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$abrasiv-forslitning$kuggfri$, $kuggfri$Abrasiv förslitning$kuggfri$, $kuggfri$Förslitning som fås när ett hårt material/medium avverkar ytan.$kuggfri$, null, 126, true, $kuggfri$c46c7c326$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('585b72a0-f107-5a46-9859-412f31526333', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$verktygsstal$kuggfri$, $kuggfri$Verktygsstål$kuggfri$, $kuggfri$Höglegerat stål med hög kolhalt. Används i härdat tillstånd. Hårt och värmetåligt.$kuggfri$, null, 127, true, $kuggfri$c5094ef64$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('957800a7-7c8a-5c24-9f39-dbdf80fe5599', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ja-nej-basta-sattet-att-oka-e-modulen$kuggfri$, $kuggfri$Ja/Nej: Bästa sättet att öka E-modulen är att värmebehandla (härda) metallen.$kuggfri$, $kuggfri$Nej, E-modulen (elasticitetsmodulen) är ett mått på ett materials styvhet och påverkas främst av materialets atomära bindningar. Värmebehandling, som härdning, förändrar inte de interatomära bindningarna i någon betydande utsträckning och därmed inte E-modulen. Härdning påverkar främst materialets sträckgräns och hårdhet, inte dess styvhet.$kuggfri$, null, 128, true, $kuggfri$cd0469299$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('b4c5783f-d35b-52cf-a5df-727f449202b2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ja-nej-dislokationer-ar-lika-viktiga$kuggfri$, $kuggfri$Ja/Nej: Dislokationer är lika viktiga för ett materials E-modul som för sträckgränsen.$kuggfri$, $kuggfri$Nej, dislokationer påverkar främst materialets sträckgräns och duktilitet, eftersom de spelar en viktig roll i plastisk deformation. E-modulen bestäms däremot av de elastiska egenskaperna hos atomernas bindningar, och dislokationer har en försumbar effekt på den.$kuggfri$, null, 129, true, $kuggfri$c861e1f68$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('487cb6ba-20b9-586c-a857-b0e2025341c0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ja-nej-perlit-bildas-vid-en-eutektisk$kuggfri$, $kuggfri$Ja/Nej: Perlit bildas vid en eutektisk reaktion från smälta.$kuggfri$, $kuggfri$Nej, perlit bildas inte vid en eutektisk reaktion, utan vid en eutektoidisk reaktion. I stål sker denna reaktion vid ca 727°C då austenit (en fast lösning) omvandlas till en blandning av ferrit och cementit (perlit), inte från smälta.$kuggfri$, null, 130, true, $kuggfri$c058616b6$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('1a8920c7-444e-55dd-a0d3-e2b9fc75f32f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ja-nej-malet-med-utskiljningshardning$kuggfri$, $kuggfri$Ja/Nej: Målet med utskiljningshärdning är att få bort dislokationerna.$kuggfri$, $kuggfri$Nej, utskiljningshärdning syftar inte till att ta bort dislokationer, utan till att skapa små partiklar (utskiljningar) som hindrar dislokationsrörelser. Detta gör materialet starkare eftersom dislokationerna har svårare att röra sig genom materialet, vilket ökar sträckgränsen och hårdheten.$kuggfri$, null, 131, true, $kuggfri$c1e42cb58$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('ba88eb7f-d3db-5349-ab49-7b8c7aeffce9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ja-nej-omslagstemperatur-finns-hos$kuggfri$, $kuggfri$Ja/Nej: Omslagstemperatur finns hos vanligt stål men inte hos aluminium och rostfritt stål.$kuggfri$, $kuggfri$Ja, vanligt stål har en omslagstemperatur, där materialet övergår från att vara duktilt vid högre temperaturer till att bli sprött vid lägre temperaturer. Aluminium och de flesta rostfria stål har dock inte denna sprödbrottsegenskap eftersom de behåller sin duktilitet vid låga temperaturer.$kuggfri$, null, 132, true, $kuggfri$cbf196fb5$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('fa0f6670-4e74-5d91-aec7-552d8f350dd5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ja-nej-utmattningsgransen-ar-antalet$kuggfri$, $kuggfri$Ja/Nej: Utmattningsgränsen är antalet cykler till brott vid en viss spänning.$kuggfri$, $kuggfri$Nej, utmattningsgränsen är inte antalet cykler till brott, utan den maximala spänningsnivån som ett material kan utsättas för ett oändligt antal cykler utan att gå sönder. Antalet cykler till brott vid en viss spänning kallas istället utmattningslivslängd.$kuggfri$, null, 133, true, $kuggfri$c36e9f87f$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('8fb71a02-bb47-524d-9d58-e83dcd056a5d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ja-nej-krypning-ar-ett-fenomen-som-bara$kuggfri$, $kuggfri$Ja/Nej: Krypning är ett fenomen som bara uppstår vid höga temperaturer.$kuggfri$, $kuggfri$Ja, krypning är en deformation som sker över tid under konstant belastning och hög temperatur. För de flesta metaller uppträder krypning bara vid temperaturer över ungefär 0,4 gånger deras smälttemperatur (i Kelvin).$kuggfri$, null, 134, true, $kuggfri$cc0197e82$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('843de66d-7d6a-5be1-91b9-d310fa20cd83', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ja-nej-nar-ett-material-varmvalsas-sa$kuggfri$, $kuggfri$Ja/Nej: När ett material varmvalsas så ökar sträckgränsen.$kuggfri$, $kuggfri$Nej, vid varmvalsning sker processen vid höga temperaturer, där rekristallisation kan inträffa. Detta leder till att dislokationer kan "läkas", vilket innebär att materialet inte blir starkare. Sträckgränsen ökar snarare vid kallbearbetning, där dislokationsdensiteten ökar.$kuggfri$, null, 135, true, $kuggfri$c12e7087d$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('44fded3b-b47b-5b74-9495-07fbb279c6d9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ja-nej-sproda-brott-foljer-alltid$kuggfri$, $kuggfri$Ja/Nej: Spröda brott följer alltid korngränserna.$kuggfri$, $kuggfri$Nej, spröda brott kan vara både interkristallina (följer korngränserna) och transkristallina (går genom kornen). Det beror på materialets struktur och de förhållanden under vilka brottet sker.$kuggfri$, null, 136, true, $kuggfri$c6a17d782$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('d0618afe-bca0-547e-af97-57e89cc816bb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$ja-nej-i-stal-bildar-kol-cementit-men-i$kuggfri$, $kuggfri$Ja/Nej: I stål bildar kol cementit, men i gjutjärn förekommer kolet som ren grafit.$kuggfri$, $kuggfri$Ja, i stål bildar kol cementit (Fe₃C), en hård och spröd fas. I gjutjärn bildas istället grafit, som är ren kol i form av flingor eller klot beroende på gjutjärnets typ, vilket ger det unika egenskaper som skiljer det från stål.$kuggfri$, null, 137, true, $kuggfri$cd17970e0$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('6675b4ec-52ec-55b3-b2a8-2df1ebeb4a6f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$loslighetsgrans$kuggfri$, $kuggfri$Löslighetsgräns$kuggfri$, $kuggfri$Den högsta koncentration av ett ämne som kan lösas i en fas.$kuggfri$, null, 138, true, $kuggfri$c4eaf4bf6$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('7ff14f04-381a-5fd9-901a-f51881b05291', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$utmattningsgrans$kuggfri$, $kuggfri$Utmattningsgräns$kuggfri$, $kuggfri$Den spänning under vilken inte utmattning sker.$kuggfri$, null, 139, true, $kuggfri$c21bbb14b$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('41b15a13-a92a-5380-bc10-a0719221fd31', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$segt-brott$kuggfri$, $kuggfri$Segt brott$kuggfri$, $kuggfri$Ett brott som föregås av mycket plasticering. Lång töjning innan brott sker med andra ord.$kuggfri$, null, 140, true, $kuggfri$c33e4b139$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('825a6b52-8e29-547f-886a-75b54524f3d6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$strukturbestandsdel$kuggfri$, $kuggfri$Strukturbeståndsdel$kuggfri$, $kuggfri$En urskiljbar del av materialet som består av en eller flera faser och kan ses som en enhet på
något sätt. Kan vara en fas, eutektikum eller eutektoid.$kuggfri$, null, 141, true, $kuggfri$c337411e9$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('2966162f-6239-561d-997b-f65d8642ef18', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$fas$kuggfri$, $kuggfri$Fas$kuggfri$, $kuggfri$En del av materialet med homogena fysikaliska och kemiska egenskaper$kuggfri$, null, 142, true, $kuggfri$cf31ec049$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash) values ('22b91be4-1d32-5d02-b3ec-d2f57e5208a0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'bfff339c-3a73-562e-b919-e03c3b7521e8', $kuggfri$superlegering$kuggfri$, $kuggfri$Superlegering$kuggfri$, $kuggfri$Vanligtvis legeringar med Ni-bas som har excellenta högtemperaturegenskaper, oxidations- och korrosionsmotstånd.$kuggfri$, null, 143, true, $kuggfri$c52e0f5b9$kuggfri$);

commit;
