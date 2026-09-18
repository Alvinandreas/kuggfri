-- GENERERAD: alla migrationer + seed i en fil, för ett NYTT Supabase-projekt (SQL-editorn).
-- ===== supabase/migrations/20260911000000_init.sql =====
-- Kuggfri – grundschema
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

-- ===== supabase/migrations/20260911000100_reorder.sql =====
-- Ombeställning i en enda fråga i stället för en uppdatering per rad.
-- Security invoker: RLS avgör, dvs. bara admin påverkar några rader alls.

create or replace function public.reorder_cards(p_deck_id uuid, p_ids uuid[])
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  update public.cards c
  set sort_order = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where c.id = x.id
    and c.deck_id = p_deck_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.reorder_categories(p_deck_id uuid, p_ids uuid[])
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  update public.categories c
  set sort_order = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where c.id = x.id
    and c.deck_id = p_deck_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.reorder_cards(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_categories(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_cards(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_categories(uuid, uuid[]) to authenticated;

-- ===== supabase/migrations/20260914000000_tricky_mode.sql =====
-- Nytt studieläge "kluriga kort" (tricky). Loggas i study_sessions som övriga lägen.
alter table public.study_sessions drop constraint if exists study_sessions_mode_check;
alter table public.study_sessions
  add constraint study_sessions_mode_check check (mode in ('fsrs', 'free', 'random', 'tricky'));

-- ===== supabase/migrations/20260914000100_review_log.sql =====
-- Repetitionshistorik: en rad per skattning. Underlag för statistik
-- ("kort per dag", "ackumulerad kunskap"). Gäster har motsvarande i localStorage.

create table public.review_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  mode text not null check (mode in ('fsrs', 'free', 'random', 'tricky')),
  reviewed_at timestamptz not null default now()
);

create index review_log_user_time_idx on public.review_log (user_id, reviewed_at);
create index review_log_card_idx on public.review_log (card_id);

revoke all on public.review_log from anon, authenticated;
grant select, insert on public.review_log to authenticated;

alter table public.review_log enable row level security;

create policy "review_log: läs egna" on public.review_log
  for select to authenticated
  using (user_id = auth.uid());

create policy "review_log: skriv egna" on public.review_log
  for insert to authenticated
  with check (user_id = auth.uid());

-- Nollställning tar även bort historiken för decket / allt (schemanollställning behåller den).
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
  delete from public.review_log rl
  using public.cards c
  where rl.card_id = c.id
    and c.deck_id = p_deck_id
    and rl.user_id = auth.uid();
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
  delete from public.review_log where user_id = auth.uid();
  delete from public.card_progress where user_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ===== supabase/migrations/20260916000000_card_reports.sql =====
-- Felrapporter på kort: studenter (även gäster utan konto) kan flagga att ett kort är fel
-- eller otydligt. Admin ser rapporterna per deck, åtgärdar och tar bort dem.
-- Det är kvalitetsslingan mellan studenter, Alvin och examinatorn.

create table public.card_reports (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  -- Sätts automatiskt till inloggad användare (null för gäster). Kan inte anges av klienten.
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  message text not null check (length(btrim(message)) between 3 and 1000),
  contact text check (contact is null or length(contact) <= 200),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index card_reports_card_idx on public.card_reports (card_id);
create index card_reports_status_idx on public.card_reports (status, created_at desc);

revoke all on public.card_reports from anon, authenticated;
-- Vem som helst får skicka in, men bara dessa kolumner: user_id och status kommer från default.
grant insert (card_id, message, contact) on public.card_reports to anon, authenticated;
-- Läsa, åtgärda och ta bort: bara admin (RLS nedan).
grant select, update (status, resolved_at), delete on public.card_reports to authenticated;

alter table public.card_reports enable row level security;

create policy "card_reports: alla får rapportera kort i publicerade deck" on public.card_reports
  for insert to anon, authenticated
  with check (
    exists (
      select 1
      from public.cards c
      join public.decks d on d.id = c.deck_id
      where c.id = card_id and d.is_published
    )
  );

create policy "card_reports: admin läser" on public.card_reports
  for select to authenticated
  using (public.is_admin());

create policy "card_reports: admin uppdaterar" on public.card_reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "card_reports: admin tar bort" on public.card_reports
  for delete to authenticated
  using (public.is_admin());

-- ===== supabase/migrations/20260917000000_examiners.sql =====
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

-- ===== supabase/migrations/20260917000100_overview_v2.sql =====
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

-- ===== supabase/migrations/20260917000200_examiner_invites.sql =====
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

-- ÅNGRA (se docs/ATERSTALLNING.md). Återställer handle_new_user och list_deck_examiners till
-- versionerna i 20260917000000_examiners.sql och tar bort inbjudningstabellen.
-- drop function if exists public.remove_deck_examiner_invite(uuid, text);
-- drop function if exists public.add_deck_examiner(uuid, text);
-- drop function if exists public.list_deck_examiners(uuid);
-- create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
-- begin
--   insert into public.profiles (id, display_name)
--   values (new.id, nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''))
--   on conflict (id) do nothing;
--   return new;
-- end;
-- $$;
-- drop table if exists public.deck_examiner_invites;
-- (list_deck_examiners och add_deck_examiner återskapas från 20260917000000_examiners.sql.)

-- ===== supabase/migrations/20260918000000_import_and_limits.sql =====
-- Import i en transaktion och rimliga längdgränser.
--
-- 1. import_cards(): nya kategorier, nya kort och uppdaterade kort skrivs i ett anrop, så att ett
--    fel mitt i importen inte lämnar halva importen kvar. Security invoker: RLS avgör (admin eller
--    examinator för decket), precis som vid enskilda skrivningar.
-- 2. Längdgränser på kort och deck så att ett inklistrat kapitel inte accepteras av misstag.
--    Servern kontrollerar samma gränser först och ger ett begripligt fel.

alter table public.cards
  add constraint cards_front_length check (length(front) <= 5000),
  add constraint cards_back_length check (length(back) <= 20000),
  add constraint cards_hint_length check (hint is null or length(hint) <= 500);

alter table public.decks
  add constraint decks_description_length check (description is null or length(description) <= 2000),
  add constraint decks_course_code_length check (course_code is null or length(course_code) <= 50),
  add constraint decks_source_credit_length check (source_credit is null or length(source_credit) <= 2000);

-- p_create: [{front, back, hint, category, sort_order}]   p_update: [{id, back, hint, category, sort_order}]
-- category är kategorins titel (matchas skiftlägesokänsligt) eller null.
create or replace function public.import_cards(p_deck_id uuid, p_new_categories text[], p_create jsonb, p_update jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  cat_order integer;
  card_order integer;
  r jsonb;
  cat_id uuid;
  t text;
  n integer;
  created integer := 0;
  updated integer := 0;
begin
  if not public.can_edit_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(max(sort_order), -1) + 1 into cat_order from public.categories where deck_id = p_deck_id;
  foreach t in array coalesce(p_new_categories, array[]::text[]) loop
    insert into public.categories (deck_id, title, sort_order) values (p_deck_id, t, cat_order);
    cat_order := cat_order + 1;
  end loop;

  select coalesce(max(sort_order), -1) + 1 into card_order from public.cards where deck_id = p_deck_id;
  for r in select * from jsonb_array_elements(coalesce(p_create, '[]'::jsonb)) loop
    cat_id := null;
    if nullif(trim(coalesce(r ->> 'category', '')), '') is not null then
      select id into cat_id from public.categories
      where deck_id = p_deck_id and lower(trim(title)) = lower(trim(r ->> 'category')) limit 1;
    end if;
    insert into public.cards (deck_id, category_id, front, back, hint, sort_order)
    values (
      p_deck_id,
      cat_id,
      r ->> 'front',
      r ->> 'back',
      nullif(r ->> 'hint', ''),
      coalesce((r ->> 'sort_order')::integer, card_order)
    );
    if (r ->> 'sort_order') is null then
      card_order := card_order + 1;
    end if;
    created := created + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_update, '[]'::jsonb)) loop
    cat_id := null;
    if nullif(trim(coalesce(r ->> 'category', '')), '') is not null then
      select id into cat_id from public.categories
      where deck_id = p_deck_id and lower(trim(title)) = lower(trim(r ->> 'category')) limit 1;
    end if;
    update public.cards
    set back = r ->> 'back',
        hint = nullif(r ->> 'hint', ''),
        category_id = cat_id,
        sort_order = coalesce((r ->> 'sort_order')::integer, sort_order)
    where id = (r ->> 'id')::uuid and deck_id = p_deck_id;
    get diagnostics n = row_count;
    updated := updated + n;
  end loop;

  return jsonb_build_object('created', created, 'updated', updated);
end;
$$;

revoke execute on function public.import_cards(uuid, text[], jsonb, jsonb) from public, anon;
grant execute on function public.import_cards(uuid, text[], jsonb, jsonb) to authenticated;

-- ÅNGRA (se docs/ATERSTALLNING.md)
-- drop function if exists public.import_cards(uuid, text[], jsonb, jsonb);
-- alter table public.decks
--   drop constraint if exists decks_description_length,
--   drop constraint if exists decks_course_code_length,
--   drop constraint if exists decks_source_credit_length;
-- alter table public.cards
--   drop constraint if exists cards_front_length,
--   drop constraint if exists cards_back_length,
--   drop constraint if exists cards_hint_length;

-- ===== supabase/migrations/20260919000000_exam_date.sql =====
-- Tentadatum per deck. Styr schemaläggningen för studenten: alla kort hinner förfalla minst en
-- gång före tentan, och nya kort doseras så att hela decket är sett i god tid.
-- Expanderande ändring: bara en nullable kolumn, gammal kod ignorerar den.

alter table public.decks add column exam_date date;

comment on column public.decks.exam_date is 'Kursens tentadatum (valfritt). Styr intervalltak och dosering av nya kort i schemalagd repetition.';

-- ÅNGRA (se docs/ATERSTALLNING.md)
-- alter table public.decks drop column if exists exam_date;

-- ===== supabase/seed.sql =====
-- GENERERAD FIL. Ändra inte här; ändra i seed/ och kör `npm run seed:build`.
-- Innehållet kommer från riktiga Brainscape-exporter (se seed/*/deck.json för kreditering).

begin;
-- Deck: Materialteknik
insert into public.decks (id, slug, title, description, course_code, source_credit, is_published, sort_order) values ('1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$materialteknik$seed$, $seed$Materialteknik$seed$, $seed$Frågor och begrepp från kursen Materialteknik på Maskinteknik, Chalmers. Sammanställt av studenter och använt av två årskullar.$seed$, $seed$MTM081$seed$, $seed$Sammanställt av Alvin utifrån föreläsningar och kursmaterial i Materialteknik (Maskinteknik, Chalmers). Ursprungligen publicerat som flashcardset i Brainscape och använt av närmare 200 studenter över två årskullar.$seed$, true, 0);
insert into public.categories (id, deck_id, title, sort_order) values ('20e76167-bad1-5c23-86ab-85047b278b49', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Materialgrupper och egenskaper$seed$, 0);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('f91c9c56-580b-55ae-8dd6-e017d96baad1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Vilka materialgrupper finns det?$seed$, $seed$* Metaller
* Keramer
* Polymerer

Ibland anses glas och elastomerer som separata materialgrupper men de kan annars ses som undergrupper till keramer respektive polymerer. En kombination av två eller flera material kallas för en komposit eller hybrid och kan ibland också ses som sina egna materialgrupp.$seed$, null, 0);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('9bc02ee3-29be-5fce-9777-74de93293147', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Nämn minst två olika typer av atombindningar och redogör för deras karaktäristiska egenskaper.$seed$, $seed$* Kovalent bindning:
  - Stark
  - Riktningsberoende
  - Keramer, polymerer
* Metallbindning:
  - Stark
  - Elektronmoln → elektrisk och
termisk ledning
  - Hos metaller
* Jonbindning
  - Stark
  - Bindning mellan positiva och
negativa joner
  - Keramer
* Van der Waal, vätebindning,
polära bindningar
  - Svaga
  - Mellan polymerkedjor$seed$, null, 1);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('daacead1-119b-5ef5-9fb5-d7ff236d1333', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Vad är en keram och vad kännetecknar dem?$seed$, $seed$* Oorganiska, kemiska föreningar
mellan metal- och icke-metall
* Ex: Al₂O₃, SiC, SiO₂
* Använder sig av kovalent- eller jonbindning
* Cement, betong, tegel, porslin,
glas, tekniska keramer

Egenskaper:
* Hög smälttemperatur
* Kemiskt stabila
* Hög styvhet, bra slitstyrka
* Spröda, tål inte dragbelastning,
bättre i tryckbelastning
* Elektriskt och termiskt
isolerande$seed$, null, 2);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('5879e839-54af-53e0-9a30-0a9d450ea64a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Hur tillverkas vanligtvis en produkt gjord i någon form av keram?$seed$, $seed$* Keramer tillverkas av olika
mineral
* Utgångsmaterial i form av lera
eller pulver
* Formas till produktens form
* Sintras (bränns) vid ca. 2/3 av
keramens smälttemperatur$seed$, null, 3);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('c9a74ab1-e474-5aa9-a8e9-5fbace07ccb9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Vad är en metall och vad kännetecknar dem?$seed$, $seed$* Vanliga metaller
  - Stål
  - Aluminium
  - Cu, Mg, Ti, Ni
* Används oftast i legering
(blandning)
  - Stål = Fe + C
  - Brons = Cu +Sn
  - Mässing = Cu + Zn

Egenskaper:
* Kristallin struktur
* Medel till hög smälttemperatur
* Elektriskt och termiskt ledande
* Hög styvhet
* Hög sträckgräns (hårdhet)
* Ej spröda
* Hög densitet
* Kan gjutas
* Kan formas med plastiska
metoder: valsning, pressning
* Kan maskinbearbetas:
borrning, svarvning, fräsning$seed$, null, 4);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('fcbff137-2aa0-5a35-8bcb-bb68db753900', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Vad är en polymer och vad kännetecknar dem?$seed$, $seed$* Organiska material som består
av makromolekyler
* Tillverkas av olja, men även
annan organisk råvara
* Plast = polymer + tillsatser

Egenskaper:
* Låg användningstemperatur
* Relativt låg styvhet och
sträckgräns
* Låg densitet
* Elektriskt och termiskt
isolerande
* Enkla att forma$seed$, null, 5);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('949bbcd0-5e62-5414-b18d-b8beb7d057cd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Nämn minst två olika typer av polymerer och vad som kännetecknar dem.$seed$, $seed$* Termoplaster
  - Långa polymerkedjor
  - Svaga bindningar mellan
kedjorna
  - Kan formas med värme
  - Återvinningsbara
* Härdplaster
  - Nätverk av molekyler
  - Kovalenta bindningar
  - Kan inte formas med värme
  - Inte återvinningsbara
* Gummi (elastomerer)
  - Glest tvärbundna
polymerkedjor
  - Kan inte formas med värme
  - Inte återvinningsbara$seed$, null, 6);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('4ae75297-05ec-51ca-8754-89d3f9f7df5f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Vad är en komposit och vad kännetecknar dem?$seed$, $seed$* Kombination av två eller flera
material, ex. plast och kolfiber
* Vanliga fiber: kolfiber, glasfiber,
aramidfiber
* Förstärkningen kan vara i olika
form: långa fiber, korta fiber,
partiklar
* Andra exempel:
  - Betong = cement och sten
  - Hårdmetall = Co och WC$seed$, null, 7);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('a402ebee-a4da-5f84-8535-c4fd200c71cc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Nämn minst två olika typer av tillverkningsmetoder.$seed$, $seed$* Primär formning
* Sekundär formning
* Fogning
* Ytbehandling$seed$, null, 8);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('2177dc2f-e750-5ded-b194-8b38181e7213', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$"Materialegenskaper" brukar delas upp i ett antal underkategorier, nämn minst tre av dessa.$seed$, $seed$* Allmänna egenskaper
* Mekaniska egenskaper
* Elektriska, magnetiska och
optiska egenskaper
* Termiska egenskaper
* Kemiska egenskaper
* Miljö$seed$, null, 9);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('fd10cfb3-afeb-5545-966b-0d4f8706efa3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Ge minst två exempel på mekaniska egenskaper.$seed$, $seed$* Styvhet
  - Hur mycket ett material
deformeras vid en viss last.
* Sträckgräns
  - Vid vilken last (spänning) ett
material deformeras
permanent.
* Brottseghet
  - Vid vilken last ett material
går sönder.$seed$, null, 10);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('342000b5-8bbe-5bef-9153-e733a8a2d27d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Ge minst två exempel på elektriska, magnetiska och optiska egenskaper.$seed$, $seed$* Elektisk ledningsförmåga
* Elektrisk isolering
* Magnetiska
* Genomskinligt, reflexion, färg

Beror på växelverkan mellan
elektronerna i materialet$seed$, null, 11);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('9ea9fa5e-09a5-5618-a33a-2cc00e766702', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Ge minst två exempel på termiska egenskaper.$seed$, $seed$* Smälttemperatur
* Min och max
användningstemperatur
* Värmeledning
* Specifik värmekapacitivitet
* Termisk utvidgning$seed$, null, 12);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('1b4c22e2-a1db-5f18-ad14-bda4abbd68fd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Ge minst två exempel på kemiska egenskaper.$seed$, $seed$* Korrosion (“rostar”)
* Oxidation (reagerar med syre)
* Reaktioner i användningsmiljön
* Giftigt$seed$, null, 13);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('8427cac8-2352-5c74-aca9-af60357d64fc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '20e76167-bad1-5c23-86ab-85047b278b49', $seed$Ge minst två exempel på miljöegenskaper.$seed$, $seed$* CO₂ footprint: mängd CO₂-som
bildas vid framställning
* Embedded energy: mängd
energi som åtgår för
framställning
* Återvinningsbart
* Andra miljöbelastningar vid
utvinning, framställning,
produkttillverkning,
användning och skrotning$seed$, null, 14);
insert into public.categories (id, deck_id, title, sort_order) values ('29f51667-f7e4-5e67-b21a-ee68e519bc92', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Materialvalsprocessen$seed$, 1);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('1df0482a-dbbc-5fc0-8478-eebaac5d6b37', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '29f51667-f7e4-5e67-b21a-ee68e519bc92', $seed$Vilka är de olika stegen i materialvalsprocessen?$seed$, $seed$1. Översätta
2. Sålla
3. Rangordna
4. Sök dokumentation
5. Iterera$seed$, null, 15);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('31e2b57f-174a-5a2a-8e90-7274a384cd11', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '29f51667-f7e4-5e67-b21a-ee68e519bc92', $seed$Beskriv vad man gör i materialvalssteget: "Översätta".$seed$, $seed$Översätta krav på komponenten till krav på materialet:

* Funktion: talar om materialets huvudsakliga funktion i
komponenten.
Ex. leda värme, elektrisk isolering,
balk i böjning som inte plasticerar.
* Krav: egenskaper som måste vara uppfyllda för att komponenten skall fungera.
Ex. användningstemperatur, tåla
vatten, viss brottseghet
* Mål: egenskaper hos komponenten som vi vill optimera.
Ex. vikt, pris, miljöbelastning
* Fria variabler: variabler hos komponenten som vi kan ändra.
Ex. tvärsnitt, material$seed$, null, 16);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('715b709e-6935-5adb-9f40-36efe6f83eae', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '29f51667-f7e4-5e67-b21a-ee68e519bc92', $seed$Beskriv vad man gör i materialvalssteget: "Sålla".$seed$, $seed$Ta bort alla material som inte fyller kraven. Använder vi dessa material så kommer komponenten inte att fungera som vi vill.) Materialegenskaper som vi använder i målfunktionen bör vi inte heller använda vid sållningen. (ex. inget krav på densitet om målet är låg vikt.)$seed$, null, 17);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('5716c039-7ebe-5755-85c1-bc41eb10adf1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '29f51667-f7e4-5e67-b21a-ee68e519bc92', $seed$Beskriv vad man gör i materialvalssteget: "Rangordna".$seed$, $seed$* Använd funktion, mål och fria variabler för att bestämma
materialindex.
* Materialindex = numeriskt värde som beskriver hur bra ett material uppfyller målen!
* Ta hjälp av materialindexet för att rangordna materialen.
Ex: E-modul/pris, E-modul^(1/2)/densitet$seed$, null, 18);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('86d4f5f0-8721-508c-a3d1-104ff29ee34e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '29f51667-f7e4-5e67-b21a-ee68e519bc92', $seed$Beskriv vad man gör i materialvalssteget: "Sök dokumentation".$seed$, $seed$Leta i dokumentation (handböcker, artiklar, standarder m.m.) för att se om det finns erfarenheter av materialet i liknande tillämpningar.$seed$, null, 19);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('82ac93d4-8f74-5549-a84f-050916da6226', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '29f51667-f7e4-5e67-b21a-ee68e519bc92', $seed$Beskriv vad man gör i materialvalssteget: "Iterera". Varför är det så viktigt att iterera sitt materialval?$seed$, $seed$Materialvalet måste ofta förfinas och förbättras i flera steg innan man hittar den bästa möjliga lösningen. För att säkerställa att man inte missat potentiellt aktuella material utökar man vanligtvis mängden valbara material efter den första iterationen efter att man skaffat sig en upplevelse av vad för typ av material som passar uppdragsbeskrivningen.$seed$, null, 20);
insert into public.categories (id, deck_id, title, sort_order) values ('3640d01d-e7e7-5a68-89f2-3fa8c69470e9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Kristallstruktur$seed$, 2);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('942c5970-3094-536f-80e0-555124fdbe57', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '3640d01d-e7e7-5a68-89f2-3fa8c69470e9', $seed$Vad är skillnaden mellan kristallin- och amorf mikrostruktur?$seed$, $seed$* Kristallin = ordnad struktur
  - Metaller, keramer, vissa polymerer
* Amorf = oordnad struktur
  - Polymerer, glas$seed$, null, 21);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('2b33b3d1-1182-576c-a93e-08f3c5fde72e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '3640d01d-e7e7-5a68-89f2-3fa8c69470e9', $seed$Vad är en enhetscell? Nämn minst två olika typer av enhetsceller.$seed$, $seed$* En liten volym som kan beskriva hela kristallen
* I varje punkt sitter det en atom eller molekyl
* Sex parametrar: 3 längder, 3 vinklar

Ex: FCC (Face Centered Cubic), BCC (Body Centered Cubic), Triclinic, Simple Cubic, Close-Packed Hexagonal.$seed$, null, 22);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('f8532388-d452-52d3-b73b-f1a42cc9f976', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '3640d01d-e7e7-5a68-89f2-3fa8c69470e9', $seed$Vad kännetecknar enhetscellen: "FCC"?$seed$, $seed$* Face centered cubic
* Ytcentrerad kubisk
* Ex: Al, Cu, Ni, Au, Ag, Rostfritt stål
* Kantlängd a, vinkel 90 grader
* Tätpackad ytdiagonal$seed$, null, 23);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('17b24f38-9853-59bf-9c90-17ded11225d8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '3640d01d-e7e7-5a68-89f2-3fa8c69470e9', $seed$Vad kännetecknar enhetscellen: "BCC"?$seed$, $seed$* Body centered cubic
* Rymdcentrerat kubisk
* Ex: Fe
* Kantlängd a, vinkel 90 grader
* Tätpackad rymddiagonal$seed$, null, 24);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('fa22c387-97e5-5b28-a793-31513bf2fc94', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '3640d01d-e7e7-5a68-89f2-3fa8c69470e9', $seed$Det finns olika typer av hål i kristallstrukturer, vad innebär detta?$seed$, $seed$* Mellan atomerna finns
hålrum med olika form
och storlek
* Avgör om små atomer
kan lösas in i
materialet (ex. C i Fe)$seed$, null, 25);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('1a66c915-4bb7-5453-806f-c02852fece92', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '3640d01d-e7e7-5a68-89f2-3fa8c69470e9', $seed$Millerindex: Beskriv kortfattat vad det är och hur det tas fram.$seed$, $seed$Millerindex är en form av vektorbeteckning som används för att beskriva atomplans position. Origo för koordinatsystemet placeras i regel i ett av enhetscellens hörn. På följande sätt härleds en enhetscells Millerindex:
1. Bestäm planets skärningar med koordinataxlarna
2. Invertera
3. Gör heltalig → Millerindex (hkl)
(hkl) = specifikt plan
{hkl} = familj av plan

På ett liknande sätt kan man beskriva en kristalls riktningar, men då kallas det inte längre för Millerindex och följande beteckning används istället:
[hkl] = specifik riktning
\<hkl> = familj av riktningar$seed$, null, 26);
insert into public.categories (id, deck_id, title, sort_order) values ('a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Styvhet, töjning och materialindex$seed$, 3);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('1893d404-b335-5554-87ae-4794384263ae', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Vad beror ett materials densitet på för faktorer?$seed$, $seed$* Atomvikten hos atomerna i materialet
* Antalet atomer/volym
* Densiteten hos kompositer beror på volymandel och densitet på de ingående materialen
* Densiteten i polymerskum, trä m.m blir låg p.g.a. hålrummen.$seed$, null, 27);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('08a4495e-19a0-548f-95ee-a0995bd4f5d8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Atombindningar kan jämföras med linjära fjädrar. Hur kommer detta sig och varför gör man det?$seed$, $seed$Man brukar likna atombindningar med linjära fjädrar för att de har liknande egenskaper.
Om:
S = styvheten hos atombindningen
n = antalet bindningar/area
Får vi:
E-modulen = S x n

* Elastiskt beteende = materialet beter sig
som en fjäder, fjädrar tillbaka vid
avlastning
* Djup bindningsenergikurva ger:
  - Stor E-modul
  - Hög smälttemperatur$seed$, null, 28);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('774da675-b6a2-5e39-97a4-70c19ef64296', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Vad har ett materials atombindningar för inverkan på dess egenskaper?$seed$, $seed$* Påverkar styvhet, termisk utvidgning,
smälttemperatur, elektrisk ledningsförmåga m.m.
* Kan ej förändras med processer$seed$, null, 29);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('96b9dedf-1044-5401-9d4d-72d455717b1c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Hur ser ett typiskt dragprov ut för ett sprött material?$seed$, $seed$* Elastiskt beteende upp till
brottgränsen
* Brottgränsen =den spänning
där brott sker
* Keramer, glas$seed$, null, 30);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('09c96aed-0deb-5e60-802c-f8203269a9d0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Hur ser ett typiskt dragprov ut för ett segt material?$seed$, $seed$* Elastiskt beteende upp till
sträckgränsen
* Sträckgränsen = den spänning där
materialet börjar plasticera
* Brottgränsen = högsta spänningen
* Elastisk avlastning även i plastiska
området
* Metaller, polymerer$seed$, null, 31);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('28313dfd-28e3-5668-bc1b-e92faadf7a62', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Vilka egenskaper kan observeras/kartläggas med hjälp av dragprov?$seed$, $seed$* E-modul (styvhet) GPa
* Sträckgräns (börjar plasticera) MPa
* Brottgräns (största spänningen innan brott) MPa
* Brottförlängning (plastisk töjning efter brott) %
* Seghet – arean under dragprovkurvan$seed$, null, 32);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('8c9e763f-c513-5fe6-8970-adc2a62b3a6a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Styvheten hos kompositer beror på fler faktorer än homogena material gör, nämn minst två av dessa.$seed$, $seed$Styvheten beror på:

* De ingående komponenternas
egenskaper
* Volymfraktion
* Orientering
* Form

Ex: Fiberriktning$seed$, null, 33);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('f24931ae-5c0c-5de4-9055-2ceebe80265f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Vad är töjning?$seed$, $seed$Töjning är en geometrisk storhet som beskriver den procentuella förlängningen av ett material under en given last eller annan typ av påfrestning.

* Töjning kan orsakas av:

Mekaniska laster:
$\sigma = E\,\varepsilon$
Temperatur:
$\varepsilon = \alpha\,\Delta T$
$\alpha$ = längdutvidgningskoefficienten
Elektriska och magnetiska fält
Fukt m.m.$seed$, null, 34);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('e2aa18a7-b7aa-54fd-8246-4f0833d971eb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Vad kännetecknar ett isotropt material?$seed$, $seed$Ett isotropt material är ett material som kan beskrivas med minst två elastiska konstanter:

* E-modul
* Poissons tal, tvärkontraktion

Fler elastiska konstanter i t.ex.
kompositer, trä → anisotropt material$seed$, null, 35);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('7b45f59c-2a7c-5f87-98f6-7ec58d9eb4f0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Vad har lastfall för inverkan på materialindexet?$seed$, $seed$Lastfallet bestämmer vilket materialindex som är bäst lämpat för situationen. Materialindexet beskriver i sin tur hur bra ett material presterar i det aktuella lastfallet och kan därför med fördel användas för att rangordna en mängd material.$seed$, null, 36);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('bbc1ddfb-162b-5777-9a9a-e0b834781db6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Vad är ett lastfall och varför är det viktigt i materialvalsprocessen?$seed$, $seed$* Ett lastfall är en isolerad belastningssituation som materialet kan utsättas för.
* Ex: En stång i tryck/drag/vridspänning, en balk i böjning/knäckning eller utsatt för utbredd last, ett tryckkärl utsatt för tryckskillnader.
* Lastfall används för att definiera vilket materialindex som är bäst lämpat för materialvalet.
* För att få den mest rättvisa jämförelsen av materialindex bör man använda lastfallet som förekommer oftast!$seed$, null, 37);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('7735da59-a931-5fcf-b115-635b97a87d5d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'a10dd962-3cc6-555d-b5e0-f3c06d69c1cd', $seed$Beskriv ingående vad ett materialindex är och hur det används.$seed$, $seed$* Ett numeriskt värde M som talar om hur effektivt ett material är i
ett visst lastfall och en viss form
* För att bestämma materialindex behöver vi veta vilken egenskap som skall optimeras (ex: styvhet, pris, vikt) och lastfall
* Detta bestäms av funktion, mål och fria variabler från
översättningen
* Materialindex används för att rangordna material i materialvalet$seed$, null, 38);
insert into public.categories (id, deck_id, title, sort_order) values ('ed573ff4-cf6a-52d7-8d84-b8cfc2247678', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Dislokationer, härdning och brott$seed$, 4);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('7c275698-a60d-5b46-af2f-47f4ecf0a264', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Hur mäts ett materials hårdhet?$seed$, $seed$* Mäts med intryck
* Olika metoder med
olika form på
indenter och olika
last
* Kopplar till
sträckgräns$seed$, null, 39);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('74ea9c02-f2ae-5015-932e-edcd05bd0250', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Vad kan det finnas för defekter i kristaller?$seed$, $seed$* Vakanser = atomer saknas
* Inlösta atomer = atom av
annan sort
* Dislokationer = extra
atomplan
* Korngränser$seed$, null, 40);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('2e1c62fa-cdfd-5570-9a03-cf8927b9d916', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Beskriv ingående vad dislokationer och dislokationsrörelser är och vad det innebär för materialet.$seed$, $seed$Dislokationer är en typ av strukturmässig avvikelse i kristallen i form av "extra atomplan". De bryter alltså det annars uniforma mönstret hos kristallen.

* När kristallen belastas över sträckgränsen kan dislokationer röra sig
* Dislokationerna rör sig på glidsystem = glidplan + glidriktning
* Glidningen ger upphov till en förskjutning som har storlek och riktning som glidvektorn, Burges vektor

Dislokationen kan sättas i rörelse av skjuvspänningar och rör sig sedan i små steg. Detta ger upphov till små förskjutningar eller annars kallat; plastiska deformationer i kristallstrukturen.

* Dislokationerna rör sig lättast i
riktningar nära 45 grader mot
belastningsriktningen
* Plasticering sker under
konstant volym
* Ger upphov till skjuvband =
band av plasticerat material$seed$, null, 41);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('bff9862d-92dc-5038-b7aa-364595e122b1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Vad är en härdningsmekanism? Nämn minst två olika typer av härdningsmekanismer.$seed$, $seed$En förändring av mikrostrukturen för att göra dislokationsrörelser svårare. Det resulterar i högre sträckgräns, hårdhet och ofta lägre brottförlängning. De olika typerna av härdningsmekanismer är:

1. Lösningshärdning
2. Utskiljningshärdning
3. Deformationshärdning
4. Korngränshärdning$seed$, null, 42);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('fce03987-c774-5d01-aecb-f2fd71ba389f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Vad är lösningshärdning och hur går det till?$seed$, $seed$* Atomer av annan sort löses in i
kristallen
* Spänningsfältet kring atomerna
hindrar dislokationsrörelse
* Större effekt med större
koncentration och större skillnad i
atomstorlek
* Sker med legering i smälta$seed$, null, 43);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('f71732f4-c08a-5139-98b6-c5741390df58', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Vad är utskiljningshärdning och hur går det till?$seed$, $seed$* Partiklar av annan fas
bildas i materialet
* Partiklarna hindrar
dislokationsrörelse
* Sker med legering i smälta
och värmebehandling i
fast form$seed$, null, 44);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('76876f2b-93fe-5fc3-9a6c-656b9742a2f6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Vad är deformationshärdning och hur går det till?$seed$, $seed$* Dislokationer hindrar andra
dislokationer att röra sig (låser
varandra)
* Mängden dislokationer ökar
kraftigt vid plastisk
deformation → plastiskt
hårdnande
* Sker vid kallbearbetning
(pressning, valsning, smide ...)$seed$, null, 45);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('11321fe5-1a35-5e5c-889f-d876af7adcfc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Vad är korngärnshärdning och hur går det till?$seed$, $seed$* Minska storleken på kornen som utgör materialet så att antalet korngränser ökar
* Korngränser hindrar
dislokationer
* Små korn ger hårdare material
* Viktigt hos BCC-metaller (vissa
stål)$seed$, null, 46);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('0222cfd4-b154-534c-b3e6-5778d9246ae5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$När ska man använda materialindex för styvhet, kontra sträckgräns?$seed$, $seed$* Använd materialindex för styvhet
om deformationen är
dimensionerande. (Krav på max
deformation)
* Använd materialindex för
sträckgräns om last utan plasticering
är dimensionerande. (Krav på max
spänning)$seed$, null, 47);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('cee7692a-a886-5dfa-b59b-35def89068d1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Vad är brottseghet?$seed$, $seed$Ett mått på ett materials naturliga motstånd mot propagering av sprickor.

* Brottseghet $K_{1c}$ ($\text{MPa}\sqrt{\text{m}}$), 1 för modus, c för kritisk
* Brott när $K_{1c}$> $K_1$
* Tar hänsyn till last och spricklängd
* Beror på energin som krävs för att driva sprickan
* ($K_{1c} = \sqrt{E\,G_c}$)$seed$, null, 48);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('458cc835-967a-5401-81e7-7fc07e316c05', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Varför är spröda material extra känsliga för defekter?$seed$, $seed$Största förekommande defekten i en komponent ger störst spänning vilket innebär att brottet börjar där. Brottstyrkan blir då beroende av sannolikheten för att det finns en defekt i det belastade området och ju större komponenten är desto högre blir sannolikheten att det förekommer defekter. Eftersom sprickor uppträder lättare i spröda material blir de mer defektkänsliga.$seed$, null, 49);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('b79f8d63-be43-5173-a3e1-af8e32818407', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Vad har temperatur för inverkan på ett materials brottseghet?$seed$, $seed$När temperaturen sjunker blir materialen sprödare, och sannolikheten för sprickbildning ökar.$seed$, null, 50);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('04161dbf-75bd-57a7-a8cb-ac02438a1382', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Vad är skillnaden mellan ett segt- respektive sprött brott?$seed$, $seed$Ett segt material deformeras plastiskt under en längre tid innan brott uppstår, till skillnad från ett sprött material som deformeras betydligt mindre innan brott sker.$seed$, null, 51);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('63814ea1-408d-551c-8b7b-12fe87b553a0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ed573ff4-cf6a-52d7-8d84-b8cfc2247678', $seed$Vad använder man för typ av test för att undersöka ett materials brottseghet?$seed$, $seed$För att bestämma brottseghet hos ett material används slagprovning.

* Det är ett enkelt test för att mäta energin som krävs för sprickpropagering
* Provstav med anvisning används för att standardisera testet
* Används för kvalitetstest och omslagstemperatur
(omslag mellan sprött och segt beteende)$seed$, null, 52);
insert into public.categories (id, deck_id, title, sort_order) values ('d462076e-8a0c-5486-85b1-860c999ea1c5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Stål, värmebehandling och bearbetning$seed$, 5);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('846fd624-058b-5861-af75-c8b0f3428194', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad utgör stål?$seed$, $seed$Stål är järn legerat med kol som beroende på kolhalt och tillverkningsförhållanden kan ges olika egenskaper.$seed$, null, 53);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('fef659b9-5801-568e-9319-554cdc41e727', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad är ett fasdiagram och vad används det till?$seed$, $seed$Ett fasdiagram visar vilka faser som är stabila vid vilka specifika temperaturer och sammansättningar av de ingående metallerna i en legering (även tryck m.m.). Gäller vid långsamma förlopp så att utjämning av koncentrationsskillnader kan ske m.h.a. diffusion = jämvikt uppnås.$seed$, null, 54);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('96514959-707a-59b2-851e-4ef3c42c7efc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad är Ferrit och när uppstår det?$seed$, $seed$Ferrit är rent järn upp till 910°C, BCC, låg löslighet av C.$seed$, null, 55);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('373c8293-aef4-5d42-b0ce-848100050a38', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad är Austenit och när uppstår det?$seed$, $seed$Austenit, rent järn upp över 910 °C, FCC, upp till 2.1 % löslighet av C.$seed$, null, 56);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('9e790f40-15cb-5a05-a2c6-f36a250c5bb4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad är cementit och när uppstår det?$seed$, $seed$Cementit, Fe₃C, intermediär fas, 6,67 % C, mycket hård$seed$, null, 57);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('c886bdde-cdd0-54a9-8aa1-eb5651c1bd72', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Beskriv vad en anlöpning är.$seed$, $seed$Anlöpning av härdat stål är en process som används för att öka materialets duktilitet och sänka dess hårdhet.

För att uppnå detta återuppvärms stålet till en temperatur beroende på stålsort och produkt precis under den punkt där ferrit omvandlas till austenit (cirka 910 °C).

* En uppvärmning till en temperatur under
austenittemeraturen ger fasomvandling till
anlöpt martensit = perlit + cementit (mycket
fina utskiljningar)
* Minskar hårdhet något, men mycket segare
* Kan bestämma hårdhet med
anlöpningstemperatur$seed$, null, 58);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('ff0270da-0fb3-5554-8c07-fa945940cace', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vilken inverkan har kolhalten på stålets egenskaper?$seed$, $seed$Kolet gör att järnet blir brukbart som konstruktionsmaterial överhuvudtaget. Stålet blir sprödare ju mer kol som introduceras.$seed$, null, 59);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('a156df5d-7d29-5842-8c7a-ae06bbd0c868', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad är martensit och hur uppstår det?$seed$, $seed$Kan fås vid snabbkylning av stål från austenitområdet. Det är utöver det en metastabil fas med tetragonal struktur = distorderad BCC.$seed$, null, 60);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('ee670ea1-20b3-5295-a74a-cef913fa0060', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad är ett TTT-diagram och vad används det till?$seed$, $seed$TTT-diagram står för Time Temperature Transformation- diagram och används för att bestämma tid och temperatur för värmebehandlingar.$seed$, null, 61);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('3641ad06-4872-50a7-a33b-fffab0970423', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Varför legerar man stål? Nämn minst två anledningar.$seed$, $seed$Man legerar stål för att öka hållfastheten eller tilldela det ytterligare egenskaper! Några exempel på detta är ökad härdbarhet och bättre högtemperatursegenskaper. Om man legerar stålet med krom (Cr) får man ett kromoxidskikt på ytan av det färdiga materialet som innebär korrosionsmotstånd (rostfritt stål).$seed$, null, 62);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('5cae52a1-b79b-5d3a-a664-3df9b619395c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad kännetecknar underkategorin: "Konstruktionsstål"?$seed$, $seed$* Kolhalt: < 0.25%

Konstruktionsstål kan delas in i två grupper; Kolstål och HSLA (High Strength Low Alloy)-steels, där låg kolhalt definieras som < 0.25%. Båda är svetsbara men kan ej härdas. Kolstål är billigt och används i exempelvis byggnader eller skepp. HSLA tillverkas mha en termomekanisk process som ger fin mikrostruktur och således hög sträckgräns. Används till exempel i fordonsplåtar och broar.$seed$, null, 63);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('00286ad2-ed7e-553f-a832-8c1755ab2d3a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad kännetecknar underkategorin: "Maskinstål"?$seed$, $seed$* Kolhalt: 0.25-0.75 %

Maskinstål kan härdas och är legerat för att öka härdbarheten. Dock är det svårare att svetsa än exempelvis konstruktionsstål. Exempel på användningsområden är järnvägsräls, handverktyg, maskindelar etc.$seed$, null, 64);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('9f45e627-10c5-5639-97b3-d0cc3fcf61d3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad kännetecknar underkategorin: "Verktygsstål"?$seed$, $seed$* Kolhalt: 0.5-1.7 % C

Verktygsstål är legerat för att erhålla stabila karbider vid hög temperatur. Används i exempelvis gjutformar, pressverktyg, skärverktyg och kullager.$seed$, null, 65);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('11a98f33-6c63-52d2-83c5-4958d48f096c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad kännetecknar underkategorin: "Rostfritt stål"?$seed$, $seed$Legeras med Cr för att få ett kromoxidskikt på ytan → korrosionsskydd

* Ni, stabiliserar austenit vid rumstemperatur
* Tre typer: ferritiska (billiga), austenitiska (bäst korrosionsmotstånd, lågtemperaturegenskaper), martensitiska (kan härdas)$seed$, null, 66);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('baba4631-739c-56a8-99c5-5415f51bdeaf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad innebär kalldeformation?$seed$, $seed$Kallbearbetning, även känt som deformationshärdning eller kalldeformation, är en process som stärker metall genom plastisk deformation som exempelvis kallvalsning och tråddragning.

Mycket högre dislokationsdensitet efter
kallbearbetning → högre sträckgräns
(deformationshärdning)$seed$, null, 67);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('221bb716-4d37-5c54-92db-6a9cd47d5b84', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad innebär rekristallation?$seed$, $seed$Rekristallation är en process inom metallbearbetning där en deformerad metall omstrukturerar sin inre kristallstruktur för att minska spänningar och återställa dess ursprungliga egenskaper. När metallen deformeras plastiskt, till exempel genom valsning eller smidning, blir dess kristallstruktur och dislokationer störda, vilket leder till hårdare och sprödare egenskaper (detta kallas kallbearbetning).
Rekristallation sker när en deformerad metall värms upp till en specifik temperatur, kallad rekristallationstemperaturen. Vid denna temperatur börjar nya, icke-deformerade korn att bildas inuti materialet. Dessa nya korn ersätter de gamla, deformerade kornen och bidrar till att:

* Sänka metallens hårdhet och öka dess duktilitet – metallen blir mjukare och mer formbar.
* Minska inre spänningar – som byggts upp under deformationen.
* Förbättra materialets struktur – den får en jämnare och mer homogen kornstruktur.$seed$, null, 68);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('7d727a17-95bc-5fdb-bd9b-4226d7790a6a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Vad innebär varmdeformation?$seed$, $seed$Varmdeformation är en process där metaller deformeras vid temperaturer som är högre än deras rekristallationstemperatur (ofta över cirka 0,5 gånger smälttemperaturen i kelvin). Vid dessa temperaturer kan metallens kristallstruktur rekonstrueras samtidigt som deformationen sker, vilket gör att nya korn kan bildas kontinuerligt under bearbetningen. Detta innebär att materialet inte härdas, och det behåller sin duktilitet och formbarhet. Varmdeformation används ofta för stora formändringar, exempelvis vid smidning och valsning i höga temperaturer.

Kortfattat:

* Ger deformation utan att höja sträckgänsen
* Stora deformationer är möjliga$seed$, null, 69);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('c094a4a2-7f4d-5a66-bba5-c8ceebeda275', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Beskriv kortfattat vad skillnaden mellan kall- och varmdeformation är.$seed$, $seed$Skillnader kortfattat:

* Varmdeformation: Hög temperatur, inga spänningar byggs upp, materialet behåller sin formbarhet och stora dimensionsändringar kan ske under en och samma behandling.
* Kalldeformation: Låg temperatur, spänningar och hårdhet ökar, materialet blir starkare men samtidigt sprödare.$seed$, null, 70);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('eb92e14a-b43b-5125-9826-ca28e37cbbb7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Ge exempel på minst två plastiska formningsmetoder.$seed$, $seed$Exempel:

* Smide
* Valsning
* Pressning
* Tråddragning$seed$, null, 71);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('2ff228b4-b2d0-55cb-b8a7-878c51a24bf2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Redogör för vad gjutning innebär för materialet och ge exempel på minst två gjutningsmetoder.$seed$, $seed$* Gjutstruktur – Olika struktur i
olika delar av gjutgodset
* Defekter – porer, sprickor
* Ofta något sämre mekaniska
egenskaper än valsade eller
smidda material

Exempel:

* Formgjutning
(högt och lågt tryck)
* Sandgjutning
* Lost wax- casting$seed$, null, 72);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('71e1bc92-58a3-5b74-ba8a-e2374d2d6524', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd462076e-8a0c-5486-85b1-860c999ea1c5', $seed$Redogör för vad svetsning innebär för materialet och ge exempel på minst två svetsmetoder.$seed$, $seed$* Svets där materialet har smält och
stelnat – gjutstruktur
* Värmepåverkad zon (HAZ) –
förändrad mikrostruktur,
korntillväxt, förändrad härdning
* Ofta sprickor

Ex: TIG/MIG/MAG$seed$, null, 73);
insert into public.categories (id, deck_id, title, sort_order) values ('8323164b-a5df-5b23-83ce-053207cd4da8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Termiska egenskaper, diffusion och krypning$seed$, 6);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('04dbe6f7-1072-554d-a8f2-2b78d3e2aeb0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Vad händer med material när temperaturen höjs?$seed$, $seed$* Atomerna börjar vibrera
* Atombindningarna blir svagare
* Atomerna rör sig lättare (diffusion)
* Fasomvandlingar
* Kemiska reaktioner$seed$, null, 74);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('a129f64e-86d4-5481-9c77-9905263957d4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Beskriv utförligt vad smälttemperatur och glasomvandlingstemperatur är och vilka material respektive är relevant för.$seed$, $seed$Smälttemperatur:

* Kristallina material
* Metaller, keramer
* Går från fast till "lågviskös"
vätska vid smälttemperaturen, "Tm"

Glasomvandlingstemperatur

* Amorfa material
* Termoplaster, glas
* Gradvis övergång från fast till "viskös" vid
glasomvandlingstemperaturen "Tg".$seed$, null, 75);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('a555e6bc-91f6-51c1-9d1b-c75256a7460a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Vad definierar ett materials relevanta användningstemperatur?$seed$, $seed$Maximal användningstemperatur begränsas
t.ex. av:

* Försämrade mekaniska egenskaper
* Fasomvandlingar och kemiska förändringar
* Oxidation

Minimal användningstemperatur
begränsas t.ex. av:

* Sprödhet$seed$, null, 76);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('cf45183e-2b01-57d5-8312-95fc93146277', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Beskriv vad ett materials specifika värmekapacitet innebär för materialet.$seed$, $seed$Värmekapacitet är ett mått på hur mycket energi som krävs för att höja temperaturen i ett material.$seed$, null, 77);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('7c0ac23d-0b96-5fd0-aaff-0593c2283b4e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Vad är termisk utvidgning respektive termiska spänningar?$seed$, $seed$När temperaturen ökar i ett material uppstår "Termisk utvidgning/töjning" (procentuella förlängningen/utvidgningen av materialet) och "Termiska gradienter" (storleken och riktningen av utvidgningen på vektorform) eftersom materialet expanderar. Den termiska utvidgningen är proportionell mot temperaturskillnaden*temperaturutvidgningskoefficienten alpha enl: $\varepsilon_T = \alpha\,(T - T_0)$.

Termiska spänningar är de spänningar som uppstår till följd av att:

* Olika material fogas samman under temperaturförändring
* Termisk utvidgning ger upphov till termiska gradienter

Detta resulterar sammantaget i "Termisk utmattning" över tid.$seed$, null, 78);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('3cd7c03b-6f20-554e-a01a-dae1e3f529fe', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Vad har atombindningar med termisk utvidgning att göra?$seed$, $seed$Den termiska utvidgningen är proportionell mot temperaturskillnaden*temperaturutvidgningskoefficienten alpha enl $\varepsilon_T = \alpha\,(T - T_0)$.

Svaga atombindningar ger stor termisk utvidgning och eftersom styrkan hos atombindningarna beror på temperaturen gör också den termiska utvidningskoefficienten det!$seed$, null, 79);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('31807683-5ade-5c0c-ad20-b4f244c2a381', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Vilka faktorer är avgörande för ett materials termiska ledningsförmåga?$seed$, $seed$Temperatur fördelas med hjälp av nedanstående mekanismer:

* Kristallvibrationer (fononer)
* Elektroner

Kristallvibrationer och elektroner överför energi från område med hög temperatur till område med låg energi! Metaller har därför väldigt bra termisk ledningsförmåga exempelvis (till följd av elektronmoln).

* Fononer = kristallvibrationer
(vågor/partiklar)
* Fononerna sprids i materialet
* Hindras och sprids på
kristallstörningar

Notera särskilt att:

* Rena legeringar har bäst termisk
ledningsförmåga
* Dislokationer, inlösta atomer och
utskiljningar hindrar/sprider
fononerna → lägre
värmeledningsförmåga$seed$, null, 80);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('b5122c3c-2f5b-5803-b235-3a2032e58717', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Beskriv kort vad värmeflöde är och hur det beräknas$seed$, $seed$Värmeflödet i ett material är proportionellt mot den partiella derivatan av temperaturen med avseende på avståndet från ytan. Temperaturförändringen över tid är istället proportionellt mot andraterivatan av temperaturen med avseende på avståndet  från ytan.

Beräkningen av värmeflöde och värmeledning tillhör området "Termodynamik" och är inget vi har gått närmare in på i kursen.$seed$, null, 81);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('7c048ecb-c6b0-5a54-9049-3bf817131b8b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Vad är diffusion?$seed$, $seed$Diffusion är den spontana spridningsprocess som äger rum när något, oftast gaser eller vätskor, med en egenskap skilt från omgivningen sprids, blandas och jämnas ut. I fallet av temperaturspridning är diffusion och diffusionshastighet mått på hur temperaturen tillåts fördelas i materialet över tid. Notera särskilt att:

* Diffusionshastigheten ökar exponentiellt
med temperaturen
* Beror på vilken atom som rör sig i vilken
kristall$seed$, null, 82);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('7e0e006c-505a-55b0-847d-9747bf66e7be', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Vilka är Ficks 1:a och 2:a lag?$seed$, $seed$Ficks lagar beskriver allmänt hur diffusion beter sig i ett material, det behöver nödvändigtvis inte vara relaterat till temperatur.

Fick's 1:a lag beskriver hur flödet (J) är proportionellt mot den partiella derivatan av koncentrationen och Fick's 2:a beskriver hur den partiella derivatan av koncentrationen med avseende på tiden är proportionell mot andraderivatan av koncentrationen.

Man får en uppsättning partiella differentialekvationer som bäst löses numeriskt.$seed$, null, 83);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('6ce736bf-3435-500a-b8c4-2e0e54b03237', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Vad är krypning? Vad finns det för olika typer av krypning?$seed$, $seed$* Krypning sker vid över cirka ½ av smälttemperaturen
* Ger plastisk (permanent) deformation
* Två typer:
  - Diffusionskrypning
  - Dislokationskrypning

* Primär krypning = snabb deformation tills dislokationer möter hinder
* Steady-state = krypning med konstant töjningshastighet
* Tertiär krypning = Skador i materialet

* Kryphastigheten beror på krypningsmekanism men är allmänt exponentiellt beroende av temperaturen
* Spänningen kan ändra krypmekanism$seed$, null, 84);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('a791ee61-3294-5b85-b04e-c613f339f443', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Beskriv närmare vad diffusionskrypning är.$seed$, $seed$Diffusionskrypning:

* Förändring av kristallernas korn
m.h.a. diffusion
* Kornen förlängs i
belastningsriktningen$seed$, null, 85);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('823689e2-5f25-53ae-90a7-dc331ac57f02', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Beskriv närmare vad dislokationskrypning är.$seed$, $seed$Dislokationskrypning:

* Plastisk deformation m.h.a.
dislokationsrörelse
* Diffusion hjälper dislokationerna att
komma runt hinder$seed$, null, 86);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('25767a97-10aa-5c97-9f25-d46f66494f29', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8323164b-a5df-5b23-83ce-053207cd4da8', $seed$Vad är ett krypbrott?$seed$, $seed$Krypbrott fås när det har
initierats porer som har tillväxt
till brott till följd av krypning.$seed$, null, 87);
insert into public.categories (id, deck_id, title, sort_order) values ('db7d4388-c808-59fd-b538-ef7a7a809ad7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Hållbarhet och återvinning$seed$, 7);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('fdc62d25-e501-5cdf-a717-e2429370900a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'db7d4388-c808-59fd-b538-ef7a7a809ad7', $seed$Vad i materialtillverkningsprocessen kräver energi och vad innebär detta för miljön?$seed$, $seed$Energiintensiva processer:

* Energi för reducering av mineral till metall
* Övrig energi för tillverkning och formning, transport, användning. Kan minskas genom att återanvända värme.

Miljöbelastning:

* Ingrepp i naturen
* Utsläpp av CO₂
* Andra utsläpp och föroreningar
* CO₂ används som mått på miljöbelastning (carbon footprint)$seed$, null, 88);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('9cdc41aa-d4cd-54c4-afb0-11ee62c1f4e7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'db7d4388-c808-59fd-b538-ef7a7a809ad7', $seed$Hur återanvändningsbara är egentligen metaller? Vad finns det för utmaningar med det?$seed$, $seed$* Metallskrot är en utmärkt råvara för metalltillverkning
* Kräver mindre energi än tillverkning från malm: 1/10 för Al och 1/3 för stål
* Ger mindre miljöbelastning
* Metall tillverkad från skrot har samma egenskaper som metall tillverkad från mineral

Utmaningar:

* Legeringshalten måste kontrolleras – problem med blandat skrot och metallföroreningar
* Koppar och tenn förstör stål
* Fe försprödar Al
* Bly, kadmium och kvicksilver är ofta oönskat i
legeringar
* Skrotet måste samlas in, transporteras, sorteras$seed$, null, 89);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('781ce964-428c-5b98-8822-03f3948924c0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'db7d4388-c808-59fd-b538-ef7a7a809ad7', $seed$Hur bra är aluminium sett ur ett hållbarhetsperspektiv?$seed$, $seed$Aluminium:

* Det vanligaste grundämnet i jordskorpan
* Framställning av primäraluminium kräver mycket energi
* Mycket mindre energi krävs för återvinning → Lämpligt för produkter som kan återvinnas, mindre lämpligt för
produkter som inte kan återvinnas.

Problem med återvinning av aluminium

* Gjutlegeringar innehåller mycket Si, 8-14%
* Övriga legeringar (smideslegeringar) innehåller små mängder Si
* Förorenas av Fe → Blandat skrot kan bara användas i begränsade mängder för återvinning till smideslegeringar.$seed$, null, 90);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('df7886e9-b9d8-517c-8d6c-ab75b92d554b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'db7d4388-c808-59fd-b538-ef7a7a809ad7', $seed$Hur bra är stål respektive rostfritt stål sett ur ett hållbarhetsperspektiv?$seed$, $seed$Stål:

* God tillgång i jordskorpan
* Relativt låg miljöbelastning per kg
* Hög hållfasthet i förhållande till miljöbelastning
* Korroderar, kräver ofta ytbehandling
* Höghållfasta stål kan användas i lättkonstruktioner

Rostfritt stål:

* Legering med järn, Cr (ca 18 %), Ni (ca 8 %), ev Mo (2 %)
* Tillgången av legeringsämne i jordskorpan är förhållandevis liten
* Legeringsämnena kan vara ohälsosamma och allergena i fri form.
Oftast inte bundna i rostfritt stål.
* Bra korrosionsmotstånd och livslängd. Bör återvinnas.$seed$, null, 91);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('ab05ea9c-7e06-5544-a4bd-873e3228906d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'db7d4388-c808-59fd-b538-ef7a7a809ad7', $seed$Vad finns det för problem med återvinningen av blandat skrot?$seed$, $seed$* Vid återanvändning av skrot är kontroll av legeringsämne ett problem
* Överflödiga legeringsämne och förorenande metaller kan vara eller är oekonomiska att ta bort
* Sorterat skrott är mer användbart och har högre värde$seed$, null, 92);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('43ac1b3a-80c6-5c0b-bd3a-c956cb75f72a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'db7d4388-c808-59fd-b538-ef7a7a809ad7', $seed$Vad är "CO₂- footprint" respektive "Embodied Energy"?$seed$, $seed$CO₂ footprint:

* Mängd CO₂ som bildas vid produktion av 1 kg material

För metaller:
- CO₂ bildas vid produktion av energi
- CO₂ bildas vid kemiska reaktioner vid reduktion av malm till metall

Embodied energy:

* Energin som krävs för att producera 1 kg av materialet

För metaller:
- Energi som krävs för reduktionsreaktionen
- Transport, värmning, processer$seed$, null, 93);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('c8fd4756-478c-5212-9aee-ce67b0723f8b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'db7d4388-c808-59fd-b538-ef7a7a809ad7', $seed$Hur ser tillgången på metaller i jordskorpan ut?$seed$, $seed$* De vanligaste metallerna finns i stor omfattning i jordskorpan: Fe, Al, Mg, Ti
* Vissa legeringsämnen finns i begränsad mängd i jordskorpan
* 69 element räknas som strategiska eller kritiska: sällsynta
jordartsmetaller, platina-gruppen, fissionsämne (U, Th, Pu), W, Ta, Nb, Ga, In$seed$, null, 94);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('a60a88db-360a-5516-85fc-e7d3d901ebf6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'db7d4388-c808-59fd-b538-ef7a7a809ad7', $seed$Sammanfatta lite kort hur metaller lämpar sig för återvinning.$seed$, $seed$* Metaller lämpar sig väl för återvinning
  - Sparar resurser och energi
  - Ger lika bra material
* Problem med föroreningar och legeringsämne
* CO₂ footprint och embodied energy ger viss
vägledning – kan användas i materialindex
* Bör titta på totala miljöbelastningen under
livscykeln$seed$, null, 95);
insert into public.categories (id, deck_id, title, sort_order) values ('70008fc5-6f65-544a-bd75-7a9ddf330103', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Tillverkning och värmebehandling av stål$seed$, 8);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('11f675c7-6caf-50ca-a8a3-12cf6d271953', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '70008fc5-6f65-544a-bd75-7a9ddf330103', $seed$Beskriv stålets tillverkningsprocess i grova mått.$seed$, $seed$* Utgångsmaterial: järnoxid
* Reduceras i masugn:
järnoxid + kol + energi → tackjärn + koloxid
* Kolhalten i tackjärnet justeras till rätt kolhalt, stålet legeras, skrot kan tillsättas
* Processen kräver energi
  - processenergi
  - energi till reducering (är konstant)
* Återvinning sparar energi och råvaror, ger mindre utsläpp av koldioxid

Därefter behandlas stålet:

* Färskning = kolhalten justeras
* Legering
* Kontinuerlig gjutning
* Varmvalsning
* Kallbearbetning
* Kallvalsning, tråddragning, m.m. → plåt, räls, balkar, stång, tråd$seed$, null, 96);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('3e8d26c8-156c-5c48-8984-20c16eae5fc4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '70008fc5-6f65-544a-bd75-7a9ddf330103', $seed$Ge minst två exempel på värmebehandlingar för stål.$seed$, $seed$* Normalisering: austenitisering + långsam kylning → primär ferrit eller cementit + perlit. Andel perlit ges av kolhalten. Ger ”normal” mikrostruktur, lämpligt för konstruktioner där styvheten är viktig.
* Mjukglödgning: värmning till temperatur under austenittemperatur (723 C) → diffusion och korntillväxt, sfäriodiserad perlit, lägre sträckgräns. Används för
stål som skall maskinbearbetas och därefter härdas.
* Martensithärdning:
1. Värmning till austenitområdet
2. Snabbskylning → martensit
3. Anlöpning → anlöpt martensit = ferrit med mycket små cementitpartiklar
Kolhalten avgör andelen cementit. Temperatur och tid för anlöpningen avgör storleken på cementitpartiklarna. Används när hårdhet och sträckgräns är viktigt.$seed$, null, 97);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('96ce059f-eb9d-5090-a3c1-7586ce80c34f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '70008fc5-6f65-544a-bd75-7a9ddf330103', $seed$Nämn minst två produktionsmässiga anledningar till att man legerar stål.$seed$, $seed$Stål legeras bland annat för att:

* Öka hållfastheten – Genom att tillsätta legeringsämnen som nickel eller krom kan stålets styrka och hållfasthet förbättras.

* Förbättra korrosionsbeständigheten – Krom och nickel ökar stålets motståndskraft mot rost och korrosion, vilket är särskilt viktigt för rostfria stål.

* Förbättra hårdheten och slitstyrkan – Tillsatser som kol, mangan och vanadin gör stålet hårdare och mer motståndskraftigt mot slitage, vilket är fördelaktigt i verktygsstål.

* Höja duktiliteten och segheten – Vissa legeringsämnen, som nickel, kan öka segheten och duktiliteten, vilket gör stålet mindre sprött vid låga temperaturer.

* Förbättra värmebeständigheten – Legeringar med ämnen som molybden och volfram hjälper stålet att behålla sina egenskaper vid höga temperaturer, vilket är viktigt för verktygsstål och höglegerat stål.

* Förbättra härdbarheten – Legeringar med ämnen som krom och molybden ökar stålets förmåga att härdas djupt, vilket gör att materialet får en jämn hårdhet vid härdning.$seed$, null, 98);
insert into public.categories (id, deck_id, title, sort_order) values ('5b7db3d5-8eb1-57af-a25e-f5867b27887c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Icke-järnmetaller$seed$, 9);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('47b4d590-e47c-5fdb-b75a-e92f979b6016', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5b7db3d5-8eb1-57af-a25e-f5867b27887c', $seed$Vad kännetecknar Aluminium?$seed$, $seed$* Lägre vikt än stål, densiteten är 2,7 kg/dm3
* FCC struktur → god plastisk formbarhet
* God maskinbarhet
* God elektrisk- och värmeledning
* Korrosionsskydd: Al reagerar med O₂ och bildar ett
skyddande oxidskikt på ytan$seed$, null, 99);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('f3cfe84c-a05b-5afa-81a0-d9e5fce5d575', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5b7db3d5-8eb1-57af-a25e-f5867b27887c', $seed$Vad kännetecknar Magnesium?$seed$, $seed$* Låg densitet 1,8 kg/dm3
* HCP struktur → begränsad plastisk formbarhet
* God maskinbarhet
* God gjutbarhet, större delen används som gjutgods
* Bildar poröst oxidskikt, sämre korrosionsskydd
* Brännbart – men bara som pulver eller tunn plåt
* Energikrävande produktion$seed$, null, 100);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('6aac01af-daed-5261-b5cf-ed3308dbfcdd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5b7db3d5-8eb1-57af-a25e-f5867b27887c', $seed$Vad kännetecknar Titan?$seed$, $seed$* Medel densitet 4,1 kg/dm3
* Utmärkt hållfasthet
* Utmärkt korrosionsskydd
* Dyrt på grund av tillverkningsprocessen
* Används i ren form eller legerat
* Titan är den enda metallen som är biokompatibel (inte är
negativ för kroppen)$seed$, null, 101);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('643176a4-3a05-5292-8129-4b6e4149cc36', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5b7db3d5-8eb1-57af-a25e-f5867b27887c', $seed$Vad kännetecknar Koppar och dess legeringar?$seed$, $seed$* Hög densitet 8,9 kg/dm3
* Koppar: Utmärkt formbarhet, hög elektrisk och termisk
ledningsförmåga, pris=50 SEK/kg
* Mässing: legerat med 5-40 % Zn, bra form- och maskinbarhet.
* Brons: legerat med 5-25 % Sn, bra hållfasthet men lite
duktilitet, gjuts ofta
* Lagerbrons har bra tribologiska egenskaper$seed$, null, 102);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('3b2548ba-d87e-57a0-bb7c-35f13c5d7d11', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5b7db3d5-8eb1-57af-a25e-f5867b27887c', $seed$Vad kännetecknar Nickel- och så kallade superlegeringar?$seed$, $seed$* Medel densitet 7,9-8,7 kg/dm3
* E-modul: 200-220 GPa
* Sträckgräns: 272-900 MPa
* Brottseghet: 127-251 $\text{MPa}\sqrt{\text{m}}$
* Användningstemperatur: -273-1040 C
* Carbon footprint: 13 kg/kg
* Pris: 150 SEK/kg (för superlegeringar)
* Exceptionella högtemperatur- egenskaper med god
oxidations och korrosionsegenskaper
* Legeras med Cr, Co, Al, Ti Mo,
Zr, Fe, Hf$seed$, null, 103);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('9646e436-ccab-5338-96cf-4c98f5dd6f6c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5b7db3d5-8eb1-57af-a25e-f5867b27887c', $seed$Varför använder man inte alltid stål eftersom det är billigast?$seed$, $seed$Stål har bra mekaniska egenskaper, låg miljöbelastning per kilo och återfinns i många olika varianter för olika användningsområden till det billigaste priset, men aluminium har lägre densitet, fortfarande bra pris, är lättbearbetat och har bra naturligt korrosionsskydd.

Stål är bra, men i vissa situationer väljs andra material för att deras speciella egenskaper gör de särskilt fördelaktiga.$seed$, null, 104);
insert into public.categories (id, deck_id, title, sort_order) values ('e001f141-56b3-509c-b7db-9b03f6746a85', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $seed$Begrepp och ja/nej-frågor$seed$, 10);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('33e09b93-ad54-5af8-a8d3-461322d4a11d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Åldring$seed$, $seed$Åldring av metaller (eller åldringshärdning) är en process där metallens mikrostruktur och egenskaper förändras över tid, antingen genom naturlig åldring vid rumstemperatur eller genom en kontrollerad värmebehandling som kallas artificiell åldring. Åldring används ofta för att förbättra mekaniska egenskaper som hårdhet och hållfasthet i metallegeringar, särskilt aluminium-, titan- och nickelbaserade legeringar.$seed$, null, 105);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('e949b21c-e3c3-523b-a357-fdffbf868555', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Brottförlängning$seed$, $seed$Den plastiska förlängningen som kvarstår efter ett material har belastats till brott.$seed$, null, 106);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('12e7a5da-d96c-50bc-b32b-f47dfe70ea17', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Keram$seed$, $seed$Ett material som är uppbyggt av en metall och en icke-metall (minst).$seed$, null, 107);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('ea8bde5e-ab6e-5a18-8322-c07525d32f15', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$CO₂-foot print$seed$, $seed$Den mängd CO₂ som bildas vid produktion av ett kilo material.$seed$, null, 108);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('12eef9a1-4df6-5467-967d-c0ce30c760be', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Anisotropt$seed$, $seed$Olika egenskaper i olika riktningar$seed$, null, 109);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('cb6a01c9-dc50-560a-aab3-050efcb8dc2f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$TTT-diagram$seed$, $seed$Ett diagram som visar fastransformationer vid svalning som funktion av tid och
temperatur.$seed$, null, 110);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('19451730-85bc-519d-a89c-46ae598cde34', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Krypning$seed$, $seed$Långsam plastisk deformation som beror på temperatur, tid och last. Sker vid temperaturer över halva smälttemperaturen i K, och töjningshastigheten ökar exponentiellt med
temperaturen.$seed$, null, 111);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('7c543bdb-db53-5736-9c7b-aabcac9bc9a3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Brottseghet$seed$, $seed$Ett mått på materialets seghet, hur mycket energi som behövs för att driva en
spricka. Brott fås när spänningsintensiteten vid sprickspetsen är högre än brottsegheten.$seed$, null, 112);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('7db11e3f-1a67-55a9-b130-331762c350f8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Högcykelutmattning$seed$, $seed$Utmattning är brott som uppkommer vid cyklisk belastning. Vid högcykelutmattning är belastningen under sträckgränsen, och materialet plasticerar bara lokalt
vid sprickspetsen, vilket ger ett stort antal cykler till brott.$seed$, null, 113);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('963b61b2-3291-5b78-a964-29a19695e8fc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Aktiveringsenergi$seed$, $seed$Den energibarriär som måste övervinnas m.h.a. termisk energi för att vissa processer skall kunna
ske, t.ex. kemiska reaktioner, diffusion, krypning.$seed$, null, 114);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('87f82869-c5ed-5808-ae6c-e2dba8687edd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Specifik värmekapacitet$seed$, $seed$Värmekapacitet är den mängd energi som krävs för att höja temperaturen med en grad Kelvin i en viss mängd material.
Specifik värmekapacitet är den mängd energi som går åt för att värma upp specifikt ett kilogram av ämnet.$seed$, null, 115);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('469313fc-0f56-579c-aca3-4a5169c6acb0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Diffusionskoefficient$seed$, $seed$Ett mått på hur snabbt atomer rör sig (diffunderar) i ett material. Beror på temperaturen och vilka atomer som diffunderar, och i vilket material.$seed$, null, 116);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('29b54f64-05a2-52b4-994e-2a25d083c80a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Metastabil$seed$, $seed$Ett tillstånd i ett lokalt energiminimum. För att uppnå tillståndet med lägst energi (stabilt) måste en energibarriär övervinnas genom tillförsel av termisk energi. Fasen har högre Gibbs fria energi men antar spontant inte den mer stabila fasen.$seed$, null, 117);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('0917f92c-6d82-511b-931f-d5d57ae3ad41', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Intermetall$seed$, $seed$En fas bestående av minst två metaller som finns mellan två metaller i fasdiagrammet.$seed$, null, 118);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('522494fc-098f-5fee-bb78-b15935e62422', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Adhesiv förslitning$seed$, $seed$Vid nötningen binds materialen samman med atomära bindningar, och material rycks bort när ytorna glider mot varandra. De två materialen svetsas punktvis samman, och slits isär.$seed$, null, 119);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('3348a42c-3784-50c4-9775-93af5ed39f20', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Slagseghet$seed$, $seed$Den energi som går åt för att slå av en anvisad provstav. Ett mått på hur segt eller sprött materialet är.$seed$, null, 120);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('f6fe48e3-566a-5fcf-996e-9689d6a4b5af', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Styvhet$seed$, $seed$Ett mått på hur mycket ett material deformeras elastiskt när det utsätts för en last.$seed$, null, 121);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('4090e8db-bd6e-54cb-9c69-b88751dbdd66', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Eutektikum$seed$, $seed$En strukturbeståndsdel som består av två faser. Eutektikum bildas vid konstant temperatur
och koncentration genom en trefasreaktion där en smält fas L bildar två fasta faser: L → alpha + beta$seed$, null, 122);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('fc58e222-1e8d-5229-b0dc-ed4644439300', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Mjukglödgning$seed$, $seed$En värmebehandling av stål där man får sfäriodiserad perlit, vilket ger ett material med lägre sträckgräns men som är lättare att maskinarbeta. Stålet värms upp till en temperatur under austenitiseringstemperaturen, och
diffusion ger sfäriodiserad cementit.$seed$, null, 123);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('86387465-e367-5e9f-a6ad-6dc06195cd16', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Kristallin$seed$, $seed$Atomer eller molekyler som sitter i en ordnad struktur.$seed$, null, 124);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('a03db887-8ac9-5ce3-be92-7a54af448492', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Krypning (metaller)$seed$, $seed$Plastisk deformation som beror på tid, temperatur och last.$seed$, null, 125);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('d6987f22-a4da-5cca-b0c3-f8412fd00b21', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Abrasiv förslitning$seed$, $seed$Förslitning som fås när ett hårt material/medium avverkar ytan.$seed$, null, 126);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('ac4f933f-ad88-5b59-b548-56b5fc352f46', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Verktygsstål$seed$, $seed$Höglegerat stål med hög kolhalt. Används i härdat tillstånd. Hårt och värmetåligt.$seed$, null, 127);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('38d0bf05-861f-50ba-b884-7a184fb2df5d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Ja/Nej: Bästa sättet att öka E-modulen är att värmebehandla (härda) metallen.$seed$, $seed$Nej, E-modulen (elasticitetsmodulen) är ett mått på ett materials styvhet och påverkas främst av materialets atomära bindningar. Värmebehandling, som härdning, förändrar inte de interatomära bindningarna i någon betydande utsträckning och därmed inte E-modulen. Härdning påverkar främst materialets sträckgräns och hårdhet, inte dess styvhet.$seed$, null, 128);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('11e7b581-b12f-511a-a934-1e89a5fa5c81', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Ja/Nej: Dislokationer är lika viktiga för ett materials E-modul som för sträckgränsen.$seed$, $seed$Nej, dislokationer påverkar främst materialets sträckgräns och duktilitet, eftersom de spelar en viktig roll i plastisk deformation. E-modulen bestäms däremot av de elastiska egenskaperna hos atomernas bindningar, och dislokationer har en försumbar effekt på den.$seed$, null, 129);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('5b828793-a8ed-5a66-a088-395b53d6206d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Ja/Nej: Perlit bildas vid en eutektisk reaktion från smälta.$seed$, $seed$Nej, perlit bildas inte vid en eutektisk reaktion, utan vid en eutektoidisk reaktion. I stål sker denna reaktion vid ca 727°C då austenit (en fast lösning) omvandlas till en blandning av ferrit och cementit (perlit), inte från smälta.$seed$, null, 130);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('a6c37b91-c4e0-5bf7-909d-03caa88bfaf1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Ja/Nej: Målet med utskiljningshärdning är att få bort dislokationerna.$seed$, $seed$Nej, utskiljningshärdning syftar inte till att ta bort dislokationer, utan till att skapa små partiklar (utskiljningar) som hindrar dislokationsrörelser. Detta gör materialet starkare eftersom dislokationerna har svårare att röra sig genom materialet, vilket ökar sträckgränsen och hårdheten.$seed$, null, 131);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('582de5e8-8fa8-5cf9-bcbd-bdc3018fc34c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Ja/Nej: Omslagstemperatur finns hos vanligt stål men inte hos aluminium och rostfritt stål.$seed$, $seed$Ja, vanligt stål har en omslagstemperatur, där materialet övergår från att vara duktilt vid högre temperaturer till att bli sprött vid lägre temperaturer. Aluminium och de flesta rostfria stål har dock inte denna sprödbrottsegenskap eftersom de behåller sin duktilitet vid låga temperaturer.$seed$, null, 132);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('22907691-2939-5f9d-b2ea-ce768690bc00', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Ja/Nej: Utmattningsgränsen är antalet cykler till brott vid en viss spänning.$seed$, $seed$Nej, utmattningsgränsen är inte antalet cykler till brott, utan den maximala spänningsnivån som ett material kan utsättas för ett oändligt antal cykler utan att gå sönder. Antalet cykler till brott vid en viss spänning kallas istället utmattningslivslängd.$seed$, null, 133);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('e22ce53c-a968-54b4-8c52-60c687d2400b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Ja/Nej: Krypning är ett fenomen som bara uppstår vid höga temperaturer.$seed$, $seed$Ja, krypning är en deformation som sker över tid under konstant belastning och hög temperatur. För de flesta metaller uppträder krypning bara vid temperaturer över ungefär 0,4 gånger deras smälttemperatur (i Kelvin).$seed$, null, 134);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('c366cfd3-2e52-5587-9bee-e69c12e80d74', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Ja/Nej: När ett material varmvalsas så ökar sträckgränsen.$seed$, $seed$Nej, vid varmvalsning sker processen vid höga temperaturer, där rekristallisation kan inträffa. Detta leder till att dislokationer kan "läkas", vilket innebär att materialet inte blir starkare. Sträckgränsen ökar snarare vid kallbearbetning, där dislokationsdensiteten ökar.$seed$, null, 135);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('922c5ec0-cf20-542a-b868-d81ad62e5260', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Ja/Nej: Spröda brott följer alltid korngränserna.$seed$, $seed$Nej, spröda brott kan vara både interkristallina (följer korngränserna) och transkristallina (går genom kornen). Det beror på materialets struktur och de förhållanden under vilka brottet sker.$seed$, null, 136);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('7e5ab01a-a534-5c33-a165-0fb11ae217a0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Ja/Nej: I stål bildar kol cementit, men i gjutjärn förekommer kolet som ren grafit.$seed$, $seed$Ja, i stål bildar kol cementit (Fe₃C), en hård och spröd fas. I gjutjärn bildas istället grafit, som är ren kol i form av flingor eller klot beroende på gjutjärnets typ, vilket ger det unika egenskaper som skiljer det från stål.$seed$, null, 137);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('2c441d0e-7e73-5e36-9bcd-a6dd7ceffb17', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Löslighetsgräns$seed$, $seed$Den högsta koncentration av ett ämne som kan lösas i en fas.$seed$, null, 138);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('55ddb9b2-b6c5-5165-926c-6ff85260787e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Utmattningsgräns$seed$, $seed$Den spänning under vilken inte utmattning sker.$seed$, null, 139);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('4a122d55-7a57-5f6d-b220-008b8aa74e35', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Segt brott$seed$, $seed$Ett brott som föregås av mycket plasticering. Lång töjning innan brott sker med andra ord.$seed$, null, 140);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('68ad5222-ea26-5ef2-9edd-55de08e486cc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Strukturbeståndsdel$seed$, $seed$En urskiljbar del av materialet som består av en eller flera faser och kan ses som en enhet på
något sätt. Kan vara en fas, eutektikum eller eutektoid.$seed$, null, 141);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('92a44fa4-db77-5e62-ac5f-532c748898b5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Fas$seed$, $seed$En del av materialet med homogena fysikaliska och kemiska egenskaper$seed$, null, 142);
insert into public.cards (id, deck_id, category_id, front, back, hint, sort_order) values ('ce7eb39b-38fb-545a-afa8-8b751e68fd1e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e001f141-56b3-509c-b7db-9b03f6746a85', $seed$Superlegering$seed$, $seed$Vanligtvis legeringar med Ni-bas som har excellenta högtemperaturegenskaper, oxidations- och korrosionsmotstånd.$seed$, null, 143);

commit;
