-- Veckobrevet på engelska (Alvins beslut 2 okt 2026): polymerexaminatorn läser inte svenska.
--
-- - profiles.lang: språket kontot har valt med reglaget English ('sv' eller 'en'). Webbläsaren
--   minns valet i en kaka; kontot behöver det för det som skickas utan webbläsare, som veckobrevet.
-- - digest_recipients() returnerar språket.
-- - deck_digest() returnerar områdets och kortets engelska namn bredvid de svenska (title_en,
--   front_en), så att mejlet kan skrivas helt på engelska. Inget annat i funktionen ändras.

alter table public.profiles
  add column lang text not null default 'sv' check (lang in ('sv', 'en'));

comment on column public.profiles.lang is 'Språket kontot valt med reglaget English: sv eller en. Styr veckobrevets språk.';

grant update (lang) on public.profiles to authenticated;

-- Returtypen ändras, så funktionen skapas om.
drop function if exists public.digest_recipients();

create function public.digest_recipients()
returns table (deck_id uuid, deck_slug text, deck_title text, user_id uuid, email text, display_name text, lang text)
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
  select distinct d.id, d.slug, d.title, p.id, u.email::text, p.display_name, p.lang
  from public.decks d
  join public.profiles p on p.digest_email and (p.is_admin or exists (
    select 1 from public.deck_examiners x where x.deck_id = d.id and x.user_id = p.id
  ))
  join auth.users u on u.id = p.id
  where d.is_published and u.email is not null;
end;
$$;
revoke execute on function public.digest_recipients() from public, anon, authenticated;
grant execute on function public.digest_recipients() to service_role;

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
    select c.id, c.category_id, c.front, c.translation_en ->> 'front' as front_en
    from public.cards c where c.deck_id = p_deck_id and c.is_active
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
      select coalesce(jsonb_agg(jsonb_build_object('title', x.title, 'title_en', x.title_en, 'avg', x.avg, 'students', x.students) order by x.avg), '[]'::jsonb)
      from (
        select cat.title, max(cat.title_en) as title_en, avg(p.self_rating) as avg, count(distinct p.user_id) as students
        from progress p join public.categories cat on cat.id = p.category_id
        where p.self_rating is not null
        group by cat.title
        having count(distinct p.user_id) >= min_n
        order by avg(p.self_rating) limit 3
      ) x
    ),
    'tricky', (
      select coalesce(jsonb_agg(jsonb_build_object('front', y.front, 'front_en', y.front_en, 'low_share', y.low_share, 'ratings', y.ratings) order by y.low_share desc), '[]'::jsonb)
      from (
        select dc.front, dc.front_en,
               count(p.self_rating) as ratings,
               (count(*) filter (where p.self_rating <= 2))::double precision / greatest(count(p.self_rating), 1) as low_share
        from deck_cards dc join progress p on p.card_id = dc.id
        group by dc.id, dc.front, dc.front_en
        having count(p.self_rating) >= min_n and count(*) filter (where p.self_rating <= 2) > 0
        order by 4 desc limit 5
      ) y
    ),
    'open_reports', (select count(*) from public.card_reports r join deck_cards dc on dc.id = r.card_id where r.status = 'open'),
    'latest_reports', (
      select coalesce(jsonb_agg(jsonb_build_object('front', z.front, 'front_en', z.front_en, 'message', z.message, 'created_at', z.created_at) order by z.created_at desc), '[]'::jsonb)
      from (
        select dc.front, dc.front_en, r.message, r.created_at
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

-- ÅNGRA (se docs/ATERSTALLNING.md): kör om deck_digest och digest_recipients ur
-- 20260920000200_sakerhet.sql och 20260919000200_reminders.sql, sedan
-- revoke update (lang) on public.profiles from authenticated;
-- alter table public.profiles drop column if exists lang;
