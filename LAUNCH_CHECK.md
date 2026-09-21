# Lanseringskontroll inför v1.0

**Utförd** måndag 21 september 2026 på branchen `launch-check`.
**Gäller** commit `894ef66` mot produktionsprojektet `Kuggfri` (eu-west-1, Postgres 17.6, ACTIVE_HEALTHY).
**Lansering** tisdag 22 september kl. 10:00, cirka 150 studenter som registrerar sig från mobilen ungefär samtidigt.

Ingenting är pushat och ingenting är deployat.

---

## Omdöme

Själva tjänsten är redo. Alla 50 E2E-tester och 335 enhetstester är gröna, produktionsbygget går
igenom, innehållet är komplett och korrekt, och behörigheterna håller mot ett direkt angrepp
förbi gränssnittet.

**Det som hindrar lansering är inte koden utan tre inställningar i Supabase.** Med dagens
standardvärden klarar registreringen ungefär 30 studenter innan resten möts av ett fel, och med
e-postbekräftelse påslagen kommer bara två studenter i timmen att få sitt bekräftelsemejl. Det är
konfiguration, inte kod, och tar tillsammans ungefär tjugo minuter.

---

## 1. Blockerande problem

### B1. Registreringen stryps efter ~30 studenter

Supabase räknar sina auth-gränser **per IP-adress**. Kuggfris registrering och inloggning är
server actions, alltså går varje anrop ut från Vercels server — inte från studentens telefon.
Supabase ser därför **en enda IP för hela årskursen**.

Standardvärdena, [enligt Supabase dokumentation](https://supabase.com/docs/guides/auth/rate-limits):

| Gräns | Standard | Vad den träffar hos oss |
|---|---|---|
| Sign-ups and sign-ins | 30 per 5 min per IP | All registrering och inloggning, gemensamt för alla 150 |
| Verification requests | 30 per 5 min per IP | Klicket på bekräftelselänken i mejlet |
| Token refresh | 150 per 5 min per IP | Sessioner som förnyas, även middleware |
| Emails sent | **2 per timme** med inbyggd avsändare | Varje bekräftelse- och återställningsmejl |

150 studenter på tio minuter är 75 registreringar per 5 minuter. Taket är 30. Utan ändring får
ungefär en tredjedel konto och resten ett felmeddelande mitt under presentationen.

**Åtgärd (du, i Supabase-dashboarden):** Authentication → Rate Limits.

| Inställning | Sätt till | Varför |
|---|---|---|
| Sign-ups and sign-ins | **300 / 5 min** | 150 studenter med marginal för omförsök |
| Verification requests | **300 / 5 min** | Alla klickar på länken ungefär samtidigt |
| Token refresh | **1000 / 5 min** | 150 aktiva sessioner, alla från Vercels IP |
| Emails sent | **300 / timme** | Kräver eget SMTP, se B2 |

### B2. Eget SMTP måste vara på plats innan bekräftelse slås på

Du har valt Hostinger, vilket är rätt val: leverantören står redan i integritetspolicyn som
personuppgiftsbiträde, så inget nytt biträde tillkommer. Jag har uppdaterat policytexten så att
den täcker även inloggnings- och bekräftelsemejl, inte bara påminnelserna.

Hostinger Mail har ingen dokumenterad timgräns, bara en dygnsgräns:
[1000 utgående per dygn på Business Starter](https://www.hostinger.com/support/4625828-parameters-and-limits-of-hostinger-email/),
3000 på Standard och Premium, räknat per brevlåda över rullande 24 timmar. 150 bekräftelsemejl är
alltså inget problem — kontrollera bara att kontot är en Business Email-plan och inte den fria
testversionen, som har lägre tak.

**Två saker som är lätta att missa:**

1. **Supabases egen mejlgräns ligger kvar lågt även med eget SMTP.** Den måste höjas separat
   (se tabellen i B1). Kopplar du bara in SMTP och tror att taket försvinner, stannar utskicken ändå.
2. **SPF och DKIM för kuggfri.com.** Utan dem är risken stor att 150 mejl från en ny avsändare till
   `@student.chalmers.se` hamnar i skräpposten — samtidigt, vilket i sig ser ut som massutskick.
   Sätt posterna i kväll så att DNS hinner slå igenom, och **provskicka till en Chalmersadress och
   kontrollera att mejlet landar i inkorgen**, inte bara att det skickas.

### B3. Produktionsdatabasen ligger nio migrationer efter

Produktionen har migrationer till och med `20260917000200`. Nio väntar, bland dem
säkerhetshärdningen, dataskyddet och innehållsnycklarna. Ordningen i `docs/LANSERING.md` gäller:
`db push` först, `kuggfri apply --mal prod` efter.

Kör du `kuggfri plan --mal prod` före push misslyckas den — funktionen `deck_snapshot` finns inte
förrän migrationerna är på plats. Tidigare svarade kommandot bara `Command failed`; nu säger det
rakt ut vad som saknas och vad man gör åt det.

---

## 2. Risker som inte hindrar lansering

**Gränsen räknas fortfarande per IP, även höjd.** Höjningen i B1 tar bort problemet för 150
studenter, men grundförhållandet består: hela årskursen delar Vercels IP. Supabase har stöd för att
vidarebefordra studentens riktiga IP (`Sb-Forwarded-For`), men det kräver en hemlig nyckel i
auth-anropen och är fel sak att bygga kvällen före. Reserven om taket ändå slår i är att studenten
kan plugga vidare utan konto — och det är precis vad felmeddelandet numera säger.

**Ett avbrutet registreringsförsök kan ha skapat kontot ändå.** I lasttestet med 200 samtidiga
registreringar skapades 127 konton men bara 124 fick svar: tre studenter hade alltså fått ett fel
trots att kontot fanns. Meddelandet "adressen finns redan" hänvisar nu till inloggning och till
Glömt lösenord, så de tre tar sig vidare själva i stället för att fastna.

**Felrapporternas tak delas av alla gäster.** 60 rapporter per timme gäller gemensamt för alla som
inte är inloggade, 10 per timme och person för den som är det. En enskild spammare kan alltså låsa
rapportfunktionen för alla gäster i en timme. Avvägningen är medveten, och studenten får numera ett
begripligt besked i stället för "Något gick fel".

**Tentadatum är inte satt.** `decks.exam_date` är tomt, så nedräkningen, den höjda doseringen inför
tentan och slutrepetitionen ligger vilande. Funktionerna är testade och fungerar — de saknar bara
sitt datum. Vill du visa dem på presentationen behöver Johans datum sättas först.

**Tre kort når inga studenter.** `content/materialteknik/12-korrosion.md` innehåller tre färdiga
kort om korrosion men nämns inte i `kurs.json`, så de har aldrig nått databasen. Jag har lämnat
filen orörd — om korten ska med är det ett innehållsbeslut som är ditt och Johans, inte en rättelse
kvällen före lansering. `kuggfri kontrollera` varnar nu för sådana filer.

**Sidorna renderas per visning.** Kurssidan gör serverarbete vid varje besök (cirka 40 ms), eftersom
sidhuvudet visar om du är inloggad. 150 samtidiga anrop mot en ensam lokal process tog 7 sekunder;
på Vercel fördelas de över instanser och det är inte samma problem. Men det betyder att kallstarter
märks i minuten efter tio, när alla kommer samtidigt.

**Gratisnivåns säkerhetskopior.** Projektets egen backuprutin har körts senast natten till i dag
(`backups/2026-09-21-0130`). Den täcker behovet, men den körs från din dator — inte automatiskt i
molnet.

---

## 3. Vad jag åtgärdat på branchen

Alla ändringar minskar risk. Ingen ny funktionalitet.

| Vad | Varför det spelade roll |
|---|---|
| **Takgränsen för felrapporter kastade fel undantag.** `raise exception 'rate limited' using message = ...` sätter MESSAGE två gånger, så PostgreSQL svarade `42601` i stället för `53400` med sin egen text. Ny migration `20260921000000_rapportgrans.sql`. | Skyddet höll, men studenten fick "Något gick fel. Försök igen." och uppmanades göra om det som just misslyckats. |
| **Databasens meddelande når fram till studenten** vid takgräns i stället för ett generiskt fel. | Se ovan: rätt besked leder till rätt beteende. |
| **`NEXT_PUBLIC_SITE_URL` som saknas ger inte längre localhost-länkar.** Faller tillbaka på Vercels egen adress och skriver i loggen. Fyra tester. | Utan variabeln pekade varje länk i varje utskickat mejl på studentens egen dator — tyst, och synligt bara för den som klickade. |
| **CLI:t visar det verkliga databasfelet.** De tre vanligaste orsakerna får en rad om vad man gör åt dem. | `Command failed` utan orsak är fel sak att möta klockan nio på lanseringsmorgonen. |
| **"Adressen finns redan" hänvisar till inloggning.** | Ett avbrutet försök kan ha skapat kontot ändå; se risken ovan. |
| **429-meddelandet ger rätt råd.** Sa tidigare "vänta en stund" — men gränsen är gemensam för hela årskursen, så den som väntar får samma svar igen. Säger nu att man kan plugga vidare utan konto och skapa det senare. | Reserven när taket slår i. |
| **`kuggfri kontrollera` varnar för kortfiler som `kurs.json` inte känner till.** | Tre korrosionskort har legat osynliga utan att något sa ifrån. |
| **Integritetspolicyn beskriver Hostinger korrekt** nu när de även skickar inloggnings- och bekräftelsemejl. | En policy som inte stämmer är sämre än ingen. |
| **Lanseringskontroll av schemat**, sju nya tester: orört kort förfaller direkt, knapparna 1–5 ligger i växande ordning, doseringen håller första passet på 20 kort, fri repetition rör inte schemat, och ett kort som inte satt köas om innan passet är slut. | Det sista är garantin som gör att korta inlärningssteg kan vara avstängda i FSRS. Faller den, försvinner ett misslyckat kort till i morgon. |

---

## 4. Testprotokoll

### 1. Registrering, inloggning, glömt lösenord, felmeddelanden — **godkänt**

Hela kedjan med e-postbekräftelse påslagen kördes mot Mailpit i natt: gästprogress → registrering
("Kontrollera din e-post") → svenskt mejl → `/auth/confirm` → **"2 kort flyttades till ditt konto"**
→ bekräftat konto med progress och historik i databasen. Inloggning före bekräftelse nekas med
`email_not_confirmed`.

Felvägarna, provade genom gränssnittet i dag:

| Fall | Svar |
|---|---|
| Fel lösenord | "Fel e-post eller lösenord." |
| Okänd adress | **Exakt samma text** — ingen möjlighet att kartlägga vilka adresser som finns |
| Befintlig adress vid registrering | "Det finns redan ett konto … Logga in i stället, eller välj Glömt lösenord." |
| Ogiltig adress | Blockeras i webbläsaren, och fångas av servern om man kringgår det |
| För kort lösenord | "Lösenordet är för kort." |
| Glömt lösenord, okänd adress | "Om adressen har ett konto har vi skickat en länk." |
| Glömt lösenord, befintlig adress | **Exakt samma text** |

Återställningslänken är verifierad av E2E: länken i mejlet loggar in och det nya lösenordet fungerar.

### 2. Synk mellan enheter — **godkänt**

Inloggad skattning skrivs till databasen och **inte** till localStorage (kontrollerat: noll
progressnycklar i webbläsaren för ett konto). Efter att all lokal lagring rensats — vilket är vad en
ny enhet är — renderas progressen ändå: 15/15 studerade i första kategorin, 95 % "Kan nu". Gästens
progress ligger i localStorage och flyttas över vid registrering.

### 3. Schemalagd och fri repetition — **godkänt**

335 enhetstester, varav sju nya som beskriver dag ett för en student. Bekräftat: orört kort är
förfallet direkt, första passet doseras till 20 kort av 144, en femma flyttar kortet framåt och en
etta tillbaka, ett kort som inte satt köas om inom samma pass, och fri repetition rör varken
schemat eller progressen. E2E bekräftar samma sak genom gränssnittet, inklusive provtentan.

### 4. Nollställning av användardata — **godkänt**

E2E täcker alla tre vägarna: nollställ decket, nollställ schemat men behåll skattningarna, och radera
kontot. Dataexportens fullständighet och raderingens täckning är dessutom vaktade av tester som
räknar upp tabellerna i schemat — en ny tabell som knyter data till ett konto gör testet rött tills
den finns med i både export och radering.

### 5. Adminpanelen — **godkänt**

Det finns inget separat lösenord, och det ska det inte finnas: åtkomst styrs av rollen på kontot.
Utloggad skickas till inloggning, vanlig inloggad användare får 403. Viktigast är att skyddet inte
bara ligger i gränssnittet. Jag angrep databasen direkt med en vanlig students egen token, förbi
appen:

| Försök | Utfall |
|---|---|
| Läsa andras progress, historik, profiler | 0 rader — bara sina egna |
| Läsa examinatorslistan, e-postloggen, andras felrapporter | 0 rader |
| Ändra, skapa eller ta bort ett kort | Blockerat — 144 kort orörda efteråt, noll ändrade |
| Göra sig själv till admin | 403 |
| Ge sig själv examinatorsrätt | 403 |
| Hämta kursstatistik eller felrapporter via funktionsanrop | 403 |
| Nollställa allas progress | Träffar bara det egna kontot |

Anonym besökare når bara det publika kortinnehållet; alla andra tabeller svarar 401.

Produktionens konton är rena: ditt adminkonto, ett vanligt konto och Johans Chalmersadress. Inga
testkonton, inga svaga lösenord. Johan har redan examinatorsrätt i produktion.

### 6. Mobilvy — **godkänt**

375 px och 768 px, ljust och mörkt, student- och adminvyer: ingen horisontell scroll, inget utanför
skärmen, noll konsolfel. Kontrollerat mot produktionsbygget, inte dev-servern.

Klickytorna åtgärdades i natt: kategorikryssrutorna var 16×16 px, under gränsen på 24, och det är
studentens huvudsakliga interaktion på en telefon. Rutan ritas fortfarande som 16 px men träffytan
är 32×32. Kvar under gränsen är bara länkar inne i löpande text, vilket undantaget täcker.

### 7. Belastning — **se B1**

Uppmätt, inte gissat:

- **60 samtidiga registreringar** mot lokala Supabase: alla lyckades på 2,0 s.
- **200 samtidiga**: 124 lyckades, 76 föll på 500 när anslutningarna tog slut. 127 konton skapades
  — tre studenter fick alltså fel trots att kontot fanns.
- **150 samtidiga sidvisningar** mot produktionsbygget: alla 200 OK, men median 7 s på en ensam
  process. Serverarbetet per visning är cirka 40 ms; på Vercel fördelas det.

Databasens storlek är inget problem: 150 studenter × 144 kort är cirka 22 000 progressrader.
Appen använder PostgREST över HTTP, så Postgres anslutningstak berörs inte.

### 8. Materialteknik-setet — **godkänt**

144 aktiva kort, 11 kategorier, noll dubbletter, noll tomma fram- eller baksidor, alla med stabil
nyckel, kursen publicerad. `kuggfri kontrollera` hittar inga problem utöver den osynliga
korrosionsfilen. Produktionen har samma 144 kort i dag, så innehållet flyttas inte — det som
tillkommer vid `apply` är nycklarna som knyter korten till filerna.

### 9. Säkerhet — **godkänt**

Utöver behörighetstesterna i punkt 5:

- **Radnivåsäkerhet på samtliga elva tabeller.** `deck_examiner_invites` har noll policyer, alltså
  neka-allt — rätt för en tabell som innehåller examinatorers adresser.
- **Inga hemligheter i repot.** `.env*` är gitignorerad, servicenyckeln finns inte i någon klientfil,
  och bara de tre avsedda `NEXT_PUBLIC`-variablerna når webbläsaren.
- **Headers på plats i produktionsbygget:** CSP med nonce och `strict-dynamic` (inget
  `unsafe-inline` för skript), HSTS i två år, `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy: same-origin`, snäv `Permissions-Policy`, `object-src 'none'`.
- **Ingen användaruppräkning** vid inloggning eller glömt lösenord.
- **Cron- och cacherensningsändpunkterna kräver sin hemlighet** — 401 utan, verifierat av E2E.
- **Anonymitetsgränsen ligger i databasen**, inte i React: statistik med färre än fem studenter
  filtreras bort innan den lämnar servern.

---

## 5. Checklista före kl. 10:00

### I kväll

- [ ] **SMTP i Supabase:** Authentication → Emails → SMTP Settings, Hostingers uppgifter, avsändare på kuggfri.com
- [ ] **SPF och DKIM för kuggfri.com** i DNS — och provskicka till en `@student.chalmers.se`-adress och kontrollera att mejlet hamnar i **inkorgen**
- [ ] **Höj gränserna:** Authentication → Rate Limits enligt tabellen i B1 (sign-ups 300, verification 300, token refresh 1000, emails 300/h)
- [ ] **Slå på Confirm email** när SMTP är verifierat — inte innan
- [ ] **Miljövariabler i Vercel:** `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `REVALIDATE_SECRET`, `ALLOWED_HOSTS`, SMTP-variablerna
- [ ] **Redirect URLs i Supabase:** ta bort `https://*.vercel.app/**`, behåll kuggfri.com
- [ ] **Säkerhetskopia** av produktionen: `node scripts/backup.cjs`

### Deploy

- [ ] `npm run verify` och `npm run build` med dev-servern stoppad
- [ ] Bygg om 3001-kopian och **verifiera själv** — säg "pusha" först därefter
- [ ] `npx supabase db push` (nio migrationer)
- [ ] `npm run kuggfri -- plan materialteknik --mal prod` — ska visa 144 kort som knyts ihop, elva kategorier och en kursuppdatering, inga innehållsändringar
- [ ] `npm run kuggfri -- apply materialteknik --mal prod`
- [ ] Rökprov i tre roller: utloggad gäst, ny student, Johan som examinator

### Innan du går upp på scen

- [ ] **Registrera ett riktigt konto på en Chalmersadress** och gå hela vägen genom mejlet — det är det enda som provar SMTP, DNS och gränserna tillsammans
- [ ] Bestäm om tentadatum ska sättas (nedräkning och slutrepetition tänds av det)
- [ ] Bestäm om korrosionskorten ska med
- [ ] Ha reservbeskedet klart: **man behöver inget konto för att börja plugga** — det är också vad appen säger om taket slår i
