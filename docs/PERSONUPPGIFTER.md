# Personuppgifter: register, rutiner och ansvar

Internt arbetsdokument. Den publika texten finns på `/integritet`
([app/integritet/page.tsx](../app/integritet/page.tsx)); det här dokumentet är underlaget bakom den
och rutinerna vi följer. Uppdaterat 20 september 2026.

**Grundregeln:** läggs en tabell, kolumn eller localStorage-nyckel med personuppgifter till ska den
in på fyra ställen innan den går i produktion:

1. registret i avsnitt 2 nedan,
2. integritetspolicyn på `/integritet`,
3. dataexporten i [app/api/konto/export/route.ts](../app/api/konto/export/route.ts),
4. raderingen (`delete_my_account()`, som kaskaderar via främmande nycklar).

Testerna i `tests/unit/privacy/` kontrollerar punkt 3 och 4 automatiskt.

## 1. Roller

| Roll | Vem |
|---|---|
| Personuppgiftsansvarig | Alvin Andreasson, privatperson, student vid Chalmers |
| Dataskyddsombud | Krävs inte (ingen myndighet, ingen storskalig övervakning, inga känsliga uppgifter) |
| Personuppgiftsbiträden | Supabase (databas och inloggning, EU-region Irland), Vercel (drift, serverregion Stockholm), Hostinger (appens egna mejl: påminnelser och veckobrev) |
| Utanför ansvaret | Chalmers är **inte** personuppgiftsansvarig. Tjänsten är ett studentinitiativ som används i en kurs, inte en del av lärosätets IT-miljö. Examinatorn får bara se anonym, aggregerad statistik |

> **Att göra samtidigt som SMTP byts (docs/LANSERING.md steg 1):** slås egen SMTP på för Supabase
> inloggningsmejl blir den leverantören (Resend i den rekommenderade lösningen) ett nytt biträde som
> behandlar studenternas e-postadresser. Då ska den läggas till både i tabellen ovan och i listan på
> `/integritet`, och DPA:t hos leverantören godkännas. Byts inte SMTP står Supabase för utskicken och
> listan stämmer som den är.

Kursens examinator är inte ett biträde: hen behandlar inga personuppgifter i tjänsten, eftersom
kursöversikten bara innehåller aggregat. Undantaget är felrapporter, där studenten *frivilligt* kan
lämna en kontaktadress för svar.

## 2. Register över behandlingar (GDPR art. 30)

| # | Kategori | Var | Ändamål | Rättslig grund | Gallring |
|---|---|---|---|---|---|
| 1 | E-postadress, lösenordshash, tidpunkter för inloggning | `auth.users` (Supabase Auth) | Inloggning och kontoåterställning | Avtal 6.1 b | Vid kontoradering |
| 2 | Visningsnamn, adminflagga, mejlinställningar | `public.profiles` | Personalisering, behörighet, utskicksval | Avtal 6.1 b, samtycke 6.1 a för utskicken | Vid kontoradering |
| 3 | Progress per kort (FSRS-tillstånd, senaste skattning) | `public.card_progress` | Schemalägga repetitioner | Avtal 6.1 b | Vid kontoradering eller nollställning |
| 4 | Repetitionshistorik (kort, skattning, läge, tidpunkt) | `public.review_log` | Studentens egna diagram, underlag för anonym kursstatistik | Avtal 6.1 b | Vid kontoradering eller nollställning |
| 5 | Studiesessioner | `public.study_sessions` | Statistik på kontosidan | Avtal 6.1 b | Vid kontoradering |
| 6 | Felrapporter (text, valfri kontaktadress, ev. user_id) | `public.card_reports` | Rätta fel i kursmaterialet | Berättigat intresse 6.1 f | Kontakt nollställs efter 180 dagar; åtgärdade rapporter raderas efter 180 dagar (`purge_old_data()`) |
| 7 | Examinatorsroll per kurs | `public.deck_examiners`, `deck_examiner_invites` | Behörighet till egen kurs | Berättigat intresse 6.1 f | Vid kontoradering eller när rollen tas bort |
| 8 | Logg över skickade mejl (typ, ämne, tidpunkt) | `public.email_log` | Undvika dubbla utskick | Berättigat intresse 6.1 f | 90 dagar (`purge_old_data()`) |
| 9 | Gästprogress och inställningar | Studentens webbläsare (`localStorage`) | Tjänsten utan konto | Ingen behandling hos oss | Studenten rensar själv |

Inga särskilda kategorier av uppgifter (art. 9) behandlas. Ingen profilering med rättsliga följder.
Inga barn under 13 är målgrupp; tjänsten riktar sig till universitetsstudenter.

### Vad som aldrig lagras

Namn (utöver frivilligt visningsnamn), personnummer, studentnummer, telefonnummer, adress,
IP-adresser för profilering, betyg, tentaresultat, och inga uppgifter från tredje part.

## 3. Gallring

| Vad | När | Hur |
|---|---|---|
| Mejlloggen | 90 dagar | `purge_old_data()`, automatiskt i `/api/cron/daily` |
| Åtgärdade felrapporter | 180 dagar | samma funktion |
| Kontaktadress i felrapporter | 180 dagar | samma funktion (sätts till null) |
| Vilande konton | 24 månader utan inloggning eller repetition | `dormant_accounts()` listar dem. **Radering sker aldrig automatiskt** utan är ett medvetet beslut: granska listan, mejla dem som har adress, radera först därefter |
| Allt övrigt | När studenten raderar kontot | `delete_my_account()` raderar raden i `auth.users`; resten kaskaderar |

Att vilande konton inte raderas automatiskt är ett medvetet val: risken att radera en students
progress mitt i en utbildning väger tyngre än nyttan av automatiken.

## 4. Rutiner

### Begäran om registerutdrag eller dataportabilitet

Studenten laddar ner allt själv under Konto. Kommer en begäran ändå per mejl: bekräfta att den
kommer från kontots adress, hänvisa till knappen, och skicka vid behov filen själv. Svarstid: högst
en månad.

### Begäran om radering

Studenten raderar själv under Konto. Per mejl: bekräfta adressen, radera, bekräfta att det är gjort.
Kontrollera att inget ligger kvar i säkerhetskopior äldre än 14 dagar (de roterar bort av sig själva).

### Personuppgiftsincident

1. Stoppa läckan (avpublicera, rotera nycklar, stäng av funktionen).
2. Dokumentera: vad, när, hur många, vilka uppgifter, vad vi gjort.
3. Bedöm risken. Anmäl till IMY inom 72 timmar om risken inte är osannolik.
4. Informera de drabbade om risken är hög.
5. Skriv ned orsak och åtgärd i `DECISIONS.md`.

Kontaktväg för den som hittar ett säkerhetsproblem: adressen på `/om`.

### Vid ändring av datamodellen

Följ fyrapunktslistan överst i det här dokumentet. Kör `npm run verify` — testerna i
`tests/unit/privacy/` fäller om en tabell med `user_id` saknas i exporten.

## 5. Säkerhetsåtgärder

- HTTPS överallt, HSTS, säkerhetsheaders (se `next.config.ts`).
- Row level security på varje tabell, med ett test per policy (`tests/unit/db/rls.test.ts`).
- Kolumnrättigheter gör att `is_admin` inte kan sättas av en användare.
- `security definer`-funktioner har alltid `set search_path` och en explicit behörighetskontroll.
- Service role-nyckeln finns bara som servermiljövariabel i Vercel och i CLI:t lokalt, aldrig i
  webbläsaren och aldrig i repot.
- Aggregerad statistik visas först vid minst fem skattande studenter.
- Beroenden granskas med `npm audit` inför varje release.

### Säkerhetskopior

`scripts/backup.cjs` dumpar produktionsdatabasen varje natt till `backups/` på arbetsdatorn. Dumpen
**innehåller `auth.users`**, alltså e-postadresser och lösenordshashar. Därför:

- `backups/` är gitignorerad och får aldrig committas (testet i `tests/unit/privacy/` kontrollerar det).
- Arbetsdatorns disk ska vara krypterad (BitLocker).
- De fjorton senaste behålls, äldre raderas automatiskt av skriptet.
- Dumpen får aldrig läggas i molnlagring, mejlas eller delas.

## 6. Att göra

- [ ] Publicera en kontaktadress på `/om` som studenter kan använda för dataskyddsfrågor (i dag
      hänvisar policyn dit, men adressen behöver stå där).
- [ ] Bekräfta att BitLocker är på på arbetsdatorn.
- [ ] Efter lansering: granska `dormant_accounts()` en gång per termin.
