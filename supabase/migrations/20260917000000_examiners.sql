-- Examinatorer: en användare kan ges redigeringsrätt till ett enskilt deck utan att
-- vara admin. Admin (profiles.is_admin) ser och gör fortfarande allt; examinatorn ser
-- bara sina deck i adminvyn och kan varken skapa eller ta bort deck.
-- Dessutom: aggregerad kursstatistik för översikten (deck_stats_overview).

create table public.deck_examiners (
  deck_id uuid not null references public.decks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);

create index deck_examiners_user_idx on public.deck_examiners (user_id);

comment on table public.deck_examiners is 'Vilka användare som får redigera vilket deck (examinatorroll).';

revoke all on public.deck_examiners from anon, authenticated;
grant select on public.deck_examiners to authenticated;

alter table public.deck_examiners enable row level security;

-- Egna rader (för att veta vilka deck man får redigera); admin ser alla.
create policy "deck_examiners: läs egna eller admin" on public.deck_examiners
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Får den inloggade redigera decket? Security definer så att policyer kan anropa
-- den utan att bero på RLS på deck_examiners/profiles.
create or replace function public.can_edit_deck(p_deck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.deck_examiners e
      where e.deck_id = p_deck_id and e.user_id = auth.uid()
    );
$$;

-- Policyer för anon anropar också funktionen (den svarar false utan session).
grant execute on function public.can_edit_deck(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policyer: "admin" blir "admin eller examinator för decket" där det gäller
-- innehåll. Att skapa och ta bort deck är fortfarande bara admin.
-- ---------------------------------------------------------------------------

drop policy "decks: läs publicerade" on public.decks;
create policy "decks: läs publicerade" on public.decks
  for select to anon, authenticated
  using (is_published = true or public.can_edit_deck(id));

drop policy "decks: admin uppdaterar" on public.decks;
create policy "decks: redaktör uppdaterar" on public.decks
  for update to authenticated
  using (public.can_edit_deck(id))
  with check (public.can_edit_deck(id));

drop policy "categories: läs publicerade" on public.categories;
create policy "categories: läs publicerade" on public.categories
  for select to anon, authenticated
  using (
    public.can_edit_deck(deck_id)
    or exists (select 1 from public.decks d where d.id = deck_id and d.is_published)
  );

drop policy "categories: admin skriver" on public.categories;
create policy "categories: redaktör skriver" on public.categories
  for insert to authenticated
  with check (public.can_edit_deck(deck_id));

drop policy "categories: admin uppdaterar" on public.categories;
create policy "categories: redaktör uppdaterar" on public.categories
  for update to authenticated
  using (public.can_edit_deck(deck_id))
  with check (public.can_edit_deck(deck_id));

drop policy "categories: admin tar bort" on public.categories;
create policy "categories: redaktör tar bort" on public.categories
  for delete to authenticated
  using (public.can_edit_deck(deck_id));

drop policy "cards: läs publicerade" on public.cards;
create policy "cards: läs publicerade" on public.cards
  for select to anon, authenticated
  using (
    public.can_edit_deck(deck_id)
    or exists (select 1 from public.decks d where d.id = deck_id and d.is_published)
  );

drop policy "cards: admin skriver" on public.cards;
create policy "cards: redaktör skriver" on public.cards
  for insert to authenticated
  with check (public.can_edit_deck(deck_id));

drop policy "cards: admin uppdaterar" on public.cards;
create policy "cards: redaktör uppdaterar" on public.cards
  for update to authenticated
  using (public.can_edit_deck(deck_id))
  with check (public.can_edit_deck(deck_id));

drop policy "cards: admin tar bort" on public.cards;
create policy "cards: redaktör tar bort" on public.cards
  for delete to authenticated
  using (public.can_edit_deck(deck_id));

drop policy "card_reports: admin läser" on public.card_reports;
create policy "card_reports: redaktör läser" on public.card_reports
  for select to authenticated
  using (exists (select 1 from public.cards c where c.id = card_id and public.can_edit_deck(c.deck_id)));

drop policy "card_reports: admin uppdaterar" on public.card_reports;
create policy "card_reports: redaktör uppdaterar" on public.card_reports
  for update to authenticated
  using (exists (select 1 from public.cards c where c.id = card_id and public.can_edit_deck(c.deck_id)))
  with check (exists (select 1 from public.cards c where c.id = card_id and public.can_edit_deck(c.deck_id)));

drop policy "card_reports: admin tar bort" on public.card_reports;
create policy "card_reports: redaktör tar bort" on public.card_reports
  for delete to authenticated
  using (exists (select 1 from public.cards c where c.id = card_id and public.can_edit_deck(c.deck_id)));

-- ---------------------------------------------------------------------------
-- Statistikfunktionerna: examinatorn får se sitt decks statistik.
-- ---------------------------------------------------------------------------

create or replace function public.deck_stats_summary(p_deck_id uuid)
returns table (unique_users bigint, total_reviews bigint, avg_rating double precision)
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
  if not public.can_edit_deck(p_deck_id) then
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

-- Kursöversikten: allt aggregerat i ett anrop. Inga användar-id:n eller e-postadresser
-- lämnar databasen; per kort returneras bara antal och andelar.
--   students        antal konton med progress i decket
--   active_7d       antal konton med minst en repetition senaste 7 dagarna
--   reviews_14d     antal repetitioner senaste 14 dagarna
--   avg_rating      snittskattning över alla progressrader
--   days            [{day, reviews}] per dag, senaste p_days dagarna (Europe/Stockholm)
--   categories      [{category_id, learned, partial, studied, students}] summor över alla studenter
--   cards           [{card_id, category_id, front, ratings, low, avg}] för kort med minst en skattning
create or replace function public.deck_stats_overview(p_deck_id uuid, p_days integer default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.can_edit_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with deck_cards as (
    select c.id, c.category_id, c.front from public.cards c where c.deck_id = p_deck_id
  ),
  progress as (
    select cp.user_id, cp.card_id, cp.self_rating, cp.reps, dc.category_id
    from public.card_progress cp
    join deck_cards dc on dc.id = cp.card_id
  ),
  log as (
    select rl.user_id, rl.reviewed_at
    from public.review_log rl
    join deck_cards dc on dc.id = rl.card_id
  )
  select jsonb_build_object(
    'students', (select count(distinct user_id) from progress),
    'active_7d', (select count(distinct user_id) from log where reviewed_at >= now() - interval '7 days'),
    'reviews_14d', (select count(*) from log where reviewed_at >= now() - interval '14 days'),
    'avg_rating', (select avg(self_rating) from progress),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'reviews', coalesce(n.reviews, 0)) order by d.day), '[]'::jsonb)
      from generate_series(
        (now() at time zone 'Europe/Stockholm')::date - (p_days - 1),
        (now() at time zone 'Europe/Stockholm')::date,
        interval '1 day'
      ) as d(day)
      left join (
        select (reviewed_at at time zone 'Europe/Stockholm')::date as day, count(*) as reviews
        from log
        group by 1
      ) n on n.day = d.day::date
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'category_id', category_id,
        'learned', learned,
        'partial', partial,
        'studied', studied,
        'students', students
      )), '[]'::jsonb)
      from (
        select
          category_id,
          count(*) filter (where self_rating = 5) as learned,
          count(*) filter (where self_rating in (3, 4)) as partial,
          count(*) as studied,
          count(distinct user_id) as students
        from progress
        where category_id is not null
        group by category_id
      ) x
    ),
    'cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'card_id', card_id,
        'category_id', category_id,
        'front', front,
        'ratings', ratings,
        'low', low,
        'avg', avg
      ) order by low_share desc, ratings desc), '[]'::jsonb)
      from (
        select
          dc.id as card_id,
          dc.category_id,
          dc.front,
          count(p.self_rating) as ratings,
          count(*) filter (where p.self_rating <= 2) as low,
          avg(p.self_rating) as avg,
          (count(*) filter (where p.self_rating <= 2))::double precision / greatest(count(p.self_rating), 1) as low_share
        from deck_cards dc
        join progress p on p.card_id = dc.id
        group by dc.id, dc.category_id, dc.front
        having count(p.self_rating) > 0
      ) y
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.deck_stats_overview(uuid, integer) from public, anon;
grant execute on function public.deck_stats_overview(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Hantera examinatorer från adminvyn (bara admin). Uppslag på e-post sker i
-- databasen så att inga adresser behöver listas för klienten i onödan.
-- ---------------------------------------------------------------------------

create or replace function public.list_deck_examiners(p_deck_id uuid)
returns table (user_id uuid, email text, display_name text, created_at timestamptz)
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
  select e.user_id, u.email::text, p.display_name, e.created_at
  from public.deck_examiners e
  join auth.users u on u.id = e.user_id
  left join public.profiles p on p.id = e.user_id
  where e.deck_id = p_deck_id
  order by e.created_at;
end;
$$;

-- Returnerar 'added', 'exists' eller 'not_found'.
create or replace function public.add_deck_examiner(p_deck_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if uid is null then
    return 'not_found';
  end if;
  if exists (select 1 from public.deck_examiners e where e.deck_id = p_deck_id and e.user_id = uid) then
    return 'exists';
  end if;
  insert into public.deck_examiners (deck_id, user_id) values (p_deck_id, uid);
  return 'added';
end;
$$;

create or replace function public.remove_deck_examiner(p_deck_id uuid, p_user_id uuid)
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
  delete from public.deck_examiners where deck_id = p_deck_id and user_id = p_user_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.list_deck_examiners(uuid) from public, anon;
revoke execute on function public.add_deck_examiner(uuid, text) from public, anon;
revoke execute on function public.remove_deck_examiner(uuid, uuid) from public, anon;
grant execute on function public.list_deck_examiners(uuid) to authenticated;
grant execute on function public.add_deck_examiner(uuid, text) to authenticated;
grant execute on function public.remove_deck_examiner(uuid, uuid) to authenticated;
