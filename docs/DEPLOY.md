# Deploy till kuggfri.com – exakt vad Alvin gör och vad Claude gör

> Rutinen vid varje deploy (backup före migration, `db push` före `git push`, tagg, återställning)
> står i [ATERSTALLNING.md](ATERSTALLNING.md).

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
2. Välj **Magic Link**. Subject: `Din inloggningslänk till Kuggfri`. Ersätt hela brödtexten med
   innehållet i `supabase/templates/magic-link.html`. Spara.
3. Välj **Confirm signup**. Subject: `Bekräfta ditt konto på Kuggfri`. Ersätt brödtexten med
   `supabase/templates/confirmation.html`. Spara. (Används bara om "Confirm email" slås på igen.)
4. **Authentication → URL Configuration → Redirect URLs**: lägg till `https://kuggfri.com/**` och
   `https://kuggfri.vercel.app/**`. Vercel-integrationen lade bara in sina egna
   `kuggfri-…-gate-ai-sverige.vercel.app`-adresser, vilket är varför länkar hamnade där 14 sep.
5. Testa: kuggfri.com → Logga in → "Skicka inloggningslänk i stället" → öppna mejlet på en annan
   enhet än den du beställde från. Du ska landa inloggad på startsidan.

`supabase config push` ska **inte** användas för detta: config.toml deklarerar lokala värden
(site_url, redirect-listan, rate limits) som då skulle skriva över molnets riktiga inställningar.
`supabase config diff` är däremot ofarligt och visar skillnaderna.

## 3c. Egen mejlserver (krävs före lansering till studenter)

Supabase inbyggda utskick är begränsat till ett par mejl per timme per projekt och är avsett för
test. Med många studenter behövs egen SMTP. Rekommendation: **Resend** (gratis upp till 3 000 mejl
per månad).

1. Skapa konto på resend.com, lägg till domänen `kuggfri.com` under *Domains* och lägg in de
   DNS-poster Resend visar hos Hostinger (TXT för verifiering, MX + TXT för DKIM/SPF på en subdomän).
2. Skapa en API-nyckel i Resend (Sending access räcker).
3. Supabase → **Project Settings → Authentication → SMTP Settings** → Enable Custom SMTP:
   Sender email `noreply@kuggfri.com`, Sender name `Kuggfri`, Host `smtp.resend.com`, Port `465`,
   Username `resend`, Password = API-nyckeln. Spara.
4. Supabase → Authentication → Rate Limits: höj "Rate limit for sending emails" till t.ex. 100/timme.

API-nyckeln är en hemlighet: klistra in den i Supabase-dashboarden, aldrig i repot eller i chatten.

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
