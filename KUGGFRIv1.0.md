# Kuggfri v1.0 — vad som hänt sedan demon

**v0** är det Johan Ahlström fick se torsdag 17 september, och det som ligger på kuggfri.com just nu.
**v1.0** är det som deployas inför tisdagens presentation.

Mellan dem ligger 50 commits, 181 filer, ungefär 15 700 tillagda rader och nio databasmigrationer.
Antalet kort är detsamma — 144 stycken i elva kategorier. Det som ändrats är nästan allt runt dem.

---

## Kort version

Demon visade att flashcards med ett vetenskapligt schema fungerar. v1.0 är samma idé byggd för att
faktiskt tåla en hel årskurs: **doserad så att den inte skrämmer bort någon dag ett**, med
återkopplingen en examinator behöver, och med säkerhet, dataskydd och återställning på plats.

---

## Det studenterna märker

### Första passet är 20 kort, inte 144

Den största förändringen, och den som kom ur omvärldsanalysen. I demon mötte en ny student hela
kursen på en gång. Nu doseras nya kort: **20 per dag** som standard, valbart 10, 20 eller 40, och
förfallna repetitioner tillkommer ovanpå. Första besöket säger rakt ut vad som väntar: *"Första
passet är 20 kort, cirka 5 minuter."*

### En tydlig slutpunkt

Passet tar slut. Rutan **"Klar för i dag"** visar dagens repetitioner, hur många kort du kan just nu
och din svit — och erbjuder att ta fler nya kort om du vill, i stället för att bara fortsätta i
oändlighet. Det är skillnaden mellan en app man blir klar med och en man ger upp inför.

### Svit med frysningar

Sviten räknar aktiva dagar, men du får **två frysningar** och en ny per sju aktiva dagar. En missad
dag mitt i tentaveckan nollställer alltså inte allt. Du kan också ställa in att bara vardagar räknas.

### Provtenta

Nytt läge: **30 slumpade kort ur ditt urval, utan ledtrådar och utan att gå tillbaka**. Påverkar inte
schemat, utan visar hur du ligger till i procent. Det närmaste en generalrepetition.

### Tentadatum styr schemat

Sätts ett tentadatum får kursen en nedräkning, och schemat anpassar sig: inget kort schemaläggs
bortom tentan, takten på nya kort höjs automatiskt om du inte hinner introducera allt i tid — och
det syns öppet med hur många per dag som krävs. De sista två dagarna byter läget till
**slutrepetition**: hela urvalet, svagast först.

*(Funktionen är på plats och testad men vilande tills Johans datum är satt.)*

### Skattningarna överlever dålig uppkoppling

Pluggar du på spårvagnen och tappar nätet läggs skattningen i en **utkorg** och skickas när
uppkopplingen kommer tillbaka. Tidigare kunde den försvinna. Du ser hur många som väntar.

### "Kan nu" per kategori

Utöver *studerade* och *inlärda* visas nu en uppskattning av hur mycket du faktiskt kommer ihåg just
nu, räknat på FSRS återkallelsesannolikhet. Den visas först när kategorin har minst tre studerade
kort, så att siffran betyder något.

### Kalibrering: säkert men fel

Vänder du kortet snabbt och skattar lågt får du en tydligare markering och lite längre tid innan
nästa kort. Det är ögonblicket då man upptäcker att man trodde man kunde något — det är värt en
paus, inte ett snabbt klick vidare.

### Glömt lösenord

Fanns inte i demon. Nu finns återställning via mejl, och länken fungerar på vilken enhet som helst.

### Dela kursen

Kopiera länk och **QR-kod** direkt på kurssidan — tänkt för att visas på en projektorduk. Och när
någon klistrar in länken i en gruppchatt visas numera ett **flashcard med kursens namn, kurskod och
kortantal** i stället för en tom ruta.

### Påminnelser, om du vill

Frivilligt dagligt mejl när du har kort att repetera. Avstängt som standard, skickas aldrig efter
tentan, och stängs av med ett klick.

### Mobilen

Klickytorna är gjorda för tummar: kategorikryssrutorna hade en träffyta på 16×16 px, nu 32×32 utan
att något ser annorlunda ut. Hela gränssnittet är genomgånget vid 375 och 768 px, i ljust och mörkt.

---

## Det Johan märker

### Veckobrev på måndagar

Ett mejl med veckans siffror: antal studenter, nya studenter, aktiva, repetitioner, snittskattning,
de svåraste kategorierna, de kluriga korten och öppna felrapporter. Han behöver inte logga in för
att veta hur det går.

### Kommer studenterna tillbaka?

Nytt aktiveringsmått: hur många som börjat, hur många som gjorde minst 20 kort första passet, och hur
många av dem som kom tillbaka inom tre dagar. Det är frågan som avgör om tjänsten används eller bara
provas.

### Anonymitetsgränsen ligger i databasen

Statistik per kort och kategori visas bara när minst **fem** studenter bidragit. I demon filtrerades
det i gränssnittet — vilket betyder att underlaget ändå skickades till webbläsaren. Nu filtreras det
innan det lämnar servern, och Johan ser i stället hur många kort som är dolda för att underlaget är
för litet.

### Examinatorer kan förberedas i förväg

En examinator kan bjudas in på sin adress innan kontot finns; behörigheten kopplas när adressen
bekräftas. Och den kan bara kopplas till en **bekräftad** adress — se säkerhetsavsnittet.

### Felrapporter

Studenten rapporterar fel direkt på kortet, Johan ser rapporten med kortets framsida, åtgärdar och
markerar den klar. Med tak mot spam.

---

## Under ytan

### Innehåll som kod

Kurserna ligger nu i versionshanterade markdownfiler med **stabila nycklar**. Tidigare härleddes
kortens identitet ur texten, vilket betydde att en rättad stavning kunde se ut som ett nytt kort och
ta studenternas progress med sig. Nu överlever progressen att både fram- och baksida skrivs om —
provkört mot databasen, med skattning, stabilitet och förfallodatum intakta.

Synken är trevägs: filerna föreslår, **admin vinner alltid**, och `pull` hämtar tillbaka det som
ändrats i gränssnittet. Du och Johan fortsätter alltså arbeta i tjänsten som vanligt; filerna är till
för att jag ska kunna navigera innehållet.

Borttagning kräver ett uttryckligt `--radera` — annars inaktiveras kortet bara.

### Säkerhet

Det allvarligaste fyndet under helgen: **med e-postbekräftelse avstängd räckte det att registrera ett
konto på examinatorns adress för att ärva hans behörighet till kursen.** Skyddet ligger nu i
databasen och kräver bekräftad adress oavsett vad som är inställt i dashboarden.

Dessutom: innehållspolicy med nonce (inga inline-skript), HSTS, inramning helt blockerad,
behörighetskontroller som håller även när man går direkt på databasen förbi gränssnittet, tak mot
spam i felrapporterna, och konstant-tidsjämförelse av hemligheterna till cron-ändpunkterna.

### Dataskydd

Ny integritetspolicy som beskriver vad som faktiskt sparas, med ändamål, laglig grund och
lagringstid per tabell. "Ladda ner mina data" är fullständig — tester räknar upp tabellerna i schemat
och blir röda om en ny tabell glöms bort. Kontoradering tar med allt, inklusive kontaktadresser i
gamla felrapporter. Gallring av gammal data, och ett internt register över behandlingen.

### Om något går fel

Produktionscommiten är taggad, återställningsrutinen är skriven och migrationerna är
**expand-only** — nya kolumner läggs till, inga tas bort, så en äldre version av koden fungerar mot
den nya databasen. Nattlig säkerhetskopia med verifierad återställning.

### Kvalitet

| | v0 (17 sep) | v1.0 |
|---|---|---|
| Testfiler | 20 | 39 |
| Enhetstester | — | 335 |
| E2E-tester | — | 50, mobil och desktop |
| Databasmigrationer | 8 | 17 |
| Sidor och ändpunkter | 23 | 28 |

Produktionsbygget var dessutom **trasigt** sedan lördag utan att något sa ifrån — en konstant
exporterad ur en `"use server"`-modul, vilket bara `next build` upptäcker. En deploy hade stannat.
Rättat, och ett test läser numera varje sådan fil.

---

## Det som inte ändrats

Samma 144 kort i elva kategorier, samma FSRS-schema i botten, samma skattningsskala 1–5, samma
gästläge där man kan börja plugga direkt utan konto. Kursinnehållet är oförändrat — **allt Johan
granskade gäller fortfarande.**
