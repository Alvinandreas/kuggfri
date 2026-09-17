-- Examinatorer kan förberedas innan personen registrerat sig: adressen sparas som
-- en väntande inbjudan och kopplas automatiskt till kontot när det skapas
-- (handle_new_user). Bara admin läser/skriver, via funktionerna nedan.

create table public.deck_examiner_invites (
  deck_id uuid not null references public.decks (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  created_at timestamptz not null default now(),
  primary key (deck_id, email)
);

comment on table public.deck_examiner_invites is 'Examinatorsrätt som väntar på att personen registrerar ett konto.';

revoke all on public.deck_examiner_invites from anon, authenticated;
alter table public.deck_examiner_invites enable row level security;

-- Vid registrering: koppla väntande inbjudningar till det nya kontot.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''))
  on conflict (id) do nothing;

  insert into public.deck_examiners (deck_id, user_id)
  select i.deck_id, new.id
  from public.deck_examiner_invites i
  where i.email = lower(trim(coalesce(new.email, '')))
  on conflict do nothing;

  delete from public.deck_examiner_invites i
  where i.email = lower(trim(coalesce(new.email, '')));

  return new;
end;
$$;

-- Returnerar 'added' (kontot fanns), 'invited' (väntar på registrering) eller 'exists'.
create or replace function public.add_deck_examiner(p_deck_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  e text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select u.id into uid from auth.users u where lower(u.email) = e limit 1;
  if uid is null then
    if exists (select 1 from public.deck_examiner_invites i where i.deck_id = p_deck_id and i.email = e) then
      return 'exists';
    end if;
    insert into public.deck_examiner_invites (deck_id, email) values (p_deck_id, e);
    return 'invited';
  end if;
  if exists (select 1 from public.deck_examiners x where x.deck_id = p_deck_id and x.user_id = uid) then
    return 'exists';
  end if;
  insert into public.deck_examiners (deck_id, user_id) values (p_deck_id, uid);
  return 'added';
end;
$$;

-- Lista: kopplade konton och väntande inbjudningar (user_id är null för de senare).
drop function if exists public.list_deck_examiners(uuid);
create or replace function public.list_deck_examiners(p_deck_id uuid)
returns table (user_id uuid, email text, display_name text, created_at timestamptz, pending boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select e.user_id, u.email::text, p.display_name, e.created_at, false
  from public.deck_examiners e
  join auth.users u on u.id = e.user_id
  left join public.profiles p on p.id = e.user_id
  where e.deck_id = p_deck_id
  union all
  select null::uuid, i.email, null::text, i.created_at, true
  from public.deck_examiner_invites i
  where i.deck_id = p_deck_id
  order by 4;
end;
$$;

create or replace function public.remove_deck_examiner_invite(p_deck_id uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.deck_examiner_invites where deck_id = p_deck_id and email = lower(trim(p_email));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.list_deck_examiners(uuid) from public, anon;
revoke execute on function public.remove_deck_examiner_invite(uuid, text) from public, anon;
grant execute on function public.list_deck_examiners(uuid) to authenticated;
grant execute on function public.remove_deck_examiner_invite(uuid, text) to authenticated;
