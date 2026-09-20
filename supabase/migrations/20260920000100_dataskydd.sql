-- Dataskydd: gör "ladda ner mina data" fullständig och inför automatisk gallring.
--
-- 1. Användaren får läsa sina egna rader i email_log (GDPR art. 15: rätt till tillgång).
--    Skrivning är fortfarande bara service role; ingen kan ändra eller radera loggen.
-- 2. purge_old_data(): gallrar det som inte ska sparas för alltid.
--      - email_log äldre än 90 dagar (loggen finns för att inte skicka dubbelt, inte som historik)
--      - åtgärdade felrapporter äldre än 180 dagar (texten kan innehålla fritext från studenten)
--      - anonymiserar kvarvarande felrapporters kontaktfält efter 180 dagar
--    Körs av det dagliga cron-jobbet. Bara service role får anropa den.
-- Expanderande ändring: en policy och en funktion.

create policy "email_log: läs egna" on public.email_log
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.email_log to authenticated;

comment on table public.email_log is 'Vilka mejl som skickats till vem och när, så att inget skickas dubbelt. Gallras efter 90 dagar.';

create or replace function public.purge_old_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  emails integer;
  reports integer;
  contacts integer;
begin
  if not public.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.email_log where sent_at < now() - interval '90 days';
  get diagnostics emails = row_count;

  delete from public.card_reports where status = 'resolved' and resolved_at < now() - interval '180 days';
  get diagnostics reports = row_count;

  update public.card_reports
  set contact = null
  where contact is not null and created_at < now() - interval '180 days';
  get diagnostics contacts = row_count;

  return jsonb_build_object('email_log_deleted', emails, 'reports_deleted', reports, 'contacts_cleared', contacts);
end;
$$;

revoke execute on function public.purge_old_data() from public, anon, authenticated;
grant execute on function public.purge_old_data() to service_role;

-- Konton som inte använts på länge. Returnerar bara en lista att granska; raderar ingenting.
-- Radering av ett konto är alltid ett medvetet beslut (eller användarens eget val under Konto).
create or replace function public.dormant_accounts(p_months integer default 24)
returns table (user_id uuid, email text, last_seen timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select p.id, u.email::text, greatest(
    coalesce((select max(rl.reviewed_at) from public.review_log rl where rl.user_id = p.id), p.created_at),
    coalesce(u.last_sign_in_at, p.created_at)
  ) as last_seen
  from public.profiles p
  join auth.users u on u.id = p.id
  where greatest(
    coalesce((select max(rl.reviewed_at) from public.review_log rl where rl.user_id = p.id), p.created_at),
    coalesce(u.last_sign_in_at, p.created_at)
  ) < now() - make_interval(months => p_months)
  order by 3;
end;
$$;

revoke execute on function public.dormant_accounts(integer) from public, anon, authenticated;
grant execute on function public.dormant_accounts(integer) to service_role;

-- Radering av konto ska inte lämna kvar en kontaktadress som studenten lämnat i en felrapport.
-- Rapportens text behålls (den handlar om kortet, inte om personen) men kopplas bort helt:
-- user_id nollställs av främmande nyckeln, och kontaktfältet rensas här.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.card_reports set contact = null where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ÅNGRA (se docs/ATERSTALLNING.md). delete_my_account() återställs till versionen i
-- 20260911000000_init.sql (utan update-raden).
-- drop function if exists public.dormant_accounts(integer);
-- drop function if exists public.purge_old_data();
-- revoke select on public.email_log from authenticated;
-- drop policy if exists "email_log: läs egna" on public.email_log;
