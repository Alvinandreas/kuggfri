-- Plugget – grundschema
-- Tabeller, RLS-policyer och hjälpfunktioner. Körs av `supabase db reset`.

-- ---------------------------------------------------------------------------
-- Hjälpfunktioner
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'En rad per konto. Skapas automatiskt vid registrering.';

-- Är den inloggade användaren admin? Security definer så att policyer kan
-- anropa den utan att själva bero på RLS på profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- decks, categories, cards
-- ---------------------------------------------------------------------------

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(title) between 1 and 200),
  description text,
  course_code text,
  source_credit text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger decks_set_updated_at
  before update on public.decks
  for each row execute function public.set_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  sort_order integer not null default 0
);

create index categories_deck_id_idx on public.categories (deck_id, sort_order);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  front text not null check (length(front) > 0),
  back text not null check (length(back) > 0),
  hint text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cards_deck_id_idx on public.cards (deck_id, sort_order);
create index cards_category_id_idx on public.cards (category_id);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- card_progress (FSRS-tillstånd + självskattning)
-- ---------------------------------------------------------------------------

create table public.card_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state integer not null default 0 check (state between 0 and 3),
  last_review timestamptz,
  self_rating integer check (self_rating between 1 and 5),
  primary key (user_id, card_id)
);

create index card_progress_user_due_idx on public.card_progress (user_id, due);
create index card_progress_card_id_idx on public.card_progress (card_id);

-- ---------------------------------------------------------------------------
-- study_sessions
-- ---------------------------------------------------------------------------

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  deck_id uuid not null references public.decks (id) on delete cascade,
  mode text not null check (mode in ('fsrs', 'free', 'random')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  cards_reviewed integer not null default 0
);

create index study_sessions_user_idx on public.study_sessions (user_id, started_at desc);
create index study_sessions_deck_idx on public.study_sessions (deck_id);

-- ---------------------------------------------------------------------------
-- Rättigheter. Supabase ger anon/authenticated alla rättigheter på nya
-- tabeller via default privileges; vi är explicita här så att det inte beror
-- på det, och drar in det som inte ska gå.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

-- Börja från noll: Supabase default privileges har redan gett anon/authenticated
-- ALLA rättigheter på tabellerna ovan. Det måste dras in innan vi ger tillbaka
-- exakt det som ska gå (annars kan t.ex. profiles.is_admin uppdateras).
revoke all on public.profiles from anon, authenticated;
revoke all on public.decks from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.cards from anon, authenticated;
revoke all on public.card_progress from anon, authenticated;
revoke all on public.study_sessions from anon, authenticated;

grant select on public.decks, public.categories, public.cards to anon, authenticated;
grant insert, update, delete on public.decks, public.categories, public.cards to authenticated;

-- profiles: läsa egen rad, ändra bara display_name. is_admin kan aldrig ändras
-- av användaren själv (kolumnrättighet), oavsett policyer.
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select, insert, update, delete on public.card_progress to authenticated;
grant select, insert, update, delete on public.study_sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.decks enable row level security;
alter table public.categories enable row level security;
alter table public.cards enable row level security;
alter table public.card_progress enable row level security;
alter table public.study_sessions enable row level security;

-- profiles: bara sin egen rad. is_admin kan inte ändras (kolumnrättighet ovan).
create policy "profiles: läs egen" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles: uppdatera egen" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- decks: publik läsning av publicerade, admin ser och gör allt.
create policy "decks: läs publicerade" on public.decks
  for select to anon, authenticated
  using (is_published = true or public.is_admin());

create policy "decks: admin skriver" on public.decks
  for insert to authenticated
  with check (public.is_admin());

create policy "decks: admin uppdaterar" on public.decks
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "decks: admin tar bort" on public.decks
  for delete to authenticated
  using (public.is_admin());

-- categories: följer deckets publicering.
create policy "categories: läs publicerade" on public.categories
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.decks d where d.id = deck_id and d.is_published)
  );

create policy "categories: admin skriver" on public.categories
  for insert to authenticated
  with check (public.is_admin());

create policy "categories: admin uppdaterar" on public.categories
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "categories: admin tar bort" on public.categories
  for delete to authenticated
  using (public.is_admin());

-- cards: följer deckets publicering.
create policy "cards: läs publicerade" on public.cards
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.decks d where d.id = deck_id and d.is_published)
  );

create policy "cards: admin skriver" on public.cards
  for insert to authenticated
  with check (public.is_admin());

create policy "cards: admin uppdaterar" on public.cards
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "cards: admin tar bort" on public.cards
  for delete to authenticated
  using (public.is_admin());

-- card_progress: bara egna rader, ingen läser andras.
create policy "card_progress: egna rader" on public.card_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- study_sessions: bara egna rader.
create policy "study_sessions: egna rader" on public.study_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Nollställning av progress. Security definer så att progress på kort i
-- opublicerade deck också kan nollställas, men alltid begränsat till
-- auth.uid().
-- ---------------------------------------------------------------------------

create or replace function public.reset_deck_progress(p_deck_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.card_progress cp
  using public.cards c
  where cp.card_id = c.id
    and c.deck_id = p_deck_id
    and cp.user_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.reset_all_progress()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.card_progress where user_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Nollställer FSRS-schemat men behåller self_rating. p_deck_id null = alla deck.
create or replace function public.reset_schedule_keep_ratings(p_deck_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.card_progress cp
  set due = now(),
      stability = 0,
      difficulty = 0,
      elapsed_days = 0,
      scheduled_days = 0,
      reps = 0,
      lapses = 0,
      state = 0,
      last_review = null
  from public.cards c
  where cp.card_id = c.id
    and cp.user_id = auth.uid()
    and (p_deck_id is null or c.deck_id = p_deck_id);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Fullständig radering av det egna kontot. Kaskaderar till profiles,
-- card_progress och study_sessions via främmande nycklar.
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
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Statistik för admin. Aggregerat, inga personuppgifter returneras.
-- ---------------------------------------------------------------------------

create or replace function public.deck_stats_summary(p_deck_id uuid)
returns table (unique_users bigint, total_reviews bigint, avg_rating double precision)
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
  select
    count(distinct cp.user_id)::bigint,
    coalesce(sum(cp.reps), 0)::bigint,
    avg(cp.self_rating)::double precision
  from public.card_progress cp
  join public.cards c on c.id = cp.card_id
  where c.deck_id = p_deck_id;
end;
$$;

create or replace function public.deck_stats_cards(p_deck_id uuid)
returns table (card_id uuid, front text, rating_count bigint, avg_rating double precision, total_reps bigint)
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
  select
    c.id,
    c.front,
    count(cp.self_rating)::bigint,
    avg(cp.self_rating)::double precision,
    coalesce(sum(cp.reps), 0)::bigint
  from public.cards c
  left join public.card_progress cp on cp.card_id = c.id
  where c.deck_id = p_deck_id
  group by c.id, c.front
  order by avg(cp.self_rating) asc nulls last, count(cp.self_rating) desc;
end;
$$;

-- Funktioner: bara inloggade får anropa.
revoke execute on function public.reset_deck_progress(uuid) from public, anon;
revoke execute on function public.reset_all_progress() from public, anon;
revoke execute on function public.reset_schedule_keep_ratings(uuid) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.deck_stats_summary(uuid) from public, anon;
revoke execute on function public.deck_stats_cards(uuid) from public, anon;
grant execute on function public.reset_deck_progress(uuid) to authenticated;
grant execute on function public.reset_all_progress() to authenticated;
grant execute on function public.reset_schedule_keep_ratings(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.deck_stats_summary(uuid) to authenticated;
grant execute on function public.deck_stats_cards(uuid) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
