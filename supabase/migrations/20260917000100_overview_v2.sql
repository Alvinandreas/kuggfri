-- Kursöversikt v2: statistik som hjälper examinatorn (svårighet per kategori,
-- hur långt studenterna kommit, aktivitet per vecka, skattningsfördelning, öppna
-- felrapporter) i ett enda anrop. Felrapporter hämtas med två funktioner i stället
-- för att klienten skickar listor med kort-id. Allt kontrolleras med can_edit_deck().

create index if not exists card_reports_card_status_idx on public.card_reports (card_id, status);

drop function if exists public.deck_stats_overview(uuid, integer);

-- Returnerar jsonb:
--   students          konton med progress i decket
--   active_7d         konton med minst en repetition senaste 7 dagarna
--   reviews_7d        repetitioner senaste 7 dagarna
--   avg_rating        snittskattning över alla progressrader (1–5)
--   open_reports      öppna felrapporter
--   rating_dist       [{rating, n}] antal progressrader per aktuell skattning 1–5
--   progress_buckets  [{bucket, students}] studenter per andel inlärda kort: 0 = 0–20 %, … 4 = 80–100 %
--   weeks             [{week, start, students, reviews}] senaste p_weeks veckorna (ISO-vecka, Europe/Stockholm)
--   categories        [{category_id, students, ratings, avg, low, learned, partial, studied}]
--   cards             [{card_id, category_id, front, ratings, low, avg}] kort med minst en skattning,
--                     sorterade på andel låga skattningar
create or replace function public.deck_stats_overview(p_deck_id uuid, p_weeks integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  active_cards integer;
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
  )
  select jsonb_build_object(
    'students', (select count(*) from per_student),
    'active_7d', (select count(distinct user_id) from log where reviewed_at >= now() - interval '7 days'),
    'reviews_7d', (select count(*) from log where reviewed_at >= now() - interval '7 days'),
    'avg_rating', (select avg(self_rating) from progress),
    'open_reports', (
      select count(*) from public.card_reports r join deck_cards dc on dc.id = r.card_id where r.status = 'open'
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
      from (
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

-- Felrapporter för ett deck, nyast först, med kortets framsida. Kontaktfältet ingår
-- (studenten har själv valt att lämna det), user_id lämnar aldrig databasen.
create or replace function public.deck_reports(p_deck_id uuid)
returns table (
  id uuid,
  card_id uuid,
  card_front text,
  message text,
  contact text,
  status text,
  created_at timestamptz,
  resolved_at timestamptz
)
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
  select r.id, r.card_id, c.front, r.message, r.contact, r.status, r.created_at, r.resolved_at
  from public.card_reports r
  join public.cards c on c.id = r.card_id
  where c.deck_id = p_deck_id
  order by r.created_at desc;
end;
$$;

create or replace function public.deck_open_report_count(p_deck_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.can_edit_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*)::integer into n
  from public.card_reports r
  join public.cards c on c.id = r.card_id
  where c.deck_id = p_deck_id and r.status = 'open';
  return n;
end;
$$;

revoke execute on function public.deck_reports(uuid) from public, anon;
revoke execute on function public.deck_open_report_count(uuid) from public, anon;
grant execute on function public.deck_reports(uuid) to authenticated;
grant execute on function public.deck_open_report_count(uuid) to authenticated;
