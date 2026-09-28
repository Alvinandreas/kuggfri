# Deploy till kuggfri.com – exakt vad Alvin gör och vad Claude gör

> Rutinen vid varje deploy (backup före migration, `db push` före `git push`, tagg, återställning)
> står i [ATERSTALLNING.md](ATERSTALLNING.md). Körordningen för lanseringen tisdag 22 sep, med
> rökprov och avbrytskriterier, står i [LANSERING.md](LANSERING.md).

Konton finns redan på Supabase och Vercel. Det som återstår kräver dina inloggningar i tre
verktyg. Kör stegen under **"Du gör"** i ordning (cirka 15 minuter), så tar Claude resten.

## 1. GitHub (du gör, en gång)

1. Skapa ett tomt privat repo på github.com, namn `kuggfri`. Ingen README, ingen .gitignore.
2. Öppna en terminal i `C:\Users\Alvin\flashcardengine` och kör (byt ut ANVÄNDARNAMN):

```bash
git remote add origin https://github.com/ANVÄNDARNAMN/kuggfri.git
```

```bash
git push -u origin main
```

Ett fönster från Git Credential Manager öppnas: logga in på GitHub och godkänn. Efter det kan
Claude pusha själv.

## 2. Supabase (du gör)

1. supabase.com → **New project**: namn `kuggfri`, region **Central EU (Frankfurt)** eller
   **West EU (Ireland)**, klicka **Generate a password** och spara det i din lösenordshanterare.
2. När projektet är klart: **Project Settings → General**, kopiera **Reference ID**.
3. Logga in CLI:t så att Claude kan köra migrationerna:

```bash
npx supabase login
```

Ett webbläsarfönster öppnas, godkänn. Kör sedan (byt ut REF):

```bash
npx supabase link --project-ref REF
```

Den frågar efter databaslösenordet: klistra in det. Klart. Claude kör sedan `supabase db push`
och laddar innehållet.

**Alternativ utan CLI:** öppna **SQL Editor** i dashboarden, klistra in hela innehållet i
`supabase/deploy/full.sql` och kör. Det skapar alla tabeller, policyer och laddar de 144 korten.

4. **Authentication → URL Configuration**: sätt Site URL till `https://kuggfri.com` och lägg till
   `https://kuggfri.com/**` samt `https://*.vercel.app/**` under Redirect URLs. Under
   **Authentication → Providers → Email** bestämmer du om e-postbekräftelse ska krävas (rekommenderat
   på för riktiga användare).
5. **Project Settings → API**: kopiera **Project URL** och **anon public**-nyckeln. Skicka dem till
   Claude i chatten (de är publika per design). Skicka **inte** service_role-nyckeln.

## 3. Vercel (du gör)

1. vercel.com → **Add New → Project** → Import `kuggfri` från GitHub (ge Vercel åtkomst till repot).
2. Under **Environment Variables** före första deployen:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public
   - `NEXT_PUBLIC_SITE_URL` = `https://kuggfri.com`
3. **Deploy**. Bygget tar cirka två minuter.
4. **Settings → Domains**: lägg till `kuggfri.com` och `www.kuggfri.com`. Vercel visar DNS-poster
   (en A-post för roten och en CNAME för www). Lägg in dem hos den leverantör där du köpte domänen.
   Det tar från några minuter upp till ett dygn innan de slår igenom.
   **Gjort 14 sep 2026** hos Hostinger (DNS / Nameservers → DNS records, Hostingers egna namnservrar
   behålls): A `@` → `216.198.79.1`, CNAME `www` → det projektspecifika `…vercel-dns-017.com`-värdet
   som Vercel visade. Hostingers parkeringsposter för `@` och `www` togs bort. Spridning tog under
   fem minuter, certifikatet några minuter till. Sätt `kuggfri.com` som huvudadress (utan omdirigering)
   och låt `www` omdirigera dit, annars hamnar besökare på www-adressen.
5. Alternativ: logga in CLI:t så kan Claude deploya och sätta variabler själv:

```bash
npx vercel login
```

## 3b. E-postmallar i Supabase (krävs för inloggningslänkar)

Supabase standardmall skickar användaren via Supabase egen verify-sida med en PKCE-kod som bara
kan lösas in i **samma webbläsare** som beställde länken. Öppnas mejlet i mobilens mejlapp, en annan
webbläsare eller en annan enhet misslyckas inloggningen ("Länken är ogiltig"). Kuggfris mallar
använder i stället `token_hash`, som `/auth/confirm` verifierar direkt. Då fungerar länken överallt
och landar alltid på Site URL (kuggfri.com). Lokalt läses mallarna från `supabase/templates/` via
`config.toml`; i molnet måste de klistras in en gång:

1. Supabase → **Authentication → Emails** (fliken *Templates*).
2. Klistra in alla fyra mallarna med ämnesrad enligt tabellen i **3c, steg 4** nedan (sedan 28 sep
   finns också en mall för byte av e-postadress, och bekräftelsemejlet är ett välkomstmejl).
3. **Authentication → URL Configuration → Redirect URLs**: lägg till `https://kuggfri.com/**` och
   `https://kuggfri.vercel.app/**`. Vercel-integrationen lade bara in sina egna
   `kuggfri-…-gate-ai-sverige.vercel.app`-adresser, vilket är varför länkar hamnade där 14 sep.
4. Testa: kuggfri.com → Logga in → "Skicka inloggningslänk i stället" → öppna mejlet på en annan
   enhet än den du beställde från. Du ska landa inloggad på startsidan.

`supabase config push` ska **inte** användas för detta: config.toml deklarerar lokala värden
(site_url, redirect-listan, rate limits) som då skulle skriva över molnets riktiga inställningar.
`supabase config diff` är däremot ofarligt och visar skillnaderna.

## 3c. E-post via Hostinger (SMTP, e-postbekräftelse och mallar)

Beslut 28 sep 2026: alla mejl går från brevlådan `noreply@kuggfri.com` hos Hostinger, både
Supabase egna utskick (bekräftelse, glömt lösenord, inloggningslänk, byte av e-post) och appens
egna påminnelser och veckobrev. E-postbekräftelse vid registrering slås **på**. Supabase inbyggda
mejlserver klarar bara ett par mejl i timmen och är inte tänkt för riktiga användare, så steg 1
måste vara gjort innan steg 3.

Lösenordet till brevlådan är en hemlighet: skriv in det direkt i Supabase och Vercel, aldrig i repot
eller i chatten.

### DNS hos Hostinger (kontrollerat 28 sep, bara läsning)

| Post | Värde i dag | Status |
|---|---|---|
| MX `kuggfri.com` | `mx1.hostinger.com` (5), `mx2.hostinger.com` (10) | OK |
| SPF, TXT `kuggfri.com` | `v=spf1 include:_spf.mail.hostinger.com ~all` | OK |
| DKIM, CNAME `hostingermail-a._domainkey` | `hostingermail-a.dkim.mail.hostinger.com` (nyckel publicerad) | OK |
| DKIM, CNAME `hostingermail-b._domainkey`, `hostingermail-c._domainkey` | pekar på Hostinger, tomma nycklar (reserv för nyckelbyte) | OK, normalt |
| DMARC, TXT `_dmarc.kuggfri.com` | `v=DMARC1; p=none` | Finns, men utan rapportadress |

Ingenting måste ändras för att mejlen ska gå fram. En förbättring som rekommenderas (Hostinger →
Domäner → kuggfri.com → DNS / Nameservers → redigera TXT-posten `_dmarc`):

```
v=DMARC1; p=none; rua=mailto:DIN-ADRESS; adkim=r; aspf=r
```

Byt `DIN-ADRESS` mot en adress du läser (t.ex. din egen Gmail). Då får du dagliga rapporter om vem
som skickar mejl i kuggfri.com:s namn. När rapporterna visat att allt från Hostinger klarar SPF och
DKIM i ett par veckor kan `p=none` höjas till `p=quarantine`, vilket gör det svårare att förfalska
avsändaren. Rör inte SPF- eller DKIM-posterna.

### Steg 1. SMTP i Supabase (du gör)

Supabase → **Project Settings → Authentication → SMTP Settings** (i nyare dashboard:
**Authentication → Emails → SMTP Settings**) → slå på **Enable Custom SMTP**:

| Fält | Värde |
|---|---|
| Sender email | `noreply@kuggfri.com` |
| Sender name | `Kuggfri` |
| Host | `smtp.hostinger.com` |
| Port number | `465` |
| Minimum interval between emails (om fältet finns) | `60` sekunder (standard) |
| Username | `noreply@kuggfri.com` |
| Password | brevlådans lösenord från Hostinger (du skriver in det själv) |

Spara. Supabase skickar inget testmejl vid sparandet; testet görs i steg 6.

### Steg 2. Rate limit för mejl (du gör)

Supabase → **Authentication → Rate Limits** → **Rate limit for sending emails**. Standard efter att
egen SMTP slagits på är 30 per timme, vilket en föreläsningssal som registrerar sig samtidigt slår i
direkt. Sätt **200 per timme**. Det räcker för en hel årskurs som registrerar sig under samma
kvart, och ligger väl under Hostingers tak (kolla i hPanel → E-post → brevlådan vilken
dygnsgräns ditt paket har; på de vanliga paketen är den runt 1 000 mejl per dygn och brevlåda).
Påminnelserna från appen räknas mot samma brevlåda hos Hostinger men inte mot Supabase gräns.

### Steg 3. Slå på e-postbekräftelse (du gör, efter steg 1)

Supabase → **Authentication → Sign In / Providers → Email** (äldre dashboard: Providers → Email):

- **Confirm email**: på.
- **Secure email change**: på (båda adresserna bekräftar ett byte).
- **Email OTP Expiration**: `3600` sekunder. Mallarna säger att länken gäller i en timme.

Befintliga konton påverkas inte: konton som skapades medan bekräftelsen var avstängd är redan
markerade som bekräftade. Vill du vara säker kör du i SQL Editor
`select email from auth.users where email_confirmed_at is null;` före omslaget; ett konto som
dyker upp där och som du vet är äkta bekräftas med
`update auth.users set email_confirmed_at = now() where email = 'adressen';`. Nya konton får ett
välkomstmejl med bekräftelseknapp och kommer in först när de tryckt på den. Appen visar då
"Kolla din inkorg" med adressen, en knapp för att skicka mejlet igen och ett tips om skräpposten.
Försöker någon logga in innan bekräftelsen får hen en förklaring och samma knapp.

### Steg 4. Mallar och ämnesrader (du gör)

Supabase → **Authentication → Emails** → fliken *Templates*. För varje mall: ersätt hela
brödtexten (växla till källkodsläget, markera allt, klistra in) med filens innehåll och sätt ämnesraden.
Öppna filerna i VS Code eller Anteckningar och kopiera allt, från `<!doctype html>` till `</html>`.

| Mall i Supabase | Fil | Subject |
|---|---|---|
| Confirm signup | `supabase/templates/confirmation.html` | `Välkommen till Kuggfri, bekräfta din e-postadress` |
| Reset Password | `supabase/templates/recovery.html` | `Välj ett nytt lösenord till Kuggfri` |
| Magic Link | `supabase/templates/magic-link.html` | `Din inloggningslänk till Kuggfri` |
| Change Email Address | `supabase/templates/email_change.html` | `Bekräfta din nya e-postadress på Kuggfri` |

Mallarna Invite user och Reauthentication används inte och kan lämnas som de är.

Alla länkar går till `{{ .SiteURL }}/auth/confirm?token_hash=…&type=…` och fungerar därför bara om
**Authentication → URL Configuration → Site URL** är exakt `https://kuggfri.com` (utan snedstreck
sist). Samma lista av Redirect URLs som i 3b gäller: `https://kuggfri.com/**` och
`https://kuggfri.vercel.app/**`. Loggan i mejlen hämtas från `https://kuggfri.com/apple-touch-icon.png`.

Mallarna hälsar neutralt, utan namn. Namnet skrivs av den som registrerar, som inte behöver vara
adressens ägare, och skräppostare använder annars registreringsformulär för att få in egen text i
mejl som skickas från någon annans domän.

### Steg 5. Vercel: appens egna mejl (du gör)

Vercel → Project → **Settings → Environment Variables**, miljön **Production** (se också 3d):

| Variabel | Värde |
|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `noreply@kuggfri.com` |
| `SMTP_PASS` | brevlådans lösenord (du skriver in det själv) |
| `EMAIL_FROM` | `Kuggfri <noreply@kuggfri.com>` |

Gör en ny deploy (Deployments → ⋯ → Redeploy) så att variablerna läses in.

### Steg 6. Testprotokoll efter aktiveringen (du gör, cirka 10 minuter)

Använd en adress som inte har något konto, gärna en Gmail och helst också en studentadress
(Outlook), eftersom de sorterar skräppost olika.

1. **Registrera** på kuggfri.com med den nya adressen. Förväntat: "Kolla din inkorg" med adressen.
   Mejlet "Välkommen till Kuggfri, bekräfta din e-postadress" kommer inom en minut, från
   `Kuggfri <noreply@kuggfri.com>`. Tryck på knappen: du landar inloggad på hemsidan (eller i
   kursen, om du registrerade dig via en kurslänk).
2. **Skicka igen**: registrera ytterligare en adress, vänta en minut och tryck "Skicka bekräftelsen
   igen". Ett nytt mejl ska komma. Försök logga in innan du bekräftat: du ska se förklaringen och
   samma knapp.
3. **Glömt lösenord**: logga ut, Logga in → Glömt lösenordet? → ange adressen. Mejlet "Välj ett nytt
   lösenord till Kuggfri" leder till Konto med rutan för nytt lösenord. Byt, logga ut, logga in med
   det nya.
4. **Inloggningslänk**: Logga in → Skicka inloggningslänk i stället. Öppna mejlet i mobilen: du ska
   landa inloggad.
5. **Skräppost**: kontrollera att inget av mejlen hamnade i skräpposten eller under Kampanjer. Gjorde
   de det: markera "Inte skräppost" och säg till.
6. **mail-tester.com**: öppna sidan, kopiera den tillfälliga adressen den visar, registrera ett konto
   med den på kuggfri.com och tryck "Then check your score". Målet är 9/10 eller mer. SPF, DKIM och
   DMARC ska vara gröna. Radera kontot efteråt (SQL eller Authentication → Users i Supabase).
7. **Mörkt läge**: titta på välkomstmejlet i mobilen med mörkt läge på. Text och knapp ska synas.

Känd risk: mejlprogram med länkskanning (Microsoft 365 Safe Links, vanligt på studentadresser) kan
öppna länken i förväg. För bekräftelsemejlet gör det inget: kontot blir bekräftat ändå och studenten
får en lugn förklaring och loggar in som vanligt. En återställningslänk kan däremot bli förbrukad;
då ber man om en ny. Visar testet i steg 3 med en Outlook-adress att det händer, är nästa steg en
mellansida med en "Fortsätt"-knapp på `/auth/confirm`.

## 3d. Påminnelser och veckobrev (mejl från appen)

Studenter kan slå på en daglig påminnelse under Konto, och examinatorer får ett veckobrev på
måndagar. Skickas av `/api/cron/daily`, som Vercel anropar varje dag 16:00 UTC (17–18 svensk tid)
enligt `vercel.json`. Utan miljövariablerna nedan svarar jobbet "configured: false" och skickar
ingenting, så det är ofarligt att deploya före konfigurationen.

I Vercel → Project → Settings → Environment Variables (Production):

| Variabel | Värde |
|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` (samma brevlåda som i 3c) |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `noreply@kuggfri.com` |
| `SMTP_PASS` | brevlådans lösenord |
| `EMAIL_FROM` | `Kuggfri <noreply@kuggfri.com>` |
| `CRON_SECRET` | en lång slumpsträng. Vercel skickar den som Bearer-token till cron-jobbet, och innehållspipelinen använder den för att rensa innehållscachen efter `apply` |
| `SUPABASE_SERVICE_ROLE_KEY` | från Supabase → Project Settings → API (bara här, aldrig `NEXT_PUBLIC_`) |

Testa manuellt (ersätt hemligheten):

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" "https://kuggfri.com/api/cron/daily?digest=1"
```

Svaret visar antal skickade påminnelser och veckobrev och eventuella fel. Hobby-planen i Vercel
tillåter ett cron-anrop per dag, därför skickas allt vid samma klockslag.

## 4. Claude gör (när ovanstående finns)

- `supabase db push` (eller SQL-filen), kontroll att RLS och seed finns i molnet.
- Gör dig till admin i molndatabasen (SQL enligt README).
- Kontroll av registrering, magic link och studieflödet på den riktiga adressen. Gjort 14–15 sep:
  registrering och lösenordsinloggning fungerar på kuggfri.com; inloggningslänk fungerar lokalt med
  de nya mallarna (testat utan cookies mot Mailpit) och i molnet så snart mallarna är inklistrade.
- E2E-körning mot produktion i läsläge (inga testkonton skapas där).
- Tar bort `/d/dev-preview`-rutten. Gjort 16 sep.

## Skicka till Claude

1. Repo-adressen och "pushen gick igenom".
2. Supabase: Project URL, anon public-nyckel, Reference ID.
3. Vercel-adressen (`kuggfri-xxxx.vercel.app`) och om domänen är tillagd.
