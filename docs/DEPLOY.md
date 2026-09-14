# Deploy till kuggfri.com – exakt vad Alvin gör och vad Claude gör

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

## 4. Claude gör (när ovanstående finns)

- `supabase db push` (eller SQL-filen), kontroll att RLS och seed finns i molnet.
- Gör dig till admin i molndatabasen (SQL enligt README).
- Kontroll av registrering, magic link och studieflödet på den riktiga adressen.
- E2E-körning mot produktion i läsläge (inga testkonton skapas där).
- Tar bort `/d/dev-preview`-rutten (svarar redan 404 i produktion).

## Skicka till Claude

1. Repo-adressen och "pushen gick igenom".
2. Supabase: Project URL, anon public-nyckel, Reference ID.
3. Vercel-adressen (`kuggfri-xxxx.vercel.app`) och om domänen är tillagd.
