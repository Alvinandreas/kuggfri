# Backup och återställning av produktionsdatabasen

Supabase Free har inga automatiska backuper. Därför tar `scripts/backup.cjs` en egen dump av
molndatabasen varje natt till `backups/<ÅÅÅÅ-MM-DD-HHMM>/` på Alvins dator (mappen är gitignorerad).
De 14 senaste sparas.

## Vad som tas

| Fil | Innehåll |
|---|---|
| `schema.sql` | Tabeller, funktioner, RLS-policyer, triggers (allt `supabase db dump` ger) |
| `data.sql` | All data i `public` (deck, kort, progress, historik, rapporter, examinatorer) och `auth` (konton, sessioner) |
| `roles.sql` | Databasroller |

Dumpen görs med Supabase CLI:s lagrade projektuppgifter från `supabase link`; inget lösenord finns i
skriptet eller i repot. CLI:t kör `pg_dump` i Docker, så skriptet startar Docker Desktop om det inte
är igång.

## Schemaläggning

En Windows-schemalagd uppgift, **Kuggfri backup**, kör `node scripts/backup.cjs` varje natt 03:30
och vid inloggning om nattens körning missades (datorn avstängd). Kontrollera:

```powershell
Get-ScheduledTaskInfo -TaskName "Kuggfri backup"
```

`LastTaskResult` ska vara `0`. Loggen skrivs till `backups/backup.log`.

Ta en backup manuellt (t.ex. före en migration eller en import):

```bash
node scripts/backup.cjs
```

## Återställning

### Enstaka tabell eller rader (vanligaste fallet)

Öppna `data.sql` i backupen, leta upp `COPY public.<tabell> ... FROM stdin;`-blocket och kör de rader
som ska tillbaka i Supabase SQL-editor som `insert`-satser, eller använd `psql`:

```bash
psql "<connection string>" -c "\copy public.cards from 'cards-rader.tsv'"
```

### Hela databasen (katastrof)

1. Skapa ett **nytt** Supabase-projekt (eller töm det befintliga: farligt, gör helst nytt).
2. Kör `schema.sql` i SQL-editorn (eller `psql -f schema.sql`).
3. Kör `data.sql` (`psql -f data.sql`; filen använder `COPY`, så SQL-editorn räcker inte).
4. Uppdatera `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` i Vercel om projektet är nytt, och Site URL /
   Redirect URLs / SMTP i det nya projektets Authentication-inställningar.

Att `auth.users` ingår gör att konton och lösenord följer med; sessioner blir ogiltiga och alla får
logga in igen.

### Verifierad återställning

Återställningen är testad lokalt (17 sep 2026): schema + data lästes in i en tom Postgres-container
och radantalen stämde med produktionen. Kör om testet efter större schemaändringar:

```bash
node scripts/restore-test.cjs backups/<mapp>
```
