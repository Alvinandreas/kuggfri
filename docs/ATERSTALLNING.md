# Återställning: så rullar vi tillbaka kuggfri.com på en minut

Det här dokumentet ersätter kodfrysning. Så länge stegen nedan fungerar kan vi deploya när som
helst, eftersom vi alltid kan gå tillbaka till ett känt fungerande läge.

Återställningspunkten inför studentlanseringen är git-taggen **`v1-lansering`**
(commit `3935773`, det som låg på kuggfri.com 19 september 2026). Varje senare release taggas
`v<nummer>-<kort namn>` när Alvin sagt "pusha".

## De tre lagren

| Lager | Var | Rullas tillbaka med | Tid |
|---|---|---|---|
| Kod | Vercel | "Promote to Production" på en tidigare deploy | 1 min |
| Databasschema | Supabase | "Ångra"-sektionen i migrationen, eller backup | 5–30 min |
| Studentdata | Supabase + localStorage | Bara lägg till fält, ändra aldrig betydelse | aldrig behövs |

## 1. Koden (nästan alltid det enda som behövs)

1. Öppna Vercel → projektet **kuggfri** → **Deployments**.
2. Hitta den senaste deploy som fungerade (commit-meddelandet och taggen syns; produktionsläget
   före lanseringen heter `v1-lansering` i git).
3. Klicka på de tre punkterna → **Promote to Production**. Bekräfta.
4. Kontrollera: öppna https://kuggfri.com i ett privat fönster, starta en session som gäst.
   Snabbtest från datorn:

```bash
E2E_BASE_URL=https://kuggfri.com E2E_SKIP_SETUP=1 npx playwright test tests/e2e/guest-study.spec.ts
```

Vercel bygger ingenting om, den pekar bara om domänen. Nästa push till `main` blir en ny deploy
igen, så rätta felet i koden innan nästa push.

Alternativ från terminalen om dashboarden inte är tillgänglig:

```bash
git checkout v1-lansering
git push --force origin HEAD:main
```

Det ger en ny deploy från taggen. Använd bara om dashboardvägen inte fungerar; force-push skriver
över historiken på GitHub, så tagga först det nuvarande läget (`git tag v-trasig main`) så att inget
går förlorat.

## 2. Databasen

Grundregeln, som gör att steg 1 nästan alltid räcker: **expandera, kontrahera aldrig i samma
release.** En migration får lägga till tabeller, kolumner (med default eller nullable) och nya
funktioner. Den får inte döpa om, ta bort eller ändra betydelsen av något som den gamla koden
använder. Då fungerar den gamla koden mot det nya schemat, och en kodåterställning är komplett.

Borttagning av gammalt sker i en egen migration minst en release senare, när ingen kod läser
det längre.

Varje migration avslutas med en kommenterad **`-- ÅNGRA`**-sektion: de exakta satserna som tar
bort det migrationen lade till. Behöver schemat ändå rullas tillbaka:

1. Ta en backup först: `node scripts/backup.cjs`.
2. Kör ÅNGRA-satserna i Supabase SQL-editorn (projektet Kuggfri → SQL Editor).
3. Ta bort migrationens rad i `supabase_migrations.schema_migrations` så att CLI:t inte tror att
   den är applicerad:

```sql
delete from supabase_migrations.schema_migrations where version = '20260919000000';
```

4. Rulla tillbaka koden (steg 1) om det inte redan är gjort.

Går inte ÅNGRA-satserna att köra (data som beror på det nya) används backupen enligt
`docs/BACKUP.md`, avsnittet "Hela databasen".

## 2b. Innehållet

Kursinnehållet ligger i git under `content/`, så en felaktig innehållsändring rullas tillbaka som
vilken kodändring som helst: `git revert` följt av `npm run kuggfri -- apply <kurs> --mal prod`.
Planen visar först exakt vad som återställs. Kort som hunnit inaktiveras återaktiveras då, med
progressen kvar, eftersom inaktivering aldrig raderar något.

`apply --radera` är det enda som tar bort kort och progress på riktigt. Backup tas automatiskt före
varje apply mot produktion, och `plan` visar hur många studenter som har progress på varje kort som
skulle raderas.

## 3. Studentdata

Progress finns i `card_progress` (konton) och `kuggfri:progress:v1` i localStorage (gäster), med
samma fält. Regeln är densamma som för schemat: nya fält får läggas till, befintliga fält byter
aldrig betydelse. Gammal kod ignorerar fält den inte känner till; ny kod måste tåla att fältet
saknas. En brytande ändring av lagringsformatet får en ny nyckel (`v2`) med migrering från `v1`,
aldrig en omskrivning av `v1`.

## Rutin vid varje deploy

1. `npm run verify` grönt lokalt.
2. Alvin verifierar på http://localhost:3001 och säger "pusha".
3. Om releasen innehåller en migration: `node scripts/backup.cjs` och sedan
   `node scripts/restore-test.cjs backups/<mappen>` (verifierad backup).
4. `npx supabase db push` (migrationer före koden, eftersom koden får förutsätta det nya schemat
   men schemat aldrig får förutsätta den nya koden).
5. `git push origin main` → Vercel deployar.
6. Tagga: `git tag -a v<n>-<namn> -m "..." && git push origin v<n>-<namn>`.
7. Gästflödena mot produktion (kommandot i steg 1 ovan) och en manuell inloggad koll.
8. Ingen migration deployas samma dag som en föreläsning eller tenta.

## Övning

Rutinen övas en gång tillsammans (Vercel-steget fram och tillbaka) så att vi vet att den tar en
minut och inte tjugo. Datum för övningen antecknas här: _ej gjord ännu_.
