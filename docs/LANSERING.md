# Lansering – körordning för tisdag 22 september

Presentationen för studenterna är tisdag 22 sep 10:00 på Johans föreläsning, och tjänsten ska vara
uppe när QR-koden visas på sista bilden. Den här filen är körordningen från "allt ligger lokalt" till
"studenterna pluggar". Rutinen för en vanlig deploy och för att rulla tillbaka står i
[ATERSTALLNING.md](ATERSTALLNING.md); inställningarna i Supabase och Vercel står i
[DEPLOY.md](DEPLOY.md). Den här filen säger i vilken **ordning** det ska ske och **när vi avbryter**.

Tidsåtgång: cirka 45 minuter, varav Alvin gör 20 och väntar 15.

---

## Steg 0 – innan något rör produktionen (måndag kväll)

- [ ] `npm run verify` grönt lokalt (typecheck, lint, `kuggfri kontrollera`, enhetstester, E2E)
- [ ] Alvin har klickat igenom http://localhost:3001 och sagt "pusha"
- [ ] Ingenting i `git status` som inte ska med

Utan de tre punkterna börjar vi inte. En lansering som behöver felsökas klockan 09:45 på tisdag är
värre än en lansering som sker måndag kväll.

---

## Steg 1 – Alvins inställningar (20 min, gör före steg 2)

Exakta klickvägar finns i DEPLOY.md 3b–3d. Kortfattat:

1. **Egen SMTP** (DEPLOY.md 3c). Utan den skickar Supabase ett par mejl i timmen, och hundra
   studenter som registrerar sig samtidigt får "Det gick inte". Det här är den enskilt största
   risken på lanseringsdagen.
2. **Slå på Confirm email** (Authentication → Providers → Email). Måste ske *efter* SMTP, annars
   fastnar alla nya konton i ett mejl som aldrig kommer fram.
3. **Integritetspolicyn måste nämna den nya mejlleverantören** innan den första studenten
   registrerar sig. Byter vi till Resend behandlar Resend studenternas e-postadresser och är därmed
   ett personuppgiftsbiträde; `/integritet` och docs/PERSONUPPGIFTER.md listar i dag Supabase,
   Vercel och Hostinger. En rad i listan, men den ska ligga före lanseringen, inte efter.
4. **Miljövariabler i Vercel** (Production): `CRON_SECRET`, `REVALIDATE_SECRET`,
   `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_HOSTS`, samt SMTP-variablerna enligt DEPLOY.md 3d.
5. **Ta bort `https://*.vercel.app/**`** ur Redirect URLs och lämna kvar `https://kuggfri.com/**`.
   Jokertecknet gör att vem som helst med en Vercel-adress kan ta emot en inloggningslänk.
6. **E-postmallarna** inklistrade (DEPLOY.md 3b), annars fungerar inloggningslänken bara i den
   webbläsare som beställde den.

Kontroll efter steg 1: beställ en inloggningslänk till din egen adress och öppna den **i mobilen**.
Du ska landa inloggad på kuggfri.com. Fungerar inte det, gå inte vidare.

> När Confirm email är på måste en inbjuden examinator bekräfta sin adress innan behörigheten
> kopplas på. Johans konto är skapat tidigare och påverkas inte, men en ny examinator som bjuds in
> efter tisdag ser inget förrän hen klickat i mejlet.

---

## Steg 2 – databasen före koden

Nya kolumner först, ny kod sedan. Omvänd ordning ger femhundra fel medan bygget hinner ikapp.

```bash
npx supabase db dump --linked -f backup-fore-lansering.sql
```

```bash
npx supabase migration list --linked
```

Listan visar vilka migrationer molnet saknar. Det ska vara de som tillkommit sedan förra pushen
(tentadatum, aktivering, påminnelser, innehållsnycklar, dataskydd, säkerhet, kortantal). Stämmer
listan inte med förväntan: stanna och läs igenom skillnaden innan något körs.

```bash
npx supabase db push
```

Alla migrationer är expanderande (lägger till, tar inte bort) och har en kommenterad ÅNGRA-sektion
sist i filen. Därför kan gammal kod köra vidare mot den nya databasen medan bygget pågår.

---

## Steg 3 – koden

```bash
git push
```

Vercel bygger i cirka två minuter. Vänta tills deployen är grön i Vercels gränssnitt innan du går
vidare — inte tills kommandot är klart.

```bash
git tag -a v1.1-lansering -m "Lansering för studenterna 22 sep" && git push --tags
```

Taggen är det vi rullar tillbaka **till** nästa gång. Utan den är återställningen en gissning.

---

## Steg 4 – innehållet

```bash
npm run kuggfri -- plan materialteknik --mal prod
```

Förväntat svar: **144 kort "knyts ihop", 0 nya, 0 borttagna.** Det betyder att filerna och molnet
beskriver samma kort och att varje kort behåller sitt id — och därmed varje students progress.

Står det att kort skapas eller tas bort: **kör inte apply.** Då har nycklarna glidit isär och
studenternas progress skulle nollställas. Kör `pull` i stället och läs skillnaden.

Ser planen rätt ut:

```bash
npm run kuggfri -- apply materialteknik --mal prod
```

Backup tas automatiskt före apply. Kör sedan `plan` igen; den ska vara tom.

---

## Steg 5 – rökprov på kuggfri.com (10 min, gör alltid)

Som **gäst**, i mobilen, utan att logga in:

- [ ] Startsidan visar Materialteknik med 144 kort
- [ ] Kurssidan: förstabesöksrutan, kategoritabellen, "Starta"-raden med antal och minuter
- [ ] Starta ett pass: vänd kort, skatta 1–5, intervalltexterna syns på knapparna
- [ ] Avsluta passet: "Klar för i dag" med de tre nyckeltalen
- [ ] Ladda om sidan: progressen finns kvar

Som **ny student**:

- [ ] Registrera ett konto med en riktig adress → mejlet kommer inom en minut
- [ ] Bekräfta via länken → gästprogressen följer med in på kontot
- [ ] Logga ut och in igen med lösenord

Som **admin** (Alvin):

- [ ] /admin visar kursen, 144 kort, statistiksidan laddar
- [ ] Ändra en kortframsida i admin och ladda om studentsidan: ändringen syns
- [ ] Felrapportknappen i studieläget skapar en rapport som syns under Rapporter

Som **examinator** (Johan, om han har tid före tisdag):

- [ ] Ser bara sin egen kurs, kan redigera kort, ser statistiken utan namn eller e-postadresser

Mejl:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" "https://kuggfri.com/api/cron/daily?digest=1"
```

- [ ] Svaret visar `configured: true` och rimliga antal, inga fel

---

## Avbrytskriterier

Rulla tillbaka direkt, felsök efteråt, om något av detta inträffar:

| Symptom | Åtgärd |
|---|---|
| Studenter kan inte registrera sig eller logga in | Kontrollera SMTP först, sedan Redirect URLs. Rulla tillbaka bara om koden är orsaken |
| Kurssidan eller studieläget ger fel för gäster | Återställ förra deployen i Vercel (ATERSTALLNING.md, cirka en minut) |
| `plan --mal prod` vill skapa eller ta bort kort | Kör inte apply. Innehållet i molnet står kvar orört tills vi förstått varför |
| Statistiken visar namn, e-post eller enskilda studenter | Rulla tillbaka omedelbart. Det är ett personuppgiftsfel, inte en bugg bland andra |

Databasen rullas **inte** tillbaka som första åtgärd: migrationerna är expanderande, så den gamla
koden fungerar mot den nya databasen. ÅNGRA-sektionerna används bara om en migration i sig är fel.

---

## Första dygnet efter lansering

Titta på det här på onsdag morgon, innan vi bygger något nytt:

- **Aktivering**: hur många som startade ett pass, hur många som gjorde minst 20 kort, hur många som
  kom tillbaka inom tre dagar (kursöversikten i admin)
- **Felrapporter**: studenterna hittar sakfel vi inte ser. Svara på dem samma vecka
- **E-postloggen**: kom påminnelserna fram, eller studsade de
- **Vercels logg**: fel som studenterna inte rapporterar

Det är också underlaget till uppföljningsrapporten till Johan.

---

## Att säga till studenterna

Tre saker som sparar oss supportfrågor:

1. **Konto behövs inte för att börja**, men progressen ligger då bara i den webbläsaren. Skapa konto
   för att plugga på flera enheter.
2. **Lägg till på hemskärmen** (Dela → Lägg till på hemskärmen i iOS, menyn i Android) ger en
   appikon och eget fönster. Det finns ingen app i App Store, och det behövs inte.
3. **Rapportera fel direkt i kortet.** Materialet är sammanställt av studenter och innehåller fel;
   knappen finns under varje kort och rapporten går till kursansvarig.
