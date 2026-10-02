-- Deltagarlistor per kurs (beslut efter mötet 2 okt 2026).
--
-- Kursmaterialet (bland annat figurer och uppgifter från kurslitteraturen) får bara nås av dem som
-- läser kursen. Därför:
--
-- 1. deck_enrollments: kursens deltagarlista, en e-postadress per rad. Examinatorer och admin
--    lägger in adresser i klump (lib/enrollment, adminfliken Deltagare). Raden kopplas till kontot
--    (user_id) när någon med adressen har ett bekräftat konto.
-- 2. Registreringen är stängd för adresser som inte står på någon deltagarlista och inte har en
--    examinatorinbjudan. Spärren sitter i en trigger på auth.users, så den gäller även den som
--    anropar Supabase Auth direkt med den publika nyckeln. Konton som skapas av skript och tester
--    via admin-API:t (app_metadata.kuggfri_skapad_av = 'skript', som en vanlig registrering inte
--    kan sätta) och det allra första kontot i ett nytt projekt (ingen admin finns än) släpps igenom.
-- 3. Korten i en publicerad kurs kan bara läsas av kursens deltagare (och redaktörerna), inte av
--    alla inloggade och inte av gäster. Appen läser innehållet med servern och kontrollerar
--    åtkomsten per kurs (lib/enrollment/access.ts); policyn hindrar att API:t går runt det.
--
-- Bara adressen sparas, inget namn: listan behövs för åtkomsten och inget annat
-- (docs/PERSONUPPGIFTER.md). Examinatorn ser listan men inte vilka som skapat konto; det ser
-- bara admin, för support.

create table public.deck_enrollments (
  deck_id uuid not null references public.decks (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  user_id uuid references auth.users (id) on delete set null,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (deck_id, email)
);

comment on table public.deck_enrollments is 'Kursens deltagarlista. Bara de som står här (eller redigerar kursen) läser kursens kort.';

create index deck_enrollments_user_idx on public.deck_enrollments (user_id) where user_id is not null;
create index deck_enrollments_email_idx on public.deck_enrollments (email);

alter table public.deck_enrollments enable row level security;
-- Inga policyer: listan läses och skrivs bara via funktionerna nedan.
revoke all on public.deck_enrollments from anon, authenticated;
grant all on public.deck_enrollments to service_role;

-- ---------------------------------------------------------------------------
-- Åtkomst
-- ---------------------------------------------------------------------------

create or replace function public.is_enrolled(p_deck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.deck_enrollments e
    where e.deck_id = p_deck_id and e.user_id is not null and e.user_id = auth.uid()
  );
$$;

/** Får besökaren läsa kursens innehåll: redaktör eller deltagare. */
create or replace function public.can_view_deck(p_deck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_edit_deck(p_deck_id) or public.is_enrolled(p_deck_id);
$$;

/** Kurserna besökaren får läsa (för kurslistan, hemsidan och sidomenyn). */
create or replace function public.my_deck_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id from public.decks d where public.can_view_deck(d.id);
$$;

grant execute on function public.is_enrolled(uuid) to anon, authenticated, service_role;
grant execute on function public.can_view_deck(uuid) to anon, authenticated, service_role;
revoke execute on function public.my_deck_ids() from public, anon;
grant execute on function public.my_deck_ids() to authenticated, service_role;

-- Korten: deltagare (och redaktörer) läser kursens aktiva, granskade kort. Gäster och inloggade
-- som inte står på listan läser inga kort alls.
drop policy "cards: läs publicerade" on public.cards;
create policy "cards: läs publicerade" on public.cards
  for select to anon, authenticated
  using (
    public.can_edit_deck(deck_id)
    or (
      is_active
      and review_status is null
      and exists (select 1 from public.decks d where d.id = deck_id and d.is_published)
      and public.is_enrolled(deck_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Registreringen
-- ---------------------------------------------------------------------------

/**
 * Får adressen skapa ett konto: den står på en deltagarlista eller har en examinatorinbjudan,
 * eller så finns ingen admin än (det första kontot i ett nytt projekt). Bara för servern:
 * en öppen funktion skulle låta vem som helst pröva om en adress läser en kurs.
 */
create or replace function public.email_may_register(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.deck_enrollments e where e.email = lower(trim(p_email)))
    or exists (select 1 from public.deck_examiner_invites i where i.email = lower(trim(p_email)))
    or not exists (select 1 from public.profiles p where p.is_admin);
$$;

revoke execute on function public.email_may_register(text) from public, anon, authenticated;
grant execute on function public.email_may_register(text) to service_role;

create or replace function public.guard_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'kuggfri_skapad_av', '') = 'skript' then
    return new;
  end if;
  if new.email is not null and public.email_may_register(new.email) then
    return new;
  end if;
  raise exception 'Registreringen är stängd för adresser som inte står på en kurs deltagarlista.'
    using errcode = '42501', hint = 'kuggfri:inte-pa-listan';
end;
$$;

revoke execute on function public.guard_registration() from public, anon, authenticated;

create trigger on_auth_user_registering
  before insert on auth.users
  for each row execute function public.guard_registration();

-- ---------------------------------------------------------------------------
-- Kopplingen konto <-> deltagarlista
-- ---------------------------------------------------------------------------

/** Kopplar listans rader för adressen till kontot, men bara när adressen är bekräftad. */
create or replace function public.link_enrollments(p_user_id uuid, p_email text, p_confirmed timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_email is null or p_confirmed is null then
    return;
  end if;
  update public.deck_enrollments
     set user_id = p_user_id
   where email = lower(trim(p_email)) and user_id is null;
end;
$$;

revoke execute on function public.link_enrollments(uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.handle_user_enrollments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.link_enrollments(new.id, new.email, new.email_confirmed_at);
  return new;
end;
$$;

revoke execute on function public.handle_user_enrollments() from public, anon, authenticated;

create trigger on_auth_user_created_enrollments
  after insert on auth.users
  for each row execute function public.handle_user_enrollments();

create trigger on_auth_user_confirmed_enrollments
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_enrollments();

-- ---------------------------------------------------------------------------
-- Redaktörernas funktioner (adminfliken Deltagare)
-- ---------------------------------------------------------------------------

/**
 * Lägger till adresser på kursens lista. Ogiltiga adresser hoppas över, dubbletter räknas en gång.
 * Adresser som redan har ett bekräftat konto kopplas direkt. Svarar med antal nya, antal som
 * redan stod på listan och antal som kopplades till ett befintligt konto.
 */
create or replace function public.add_deck_enrollments(p_deck_id uuid, p_emails text[])
returns table (added integer, already integer, linked integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text[];
  v_added integer;
  v_linked integer;
begin
  if not public.can_edit_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(array_length(p_emails, 1), 0) > 5000 then
    raise exception 'too_many' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct c), '{}')
    into v_clean
    from (select lower(trim(e)) as c from unnest(p_emails) e) s
   where c ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(c) <= 254;

  with ins as (
    insert into public.deck_enrollments (deck_id, email, added_by)
    select p_deck_id, c, auth.uid() from unnest(v_clean) c
    on conflict (deck_id, email) do nothing
    returning 1
  )
  select count(*)::integer into v_added from ins;

  with upd as (
    update public.deck_enrollments de
       set user_id = u.id
      from auth.users u
     where de.deck_id = p_deck_id
       and de.user_id is null
       and lower(u.email) = de.email
       and u.email_confirmed_at is not null
    returning 1
  )
  select count(*)::integer into v_linked from upd;

  return query select v_added, coalesce(array_length(v_clean, 1), 0) - v_added, v_linked;
end;
$$;

/** Tar bort adresser från kursens lista. Kontot finns kvar, men kursen försvinner för det. */
create or replace function public.remove_deck_enrollments(p_deck_id uuid, p_emails text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removed integer;
begin
  if not public.can_edit_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with del as (
    delete from public.deck_enrollments
     where deck_id = p_deck_id
       and email in (select lower(trim(e)) from unnest(p_emails) e)
    returning 1
  )
  select count(*)::integer into v_removed from del;
  return v_removed;
end;
$$;

/**
 * Kursens lista. `registered` (har ett konto) lämnas bara ut till admin, för support:
 * examinatorn ser inget om enskilda studenter, bara antalet (deck_enrollment_counts).
 */
create or replace function public.list_deck_enrollments(p_deck_id uuid)
returns table (email text, registered boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_edit_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select e.email,
           case when public.is_admin() then e.user_id is not null else null end,
           e.created_at
      from public.deck_enrollments e
     where e.deck_id = p_deck_id
     order by e.email;
end;
$$;

/** Antal på listan och antal med konto, för redaktörerna. */
create or replace function public.deck_enrollment_counts(p_deck_id uuid)
returns table (total integer, registered integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_edit_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select count(*)::integer, count(e.user_id)::integer
      from public.deck_enrollments e
     where e.deck_id = p_deck_id;
end;
$$;

revoke execute on function public.add_deck_enrollments(uuid, text[]) from public, anon;
revoke execute on function public.remove_deck_enrollments(uuid, text[]) from public, anon;
revoke execute on function public.list_deck_enrollments(uuid) from public, anon;
revoke execute on function public.deck_enrollment_counts(uuid) from public, anon;
grant execute on function public.add_deck_enrollments(uuid, text[]) to authenticated, service_role;
grant execute on function public.remove_deck_enrollments(uuid, text[]) to authenticated, service_role;
grant execute on function public.list_deck_enrollments(uuid) to authenticated, service_role;
grant execute on function public.deck_enrollment_counts(uuid) to authenticated, service_role;

-- ÅNGRA (se docs/ATERSTALLNING.md):
-- drop trigger if exists on_auth_user_registering on auth.users;
-- drop trigger if exists on_auth_user_created_enrollments on auth.users;
-- drop trigger if exists on_auth_user_confirmed_enrollments on auth.users;
-- återskapa policyn "cards: läs publicerade" ur 20261001000000_inaktiva_kort_dolda.sql;
-- drop function if exists public.add_deck_enrollments(uuid, text[]), public.remove_deck_enrollments(uuid, text[]),
--   public.list_deck_enrollments(uuid), public.deck_enrollment_counts(uuid), public.handle_user_enrollments(),
--   public.link_enrollments(uuid, text, timestamptz), public.guard_registration(), public.email_may_register(text),
--   public.my_deck_ids(), public.can_view_deck(uuid), public.is_enrolled(uuid);
-- drop table if exists public.deck_enrollments;
