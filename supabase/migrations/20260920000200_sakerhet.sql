-- Säkerhetshärdning inför studentlanseringen. Fynden kommer från en granskning 20 sep 2026;
-- varje avsnitt motsvarar ett fynd och har ett test i tests/unit/db/rls.test.ts.
--
-- 1. (K1) Examinatorsrätt kopplas bara till en bekräftad e-postadress.
-- 2. (M1) Anonymitetsgränsen ligger i databasen, inte i renderingen.
-- 3. (M2) deck_digest kan inte anropas med en lägre gräns än fem.
-- 4. (M3) Inaktiva kort är osynliga för studenter även direkt mot API:t.
-- 5. (M4) Tak på antal felrapporter per timme.
-- 6. (L3, L6) Tydligare undantag för CLI:t, och search_path på is_service_role.

-- ---------------------------------------------------------------------------
-- 1. (K1) Examinatorsrätt kräver bekräftad adress
--
-- Med e-postbekräftelse avstängd räcker det annars att registrera ett konto på
-- examinatorns adress för att ärva rätten till kursen. Nu kopplas inbjudan först när
-- adressen är bekräftad, och en trigger fångar upp bekräftelser som kommer senare.
-- Skyddet ligger därmed i databasen och inte bara i en inställning i dashboarden.
-- ---------------------------------------------------------------------------

create or replace function public.link_examiner_invites(p_user_id uuid, p_email text, p_confirmed timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
begin
  if p_confirmed is null or e = '' then
    return;
  end if;
  insert into public.deck_examiners (deck_id, user_id)
  select i.deck_id, p_user_id
  from public.deck_examiner_invites i
  where i.email = e
  on conflict do nothing;
  delete from public.deck_examiner_invites i where i.email = e;
end;
$$;

revoke execute on function public.link_examiner_invites(uuid, text, timestamptz) from public, anon, authenticated;

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

  perform public.link_examiner_invites(new.id, new.email, new.email_confirmed_at);
  return new;
end;
$$;

-- Bekräftelsen kommer oftast efter registreringen: koppla inbjudan då.
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.link_examiner_invites(new.id, new.email, new.email_confirmed_at);
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();

-- Att lägga till en examinator på en adress som redan har konto kräver också bekräftad adress.
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
  select u.id into uid from auth.users u where lower(u.email) = e and u.email_confirmed_at is not null limit 1;
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

-- ---------------------------------------------------------------------------
-- 2. (M1) och 3. (M2) Anonymitetsgränsen i databasen
-- ---------------------------------------------------------------------------

/** Gränsen kan höjas av anroparen men aldrig sänkas under fem. */
create or replace function public.min_students(p_requested integer)
returns integer
language sql
immutable
as $$
  select greatest(coalesce(p_requested, 5), 5);
$$;

grant execute on function public.min_students(integer) to anon, authenticated, service_role;

create or replace function public.deck_digest(p_deck_id uuid, p_min_students integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  min_n integer := public.min_students(p_min_students);
begin
  if not (public.is_service_role() or public.can_edit_deck(p_deck_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with deck_cards as (
    select c.id, c.category_id, c.front from public.cards c where c.deck_id = p_deck_id and c.is_active
  ),
  progress as (
    select cp.user_id, cp.card_id, cp.self_rating, dc.category_id
    from public.card_progress cp join deck_cards dc on dc.id = cp.card_id
  ),
  log as (
    select rl.user_id, rl.rating, rl.reviewed_at from public.review_log rl join deck_cards dc on dc.id = rl.card_id
  ),
  first_seen as (
    select user_id, min(reviewed_at) as at from log group by user_id
  )
  select jsonb_build_object(
    'exam_date', (select d.exam_date from public.decks d where d.id = p_deck_id),
    'students', (select count(distinct user_id) from progress),
    'new_students_7d', (select count(*) from first_seen where at >= now() - interval '7 days'),
    'active_7d', (select count(distinct user_id) from log where reviewed_at >= now() - interval '7 days'),
    'reviews_7d', (select count(*) from log where reviewed_at >= now() - interval '7 days'),
    'avg_rating_7d', (select avg(rating) from log where reviewed_at >= now() - interval '7 days'),
    'hardest', (
      select coalesce(jsonb_agg(jsonb_build_object('title', x.title, 'avg', x.avg, 'students', x.students) order by x.avg), '[]'::jsonb)
      from (
        select cat.title, avg(p.self_rating) as avg, count(distinct p.user_id) as students
        from progress p join public.categories cat on cat.id = p.category_id
        where p.self_rating is not null
        group by cat.title
        having count(distinct p.user_id) >= min_n
        order by avg(p.self_rating) limit 3
      ) x
    ),
    'tricky', (
      select coalesce(jsonb_agg(jsonb_build_object('front', y.front, 'low_share', y.low_share, 'ratings', y.ratings) order by y.low_share desc), '[]'::jsonb)
      from (
        select dc.front,
               count(p.self_rating) as ratings,
               (count(*) filter (where p.self_rating <= 2))::double precision / greatest(count(p.self_rating), 1) as low_share
        from deck_cards dc join progress p on p.card_id = dc.id
        group by dc.id, dc.front
        having count(p.self_rating) >= min_n and count(*) filter (where p.self_rating <= 2) > 0
        order by 3 desc limit 5
      ) y
    ),
    'open_reports', (select count(*) from public.card_reports r join deck_cards dc on dc.id = r.card_id where r.status = 'open'),
    'latest_reports', (
      select coalesce(jsonb_agg(jsonb_build_object('front', z.front, 'message', z.message, 'created_at', z.created_at) order by z.created_at desc), '[]'::jsonb)
      from (
        select dc.front, r.message, r.created_at
        from public.card_reports r join deck_cards dc on dc.id = r.card_id
        where r.status = 'open'
        order by r.created_at desc limit 3
      ) z
    )
  ) into result;
  return result;
end;
$$;

revoke execute on function public.deck_digest(uuid, integer) from public, anon;
grant execute on function public.deck_digest(uuid, integer) to authenticated, service_role;

-- Kursöversikten: kategorier och kort filtreras redan i databasen, så inget under gränsen
-- lämnar servern. `suppressed` säger hur många som väntar på fler skattningar.
create or replace function public.deck_stats_overview(p_deck_id uuid, p_weeks integer default 8, p_min_students integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  active_cards integer;
  min_n integer := public.min_students(p_min_students);
begin
  if not public.can_edit_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*) into active_cards from public.cards c where c.deck_id = p_deck_id and c.is_active;

  with deck_cards as (
    select c.id, c.category_id, c.front from public.cards c where c.deck_id = p_deck_id
  ),
  progress as (
    select cp.user_id, cp.card_id, cp.self_rating, dc.category_id
    from public.card_progress cp
    join deck_cards dc on dc.id = cp.card_id
  ),
  log as (
    select rl.user_id, rl.reviewed_at
    from public.review_log rl
    join deck_cards dc on dc.id = rl.card_id
  ),
  per_student as (
    select user_id, count(*) filter (where self_rating = 5) as learned
    from progress
    group by user_id
  ),
  week_start as (
    select date_trunc('week', now() at time zone 'Europe/Stockholm') as ts
  ),
  first_day as (
    select user_id, min((reviewed_at at time zone 'Europe/Stockholm')::date) as day
    from log
    group by user_id
  ),
  activation_rows as (
    select
      f.user_id,
      f.day,
      (select count(*) from log l where l.user_id = f.user_id and (l.reviewed_at at time zone 'Europe/Stockholm')::date = f.day) as first_day_reviews,
      exists (
        select 1 from log l
        where l.user_id = f.user_id
          and (l.reviewed_at at time zone 'Europe/Stockholm')::date between f.day + 1 and f.day + 3
      ) as returned
    from first_day f
  ),
  per_card as (
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
  ),
  per_category as (
    select
      category_id,
      count(distinct user_id) as students,
      count(self_rating) as ratings,
      avg(self_rating) as avg,
      count(*) filter (where self_rating <= 2) as low,
      count(*) filter (where self_rating = 5) as learned,
      count(*) filter (where self_rating in (3, 4)) as partial,
      count(*) as studied
    from progress
    where category_id is not null
    group by category_id
  )
  select jsonb_build_object(
    'students', (select count(*) from per_student),
    'active_7d', (select count(distinct user_id) from log where reviewed_at >= now() - interval '7 days'),
    'reviews_7d', (select count(*) from log where reviewed_at >= now() - interval '7 days'),
    'avg_rating', (select avg(self_rating) from progress),
    'open_reports', (
      select count(*) from public.card_reports r join deck_cards dc on dc.id = r.card_id where r.status = 'open'
    ),
    'min_students', min_n,
    'suppressed', jsonb_build_object(
      'cards', (select count(*) from per_card where ratings < min_n),
      'categories', (select count(*) from per_category where students < min_n)
    ),
    'activation', (
      select jsonb_build_object(
        'started', count(*),
        'first_session_20', count(*) filter (where first_day_reviews >= 20),
        'eligible', count(*) filter (where day <= (now() at time zone 'Europe/Stockholm')::date - 3),
        'returned_3d', count(*) filter (where returned and day <= (now() at time zone 'Europe/Stockholm')::date - 3)
      )
      from activation_rows
    ),
    'rating_dist', (
      select coalesce(jsonb_agg(jsonb_build_object('rating', g.r, 'n', coalesce(x.n, 0)) order by g.r), '[]'::jsonb)
      from generate_series(1, 5) as g(r)
      left join (select self_rating, count(*) as n from progress where self_rating is not null group by self_rating) x on x.self_rating = g.r
    ),
    'progress_buckets', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', g.b, 'students', coalesce(y.n, 0)) order by g.b), '[]'::jsonb)
      from generate_series(0, 4) as g(b)
      left join (
        select least(4, floor(ps.learned::numeric / greatest(active_cards, 1) * 5))::integer as b, count(*) as n
        from per_student ps
        group by 1
      ) y on y.b = g.b
    ),
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week', to_char(w.start, 'IW')::integer,
        'start', to_char(w.start, 'YYYY-MM-DD'),
        'students', coalesce(a.students, 0),
        'reviews', coalesce(a.reviews, 0)
      ) order by w.start), '[]'::jsonb)
      from generate_series(
        (select ts from week_start) - ((p_weeks - 1) * interval '1 week'),
        (select ts from week_start),
        interval '1 week'
      ) as w(start)
      left join (
        select date_trunc('week', reviewed_at at time zone 'Europe/Stockholm') as start,
               count(distinct user_id) as students,
               count(*) as reviews
        from log
        group by 1
      ) a on a.start = w.start
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'category_id', category_id,
        'students', students,
        'ratings', ratings,
        'avg', avg,
        'low', low,
        'learned', learned,
        'partial', partial,
        'studied', studied
      )), '[]'::jsonb)
      from per_category
      where students >= min_n
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
      from per_card
      where ratings >= min_n
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.deck_stats_overview(uuid, integer, integer) from public, anon;
grant execute on function public.deck_stats_overview(uuid, integer, integer) to authenticated;
drop function if exists public.deck_stats_overview(uuid, integer);

-- "Alla kort i detalj" följer samma löfte som kursöversikten.
create or replace function public.deck_stats_cards(p_deck_id uuid, p_min_students integer default 5)
returns table (card_id uuid, front text, rating_count bigint, avg_rating double precision, total_reps bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  min_n integer := public.min_students(p_min_students);
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
  having count(cp.self_rating) = 0 or count(cp.self_rating) >= min_n
  order by avg(cp.self_rating) asc nulls last, count(cp.self_rating) desc;
end;
$$;

revoke execute on function public.deck_stats_cards(uuid, integer) from public, anon;
grant execute on function public.deck_stats_cards(uuid, integer) to authenticated;
drop function if exists public.deck_stats_cards(uuid);

-- ---------------------------------------------------------------------------
-- 4. (M3) Inaktiva kort syns inte för studenter
--
-- Appen filtrerar redan på is_active, men anon-nyckeln är publik och PostgREST
-- svarar på direkta frågor. Ett kort som tagits ur bruk ska vara borta på riktigt.
-- ---------------------------------------------------------------------------

drop policy if exists "cards: läs publicerade" on public.cards;
create policy "cards: läs publicerade" on public.cards
  for select to anon, authenticated
  using (
    public.can_edit_deck(deck_id)
    or (is_active and exists (select 1 from public.decks d where d.id = cards.deck_id and d.is_published))
  );

-- ---------------------------------------------------------------------------
-- 5. (M4) Tak på felrapporter
--
-- Gäster får skriva rapporter, vilket är värdefullt, men utan tak kan en ensam
-- besökare fylla databasen och examinatorns lista. Taket räknas per konto, och
-- gemensamt för alla inloggningsfria rapporter.
-- ---------------------------------------------------------------------------

create index if not exists card_reports_created_idx on public.card_reports (created_at desc);

create or replace function public.card_reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    select count(*) into n from public.card_reports
    where user_id is null and created_at > now() - interval '1 hour';
    if n >= 60 then
      raise exception 'rate limited' using errcode = '53400', message = 'För många rapporter just nu. Försök igen om en stund.';
    end if;
  else
    select count(*) into n from public.card_reports
    where user_id = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 10 then
      raise exception 'rate limited' using errcode = '53400', message = 'Du har skickat många rapporter den senaste timmen. Försök igen senare.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists card_reports_rate_limit on public.card_reports;
create trigger card_reports_rate_limit
  before insert on public.card_reports
  for each row execute function public.card_reports_rate_limit();

-- ---------------------------------------------------------------------------
-- 6. (L3, L6) Tydligare undantag för CLI:t, och search_path
-- ---------------------------------------------------------------------------

create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.role() = 'service_role', false);
$$;

-- Undantaget för direktanslutning (psql/CLI) krävde tidigare bara att JWT-påståenden
-- saknades. Nu krävs dessutom att varken roll eller användare är satt, så att ett
-- PostgREST-anrop aldrig kan råka falla in i det.
create or replace function public.can_sync_deck(p_deck_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.can_edit_deck(p_deck_id)
    or public.is_service_role()
    or (
      auth.uid() is null
      and auth.role() is null
      and nullif(current_setting('request.jwt.claims', true), '') is null
    );
$$;

-- ÅNGRA (se docs/ATERSTALLNING.md). Funktionerna återställs till versionerna i
-- 20260917000100_overview_v2.sql, 20260917000200_examiner_invites.sql,
-- 20260919000200_reminders.sql, 20260920000000_content_keys.sql och 20260911000000_init.sql.
-- drop trigger if exists card_reports_rate_limit on public.card_reports;
-- drop function if exists public.card_reports_rate_limit();
-- drop trigger if exists on_auth_user_confirmed on auth.users;
-- drop function if exists public.handle_user_confirmed();
-- drop function if exists public.link_examiner_invites(uuid, text, timestamptz);
-- drop function if exists public.min_students(integer);
-- drop policy if exists "cards: läs publicerade" on public.cards;
-- (återskapa policyn från 20260917000000_examiners.sql)
