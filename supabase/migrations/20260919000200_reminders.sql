-- Lugna påminnelser och examinatorns veckobrev (docs/OMVARLDSANALYS.md, Fas 2.4 och 2.7).
--
-- - profiles.reminder_email: studenten väljer själv (av som standard). Högst ett mejl per dag,
--   bara när det finns förfallna kort, tystnad efter tentan. Efter 14 påminnelser utan en enda
--   repetition skickas ett sista mejl och påminnelserna stängs av (Duolingos mönster, utan spårning).
-- - profiles.digest_email: examinatorer får ett veckobrev måndag morgon (på som standard,
--   kan stängas av under Konto).
-- - email_log: vad som skickats till vem och när, så att inget skickas dubbelt och så att
--   studenten kan få ut det via "Ladda ner mina data". Bara servern (service role) läser och skriver.
-- - Tre funktioner som bara service role (cron-jobbet) eller redaktörer får anropa.
-- Expanderande ändring: bara nya kolumner med default, en ny tabell och nya funktioner.

alter table public.profiles
  add column reminder_email boolean not null default false,
  add column digest_email boolean not null default true;

comment on column public.profiles.reminder_email is 'Vill ha en daglig påminnelse via mejl när kort är förfallna (opt-in).';
comment on column public.profiles.digest_email is 'Examinator: vill ha veckobrevet på måndagar.';

grant update (display_name, reminder_email, digest_email) on public.profiles to authenticated;

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reminder', 'reminder_stop', 'digest')),
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id uuid references public.decks (id) on delete cascade,
  subject text not null,
  sent_at timestamptz not null default now()
);

create index email_log_user_kind_idx on public.email_log (user_id, kind, sent_at desc);

revoke all on public.email_log from anon, authenticated;
alter table public.email_log enable row level security;
-- Inga policyer: bara service role (som går förbi RLS) läser och skriver.

-- Kontroll som används i funktionerna nedan.
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role() = 'service_role', false);
$$;

-- Vilka studenter ska få en påminnelse i dag? En rad per student med förfallna kort i
-- publicerade deck, bara om studenten valt påminnelser. decks: [{slug, title, due, exam_date}].
create or replace function public.reminder_candidates()
returns table (
  user_id uuid,
  email text,
  display_name text,
  last_review_at timestamptz,
  reminders_since_last_review integer,
  sent_today boolean,
  decks jsonb
)
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
  with due_per_deck as (
    select cp.user_id, d.id as deck_id, d.slug, d.title, d.exam_date, count(*)::integer as due
    from public.card_progress cp
    join public.cards c on c.id = cp.card_id and c.is_active
    join public.decks d on d.id = c.deck_id and d.is_published
    where cp.state <> 0 and cp.due <= now()
      and (d.exam_date is null or d.exam_date >= (now() at time zone 'Europe/Stockholm')::date)
    group by cp.user_id, d.id, d.slug, d.title, d.exam_date
  ),
  last_review as (
    select rl.user_id, max(rl.reviewed_at) as at from public.review_log rl group by rl.user_id
  )
  select
    p.id,
    u.email::text,
    p.display_name,
    lr.at,
    (select count(*)::integer from public.email_log e
      where e.user_id = p.id and e.kind = 'reminder' and (lr.at is null or e.sent_at > lr.at)),
    exists (select 1 from public.email_log e
      where e.user_id = p.id and e.kind in ('reminder', 'reminder_stop')
        and (e.sent_at at time zone 'Europe/Stockholm')::date = (now() at time zone 'Europe/Stockholm')::date),
    (select jsonb_agg(jsonb_build_object('slug', x.slug, 'title', x.title, 'due', x.due, 'exam_date', x.exam_date) order by x.title)
      from due_per_deck x where x.user_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join last_review lr on lr.user_id = p.id
  where p.reminder_email
    and u.email is not null
    and exists (select 1 from due_per_deck x where x.user_id = p.id);
end;
$$;

-- Vem ska få veckobrevet för vilket deck? Examinatorer för decket och admin, med digest_email på.
create or replace function public.digest_recipients()
returns table (deck_id uuid, deck_slug text, deck_title text, user_id uuid, email text, display_name text)
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
  select distinct d.id, d.slug, d.title, p.id, u.email::text, p.display_name
  from public.decks d
  join public.profiles p on p.digest_email and (p.is_admin or exists (
    select 1 from public.deck_examiners x where x.deck_id = d.id and x.user_id = p.id
  ))
  join auth.users u on u.id = p.id
  where d.is_published and u.email is not null;
end;
$$;

-- Underlag för veckobrevet: samma anonymitetsgräns som kursöversikten (p_min_students).
-- Får anropas av service role och av deckets redaktörer.
create or replace function public.deck_digest(p_deck_id uuid, p_min_students integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
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
        having count(distinct p.user_id) >= p_min_students
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
        having count(p.self_rating) >= p_min_students and count(*) filter (where p.self_rating <= 2) > 0
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

revoke execute on function public.reminder_candidates() from public, anon, authenticated;
revoke execute on function public.digest_recipients() from public, anon, authenticated;
revoke execute on function public.deck_digest(uuid, integer) from public, anon;
grant execute on function public.deck_digest(uuid, integer) to authenticated;
grant execute on function public.reminder_candidates() to service_role;
grant execute on function public.digest_recipients() to service_role;
grant execute on function public.deck_digest(uuid, integer) to service_role;
grant execute on function public.is_service_role() to anon, authenticated, service_role;

-- ÅNGRA (se docs/ATERSTALLNING.md)
-- drop function if exists public.deck_digest(uuid, integer);
-- drop function if exists public.digest_recipients();
-- drop function if exists public.reminder_candidates();
-- drop function if exists public.is_service_role();
-- drop table if exists public.email_log;
-- revoke update (reminder_email, digest_email) on public.profiles from authenticated;
-- alter table public.profiles drop column if exists reminder_email, drop column if exists digest_email;
