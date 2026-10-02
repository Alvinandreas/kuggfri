# Utbyggnad: flera kurser och flera examinatorer

Teknisk plan för hur Kuggfri byggs ut från en kurs (Materialteknik) till många kurser med många
examinatorer, och ett eget gränssnitt där plattformens administratör (Alvin) sköter kurser,
personer och roller. Planen bygger på kodbasen 2 oktober 2026 (`2732299`) och pekar ut exakt vilka
filer som berörs, så att arbetet kan starta direkt när tillfället kommer.

Den strategiska ramen (när, varför, i vilken takt) står i `docs/Framtidsplan.pdf`. Den här filen
svarar på hur.

**Läsanvisning:** avsnitt 1 är sammanfattningen. Avsnitt 2 är nulägeskartan med filreferenser.
Avsnitt 3 till 5 är målbilden och besluten. Avsnitt 6 till 12 är den detaljerade designen per
område. Avsnitt 13 är etapperna i den ordning de byggs. Avsnitt 15 listar allt som är hårdkodat
till Materialteknik i dag.

---

## 1. Sammanfattning

Grunden är bättre än man kunde tro. **Behörigheten är redan per kurs** i databasen och på
servern: `can_edit_deck(deck_id)` styr all RLS för kort, områden, tentor, rapporter och
historik, och en examinator för kurs A kan inte ändra kurs B. Det som låser tjänsten till en kurs
sitter i **gränssnittet**, inte i datamodellen.

Det som behöver byggas, i ordning:

1. **Roller med nivåer och spårbarhet.** I dag finns bara "global admin" och "examinator för en
   kurs", utan nivåer, utan vem som bjöd in vem och utan händelselogg.
2. **Ett plattformsgränssnitt** (`/plattform`) för plattformsadmin: alla kurser med status, alla
   personer med roller, inbjudningar, händelselogg och drift. Inget av det finns i dag.
3. **Kursgränssnittet för flera kurser:** låsningen till Materialteknik
   (`ACTIVE_ADMIN_COURSE_SLUG`) ersätts av en kursväljare, och examinatorns vy anpassas efter roll.
4. **En väg för att skapa kurser.** Kurser som skapas i admin får slumpat id och syns inte för
   innehållsverktyget (som räknar fram id ur nyckeln). Det måste bli samma id oavsett väg.
5. **Det som är globalt men borde vara per kurs:** innehållscachen (en tagg för allt),
   kontaktuppgifter (i kod), tentans klockslag (i kod), veckobrevet till admin (får alla kurser).
6. **Testerna med två kurser,** så att inga nya antaganden om en kurs smyger sig in.

Allt kan byggas med **expanderande migrationer** (bara lägga till) bakom en inställning, medan
Materialteknik är i drift. Etapp 0 (avsnitt 13) kan göras när som helst utan att något syns för
användarna.

---

## 2. Nuläget, område för område

Bedömning: **Ja** = klarar flera kurser i dag, **Delvis** = fungerar men med begränsningar,
**Nej** = måste byggas om.

| Område | Klarar flera kurser | Var | Kommentar |
|---|---|---|---|
| Behörighet i databasen (RLS) | Ja | `supabase/migrations/20260917000000_examiners.sql` (`can_edit_deck`) | Per kurs för allt innehåll |
| Behörighet på servern | Ja | `lib/admin/access.ts`, `lib/actions/guard.ts` (`requireEditor`, `requireAdmin`) | Två roller: admin och examinator |
| Middleware för `/admin` | Ja | `middleware.ts:64-75`, `lib/auth/admin-gate.ts` | Släpper in admin och den som är examinator någonstans |
| Roller och nivåer | Nej | `deck_examiners` har bara `deck_id`, `user_id`, `created_at` | Inga nivåer, inget `added_by` |
| Inbjudningar | Delvis | `deck_examiner_invites`, `link_examiner_invites` (`20260920000200_sakerhet.sql:20`) | Fungerar, men inget mejl skickas, ingen utgång, inget `invited_by` |
| Händelselogg | Nej | | Bara `card_versions`, `reviewed_by`, `flagged_by`, `app_settings.updated_by` |
| Plattformsadmin i UI | Nej | `is_admin` kan bara sättas med SQL (`init.sql:175-178`) | Ingen lista över personer, ingen översikt över kurser |
| Navigering i admin | Nej | `lib/admin/active-course.ts:13`, `lib/admin/nav.ts:37`, `app/(app)/admin/page.tsx:13` | Låst till Materialteknik (beslut 30 sep, `DECISIONS.md:389`) |
| Sidomenyn | Nej | `components/layout/Sidebar.tsx:150-170` (`adminLinks`) | En kurs, inget kursnamn, ingen kursväljare |
| Examinatorhantering | Delvis | `components/admin/ExaminerManager.tsx`, `lib/admin/actions.ts:382-405` | Per kurs, bara admin, en kurs i taget |
| Skapa kurs i admin | Delvis | `app/(app)/admin/deck/ny`, `lib/admin/actions.ts:47-80` | Slumpat id: syns inte för CLI:t |
| Innehållspipelinen | Ja | `scripts/kuggfri.ts`, `lib/content/plan.ts` | Loopar över alla kurser; id ur nyckeln (`lib/content/model.ts:78-88`) |
| Kurskonfiguration | Delvis | `lib/courses/index.ts:47` (`ALL_COURSES`), `lib/courses/materialteknik.ts` | Kontakt och tentans klockslag i kod |
| Cache för publikt innehåll | Delvis | `lib/content/queries.ts:16-17` (`CONTENT_TAG`) | En tagg för allt: en ändring i en kurs rensar alla |
| Veckobrev | Delvis | `digest_recipients()` (`20261002000100_veckobrev_engelska.sql`) | Per kurs, men admin får ett brev per publicerad kurs |
| Statistik, export, rapporter, tentor | Ja | `deck_stats_overview`, `app/(app)/admin/deck/[id]/export` | Per kurs |
| Underhållsgrinden | Ja (avsiktligt global) | `lib/maintenance.ts` | Per kurs styrs med `is_published` |
| Lanseringsspärr | Nej | Bara policy (`docs/INNEHALL.md:172`) | "Öppna när 0 kort återstår" kontrolleras inte i kod |
| Studentens hemsida | Delvis | `components/home/HomeDashboard.tsx:128` | En primär kurs plus "Fler kurser" |
| Kurser och statistik för studenten | Ja | `app/(app)/kurser`, `components/mystats/MyStatsDashboard.tsx` | Kurslista och val av kurs finns |
| Tester | Nej | `tests/e2e/helpers.ts:13`, `tests/visual/data.ts:21`, `tests/unit/courses` | `DECK_SLUG = "materialteknik"` |

**Säkerhetsdetalj att rätta oavsett utbyggnad:** RLS för `decks` låter en examinator uppdatera
alla kolumner utom `slug` och `is_published` (`guard_deck_admin_fields`,
`20260929000000_*.sql`). Via API:t kan en examinator alltså ändra `sort_order`, `source_hash` och
`description_en`. `source_hash` är innehållspipelinens konfliktskydd och ska bara skrivas av
pipelinen. Se etapp 0.

---

## 3. Målbilden: tre gränssnitt, fyra roller

### Gränssnitten

| Gränssnitt | Adress | För vem | Innehåll |
|---|---|---|---|
| Studentens | `/hem`, `/d/<kurs>`, `/statistik`, `/konto` | Alla | Som i dag, med flera kurser |
| Kursens | `/admin/kurs/<kurs>/…` (i dag `/admin/deck/<id>/…`) | Examinatorer och granskare för kursen, plattformsadmin | Som dagens admin, med kursväljare och roller |
| Plattformens | `/plattform/…` | Bara plattformsadmin | Alla kurser, alla personer, roller, inbjudningar, logg, drift |

Plattformsgränssnittet är **ett eget gränssnitt med egen sidomeny**, inte fler flikar i kursens
admin. Skälet: det är det enda stället där man ser över kursgränserna, och det ska aldrig kunna
blandas ihop med en enskild kurs. Det ersätter dagens undermeny (Admin, Alla kurser, Ny kurs,
Admininställningar i `app/(app)/admin/layout.tsx:26-52`).

### Rollerna

| Roll | Lagras | Kan |
|---|---|---|
| **Plattformsadmin** | `profiles.is_admin` (finns) | Allt, i alla kurser, och plattformsgränssnittet |
| **Kursansvarig** | `deck_examiners.role = 'ansvarig'` (ny) | Allt i sin kurs, också bjuda in och ta bort examinatorer och granskare, publicera när lanseringsspärren är uppfylld |
| **Examinator** | `deck_examiners.role = 'examinator'` (ny, standard) | Som i dag: innehåll, granskning, tentor, rapporter, statistik, inställningar utom publicering och personer |
| **Granskare** | `deck_examiners.role = 'granskare'` (ny) | Bara fliken Granskning och statistiken (t.ex. en amanuens eller en medexaminator för en del av kursen) |

Behörighetsmatris:

| Handling | Granskare | Examinator | Kursansvarig | Plattformsadmin |
|---|---|---|---|---|
| Se kursens översikt och statistik | Ja | Ja | Ja | Ja |
| Granska (godkänn, flagga, ta ur rotation) | Ja | Ja | Ja | Ja |
| Redigera kort, områden, import | | Ja | Ja | Ja |
| Tentor och tentaläget | | Ja | Ja | Ja |
| Felrapporter | | Ja | Ja | Ja |
| Kursinställningar (tentadatum, beskrivning) | | Ja | Ja | Ja |
| Bjuda in och ta bort personer i kursen | | | Ja | Ja |
| Publicera kursen (med spärr) | | | Ja | Ja |
| Publicera trots spärr, byta adress, arkivera, radera | | | | Ja |
| Skapa kurs, plattformsgränssnittet, utse plattformsadmin | | | | Ja |

Bakåtkompatibilitet: alla befintliga rader i `deck_examiners` får `role = 'examinator'`, vilket
exakt motsvarar vad de kan i dag. Johan kan sedan göras till `ansvarig` i Materialteknik.

---

## 4. Arkitekturbeslut

Varje beslut har ett rekommenderat alternativ. De som kräver Alvins ja är markerade.

| # | Beslut | Rekommendation | Alternativ som valdes bort |
|---|---|---|---|
| B1 | Hur roller lagras | Kolumnen `role` i `deck_examiners` med en check-lista, och en SQL-funktion `deck_role(deck_id)` som returnerar rollen (eller `admin`) | En egen tabell med behörigheter per handling (för flexibelt för behovet) |
| B2 | Var plattformsgränssnittet bor | Egen route-grupp `app/(app)/plattform` med egen layout och meny | Fler flikar under `/admin` (blandar kurs och plattform) |
| B3 | Hur aktuell kurs väljs | Kursen står i adressen (`/admin/kurs/<slug>/…`); sidomenyn följer adressen; senast valda kurs sparas i `localStorage` för `/admin` | Låst konstant (i dag), eller kurs i en kaka |
| B4 | Kursens id | Alltid `deckId(slug)` (UUIDv5), också när kursen skapas i gränssnittet | Slumpat id plus uppslag på slug i CLI:t (två sanningar) |
| B5 | Källan till innehållet | Som i dag: git är källan, databasen är driftläget, `pull` för tillbaka ändringar. Plattformsgränssnittet visar per kurs om databasen har ändringar som inte förts tillbaka | Databasen som enda källa (bryter källkritiken, granskningen i git och utgåvorna) |
| B6 | Händelselogg | Tabellen `audit_log`, skriven av triggers och av säkerhetsdefinierade funktioner, aldrig direkt av klienten | Loggning i serveråtgärderna (missar ändringar via SQL och CLI) |
| B7 | Inbjudningar | Behåll mönstret att adressen kopplas vid registrering; lägg till `role`, `invited_by`, `expires_at` och ett inbjudningsmejl | Inbjudningslänk med token (krångligare, och ger inget extra när adressen ändå måste stämma) |
| B8 | Kontaktuppgifter på Om och Hjälp | Ur databasen: personer med `show_as_contact` i `deck_examiners`; koden behåller bara `sourceHints` | Kvar i `lib/courses` (kräver kodändring per examinator) |
| B9 | Cache | En tagg per kurs (`deck:<id>`) plus en listtagg; `revalidateDeck` rensar bara den kursen | En tagg för allt (i dag) |
| B10 | Lanseringsspärren | Kontrolleras i `setDeckPublishedAction` och i en databasfunktion: publicering kräver 0 ogranskade kort och 0 flaggor, utom för plattformsadmin med uttrycklig överstyrning som loggas | Bara policy (i dag) |
| B11 | Ta bort kurser | Arkivera (`decks.archived_at`), aldrig radera i gränssnittet; radering bara via CLI med säkerhetskopia | Radering i gränssnittet (i dag, kaskaderar bort progress) |
| B12 | Studentens kurser | Senare: "Mina kurser" ur besök på kurslänken och historik, utan inskrivningstabell först | Inskrivningstabell direkt (behövs först vid många kurser) |
| B13 | Plattformsadmin kan bli fler | Ja, men aldrig färre än en: funktionen som tar bort rollen vägrar ta bort den sista. **Alvins ja behövs för vem.** | |
| B14 | Organisationer och program | Inte nu. Om det behövs senare: `decks.program` som etikett för filtrering, inte en ny behörighetsnivå | En organisationsnivå med egna admins (för tidigt) |

---

## 5. Principer för genomförandet

- **Materialteknik får aldrig märka något** förrän det är meningen. Nya funktioner ligger bakom
  inställningen `app_settings['flera_kurser']`, som läses på servern (som dolda flikar i dag).
- **Bara expanderande migrationer** med ÅNGRA-sektion, enligt `docs/ATERSTALLNING.md`. Inga
  kolumner tas bort förrän koden slutat använda dem i minst en utgåva.
- **Behörighet i tre lager, alltid:** RLS i databasen, vakt i serveråtgärden, och gränssnittet
  döljer det man inte får. Gränssnittet är aldrig det enda skyddet.
- **Varje roll testas i RLS-testerna** (`tests/unit/db/rls.test.ts`) innan den används i UI.
- **Designsystemet:** nya vyer byggs av `components/ui`, och plattformsgränssnittet följer samma
  stil som kursens admin.

---

## 6. Datamodell: migrationerna

I den ordning de körs. Namnen är förslag.

### M1 `…_roller_och_spar.sql`: roller, spårbarhet, arkivering

```sql
-- Roller i kursen. Befintliga rader blir 'examinator' (exakt dagens behörighet).
alter table public.deck_examiners
  add column role text not null default 'examinator'
    check (role in ('ansvarig', 'examinator', 'granskare')),
  add column added_by uuid references auth.users (id) on delete set null,
  add column show_as_contact boolean not null default false;

alter table public.deck_examiner_invites
  add column role text not null default 'examinator'
    check (role in ('ansvarig', 'examinator', 'granskare')),
  add column invited_by uuid references auth.users (id) on delete set null,
  add column expires_at timestamptz not null default now() + interval '60 days',
  add column last_sent_at timestamptz;

-- Arkivering i stället för radering, och tentans klockslag ur koden.
alter table public.decks
  add column archived_at timestamptz,
  add column exam_time time not null default '08:30',
  add column created_by uuid references auth.users (id) on delete set null;

alter table public.card_reports
  add column resolved_by uuid references auth.users (id) on delete set null;

-- Arkiverade kurser är aldrig publika.
-- (RLS för decks: is_published and archived_at is null, eller can_edit_deck.)
```

`link_examiner_invites` uppdateras så att rollen följer med från inbjudan och utgångna inbjudningar
inte kopplas.

### M2 `…_rollfunktioner.sql`: behörighet per roll

```sql
-- Rollen i kursen för den inloggade, eller 'admin', eller null.
create or replace function public.deck_role(p_deck_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then 'admin'
    else (select role from public.deck_examiners
          where deck_id = p_deck_id and user_id = auth.uid())
  end;
$$;

-- Minst en viss nivå: granskare < examinator < ansvarig < admin.
create or replace function public.has_deck_role(p_deck_id uuid, p_min text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(array_position(array['granskare','examinator','ansvarig','admin'], public.deck_role(p_deck_id))
                  >= array_position(array['granskare','examinator','ansvarig','admin'], p_min), false);
$$;
```

`can_edit_deck(deck)` behålls och betyder fortsatt "examinator eller högre", så att all
befintlig RLS fungerar oförändrad:

```sql
create or replace function public.can_edit_deck(p_deck_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_deck_role(p_deck_id, 'examinator');
$$;
```

Nya regler där granskare behövs:

| Tabell eller funktion | I dag | Efter M2 |
|---|---|---|
| `cards` SELECT för redaktörer | `can_edit_deck` | `has_deck_role(deck_id, 'granskare')` |
| `cards` UPDATE av granskningsfälten | `can_edit_deck` | Granskare via en säkerhetsdefinierad funktion `review_card(...)` som bara rör `review_status`, `reviewed_*`, `flag_*`; övrig UPDATE kräver `examinator` |
| `deck_stats_overview`, `deck_digest` | `can_edit_deck` | `has_deck_role(..., 'granskare')` |
| `add_deck_examiner`, `remove_deck_examiner`, `list_deck_examiners` | `is_admin()` | `has_deck_role(deck, 'ansvarig')`; en ansvarig kan inte ge rollen `ansvarig` till sig själv eller ta bort den sista ansvariga |
| `decks` UPDATE | `can_edit_deck` plus vakt på `slug`, `is_published` | Vakten utökas: `source_hash` och `sort_order` bara pipelinen och admin; `is_published` även `ansvarig`, via B10; `archived_at` bara admin |

### M3 `…_handelselogg.sql`: händelselogg

```sql
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references auth.users (id) on delete set null,
  action text not null,        -- t.ex. 'deck.publish', 'examiner.add', 'role.change'
  deck_id uuid references public.decks (id) on delete set null,
  target text,                 -- t.ex. e-post eller kortnyckel
  details jsonb not null default '{}'
);
create index audit_log_deck_idx on public.audit_log (deck_id, at desc);
create index audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
-- Läsa: plattformsadmin allt, kursansvarig sin kurs. Skriva: bara funktioner och triggers.
```

Triggers loggar:
- `decks`: publicering, adressbyte, arkivering, tentadatum, tentaläget.
- `deck_examiners` och `deck_examiner_invites`: tillägg, borttagning, rollbyte.
- `profiles.is_admin`: ändringar.
- `card_reports`: åtgärdade rapporter.

Korten loggas inte här, eftersom `card_versions` och `reviewed_by` redan täcker dem.

Gallring: händelseloggen sparas i två år (läggs till i `purge_old_data`, och beskrivs i
integritetspolicyn och `docs/PERSONUPPGIFTER.md`).

### M4 `…_plattformsfunktioner.sql`: data för plattformsgränssnittet

Säkerhetsdefinierade funktioner som bara plattformsadmin får köra:

| Funktion | Returnerar |
|---|---|
| `platform_courses()` | Per kurs: titel, adress, publicerad, arkiverad, antal kort, ogranskade, flaggade, öppna felrapporter, aktiva studenter senaste 7 dagarna, tentadatum, antal examinatorer, senaste ändring |
| `platform_people(p_search text)` | Per person: namn, e-post, plattformsadmin, kurser med roll, senast aktiv, språk. Bara personer med en roll eller som söks fram med e-post, aldrig en lista över alla studenter |
| `platform_invites()` | Väntande inbjudningar med kurs, roll, inbjuden av, utgång |
| `platform_set_admin(p_user uuid, p_admin boolean)` | Sätter eller tar bort plattformsadmin; vägrar ta bort den sista |
| `platform_set_role(p_deck uuid, p_user uuid, p_role text)` | Byter roll; loggas |

`platform_people` har en medvetet snäv sökning: plattformsgränssnittet är inte en
studentkatalog. Personer utan roll visas bara när man söker på exakt e-post (för att kunna göra
någon till examinator).

### M5 `…_lanseringssparr.sql`: lanseringsspärren

`publish_deck(p_deck uuid, p_override boolean)` publicerar bara om `count(ogranskade) = 0` och
`count(flaggade) = 0`, eller om anroparen är plattformsadmin och `p_override` är sann (loggas med
skäl i `details`). `setDeckPublishedAction` anropar funktionen i stället för att uppdatera direkt.

---

## 7. Behörighet i appen

| Fil | Ändring |
|---|---|
| `lib/admin/access.ts` | `getAdminContext()` returnerar `{ userId, isAdmin, roles: Record<deckId, Role> }` i stället för `examinerDeckIds`. `canEditDeck` blir `deckRole(ctx, deckId)` och `hasDeckRole(ctx, deckId, min)` |
| `lib/actions/guard.ts` | `requireDeckRole(deckId, min)` och `deckRoleAction(min, fn)`; `editorAction` blir ett alias för `deckRoleAction('examinator', …)`, så att befintliga åtgärder inte behöver ändras |
| `lib/admin/review-actions.ts` | `deckRoleAction('granskare', …)` för godkänn, flagga, åtgärda, ta ur rotation |
| `lib/admin/actions.ts:382-405` | Examinatoråtgärderna kräver `ansvarig`, och tar en roll |
| `lib/auth/admin-gate.ts` | Släpper in den som har någon roll (oförändrat beteende); `/plattform` släpps bara in för admin |
| `middleware.ts` | Ny gren för `/plattform` (403 för andra) |
| `app/(app)/admin/deck/[id]/layout.tsx` | `hasDeckRole(…, 'granskare')` i stället för `canEditDeck`; skickar rollen till sidorna |
| Varje admin-sida | Kontrollerar sin egen miniminivå (tabellen i avsnitt 3), så att en granskare som skriver in adressen till Innehåll får 403 |

---

## 8. Plattformsgränssnittet

Route-grupp `app/(app)/plattform` med egen layout. Sidomenyn visar en sektion **Plattform** för
plattformsadmin (ersätter Alla kurser och Designsystem i dagens `Sidebar.tsx:167`).

| Sida | Adress | Innehåll |
|---|---|---|
| Översikt | `/plattform` | Nyckeltal över alla kurser (kurser i drift, aktiva studenter, ogranskade kort, öppna felrapporter), en lista **Behöver åtgärd** (kurser med flaggor, gamla felrapporter, inbjudningar som snart går ut, databasändringar som inte förts tillbaka till git) |
| Kurser | `/plattform/kurser` | Tabell med alla kurser och deras status (ur `platform_courses()`); filter: i drift, under uppbyggnad, arkiverade. Knappar: öppna kursen, publicera, arkivera |
| Ny kurs | `/plattform/kurser/ny` | Skapar kursen med `deckId(slug)` (B4), första examinatorn och rollen; visar sedan stegen ur `docs/NY-KURS.md` som en checklista |
| Kurs | `/plattform/kurser/<slug>` | Kursens personer och roller, publicering med spärrens status, arkivering, händelseloggen för kursen, länk till kursens admin |
| Personer | `/plattform/personer` | Alla med en roll: namn, e-post, kurser med roll, senast aktiv. Sök på e-post. Lägg till i en eller flera kurser på en gång, byt roll, ta bort, gör till plattformsadmin |
| Inbjudningar | `/plattform/inbjudningar` | Väntande inbjudningar, skicka mejlet igen, förläng, återkalla |
| Händelselogg | `/plattform/logg` | `audit_log` med filter på kurs, person och typ |
| Drift | `/plattform/drift` | Senaste nattjobbet och dess svar, skickade mejl per typ (ur `email_log`), senaste säkerhetskopian (rapporteras av backupskriptet till `app_settings`), migrationsversion |
| Inställningar | `/plattform/installningar` | Dagens Admininställningar (dolda flikar) flyttas hit, plus inställningen `flera_kurser` |

Nya filer, i samma mönster som befintliga:

- `lib/platform/queries.ts`: anrop till M4-funktionerna, `server-only`.
- `lib/platform/actions.ts`: serveråtgärder med `adminAction`.
- `components/platform/*`: `CourseTable`, `PeopleTable`, `RoleSelect`, `InviteList`, `AuditLog`, `NeedsAttention`. Byggs av `components/ui` (Card, Select, Badge, StatTile, Menu, Modal).
- `lib/i18n/sv/plattform.ts` och `lib/i18n/en/plattform.ts`.
- `lib/routes.ts`: `routes.platform.*`.

### Inbjudningsmejlet

I dag skickas inget mejl när någon bjuds in. Examinatorn måste få veta det på annat sätt. Ny mall
i `lib/email/templates.ts` (`buildInviteEmail`, på mottagarens språk om kontot finns, annars
svenska) med kursens namn, rollen, vem som bjöd in och en länk till `/registrera?next=/admin/kurs/<slug>`.
Skickas från `addExaminerAction` och från "Skicka igen", via den befintliga mejlaren
(`lib/email/mailer.ts`), och loggas i `email_log` med `kind = 'invite'` (check-villkoret utökas).

---

## 9. Kursgränssnittet för flera kurser

| Fil | Ändring |
|---|---|
| `lib/admin/active-course.ts` | Tas bort efter övergången. Under övergången: om `flera_kurser` är av gäller låsningen som i dag |
| `lib/admin/nav.ts` | `getAdminNav(currentSlug)` bygger posterna för kursen i adressen; räknarna (utkast, felrapporter) per kurs |
| `components/layout/Sidebar.tsx:150-170` | Under Administration: kursens namn som en väljare (`Menu`) när personen har fler än en kurs, annars bara namnet. Posterna filtreras på rollen (granskare ser Översikt och Granskning) |
| `app/(app)/admin/page.tsx` | Leder till senast valda kurs (ur `localStorage` via en liten klientkomponent), annars den enda, annars en lista med personens kurser |
| `app/(app)/admin/deck/[id]/…` | Flyttas till `app/(app)/admin/kurs/[slug]/…`. Gamla adresser leds om i `middleware.ts` (id till slug), så att bokmärken och länkar i mejl fortsätter fungera |
| `app/(app)/admin/deck/[id]/installningar` | Fliken Personer för kursansvariga: `ExaminerManager` med roll, "visa som kontakt" och inbjudningens status |
| `components/admin/review/*` | Oförändrade; vakten flyttar till `deckRoleAction('granskare')` |
| `docs/granskningsguide` | Uppdateras när adresserna och menyn ändras (`npm run pdf -- granskningsguide`) |

---

## 10. Innehållspipelinen med flera kurser

| Vad | Ändring | Fil |
|---|---|---|
| Kursens id | `saveDeckAction` (ny kurs) och plattformens Ny kurs använder `deckId(slug)` ur `lib/content/model.ts` (i CLI:t importerad som `deckIdFor`) | `lib/admin/actions.ts:80`, `lib/content/model.ts:78-80` |
| Befintliga kurser med slumpat id | CLI:t slår upp på slug om id saknas och varnar; ett engångsskript byter id (kaskad via `on update cascade` eller kopiering), eftersom progressen hänger på kortens id, inte kursens | `scripts/kommandon/innehall.ts:159,220`, `engelska.ts:60`, `tentor.ts:65` |
| Ny kurs från plattformen till git | `npm run kuggfri -- pull <kurs>` skapar `content/<kurs>/` ur databasen första gången | `scripts/kommandon/innehall.ts` |
| Osynkade ändringar | `platform_courses()` jämför kursens senaste ändring (max av `updated_at` för kort och områden) med tiden för senaste `apply` (ny kolumn `decks.applied_at`, sätts av `sync_deck`); visas i plattformens Behöver åtgärd | migration plus `sync_deck` |
| Kurskonfiguration | `examiner` i `lib/courses` ersätts av `show_as_contact` (B8); `examStart` av `decks.exam_time`; kvar i koden: `sourceHints` | `lib/courses/*`, `lib/contact.ts:20`, `components/home/HomeDashboard.tsx:60-63` |
| Testet för kurskonfiguration | Kräver inte längre en fil per kurs; kräver bara giltiga `sourceHints` där de finns | `tests/unit/courses/courses.test.ts` |
| Källtips | `sourceHints` slås i dag ihop över alla kurser (`lib/cards/sources.ts:65`); görs per kurs, så att en kurs filnamn inte påverkar en annan | `lib/cards/sources.ts` |
| Dokumentationen | `docs/INNEHALL.md:277` säger `kurs:`, `kategori:` och `kort:`, men koden (`lib/content/model.ts:78-88`) använder `deck:`, `category:` och `card:`; dokumentet rättas, aldrig koden (id:na i drift hänger på den) | `docs/INNEHALL.md` |
| Canvas | En token per person (i dag Alvins). För fler kurser: tillåtelselistan per kurs finns; token per kurs i `.env.local` (`CANVAS_TOKEN_<KURS>`) när någon annan än Alvin har åtkomst | `scripts/canvas.ts:33-54` |

---

## 11. Drift med flera kurser

| Vad | Ändring | Fil |
|---|---|---|
| Cache | En tagg per kurs (`deck:<id>`) och en för listan; `revalidateDeck(id)` rensar bara den kursen; `/api/revalidate` tar en kurs | `lib/content/queries.ts:16-46`, `lib/cache/revalidate.ts`, `app/api/revalidate/route.ts` |
| Veckobrevet | Kursens personer får sin kurs. Plattformsadmin får **ett** samlat plattformsbrev (alla kurser i en tabell) i stället för ett per kurs | `digest_recipients()`, `app/api/cron/daily/route.ts`, `lib/email/templates.ts` |
| Nattjobbet | Skriver sitt svar till `app_settings['cron_senast']`, så att plattformens Drift kan visa det | `app/api/cron/daily/route.ts` |
| Säkerhetskopian | Backupskriptet skriver tid och storlek till `app_settings['backup_senast']` via service role | `scripts/backup.cjs` |
| Index | `deck_examiners (deck_id)` finns via primärnyckeln; nytt index `review_log (card_id, reviewed_at)` om statistiken blir långsam med fler kurser (mät först) | migration |
| Lasttest | Kör `scripts/verktyg/load-test.cjs` mot flera kurser samtidigt innan tredje kursen | `scripts/verktyg/load-test.cjs:13` |
| Underhållsgrinden | Behålls global och tas bort när tjänsten väl är öppen (`lib/maintenance.ts:24-25`); kurser under uppbyggnad är opublicerade, vilket räcker | |

---

## 12. Studentsidan med flera kurser

Det mesta fungerar redan (kurslistan, statistik per kurs, studielägen per kurs). Kvar:

| Vad | Ändring | Fil |
|---|---|---|
| Hemsidan | Med flera kurser i gång: ett gemensamt "i dag" över kurserna (summa kort, en knapp per kurs) och radarn för den kurs man valt; i dag väljs en primär kurs | `components/home/HomeDashboard.tsx:128,170-240` |
| Mina kurser | Kurser man öppnat via länk eller pluggat i visas först; övriga under "Fler kurser" | `app/(app)/kurser/page.tsx`, `lib/content/queries.ts` |
| Sidomenyn | Kurssidan och Tentaläget pekar på senast använda kurs när det finns flera, i stället för att bara visas under `/d/<kurs>` | `components/layout/Sidebar.tsx:195-197` |
| Om och Hjälp | Kontaktkort per kurs ur databasen (B8) | `lib/contact.ts`, `app/(info)/*` |
| Integritetspolicyn | Nämner händelseloggen (personer med roll) och inbjudningsmejlet | `app/(info)/integritet/page.tsx`, `components/info/PrivacyEn.tsx` |

---

## 13. Etapperna

Varje etapp går att lansera för sig och kräver ingen av de senare.

### Etapp 0: förberedelser utan synliga ändringar (kan göras när som helst)

| Steg | Storlek | Varför nu |
|---|---|---|
| Vakten på `decks` utökas till `source_hash` och `sort_order` | Liten | Säkerhetsdetalj i dag, oberoende av utbyggnaden |
| Ny kurs i admin använder `deckId(slug)` | Liten | Varje kurs som skapas före ändringen blir en engångsmigrering senare |
| En andra testkurs i `content/` (`testkurs`, opublicerad, tio kort) och `DECK_SLUG` som parameter i E2E och det visuella testet | Mellan | Fångar nya antaganden om en kurs från första dagen |
| Rätta `docs/INNEHALL.md:277` till kodens prefix `deck:`, `category:`, `card:` | Liten | Dokumentationen ska stämma; koden ändras aldrig, id:na i drift hänger på den |
| Inställningen `flera_kurser` i `app_settings` (läses, gör inget än) | Liten | Allt senare kan byggas bakom den |
| Cache per kurs (B9) | Liten | Ger bara vinst, ändrar inget synligt |

### Etapp 1: roller och spårbarhet (M1 till M3)

Migrationerna, `deck_role` och `has_deck_role`, nya vakter i appen (avsnitt 7), RLS-tester för
alla fyra roller, händelseloggen med triggers. Inget nytt gränssnitt än; befintliga examinatorer
blir `examinator` och märker ingen skillnad.

**Klart när:** RLS-testerna visar matrisen i avsnitt 3 för varje roll, och händelseloggen fylls
vid publicering och ändrade examinatorer.

### Etapp 2: plattformsgränssnittet (M4, M5)

`/plattform` med Översikt, Kurser, Personer, Inbjudningar, Logg och Inställningar;
inbjudningsmejlet; lanseringsspärren. Dagens undermeny i `/admin` tas bort.

**Klart när:** Alvin kan skapa en kurs, bjuda in en kursansvarig och en granskare, se dem
registrera sig och publicera kursen när granskningen är klar, utan SQL och utan CLI för något av
det.

### Etapp 3: kursgränssnittet för flera kurser

Kursväljaren, adresser med slug, rollstyrd meny, fliken Personer för kursansvariga, borttagen
låsning till Materialteknik.

**Klart när:** en person med roller i två kurser kan växla mellan dem, och en granskare ser bara
det hen får.

### Etapp 4: innehåll och drift

Kontaktuppgifter och tentans klockslag ur databasen, osynkade ändringar i plattformens översikt,
veckobrevet till plattformsadmin, Drift-sidan, lasttest med flera kurser.

### Etapp 5: studentsidan

Gemensamt "i dag", Mina kurser och sidomenyn med flera kurser. Görs när den andra kursen har
studenter.

Ordningen följer `docs/Framtidsplan.pdf`: etapp 0 under hösten, etapp 1 och 2 i fas 2 (före
grind G2), etapp 3 och 4 när den första pilotkursen startar, etapp 5 när två kurser är i drift
samtidigt.

---

## 14. Risker vid genomförandet

| Risk | Motåtgärd |
|---|---|
| En migration låser ute Materialtekniks examinatorer | `can_edit_deck` behåller sin betydelse (avsnitt 6, M2); RLS-testerna körs mot en kopia av produktionens roller före `db push`; säkerhetskopia och återställningstest före varje migration |
| Adressbytet bryter länkar i mejl och bokmärken | Omdirigering från `/admin/deck/<id>/…` till `/admin/kurs/<slug>/…` i middleware, med tester |
| En kursansvarig tar bort sig själv eller den sista ansvariga | Funktionerna vägrar; plattformsadmin kan alltid återställa |
| Händelseloggen innehåller personuppgifter | Bara roller och åtgärder, inga studentdata; gallras efter två år; beskrivs i policyn |
| Kurser med slumpat id | Etapp 0 stoppar nya; engångsskript för befintliga |
| Granskningsguiden och studentguiden blir inaktuella | De byggs om med `npm run pdf` i samma etapp som gränssnittet ändras |

---

## 15. Allt som är hårdkodat till Materialteknik i dag

Måste ses över i etapp 0 (tester och verktyg) eller etapp 3 (appen).

**Appen**
- `lib/admin/active-course.ts:13`: `ACTIVE_ADMIN_COURSE_SLUG = "materialteknik"`, används i `lib/admin/nav.ts:37` och `app/(app)/admin/page.tsx:13`.
- `lib/courses/index.ts:47`: `ALL_COURSES = [materialteknik]`; `lib/courses/materialteknik.ts`: examinatorns kontakt.
- `lib/contact.ts:20`: kontaktkort ur kodkonfigurationen.
- `components/home/HomeDashboard.tsx:60-63`: tentans klockslag ur kodkonfigurationen.
- `components/layout/Sidebar.tsx:195-197`: Kurssidan och Tentaläget pekar på `courses[0]` när det finns en kurs.
- `app/(app)/kurser/page.tsx:43`: leder till `decks[0]` när det finns en kurs.
- `components/mystats/MyStatsDashboard.tsx:108`: `firstDeck = scoped[0] ?? decks[0]`.

**Tester**
- `tests/e2e/helpers.ts:13`: `DECK_SLUG = "materialteknik"`; `:37-39` klickar på "Materialteknik".
- `tests/e2e/cleanup.ts:19`: `PROTECTED_DECK_SLUGS = ["materialteknik"]`.
- `tests/e2e/public.spec.ts:18`.
- `tests/visual/data.ts:21`: `DECK_SLUG`.
- `tests/unit/admin/e2e-cleanup.test.ts:40`: kontrollerar låsningen.
- `tests/unit/content/originalkorten.test.ts:16,60`.
- `tests/unit/courses/courses.test.ts:19-32`: Materialtekniks värden och en examinators e-post.

**Verktyg och skript**
- `scripts/verktyg/demo-studenter.cjs:30,46` (områdenas svårighet för index 0 till 13).
- `scripts/verktyg/simulate-progress.cjs:38`, `scripts/verktyg/load-test.cjs:13`, `scripts/verktyg/demo-shots.cjs`.
- `scripts/verktyg/build-review-pdf.tsx:186`.
- `scripts/pdf/demostudent.ts:34,130`, `scripts/pdf/studentguide.cjs:17`, `scripts/pdf/skarmbilder-*.cjs`.

**Dokumentation**
- `docs/NY-KURS.md:74-83` listar de kända låsningarna; uppdateras när de tas bort.
- `DECISIONS.md:389-398`: beslutet om låsningen; ett nytt beslut ersätter det i etapp 3.

---

## 16. Beslut som behövs från Alvin innan etapp 1

1. Rollerna: räcker ansvarig, examinator och granskare, eller behövs fler (till exempel en
   läsroll för kursledningen som bara ser statistiken)?
2. Får en kursansvarig bjuda in andra till sin kurs, eller ska alla inbjudningar gå via Alvin?
3. Vem blir plattformsadmin utöver Alvin, och när (medförvaltaren i Framtidsplanen)?
4. Hur länge sparas händelseloggen (förslaget är två år)?
5. Ska kurser kunna raderas i gränssnittet alls, eller bara arkiveras (förslaget är bara
   arkiveras)?
6. Lanseringsspärren: ska även flaggade kort spärra publicering, eller bara ogranskade?
