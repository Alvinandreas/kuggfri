-- Uttryckliga tabellrättigheter, så att inget beror på Supabases default privileges.
--
-- Tentaläget kraschade på kuggfri.com (2 okt 2026, mötet med examinatorerna) med
-- "permission denied for table exams": produktionen gav inte service_role några rättigheter
-- på tabellerna från tentalägets migration, medan den lokala databasen gjorde det automatiskt.
-- Därför syntes felet varken lokalt, på 3001 eller i E2E. Samma beroende fanns för
-- studentens läsning av sina tentaförsök och för redaktörens läsning av korthistoriken.
--
-- Nu delas allt som koden behöver ut här, och det automatiska dras in där det gav mer än så
-- (lokalt), så att den lokala databasen och produktionen har samma rättigheter.
--
-- - service_role (servern: tentabanken, försöken, det dagliga jobbet): alla tabeller. Rollen
--   går förbi RLS och används bara på servern, där anroparen själv avgör vem som får se vad.
-- - exams: bara service_role. Facit ligger i tabellen; ingen läser den med användarens klient.
-- - exam_attempts: studenten läser och raderar sina egna försök (RLS) och startar ett försök
--   med bara exam_id. Svar, inlämning och poäng skriver servern.
-- - card_versions: redaktören läser historiken (RLS). Triggern skriver (security definer).
--
-- Expanderande för service_role; för anon/authenticated dras bara sådant in som koden aldrig
-- använder.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Tabeller som skapas av senare migrationer får samma rättigheter för service_role.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

revoke all on public.exams from anon, authenticated;

revoke all on public.exam_attempts from anon, authenticated;
grant select, delete on public.exam_attempts to authenticated;
grant insert (exam_id) on public.exam_attempts to authenticated;

revoke all on public.card_versions from anon, authenticated;
grant select on public.card_versions to authenticated;

-- ÅNGRA (se docs/ATERSTALLNING.md): rättigheterna behöver inte dras tillbaka; de är vad
-- koden förutsätter. Vill man ändå:
-- alter default privileges in schema public revoke all on tables from service_role;
-- alter default privileges in schema public revoke all on sequences from service_role;
