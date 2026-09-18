-- 1. Läget "provtenta" (exam): 30 slumpade kort ur urvalet utan ledtråd och utan att gå tillbaka.
--    Rör aldrig card_progress (som fri repetition) men loggas i historiken, så att studenten och
--    kursöversikten ser aktiviteten. Bara check-villkoren utökas: expanderande ändring.
-- 2. Kursöversikten får nyckeln "activation": kommer studenterna tillbaka? Räknas ur review_log,
--    aggregerat och anonymt. Nycklarna som redan fanns är oförändrade (gammal kod ignorerar den nya).

alter table public.study_sessions drop constraint if exists study_sessions_mode_check;
alter table public.study_sessions
  add constraint study_sessions_mode_check check (mode in ('fsrs', 'free', 'random', 'tricky', 'exam'));

alter table public.review_log drop constraint if exists review_log_mode_check;
alter table public.review_log
  add constraint review_log_mode_check check (mode in ('fsrs', 'free', 'random', 'tricky', 'exam'));

-- activation: {
--   started          konton med minst en repetition i decket
--   first_session_20 konton vars första dag hade minst 20 repetitioner
--   returned_3d      konton som repeterade igen inom 1–3 dagar efter första dagen
--   eligible         konton vars första dag ligger minst 3 dagar tillbaka (underlaget för returned_3d)
-- }
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
  )
  select jsonb_build_object(
    'students', (select count(*) from per_student),
    'active_7d', (select count(distinct user_id) from log where reviewed_at >= now() - interval '7 days'),
    'reviews_7d', (select count(*) from log where reviewed_at >= now() - interval '7 days'),
    'avg_rating', (select avg(self_rating) from progress),
    'open_reports', (
      select count(*) from public.card_reports r join deck_cards dc on dc.id = r.card_id where r.status = 'open'
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

-- ÅNGRA (se docs/ATERSTALLNING.md). Funktionen återställs till versionen i
-- 20260917000100_overview_v2.sql (kör den filens create or replace igen). Villkoren:
-- alter table public.study_sessions drop constraint if exists study_sessions_mode_check;
-- alter table public.study_sessions add constraint study_sessions_mode_check check (mode in ('fsrs', 'free', 'random', 'tricky'));
-- alter table public.review_log drop constraint if exists review_log_mode_check;
-- alter table public.review_log add constraint review_log_mode_check check (mode in ('fsrs', 'free', 'random', 'tricky'));
-- (rader med mode = 'exam' måste tas bort först: delete from public.review_log where mode = 'exam'; samma för study_sessions.)
