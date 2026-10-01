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


-- ===== supabase/migrations/20260919000100_exam_mode_activation.sql =====
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


-- ===== supabase/migrations/20260919000200_reminders.sql =====
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


-- ===== supabase/migrations/20260920000000_content_keys.sql =====
-- Innehållspipelinen (docs/INNEHALL.md): stabila nycklar, innehållshash och en
-- transaktionell synkfunktion, så att kurser, kategorier och kort kan läggas till,
-- ändras och tas bort med deterministiska operationer från filer i repot.
--
-- - key:          stabil identitet inom decket. Texter får ändras utan att kortet byter identitet,
--                 så studenternas progress följer med.
-- - source_hash:  innehållet så som det senast synkades från fil. Skiljer sig databasens rad från
--                 hashen har någon redigerat i admin sedan dess (då stoppar apply och ber om pull).
-- - deck_snapshot: databasens innehåll i samma form som filerna (för plan och pull).
-- - sync_deck:    utför en färdig plan i en transaktion.
--
-- Expanderande ändring: bara nya kolumner (nullable), index och funktioner. Admin-UI:t rörs inte;
-- kort som skapas där saknar nyckel tills de dras in i filerna med pull.

alter table public.decks add column source_hash text;
alter table public.categories add column key text, add column source_hash text;
alter table public.cards add column key text, add column source_hash text;

comment on column public.cards.key is 'Stabil nyckel inom decket (content/<kurs>/*.md). Null = skapat i admin, ännu inte draget till filerna.';
comment on column public.cards.source_hash is 'Innehållshash vid senaste synk från fil. Avviker raden har den redigerats i admin sedan dess.';

create unique index categories_deck_key_idx on public.categories (deck_id, key) where key is not null;
create unique index cards_deck_key_idx on public.cards (deck_id, key) where key is not null;

-- Redigeringsrätt för pipelinen: admin/examinator via can_edit_deck, service role, eller en
-- direktanslutning till databasen (CLI:t via Supabase CLI). Det sista känns igen på att anropet
-- saknar JWT-påståenden: varje anrop via PostgREST har dem, en psql-session har det aldrig.
-- Funktionerna är dessutom revoke:ade från anon, och sync_deck är security invoker så att RLS
-- avgör skrivningarna i botten.
create or replace function public.can_sync_deck(p_deck_id uuid)
returns boolean
language sql
stable
as $$
  select public.can_edit_deck(p_deck_id)
    or public.is_service_role()
    or nullif(current_setting('request.jwt.claims', true), '') is null;
$$;

grant execute on function public.can_sync_deck(uuid) to anon, authenticated, service_role;

-- Databasens innehåll för ett deck, i samma form som filerna. Kort utan kategori får
-- category_key = null. Inaktiva kort ingår (pipelinen ska se dem).
create or replace function public.deck_snapshot(p_deck_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.can_sync_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'deck', (
      select jsonb_build_object(
        'id', d.id, 'slug', d.slug, 'title', d.title, 'description', d.description,
        'course_code', d.course_code, 'source_credit', d.source_credit,
        'exam_date', d.exam_date, 'is_published', d.is_published, 'sort_order', d.sort_order,
        'source_hash', d.source_hash
      )
      from public.decks d where d.id = p_deck_id
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'key', c.key, 'title', c.title, 'sort_order', c.sort_order, 'source_hash', c.source_hash
      ) order by c.sort_order, c.title), '[]'::jsonb)
      from public.categories c where c.deck_id = p_deck_id
    ),
    'cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', k.id, 'key', k.key, 'category_id', k.category_id, 'front', k.front, 'back', k.back,
        'hint', k.hint, 'sort_order', k.sort_order, 'is_active', k.is_active, 'source_hash', k.source_hash
      ) order by k.sort_order, k.created_at), '[]'::jsonb)
      from public.cards k where k.deck_id = p_deck_id
    ),
    'progress', (
      select coalesce(jsonb_object_agg(x.card_id, x.n), '{}'::jsonb)
      from (
        select cp.card_id::text as card_id, count(*) as n
        from public.card_progress cp
        join public.cards k on k.id = cp.card_id
        where k.deck_id = p_deck_id
        group by cp.card_id
      ) x
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.deck_snapshot(uuid) from public, anon;
grant execute on function public.deck_snapshot(uuid) to authenticated, service_role;

-- Utför en färdig plan. Allt eller inget (funktionen körs i anroparens transaktion).
-- Planen innehåller redan färdiga id:n (UUID v5 av nyckeln), så SQL:en behöver inte matcha något.
--
-- p_plan = {
--   deck:       { slug, title, description, course_code, source_credit, exam_date, is_published, sort_order, source_hash },
--   categories: { create: [{id, key, title, sort_order, source_hash}], update: [...], delete: [id] },
--   cards:      { create: [{id, key, category_id, front, back, hint, sort_order, is_active, source_hash}],
--                 update: [...], deactivate: [id], delete: [id] }
-- }
create or replace function public.sync_deck(p_deck_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  d jsonb := p_plan -> 'deck';
  r jsonb;
  ids uuid[];
  n integer;
  deck_written integer := 0;
  cat_created integer := 0;
  cat_updated integer := 0;
  cat_deleted integer := 0;
  card_created integer := 0;
  card_updated integer := 0;
  card_deactivated integer := 0;
  card_deleted integer := 0;
begin
  if not public.can_sync_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Deck: skapa eller uppdatera. Sluggen är kursens nyckel och matchas på, aldrig byts.
  if d is not null then
    insert into public.decks (id, slug, title, description, course_code, source_credit, exam_date, is_published, sort_order, source_hash)
    values (
      p_deck_id,
      d ->> 'slug',
      d ->> 'title',
      d ->> 'description',
      d ->> 'course_code',
      d ->> 'source_credit',
      nullif(d ->> 'exam_date', '')::date,
      coalesce((d ->> 'is_published')::boolean, false),
      coalesce((d ->> 'sort_order')::integer, 0),
      d ->> 'source_hash'
    )
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description,
      course_code = excluded.course_code,
      source_credit = excluded.source_credit,
      exam_date = excluded.exam_date,
      is_published = excluded.is_published,
      sort_order = excluded.sort_order,
      source_hash = excluded.source_hash;
    get diagnostics n = row_count;
    deck_written := n;
  end if;

  -- Kategorier: skapa och uppdatera före korten (korten refererar till dem).
  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'categories' -> 'create', '[]'::jsonb)) loop
    insert into public.categories (id, deck_id, key, title, sort_order, source_hash)
    values ((r ->> 'id')::uuid, p_deck_id, r ->> 'key', r ->> 'title', (r ->> 'sort_order')::integer, r ->> 'source_hash');
    cat_created := cat_created + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'categories' -> 'update', '[]'::jsonb)) loop
    update public.categories set
      key = r ->> 'key',
      title = r ->> 'title',
      sort_order = (r ->> 'sort_order')::integer,
      source_hash = r ->> 'source_hash'
    where id = (r ->> 'id')::uuid and deck_id = p_deck_id;
    get diagnostics n = row_count;
    cat_updated := cat_updated + n;
  end loop;

  -- Kort: skapa, uppdatera, inaktivera, radera.
  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'cards' -> 'create', '[]'::jsonb)) loop
    insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash)
    values (
      (r ->> 'id')::uuid,
      p_deck_id,
      nullif(r ->> 'category_id', '')::uuid,
      r ->> 'key',
      r ->> 'front',
      r ->> 'back',
      nullif(r ->> 'hint', ''),
      (r ->> 'sort_order')::integer,
      coalesce((r ->> 'is_active')::boolean, true),
      r ->> 'source_hash'
    );
    card_created := card_created + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'cards' -> 'update', '[]'::jsonb)) loop
    update public.cards set
      category_id = nullif(r ->> 'category_id', '')::uuid,
      key = r ->> 'key',
      front = r ->> 'front',
      back = r ->> 'back',
      hint = nullif(r ->> 'hint', ''),
      sort_order = (r ->> 'sort_order')::integer,
      is_active = coalesce((r ->> 'is_active')::boolean, true),
      source_hash = r ->> 'source_hash'
    where id = (r ->> 'id')::uuid and deck_id = p_deck_id;
    get diagnostics n = row_count;
    card_updated := card_updated + n;
  end loop;

  -- Inaktivering: kortet försvinner för studenten men progressen finns kvar.
  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'cards' -> 'deactivate', '[]'::jsonb)) as t(x);
  if ids is not null then
    update public.cards set is_active = false where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    card_deactivated := n;
  end if;

  -- Radering: progress och historik kaskaderar. Bara med uttrycklig flagga i verktyget.
  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'cards' -> 'delete', '[]'::jsonb)) as t(x);
  if ids is not null then
    delete from public.cards where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    card_deleted := n;
  end if;

  -- Kategorier tas bort sist, när korten flyttats eller försvunnit.
  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'categories' -> 'delete', '[]'::jsonb)) as t(x);
  if ids is not null then
    delete from public.categories where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    cat_deleted := n;
  end if;

  return jsonb_build_object(
    'deck', deck_written,
    'categories_created', cat_created,
    'categories_updated', cat_updated,
    'categories_deleted', cat_deleted,
    'cards_created', card_created,
    'cards_updated', card_updated,
    'cards_deactivated', card_deactivated,
    'cards_deleted', card_deleted
  );
end;
$$;

revoke execute on function public.sync_deck(uuid, jsonb) from public, anon;
grant execute on function public.sync_deck(uuid, jsonb) to authenticated, service_role;

-- ÅNGRA (se docs/ATERSTALLNING.md)
-- drop function if exists public.sync_deck(uuid, jsonb);
-- drop function if exists public.deck_snapshot(uuid);
-- drop function if exists public.can_sync_deck(uuid);
-- drop index if exists public.cards_deck_key_idx;
-- drop index if exists public.categories_deck_key_idx;
-- alter table public.cards drop column if exists key, drop column if exists source_hash;
-- alter table public.categories drop column if exists key, drop column if exists source_hash;
-- alter table public.decks drop column if exists source_hash;


-- ===== supabase/migrations/20260920000100_dataskydd.sql =====
-- Dataskydd: gör "ladda ner mina data" fullständig och inför automatisk gallring.
--
-- 1. Användaren får läsa sina egna rader i email_log (GDPR art. 15: rätt till tillgång).
--    Skrivning är fortfarande bara service role; ingen kan ändra eller radera loggen.
-- 2. purge_old_data(): gallrar det som inte ska sparas för alltid.
--      - email_log äldre än 90 dagar (loggen finns för att inte skicka dubbelt, inte som historik)
--      - åtgärdade felrapporter äldre än 180 dagar (texten kan innehålla fritext från studenten)
--      - anonymiserar kvarvarande felrapporters kontaktfält efter 180 dagar
--    Körs av det dagliga cron-jobbet. Bara service role får anropa den.
-- Expanderande ändring: en policy och en funktion.

create policy "email_log: läs egna" on public.email_log
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.email_log to authenticated;

comment on table public.email_log is 'Vilka mejl som skickats till vem och när, så att inget skickas dubbelt. Gallras efter 90 dagar.';

create or replace function public.purge_old_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  emails integer;
  reports integer;
  contacts integer;
begin
  if not public.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.email_log where sent_at < now() - interval '90 days';
  get diagnostics emails = row_count;

  delete from public.card_reports where status = 'resolved' and resolved_at < now() - interval '180 days';
  get diagnostics reports = row_count;

  update public.card_reports
  set contact = null
  where contact is not null and created_at < now() - interval '180 days';
  get diagnostics contacts = row_count;

  return jsonb_build_object('email_log_deleted', emails, 'reports_deleted', reports, 'contacts_cleared', contacts);
end;
$$;

revoke execute on function public.purge_old_data() from public, anon, authenticated;
grant execute on function public.purge_old_data() to service_role;

-- Konton som inte använts på länge. Returnerar bara en lista att granska; raderar ingenting.
-- Radering av ett konto är alltid ett medvetet beslut (eller användarens eget val under Konto).
create or replace function public.dormant_accounts(p_months integer default 24)
returns table (user_id uuid, email text, last_seen timestamptz)
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
  select p.id, u.email::text, greatest(
    coalesce((select max(rl.reviewed_at) from public.review_log rl where rl.user_id = p.id), p.created_at),
    coalesce(u.last_sign_in_at, p.created_at)
  ) as last_seen
  from public.profiles p
  join auth.users u on u.id = p.id
  where greatest(
    coalesce((select max(rl.reviewed_at) from public.review_log rl where rl.user_id = p.id), p.created_at),
    coalesce(u.last_sign_in_at, p.created_at)
  ) < now() - make_interval(months => p_months)
  order by 3;
end;
$$;

revoke execute on function public.dormant_accounts(integer) from public, anon, authenticated;
grant execute on function public.dormant_accounts(integer) to service_role;

-- Radering av konto ska inte lämna kvar en kontaktadress som studenten lämnat i en felrapport.
-- Rapportens text behålls (den handlar om kortet, inte om personen) men kopplas bort helt:
-- user_id nollställs av främmande nyckeln, och kontaktfältet rensas här.
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
  update public.card_reports set contact = null where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ÅNGRA (se docs/ATERSTALLNING.md). delete_my_account() återställs till versionen i
-- 20260911000000_init.sql (utan update-raden).
-- drop function if exists public.dormant_accounts(integer);
-- drop function if exists public.purge_old_data();
-- revoke select on public.email_log from authenticated;
-- drop policy if exists "email_log: läs egna" on public.email_log;


-- ===== supabase/migrations/20260920000200_sakerhet.sql =====
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


-- ===== supabase/migrations/20260920000300_kortantal.sql =====
-- Antal aktiva kort per deck som en fråga i stället för att läsa varje kortrad.
--
-- Startsidan och adminlistan räknade kort genom att hämta deck_id för samtliga kort i
-- alla kurser. Med en kurs och 144 kort är det gratis; med tjugo kurser är det tusentals
-- rader över nätet för att producera tjugo heltal. Funktionen respekterar samma synlighet
-- som RLS: bara publicerade deck för anon, och redaktörens egna därutöver.

create index if not exists cards_deck_active_idx on public.cards (deck_id) where is_active;

create or replace function public.deck_card_counts()
returns table (deck_id uuid, active_cards integer)
language sql
stable
security invoker
set search_path = public
as $$
  select c.deck_id, count(*)::integer
  from public.cards c
  where c.is_active
  group by c.deck_id;
$$;

grant execute on function public.deck_card_counts() to anon, authenticated, service_role;

-- ÅNGRA (se docs/ATERSTALLNING.md)
-- drop function if exists public.deck_card_counts();
-- drop index if exists public.cards_deck_active_idx;


-- ===== supabase/migrations/20260921000000_rapportgrans.sql =====
-- Rättar takgränsen för felrapporter.
--
-- 20260920000200 skrev `raise exception 'rate limited' using errcode = ..., message = ...`.
-- Textsträngen efter `raise exception` ÄR meddelandet, så `using message` sätter det en
-- andra gång och PostgreSQL svarar 42601 "RAISE option already specified: MESSAGE".
--
-- Skyddet fungerade ändå — undantaget avbryter insert:en — men felkoden blev fel och
-- meddelandet blev internt, så studenten fick "Något gick fel. Försök igen." och
-- uppmanades att försöka igen direkt, vilket bara misslyckades på nytt.

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
    -- Gäster delar på ett gemensamt tak: vi kan inte skilja dem åt.
    select count(*) into n from public.card_reports
    where user_id is null and created_at > now() - interval '1 hour';
    if n >= 60 then
      raise exception using errcode = '53400', message = 'För många rapporter just nu. Försök igen om en stund.';
    end if;
  else
    select count(*) into n from public.card_reports
    where user_id = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 10 then
      raise exception using errcode = '53400', message = 'Du har skickat många rapporter den senaste timmen. Försök igen senare.';
    end if;
  end if;
  return new;
end;
$$;

-- ÅNGRA
-- Återställ den tidigare versionen ur 20260920000200_sakerhet.sql. Den blockerar också,
-- men med felkod 42601 och ett internt meddelande.


-- ===== supabase/migrations/20260928000000_uppgiftstyper.sql =====
-- Uppgiftstyper, svarsalternativ, utkast och källa per kort (kvällen 28 sep).
--
-- Terminologi: ett kort hör till ett OMRÅDE (tabellen categories) och har en UPPGIFTSTYP:
--   sjalvskattning  vändkort, studenten skattar sig själv 1–5 (allt innehåll hittills)
--   begrepp         begrepp → förklaring, vändkort med självskattning
--   sant-falskt     ett påstående, automaträttat (options = två alternativ, Sant och Falskt)
--   alternativ      flervalsfråga som på tentan, automaträttad (options = alternativen)
--
-- Utkast: kort som föreslagits (t.ex. ur Canvasmaterialet) och väntar på granskning av
-- examinator eller admin. Ett utkast är alltid inaktivt, så inga studentvyer behöver ändras,
-- och studenter kan inte heller läsa det via API:t (policyn nedan).
--
-- Expanderande ändring: nya kolumner med standardvärden, en ersatt läspolicy och utökade
-- synkfunktioner som fortfarande tar emot planer utan de nya fälten.

alter table public.cards
  add column kind text not null default 'sjalvskattning',
  add column options jsonb,
  add column review_status text,
  add column review_note text,
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column reviewed_at timestamptz,
  add column source text;

alter table public.cards
  add constraint cards_kind_check check (kind in ('sjalvskattning', 'begrepp', 'sant-falskt', 'alternativ')),
  add constraint cards_options_check check (
    case
      when kind in ('sant-falskt', 'alternativ') then options is not null and jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2
      else options is null
    end
  ),
  add constraint cards_review_status_check check (review_status is null or review_status in ('utkast', 'avvisad')),
  add constraint cards_review_inactive_check check (review_status is null or is_active = false);

comment on column public.cards.kind is 'Uppgiftstyp: sjalvskattning, begrepp, sant-falskt eller alternativ.';
comment on column public.cards.options is 'Svarsalternativ för automaträttade typer: [{"text": "...", "correct": true}, ...].';
comment on column public.cards.review_status is 'null = granskat/vanligt kort, utkast = väntar på granskning, avvisad = avvisat förslag. Aldrig aktivt.';
comment on column public.cards.review_note is 'Granskarens kommentar till förslaget. Ingår inte i innehållet (filerna).';
comment on column public.cards.source is 'Var innehållet kommer ifrån, t.ex. "Canvas: Tentamen MTT085 24-10, uppg 3".';

create index cards_review_status_idx on public.cards (deck_id, review_status) where review_status is not null;

-- Studenter ser aldrig utkast eller avvisade förslag, inte ens via API:t.
drop policy "cards: läs publicerade" on public.cards;
create policy "cards: läs publicerade" on public.cards
  for select to anon, authenticated
  using (
    public.can_edit_deck(deck_id)
    or (review_status is null and exists (select 1 from public.decks d where d.id = deck_id and d.is_published))
  );

-- ---------------------------------------------------------------------------
-- Synkfunktionerna får de nya fälten (samma signaturer).
-- ---------------------------------------------------------------------------

create or replace function public.deck_snapshot(p_deck_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.can_sync_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'deck', (
      select jsonb_build_object(
        'id', d.id, 'slug', d.slug, 'title', d.title, 'description', d.description,
        'course_code', d.course_code, 'source_credit', d.source_credit,
        'exam_date', d.exam_date, 'is_published', d.is_published, 'sort_order', d.sort_order,
        'source_hash', d.source_hash
      )
      from public.decks d where d.id = p_deck_id
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'key', c.key, 'title', c.title, 'sort_order', c.sort_order, 'source_hash', c.source_hash
      ) order by c.sort_order, c.title), '[]'::jsonb)
      from public.categories c where c.deck_id = p_deck_id
    ),
    'cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', k.id, 'key', k.key, 'category_id', k.category_id, 'front', k.front, 'back', k.back,
        'hint', k.hint, 'sort_order', k.sort_order, 'is_active', k.is_active, 'source_hash', k.source_hash,
        'kind', k.kind, 'options', k.options, 'review_status', k.review_status, 'source', k.source
      ) order by k.sort_order, k.created_at), '[]'::jsonb)
      from public.cards k where k.deck_id = p_deck_id
    ),
    'progress', (
      select coalesce(jsonb_object_agg(x.card_id, x.n), '{}'::jsonb)
      from (
        select cp.card_id::text as card_id, count(*) as n
        from public.card_progress cp
        join public.cards k on k.id = cp.card_id
        where k.deck_id = p_deck_id
        group by cp.card_id
      ) x
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.sync_deck(p_deck_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  d jsonb := p_plan -> 'deck';
  r jsonb;
  ids uuid[];
  n integer;
  deck_written integer := 0;
  cat_created integer := 0;
  cat_updated integer := 0;
  cat_deleted integer := 0;
  card_created integer := 0;
  card_updated integer := 0;
  card_deactivated integer := 0;
  card_deleted integer := 0;
begin
  if not public.can_sync_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if d is not null then
    insert into public.decks (id, slug, title, description, course_code, source_credit, exam_date, is_published, sort_order, source_hash)
    values (
      p_deck_id,
      d ->> 'slug',
      d ->> 'title',
      d ->> 'description',
      d ->> 'course_code',
      d ->> 'source_credit',
      nullif(d ->> 'exam_date', '')::date,
      coalesce((d ->> 'is_published')::boolean, false),
      coalesce((d ->> 'sort_order')::integer, 0),
      d ->> 'source_hash'
    )
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description,
      course_code = excluded.course_code,
      source_credit = excluded.source_credit,
      exam_date = excluded.exam_date,
      is_published = excluded.is_published,
      sort_order = excluded.sort_order,
      source_hash = excluded.source_hash;
    get diagnostics n = row_count;
    deck_written := n;
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'categories' -> 'create', '[]'::jsonb)) loop
    insert into public.categories (id, deck_id, key, title, sort_order, source_hash)
    values ((r ->> 'id')::uuid, p_deck_id, r ->> 'key', r ->> 'title', (r ->> 'sort_order')::integer, r ->> 'source_hash');
    cat_created := cat_created + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'categories' -> 'update', '[]'::jsonb)) loop
    update public.categories set
      key = r ->> 'key',
      title = r ->> 'title',
      sort_order = (r ->> 'sort_order')::integer,
      source_hash = r ->> 'source_hash'
    where id = (r ->> 'id')::uuid and deck_id = p_deck_id;
    get diagnostics n = row_count;
    cat_updated := cat_updated + n;
  end loop;

  -- Nya fält: kind, options, review_status, source. Saknas de i planen gäller standardvärdena.
  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'cards' -> 'create', '[]'::jsonb)) loop
    insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source)
    values (
      (r ->> 'id')::uuid,
      p_deck_id,
      nullif(r ->> 'category_id', '')::uuid,
      r ->> 'key',
      r ->> 'front',
      r ->> 'back',
      nullif(r ->> 'hint', ''),
      (r ->> 'sort_order')::integer,
      coalesce((r ->> 'is_active')::boolean, true),
      r ->> 'source_hash',
      coalesce(r ->> 'kind', 'sjalvskattning'),
      case when jsonb_typeof(r -> 'options') = 'array' then r -> 'options' else null end,
      nullif(r ->> 'review_status', ''),
      nullif(r ->> 'source', '')
    );
    card_created := card_created + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'cards' -> 'update', '[]'::jsonb)) loop
    update public.cards set
      category_id = nullif(r ->> 'category_id', '')::uuid,
      key = r ->> 'key',
      front = r ->> 'front',
      back = r ->> 'back',
      hint = nullif(r ->> 'hint', ''),
      sort_order = (r ->> 'sort_order')::integer,
      is_active = coalesce((r ->> 'is_active')::boolean, true),
      source_hash = r ->> 'source_hash',
      kind = coalesce(r ->> 'kind', 'sjalvskattning'),
      options = case when jsonb_typeof(r -> 'options') = 'array' then r -> 'options' else null end,
      review_status = nullif(r ->> 'review_status', ''),
      source = nullif(r ->> 'source', '')
    where id = (r ->> 'id')::uuid and deck_id = p_deck_id;
    get diagnostics n = row_count;
    card_updated := card_updated + n;
  end loop;

  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'cards' -> 'deactivate', '[]'::jsonb)) as t(x);
  if ids is not null then
    update public.cards set is_active = false where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    card_deactivated := n;
  end if;

  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'cards' -> 'delete', '[]'::jsonb)) as t(x);
  if ids is not null then
    delete from public.cards where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    card_deleted := n;
  end if;

  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'categories' -> 'delete', '[]'::jsonb)) as t(x);
  if ids is not null then
    delete from public.categories where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    cat_deleted := n;
  end if;

  return jsonb_build_object(
    'deck', deck_written,
    'categories_created', cat_created,
    'categories_updated', cat_updated,
    'categories_deleted', cat_deleted,
    'cards_created', card_created,
    'cards_updated', card_updated,
    'cards_deactivated', card_deactivated,
    'cards_deleted', card_deleted
  );
end;
$$;

revoke execute on function public.deck_snapshot(uuid) from public, anon;
grant execute on function public.deck_snapshot(uuid) to authenticated, service_role;
revoke execute on function public.sync_deck(uuid, jsonb) from public, anon;
grant execute on function public.sync_deck(uuid, jsonb) to authenticated, service_role;

-- ÅNGRA (se docs/ATERSTALLNING.md). Kör först om synkfunktionerna från
-- 20260920000000_content_keys.sql (deck_snapshot och sync_deck), sedan:
-- drop policy "cards: läs publicerade" on public.cards;
-- create policy "cards: läs publicerade" on public.cards for select to anon, authenticated
--   using (public.can_edit_deck(deck_id) or exists (select 1 from public.decks d where d.id = deck_id and d.is_published));
-- delete from public.cards where review_status is not null;   -- utkast försvinner (de är aldrig aktiva)
-- drop index if exists public.cards_review_status_idx;
-- alter table public.cards drop constraint cards_kind_check, drop constraint cards_options_check,
--   drop constraint cards_review_status_check, drop constraint cards_review_inactive_check;
-- alter table public.cards drop column kind, drop column options, drop column review_status,
--   drop column review_note, drop column reviewed_by, drop column reviewed_at, drop column source;
-- (Kort av typerna sant-falskt/alternativ blir då vanliga vändkort; ta bort dem först om det inte är önskat.)


-- ===== supabase/migrations/20260928000100_historik_original.sql =====
-- Kortens historik och originalkorten (28 sep, kväll).
--
-- - cards.original: kortet hör till den beprövade uppsättningen som två årskullar använt
--   (de 144 korten före 28 sep). Studenter kan välja att plugga bara originalkorten.
-- - card_versions: varje gång ett korts innehåll ändras sparas den FÖREGÅENDE versionen, oavsett
--   om ändringen kom från admin, granskningen eller innehållsverktyget. Admin visar historiken och
--   kan återställa en version. Nuvarande version är alltid raden i cards.
--
-- Expanderande: ny kolumn med standardvärde, ny tabell, trigger och utökade synkfunktioner.

alter table public.cards add column original boolean not null default false;
comment on column public.cards.original is 'Del av den beprövade originaluppsättningen (före 28 sep 2026).';

create table public.card_versions (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.cards (id) on delete cascade,
  deck_id uuid not null references public.decks (id) on delete cascade,
  -- Versionen gällde fram till den här tidpunkten.
  replaced_at timestamptz not null default now(),
  -- Vem som ersatte den (null = innehållsverktyget eller systemet).
  replaced_by uuid references auth.users (id) on delete set null,
  category_id uuid,
  front text not null,
  back text not null,
  hint text,
  kind text not null,
  options jsonb,
  is_active boolean not null,
  review_status text,
  source text,
  original boolean not null
);

create index card_versions_card_idx on public.card_versions (card_id, replaced_at desc);

alter table public.card_versions enable row level security;

-- Bara redaktörer för decket läser historiken. Ingen skriver direkt; triggern gör det.
create policy "card_versions: redaktör läser" on public.card_versions
  for select to authenticated
  using (public.can_edit_deck(deck_id));

create or replace function public.record_card_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.front, old.back, old.hint, old.kind, old.options, old.category_id, old.is_active, old.review_status, old.source, old.original)
     is distinct from
     (new.front, new.back, new.hint, new.kind, new.options, new.category_id, new.is_active, new.review_status, new.source, new.original) then
    insert into public.card_versions (card_id, deck_id, replaced_by, category_id, front, back, hint, kind, options, is_active, review_status, source, original)
    values (old.id, old.deck_id, auth.uid(), old.category_id, old.front, old.back, old.hint, old.kind, old.options, old.is_active, old.review_status, old.source, old.original);
  end if;
  return new;
end;
$$;

revoke execute on function public.record_card_version() from public, anon, authenticated;

create trigger cards_record_version
  after update on public.cards
  for each row execute function public.record_card_version();

-- ---------------------------------------------------------------------------
-- Synkfunktionerna får fältet original (samma signaturer).
-- ---------------------------------------------------------------------------

create or replace function public.deck_snapshot(p_deck_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.can_sync_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'deck', (
      select jsonb_build_object(
        'id', d.id, 'slug', d.slug, 'title', d.title, 'description', d.description,
        'course_code', d.course_code, 'source_credit', d.source_credit,
        'exam_date', d.exam_date, 'is_published', d.is_published, 'sort_order', d.sort_order,
        'source_hash', d.source_hash
      )
      from public.decks d where d.id = p_deck_id
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'key', c.key, 'title', c.title, 'sort_order', c.sort_order, 'source_hash', c.source_hash
      ) order by c.sort_order, c.title), '[]'::jsonb)
      from public.categories c where c.deck_id = p_deck_id
    ),
    'cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', k.id, 'key', k.key, 'category_id', k.category_id, 'front', k.front, 'back', k.back,
        'hint', k.hint, 'sort_order', k.sort_order, 'is_active', k.is_active, 'source_hash', k.source_hash,
        'kind', k.kind, 'options', k.options, 'review_status', k.review_status, 'source', k.source,
        'original', k.original
      ) order by k.sort_order, k.created_at), '[]'::jsonb)
      from public.cards k where k.deck_id = p_deck_id
    ),
    'progress', (
      select coalesce(jsonb_object_agg(x.card_id, x.n), '{}'::jsonb)
      from (
        select cp.card_id::text as card_id, count(*) as n
        from public.card_progress cp
        join public.cards k on k.id = cp.card_id
        where k.deck_id = p_deck_id
        group by cp.card_id
      ) x
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.sync_deck(p_deck_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  d jsonb := p_plan -> 'deck';
  r jsonb;
  ids uuid[];
  n integer;
  deck_written integer := 0;
  cat_created integer := 0;
  cat_updated integer := 0;
  cat_deleted integer := 0;
  card_created integer := 0;
  card_updated integer := 0;
  card_deactivated integer := 0;
  card_deleted integer := 0;
begin
  if not public.can_sync_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if d is not null then
    insert into public.decks (id, slug, title, description, course_code, source_credit, exam_date, is_published, sort_order, source_hash)
    values (
      p_deck_id,
      d ->> 'slug',
      d ->> 'title',
      d ->> 'description',
      d ->> 'course_code',
      d ->> 'source_credit',
      nullif(d ->> 'exam_date', '')::date,
      coalesce((d ->> 'is_published')::boolean, false),
      coalesce((d ->> 'sort_order')::integer, 0),
      d ->> 'source_hash'
    )
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description,
      course_code = excluded.course_code,
      source_credit = excluded.source_credit,
      exam_date = excluded.exam_date,
      is_published = excluded.is_published,
      sort_order = excluded.sort_order,
      source_hash = excluded.source_hash;
    get diagnostics n = row_count;
    deck_written := n;
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'categories' -> 'create', '[]'::jsonb)) loop
    insert into public.categories (id, deck_id, key, title, sort_order, source_hash)
    values ((r ->> 'id')::uuid, p_deck_id, r ->> 'key', r ->> 'title', (r ->> 'sort_order')::integer, r ->> 'source_hash');
    cat_created := cat_created + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'categories' -> 'update', '[]'::jsonb)) loop
    update public.categories set
      key = r ->> 'key',
      title = r ->> 'title',
      sort_order = (r ->> 'sort_order')::integer,
      source_hash = r ->> 'source_hash'
    where id = (r ->> 'id')::uuid and deck_id = p_deck_id;
    get diagnostics n = row_count;
    cat_updated := cat_updated + n;
  end loop;

  -- Saknas ett fält i planen gäller standardvärdet (äldre planer saknar uppgiftstyp och original).
  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'cards' -> 'create', '[]'::jsonb)) loop
    insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original)
    values (
      (r ->> 'id')::uuid,
      p_deck_id,
      nullif(r ->> 'category_id', '')::uuid,
      r ->> 'key',
      r ->> 'front',
      r ->> 'back',
      nullif(r ->> 'hint', ''),
      (r ->> 'sort_order')::integer,
      coalesce((r ->> 'is_active')::boolean, true),
      r ->> 'source_hash',
      coalesce(r ->> 'kind', 'sjalvskattning'),
      case when jsonb_typeof(r -> 'options') = 'array' then r -> 'options' else null end,
      nullif(r ->> 'review_status', ''),
      nullif(r ->> 'source', ''),
      coalesce((r ->> 'original')::boolean, false)
    );
    card_created := card_created + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'cards' -> 'update', '[]'::jsonb)) loop
    update public.cards set
      category_id = nullif(r ->> 'category_id', '')::uuid,
      key = r ->> 'key',
      front = r ->> 'front',
      back = r ->> 'back',
      hint = nullif(r ->> 'hint', ''),
      sort_order = (r ->> 'sort_order')::integer,
      is_active = coalesce((r ->> 'is_active')::boolean, true),
      source_hash = r ->> 'source_hash',
      kind = coalesce(r ->> 'kind', 'sjalvskattning'),
      options = case when jsonb_typeof(r -> 'options') = 'array' then r -> 'options' else null end,
      review_status = nullif(r ->> 'review_status', ''),
      source = nullif(r ->> 'source', ''),
      original = coalesce((r ->> 'original')::boolean, false)
    where id = (r ->> 'id')::uuid and deck_id = p_deck_id;
    get diagnostics n = row_count;
    card_updated := card_updated + n;
  end loop;

  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'cards' -> 'deactivate', '[]'::jsonb)) as t(x);
  if ids is not null then
    update public.cards set is_active = false where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    card_deactivated := n;
  end if;

  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'cards' -> 'delete', '[]'::jsonb)) as t(x);
  if ids is not null then
    delete from public.cards where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    card_deleted := n;
  end if;

  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'categories' -> 'delete', '[]'::jsonb)) as t(x);
  if ids is not null then
    delete from public.categories where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    cat_deleted := n;
  end if;

  return jsonb_build_object(
    'deck', deck_written,
    'categories_created', cat_created,
    'categories_updated', cat_updated,
    'categories_deleted', cat_deleted,
    'cards_created', card_created,
    'cards_updated', card_updated,
    'cards_deactivated', card_deactivated,
    'cards_deleted', card_deleted
  );
end;
$$;

revoke execute on function public.deck_snapshot(uuid) from public, anon;
grant execute on function public.deck_snapshot(uuid) to authenticated, service_role;
revoke execute on function public.sync_deck(uuid, jsonb) from public, anon;
grant execute on function public.sync_deck(uuid, jsonb) to authenticated, service_role;

-- ÅNGRA (se docs/ATERSTALLNING.md). Kör först om synkfunktionerna från
-- 20260928000000_uppgiftstyper.sql, sedan:
-- drop trigger if exists cards_record_version on public.cards;
-- drop function if exists public.record_card_version();
-- drop table if exists public.card_versions;
-- alter table public.cards drop column original;


-- ===== supabase/migrations/20260928000200_google_namn.sql =====
-- Inloggning med Google (28 sep): nya konton som skapas via Google får sitt visningsnamn från
-- Google-profilen (full_name/name i raw_user_meta_data), eftersom de inte fyller i
-- registreringsformuläret. Namnet kortas till 80 tecken som i formuläret.
-- Samma funktion som i 20260920000200_sakerhet.sql i övrigt.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      nullif(
        trim(
          coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
            nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
            nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
            ''
          )
        ),
        ''
      ),
      80
    )
  )
  on conflict (id) do nothing;

  perform public.link_examiner_invites(new.id, new.email, new.email_confirmed_at);
  return new;
end;
$$;

-- ÅNGRA: kör om handle_new_user från 20260920000200_sakerhet.sql.


-- ===== supabase/migrations/20260929000000_kursens_adress_och_publicering.sql =====
-- Examinatorer granskar innehållet men ändrar inte kursens adress (slug) eller publicering
-- (Alvins beslut 29 sep 2026). Bara global admin, service role och innehållsverktyget
-- (direktanslutning utan JWT, samma regel som can_sync_deck) får ändra de två fälten.
--
-- En trigger och inte bara gränssnittet: RLS låter redaktörer uppdatera sina deck, så utan
-- spärren i databasen kunde en examinator ändra fälten direkt via API:t.
-- Expanderande: bara en ny funktion och en trigger; inga data rörs.

create or replace function public.guard_deck_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.slug is distinct from old.slug or new.is_published is distinct from old.is_published)
     and not (
       public.is_admin()
       or public.is_service_role()
       or nullif(current_setting('request.jwt.claims', true), '') is null
     ) then
    raise exception 'Bara administratören kan ändra kursens adress eller publicering.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_deck_admin_fields() from public, anon, authenticated;

create trigger decks_guard_admin_fields
  before update on public.decks
  for each row execute function public.guard_deck_admin_fields();

-- ÅNGRA (se docs/ATERSTALLNING.md):
-- drop trigger if exists decks_guard_admin_fields on public.decks;
-- drop function if exists public.guard_deck_admin_fields();


-- ===== supabase/migrations/20260929000100_tentalaget.sql =====
-- Tentaläget (docs/TENTOR.md, Alvins beslut 29 sep 2026).
--
-- - exams: kursens gamla tentor med uppgifter och facit (jsonb). Synkas av innehållsverktyget från
--   material/<kurs>/tentor/ (utanför git). Bara redaktörer läser tabellen direkt; studenterna får
--   tentan via servern utan facit, och facit först när de lämnat in.
-- - exam_attempts: en students försök (svar, resultat, egna bedömningar av skrivuppgifter).
--   Bara egna rader.
-- - decks.exam_mode_open: tentaläget är låst för studenter tills examinatorn öppnar det.
--
-- Expanderande: nya tabeller och en ny kolumn med standardvärde.

alter table public.decks add column exam_mode_open boolean not null default false;
comment on column public.decks.exam_mode_open is 'Tentaläget öppet för studenterna (öppnas av examinator eller admin när föreläsningarna är klara).';

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  key text not null,
  title text not null,
  exam_date date,
  duration_minutes integer not null check (duration_minutes > 0),
  max_points numeric not null check (max_points > 0),
  grade_limits jsonb not null default '[]'::jsonb,
  aids text,
  instructions text,
  source text,
  status text not null default 'utkast' check (status in ('utkast', 'publicerad')),
  questions jsonb not null,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deck_id, key)
);

create index exams_deck_idx on public.exams (deck_id, exam_date desc);

create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();

alter table public.exams enable row level security;

-- Redaktörer (admin och kursens examinatorer) läser och skriver. Studenter läser aldrig direkt:
-- facit ligger i questions.
create policy "exams: redaktör läser" on public.exams
  for select to authenticated
  using (public.can_edit_deck(deck_id));

create policy "exams: redaktör skriver" on public.exams
  for all to authenticated
  using (public.can_edit_deck(deck_id))
  with check (public.can_edit_deck(deck_id));

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  -- Rättningen vid inlämning (lib/tentor/grade.ts) och studentens egna bedömningar.
  result jsonb,
  self_grades jsonb not null default '{}'::jsonb,
  points numeric,
  grade text
);

create index exam_attempts_user_idx on public.exam_attempts (user_id, exam_id, started_at desc);

alter table public.exam_attempts enable row level security;

-- Studenten läser, startar och raderar sina egna försök. Svar, inlämning, rättning och egna
-- bedömningar skriver servern (service role) efter att ha kontrollerat ägare och tid, så att
-- ingen kan sätta poäng, betyg eller submitted_at själv och därmed se facit utan att lämna in.
create policy "exam_attempts: läsa egna" on public.exam_attempts
  for select to authenticated
  using (user_id = auth.uid());

create policy "exam_attempts: starta egna" on public.exam_attempts
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "exam_attempts: radera egna" on public.exam_attempts
  for delete to authenticated
  using (user_id = auth.uid());

revoke insert, update on public.exam_attempts from anon, authenticated;
grant insert (exam_id) on public.exam_attempts to authenticated;

-- ÅNGRA (se docs/ATERSTALLNING.md):
-- drop table if exists public.exam_attempts;
-- drop table if exists public.exams;
-- alter table public.decks drop column exam_mode_open;


-- ===== supabase/migrations/20260930000000_flaggor.sql =====
-- Flaggor på kort och granskningen som inkorg (30 sep 2026, Alvins beslut).
--
-- - cards.flag_note: en anteckning om ett misstänkt fel ("Vad behöver åtgärdas?"). Ett flaggat
--   kort samlas under Granskning, fliken Flaggade, tills en examinator åtgärdat det. Flaggan
--   sätts av en examinator i granskningen eller av innehållsverktyget (attributet flagga: i
--   kortfilerna, docs/INNEHALL.md). flagged_at och flagged_by säger när och av vem; flagged_by
--   null = Kuggfris källgranskning (innehållsverktyget).
-- - Flaggan är inte innehåll: triggern record_card_version jämför bara innehållsfälten, så att
--   flagga och ta bort en flagga skapar ingen ny kortversion.
-- - RLS: befintliga policyn "cards: redaktör uppdaterar" (can_edit_deck) låter admin och
--   examinatorer för kursen sätta och ta bort flaggor. Studenter kan inte skriva kort alls, och
--   de ser aldrig utkast (policyn "cards: läs publicerade"). Studentvyerna läser inte fälten.
-- - deck_reviewer_names: namnen på dem som granskat eller flaggat kort i kursen, så att
--   granskningen kan visa "Granskad 30 sep av Johan Ahlström" (profiler är annars bara läsbara
--   för sin ägare).
-- - import_cards: kort som skapas genom importen i admin blir utkast som väntar på granskning,
--   som alla nya kort (Alvins beslut 30 sep).
--
-- Expanderande: nya kolumner utan standardvärde, en ny funktion och utökade synkfunktioner med
-- samma signaturer. Inga befintliga data ändras.

alter table public.cards
  add column flag_note text,
  add column flagged_at timestamptz,
  add column flagged_by uuid references auth.users (id) on delete set null;

alter table public.cards
  add constraint cards_flag_note_length check (flag_note is null or length(flag_note) <= 2000),
  add constraint cards_flag_consistent check (flag_note is not null or (flagged_at is null and flagged_by is null));

comment on column public.cards.flag_note is 'Anteckning om ett misstänkt fel som behöver åtgärdas. null = inte flaggat.';
comment on column public.cards.flagged_at is 'När flaggan sattes.';
comment on column public.cards.flagged_by is 'Vem som flaggade; null = Kuggfris källgranskning (innehållsverktyget).';

create index cards_flagged_idx on public.cards (deck_id) where flag_note is not null;

-- ---------------------------------------------------------------------------
-- Namnen på granskarna i en kurs (bara för redaktörer av kursen).
-- ---------------------------------------------------------------------------

create or replace function public.deck_reviewer_names(p_deck_id uuid)
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name
  from public.profiles p
  where public.can_edit_deck(p_deck_id)
    and p.display_name is not null
    and p.id in (
      select c.reviewed_by from public.cards c where c.deck_id = p_deck_id and c.reviewed_by is not null
      union
      select c.flagged_by from public.cards c where c.deck_id = p_deck_id and c.flagged_by is not null
    );
$$;

revoke execute on function public.deck_reviewer_names(uuid) from public, anon;
grant execute on function public.deck_reviewer_names(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Synkfunktionerna får fältet flag_note (samma signaturer).
-- ---------------------------------------------------------------------------

create or replace function public.deck_snapshot(p_deck_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.can_sync_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'deck', (
      select jsonb_build_object(
        'id', d.id, 'slug', d.slug, 'title', d.title, 'description', d.description,
        'course_code', d.course_code, 'source_credit', d.source_credit,
        'exam_date', d.exam_date, 'is_published', d.is_published, 'sort_order', d.sort_order,
        'source_hash', d.source_hash
      )
      from public.decks d where d.id = p_deck_id
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'key', c.key, 'title', c.title, 'sort_order', c.sort_order, 'source_hash', c.source_hash
      ) order by c.sort_order, c.title), '[]'::jsonb)
      from public.categories c where c.deck_id = p_deck_id
    ),
    'cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', k.id, 'key', k.key, 'category_id', k.category_id, 'front', k.front, 'back', k.back,
        'hint', k.hint, 'sort_order', k.sort_order, 'is_active', k.is_active, 'source_hash', k.source_hash,
        'kind', k.kind, 'options', k.options, 'review_status', k.review_status, 'source', k.source,
        'original', k.original, 'flag_note', k.flag_note
      ) order by k.sort_order, k.created_at), '[]'::jsonb)
      from public.cards k where k.deck_id = p_deck_id
    ),
    'progress', (
      select coalesce(jsonb_object_agg(x.card_id, x.n), '{}'::jsonb)
      from (
        select cp.card_id::text as card_id, count(*) as n
        from public.card_progress cp
        join public.cards k on k.id = cp.card_id
        where k.deck_id = p_deck_id
        group by cp.card_id
      ) x
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.sync_deck(p_deck_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  d jsonb := p_plan -> 'deck';
  r jsonb;
  ids uuid[];
  n integer;
  deck_written integer := 0;
  cat_created integer := 0;
  cat_updated integer := 0;
  cat_deleted integer := 0;
  card_created integer := 0;
  card_updated integer := 0;
  card_deactivated integer := 0;
  card_deleted integer := 0;
begin
  if not public.can_sync_deck(p_deck_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if d is not null then
    insert into public.decks (id, slug, title, description, course_code, source_credit, exam_date, is_published, sort_order, source_hash)
    values (
      p_deck_id,
      d ->> 'slug',
      d ->> 'title',
      d ->> 'description',
      d ->> 'course_code',
      d ->> 'source_credit',
      nullif(d ->> 'exam_date', '')::date,
      coalesce((d ->> 'is_published')::boolean, false),
      coalesce((d ->> 'sort_order')::integer, 0),
      d ->> 'source_hash'
    )
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description,
      course_code = excluded.course_code,
      source_credit = excluded.source_credit,
      exam_date = excluded.exam_date,
      is_published = excluded.is_published,
      sort_order = excluded.sort_order,
      source_hash = excluded.source_hash;
    get diagnostics n = row_count;
    deck_written := n;
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'categories' -> 'create', '[]'::jsonb)) loop
    insert into public.categories (id, deck_id, key, title, sort_order, source_hash)
    values ((r ->> 'id')::uuid, p_deck_id, r ->> 'key', r ->> 'title', (r ->> 'sort_order')::integer, r ->> 'source_hash');
    cat_created := cat_created + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'categories' -> 'update', '[]'::jsonb)) loop
    update public.categories set
      key = r ->> 'key',
      title = r ->> 'title',
      sort_order = (r ->> 'sort_order')::integer,
      source_hash = r ->> 'source_hash'
    where id = (r ->> 'id')::uuid and deck_id = p_deck_id;
    get diagnostics n = row_count;
    cat_updated := cat_updated + n;
  end loop;

  -- Saknas ett fält i planen gäller standardvärdet (äldre planer saknar uppgiftstyp, original och flagga).
  -- En flagga från filerna räknas som Kuggfris källgranskning: flagged_by null, flagged_at nu.
  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'cards' -> 'create', '[]'::jsonb)) loop
    insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at, flagged_by)
    values (
      (r ->> 'id')::uuid,
      p_deck_id,
      nullif(r ->> 'category_id', '')::uuid,
      r ->> 'key',
      r ->> 'front',
      r ->> 'back',
      nullif(r ->> 'hint', ''),
      (r ->> 'sort_order')::integer,
      coalesce((r ->> 'is_active')::boolean, true),
      r ->> 'source_hash',
      coalesce(r ->> 'kind', 'sjalvskattning'),
      case when jsonb_typeof(r -> 'options') = 'array' then r -> 'options' else null end,
      nullif(r ->> 'review_status', ''),
      nullif(r ->> 'source', ''),
      coalesce((r ->> 'original')::boolean, false),
      nullif(r ->> 'flag_note', ''),
      case when nullif(r ->> 'flag_note', '') is null then null else now() end,
      null
    );
    card_created := card_created + 1;
  end loop;

  -- I set-listan syftar kolumnnamnen till radens värden före uppdateringen: en ny eller ändrad
  -- flagga får ny tidpunkt och räknas som källgranskningens, en oförändrad behåller sina.
  for r in select * from jsonb_array_elements(coalesce(p_plan -> 'cards' -> 'update', '[]'::jsonb)) loop
    update public.cards set
      category_id = nullif(r ->> 'category_id', '')::uuid,
      key = r ->> 'key',
      front = r ->> 'front',
      back = r ->> 'back',
      hint = nullif(r ->> 'hint', ''),
      sort_order = (r ->> 'sort_order')::integer,
      is_active = coalesce((r ->> 'is_active')::boolean, true),
      source_hash = r ->> 'source_hash',
      kind = coalesce(r ->> 'kind', 'sjalvskattning'),
      options = case when jsonb_typeof(r -> 'options') = 'array' then r -> 'options' else null end,
      review_status = nullif(r ->> 'review_status', ''),
      source = nullif(r ->> 'source', ''),
      original = coalesce((r ->> 'original')::boolean, false),
      flag_note = nullif(r ->> 'flag_note', ''),
      flagged_at = case
        when nullif(r ->> 'flag_note', '') is null then null
        when nullif(r ->> 'flag_note', '') is distinct from flag_note then now()
        else flagged_at
      end,
      flagged_by = case
        when nullif(r ->> 'flag_note', '') is distinct from flag_note then null
        else flagged_by
      end
    where id = (r ->> 'id')::uuid and deck_id = p_deck_id;
    get diagnostics n = row_count;
    card_updated := card_updated + n;
  end loop;

  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'cards' -> 'deactivate', '[]'::jsonb)) as t(x);
  if ids is not null then
    update public.cards set is_active = false where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    card_deactivated := n;
  end if;

  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'cards' -> 'delete', '[]'::jsonb)) as t(x);
  if ids is not null then
    delete from public.cards where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    card_deleted := n;
  end if;

  select array_agg(x::uuid) into ids
  from jsonb_array_elements_text(coalesce(p_plan -> 'categories' -> 'delete', '[]'::jsonb)) as t(x);
  if ids is not null then
    delete from public.categories where deck_id = p_deck_id and id = any(ids);
    get diagnostics n = row_count;
    cat_deleted := n;
  end if;

  return jsonb_build_object(
    'deck', deck_written,
    'categories_created', cat_created,
    'categories_updated', cat_updated,
    'categories_deleted', cat_deleted,
    'cards_created', card_created,
    'cards_updated', card_updated,
    'cards_deactivated', card_deactivated,
    'cards_deleted', card_deleted
  );
end;
$$;

revoke execute on function public.deck_snapshot(uuid) from public, anon;
grant execute on function public.deck_snapshot(uuid) to authenticated, service_role;
revoke execute on function public.sync_deck(uuid, jsonb) from public, anon;
grant execute on function public.sync_deck(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Importen i admin: nya kort blir utkast som väntar på granskning (samma signatur).
-- ---------------------------------------------------------------------------

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
    insert into public.cards (deck_id, category_id, front, back, hint, sort_order, is_active, review_status)
    values (
      p_deck_id,
      cat_id,
      r ->> 'front',
      r ->> 'back',
      nullif(r ->> 'hint', ''),
      coalesce((r ->> 'sort_order')::integer, card_order),
      false,
      'utkast'
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

-- ÅNGRA (se docs/ATERSTALLNING.md). Kör först om synkfunktionerna från
-- 20260928000100_historik_original.sql och import_cards från 20260918000000_import_and_limits.sql,
-- sedan:
-- drop function if exists public.deck_reviewer_names(uuid);
-- drop index if exists public.cards_flagged_idx;
-- alter table public.cards
--   drop constraint if exists cards_flag_consistent,
--   drop constraint if exists cards_flag_note_length,
--   drop column if exists flagged_by,
--   drop column if exists flagged_at,
--   drop column if exists flag_note;


-- ===== supabase/migrations/20261001000000_inaktiva_kort_dolda.sql =====
-- Inaktiverade kort ska inte gå att läsa för studenter och gäster (1 okt 2026).
--
-- 20260920000200_sakerhet.sql gjorde inaktiva kort osynliga via API:t (is_active and published).
-- 20260928000000_uppgiftstyper.sql bytte policyn mot review_status is null and published, och
-- kravet på is_active föll bort. Appen läser bara aktiva kort, men den publika nyckeln kunde läsa
-- inaktiverade kort direkt. Här återställs kravet; utkasten förblir dolda som förut.

drop policy "cards: läs publicerade" on public.cards;
create policy "cards: läs publicerade" on public.cards
  for select to anon, authenticated
  using (
    public.can_edit_deck(deck_id)
    or (
      is_active
      and review_status is null
      and exists (select 1 from public.decks d where d.id = deck_id and d.is_published)
    )
  );

-- ÅNGRA (se docs/ATERSTALLNING.md): återskapa policyn ur 20260928000000_uppgiftstyper.sql.


-- ===== supabase/migrations/20261001000100_granskning_i_rotation.sql =====
-- Alla kort i rotation från början, och engelska för granskningen (Alvins beslut 1 okt 2026).
--
-- Examinatorerna granskar samtliga kort, också originalkorten. Korten är i rotation från början
-- och ett kort som inte håller tas ur rotation (status avvisad). Godkännandet är
-- granskningsdatumet: ett kort i rotation utan reviewed_at är ogranskat. Kursen öppnas för
-- studenterna först när inget kort är ogranskat. Studenternas läsregel (is_active och
-- review_status is null) ändras inte.
--
-- Utökande: två nya kolumner och en trigger. Inget befintligt värde skrivs om här; korten
-- sätts i rotation genom innehållsfilerna (status: utkast tas bort) och sync_deck.

-- ---------------------------------------------------------------------------
-- 1. Ändrat innehåll granskas igen
-- ---------------------------------------------------------------------------
-- Ändras frågan, svaret, ledtråden, typen eller alternativen utan att samma uppdatering sätter ett
-- nytt granskningsdatum (godkänner), nollställs datumet. Gäller innehållsverktyget (sync_deck),
-- kortredigeraren i admin och återställning ur historiken. "Återställ originalet" och "Spara och
-- godkänn" sätter datumet själva och behåller det.

create or replace function public.cards_review_reset()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (old.front, old.back, old.hint, old.kind, old.options)
       is distinct from (new.front, new.back, new.hint, new.kind, new.options)
     and new.reviewed_at is not distinct from old.reviewed_at then
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.cards_review_reset() from public, anon, authenticated;

create trigger cards_review_reset
  before update on public.cards
  for each row execute function public.cards_review_reset();

-- ---------------------------------------------------------------------------
-- 2. Engelska för granskningen
-- ---------------------------------------------------------------------------
-- Översättningen visas bara för den som slagit på reglaget English (admin och examinatorer; den
-- polymerexaminatorn läser inte svenska) och är aldrig det som godkänns: studenterna ser alltid
-- svenskan. sv är ett fingeravtryck av den svenska texten som översattes, så att granskningen kan
-- säga till när kortet ändrats efteråt.
--   translation_en: { "front": text, "back": text, "hint": text|null, "options": [text]|null, "sv": text }

alter table public.cards add column translation_en jsonb;
alter table public.categories add column title_en text;
alter table public.decks add column description_en text;

comment on column public.cards.translation_en is
  'Engelsk översättning för granskningen i admin (front, back, hint, options, sv = fingeravtryck av den svenska texten). Synkas med npm run kuggfri -- engelska.';
comment on column public.categories.title_en is 'Områdets namn på engelska (reglaget English).';
comment on column public.decks.description_en is 'Kursbeskrivningen på engelska (reglaget English).';

-- ÅNGRA (se docs/ATERSTALLNING.md):
-- drop trigger if exists cards_review_reset on public.cards;
-- drop function if exists public.cards_review_reset();
-- alter table public.cards drop column if exists translation_en;
-- alter table public.categories drop column if exists title_en;
-- alter table public.decks drop column if exists description_en;


-- ===== supabase/seed.sql =====
-- GENERERAD FIL. Ändra inte här; ändra i content/ och kör `npm run kuggfri -- seed`.
-- Innehållet och dess kreditering står i content/<kurs>/kurs.json.

begin;
-- Kurs: Materialteknik
insert into public.decks (id, slug, title, description, course_code, source_credit, exam_date, is_published, sort_order, source_hash) values ('1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$materialteknik$kuggfri$, $kuggfri$Materialteknik$kuggfri$, $kuggfri$Frågor, begrepp och tentauppgifter från Materialteknik på Maskinteknik, Chalmers. Korten bygger på kursens material, har källa och granskas av examinatorerna.$kuggfri$, $kuggfri$MTT085$kuggfri$, $kuggfri$Sammanställt av Alvin Andreasson utifrån föreläsningar och kursmaterial i Materialteknik (Maskinteknik, Chalmers). Ursprungligen publicerat som flashcardset i Brainscape och använt av närmare 200 studenter över två årskullar.$kuggfri$, null, true, 0, $kuggfri$cc445490f$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('97aae7d0-af93-5132-ad15-c840e2825cb2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$materialgrupper-och-egenskaper$kuggfri$, $kuggfri$Materialgrupper och egenskaper$kuggfri$, 0, $kuggfri$c3077a3e9$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('e2f719bb-f9eb-549f-acbb-a21921adb0bc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$materialvalsprocessen$kuggfri$, $kuggfri$Materialvalsprocessen$kuggfri$, 1, $kuggfri$c697dc3eb$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('d63240aa-9a49-52d8-8170-a0180269bc83', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$kristallstruktur$kuggfri$, $kuggfri$Kristallstruktur$kuggfri$, 2, $kuggfri$cbf9dc862$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('9d686bd9-37fb-54a7-aa3c-feaa3668034c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$fasdiagram-och-mikrostruktur$kuggfri$, $kuggfri$Fasdiagram och mikrostruktur$kuggfri$, 3, $kuggfri$c999384a3$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('7b4bdbf7-ac7f-5d46-8266-31205b083f96', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$styvhet-tojning-och-materialindex$kuggfri$, $kuggfri$Styvhet och elastisk deformation$kuggfri$, 4, $kuggfri$c9a990cea$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('b1e2c1c7-3222-5068-b863-314ad83c0320', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$dislokationer-hardning-och-brott$kuggfri$, $kuggfri$Plasticitet, dislokationer och härdning$kuggfri$, 5, $kuggfri$c1ee6255d$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('2207b77a-11fc-5b02-871d-12c0759eeabe', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$brott-och-utmattning$kuggfri$, $kuggfri$Brott och utmattning$kuggfri$, 6, $kuggfri$ccd1e121f$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('6aaaf25d-9bb7-5fe8-81a0-52e742379456', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$termiska-egenskaper-diffusion-och$kuggfri$, $kuggfri$Termiska egenskaper, diffusion och krypning$kuggfri$, 7, $kuggfri$c363a2bb0$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('86266117-7fc7-5ca1-b416-41853cb7dbce', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$stal-varmebehandling-och-bearbetning$kuggfri$, $kuggfri$Stål, värmebehandling och bearbetning$kuggfri$, 8, $kuggfri$c785708b3$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$icke-jarnmetaller$kuggfri$, $kuggfri$Icke-järnmetaller$kuggfri$, 9, $kuggfri$c576603a0$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('2a0cb9e4-83a2-5694-93d8-c2458390173a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$hallbarhet-och-atervinning$kuggfri$, $kuggfri$Hållbarhet och återvinning$kuggfri$, 10, $kuggfri$c819a35ce$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('ca58740d-bf59-5401-9bf0-3e5f7e352f54', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$polymerers-struktur$kuggfri$, $kuggfri$Polymerers struktur$kuggfri$, 11, $kuggfri$c2dca5d3b$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$polymerers-reologi-och-bearbetning$kuggfri$, $kuggfri$Polymerers reologi och bearbetning$kuggfri$, 12, $kuggfri$cb7419565$kuggfri$);
insert into public.categories (id, deck_id, key, title, sort_order, source_hash) values ('93859c85-44c9-5113-879e-3dab2f92f3df', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', $kuggfri$polymerers-mekaniska-egenskaper$kuggfri$, $kuggfri$Polymerers mekaniska egenskaper$kuggfri$, 13, $kuggfri$c66f34987$kuggfri$);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('95878deb-67fa-5595-8451-bc211dd37659', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$vilka-materialgrupper-finns-det$kuggfri$, $kuggfri$Vilka materialgrupper finns det?$kuggfri$, $kuggfri$* Metaller
* Keramer
* Polymerer

Ibland anses glas och elastomerer som separata materialgrupper men de kan annars ses som undergrupper till keramer respektive polymerer. En kombination av två eller flera material kallas för en komposit eller hybrid och kan ibland också ses som en egen materialgrupp.$kuggfri$, null, 0, true, $kuggfri$c9cd1edde$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2253132b-19e3-59ee-af46-2564a6a96d2f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$namn-minst-tva-olika-typer-av$kuggfri$, $kuggfri$Nämn minst två olika typer av atombindningar och redogör för deras karaktäristiska egenskaper.$kuggfri$, $kuggfri$* Kovalent bindning:
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
* Van der Waals, vätebindning,
polära bindningar
  - Svaga
  - Mellan polymerkedjor$kuggfri$, null, 1, true, $kuggfri$caf357921$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('0d9a7110-1d1f-5b25-bf5c-acfd6d154fc1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$vad-ar-en-keram-och-vad-kannetecknar-dem$kuggfri$, $kuggfri$Vad är en keram och vad kännetecknar dem?$kuggfri$, $kuggfri$* Oorganiska, kemiska föreningar
mellan metall och icke-metall
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
isolerande$kuggfri$, null, 2, true, $kuggfri$c89d2717a$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('647b3aed-fdfc-574a-8d18-5329c3c1415d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$hur-tillverkas-vanligtvis-en-produkt$kuggfri$, $kuggfri$Hur tillverkas vanligtvis en produkt gjord i någon form av keram?$kuggfri$, $kuggfri$* Keramer tillverkas av olika
mineral
* Utgångsmaterial i form av lera
eller pulver
* Formas till produktens form
* Sintras (bränns) vid ca. 2/3 av
keramens smälttemperatur$kuggfri$, null, 3, true, $kuggfri$c83c0008a$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6c5a5c2b-5572-53bc-8983-06fafcb0c100', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$vad-ar-en-metall-och-vad-kannetecknar$kuggfri$, $kuggfri$Vad är en metall och vad kännetecknar dem?$kuggfri$, $kuggfri$* Vanliga metaller
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
borrning, svarvning, fräsning$kuggfri$, null, 4, true, $kuggfri$c6331222f$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('937feb6b-7a15-5b8b-8928-af9139054624', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$vad-ar-en-polymer-och-vad-kannetecknar$kuggfri$, $kuggfri$Vad är en polymer och vad kännetecknar dem?$kuggfri$, $kuggfri$* Organiska material som består
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
* Enkla att forma$kuggfri$, null, 5, true, $kuggfri$c3d41bebe$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('180536c9-4513-56b0-811d-c76ce7f2bc38', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$vad-ar-en-komposit-och-vad-kannetecknar$kuggfri$, $kuggfri$Vad är en komposit och vad kännetecknar dem?$kuggfri$, $kuggfri$* Kombination av två eller flera
material, ex. plast och kolfiber
* Vanliga fiber: kolfiber, glasfiber,
aramidfiber
* Förstärkningen kan vara i olika
form: långa fiber, korta fiber,
partiklar
* Andra exempel:
  - Betong = cement och sten
  - Hårdmetall = Co och WC$kuggfri$, null, 6, true, $kuggfri$c3a23e395$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('294e701d-33be-5360-ac9b-fb5ccb2fa092', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$namn-minst-tva-olika-typer-av-2$kuggfri$, $kuggfri$Nämn minst två olika typer av tillverkningsmetoder.$kuggfri$, $kuggfri$* Primär formning
* Sekundär formning
* Fogning
* Ytbehandling$kuggfri$, null, 7, true, $kuggfri$c3fcfd256$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('700df2ca-94ec-5b7e-abf2-f4c30cd1c7c5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$materialegenskaper-brukar-delas-upp-i$kuggfri$, $kuggfri$"Materialegenskaper" brukar delas upp i ett antal underkategorier, nämn minst tre av dessa.$kuggfri$, $kuggfri$* Allmänna egenskaper
* Mekaniska egenskaper
* Elektriska, magnetiska och
optiska egenskaper
* Termiska egenskaper
* Kemiska egenskaper
* Miljö$kuggfri$, null, 8, true, $kuggfri$c952c436c$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('8156781b-68eb-581c-9096-1d41e140dd51', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$ge-minst-tva-exempel-pa-mekaniska$kuggfri$, $kuggfri$Ge minst två exempel på mekaniska egenskaper.$kuggfri$, $kuggfri$* Styvhet
  - Hur mycket ett material
deformeras vid en viss last.
* Sträckgräns
  - Vid vilken last (spänning) ett
material deformeras
permanent.
* Brottseghet ($K_{1c}$)
  - Materialets motstånd mot
spricktillväxt.$kuggfri$, null, 9, true, $kuggfri$c6967a2ac$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: brottseghet beskrevs som den last vid vilken materialet går sönder, men brottseghet är materialets motstånd mot spricktillväxt; Canvas, Kapitel_02 Material och tillverkning databaser, s. 26; Canvas, Fo 8 Plasticitet, s. 26; Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 28$kuggfri$, true, $kuggfri$Rättelse av originalkortet: brottseghet beskrevs som "vid vilken last ett material går sönder" (ordagrant Fö 1 HT25 s. 28), vilket snarare beskriver brottgränsen. Nu står "materialets motstånd mot spricktillväxt (K1c)" enligt Kapitel_02 s. 26 och Kapitel_08 s. 7. Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d9ec0e04-5a53-538f-a717-d0d8db6eb3c3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$ge-minst-tva-exempel-pa-elektriska$kuggfri$, $kuggfri$Ge minst två exempel på elektriska, magnetiska och optiska egenskaper.$kuggfri$, $kuggfri$* Elektrisk ledningsförmåga
* Elektrisk isolering
* Magnetiska
* Genomskinligt, reflexion, färg

Beror på växelverkan mellan
elektronerna i materialet$kuggfri$, null, 10, true, $kuggfri$cf5923006$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('745893a2-88da-5bc5-b672-f8e09ad3e43b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$ge-minst-tva-exempel-pa-termiska$kuggfri$, $kuggfri$Ge minst två exempel på termiska egenskaper.$kuggfri$, $kuggfri$* Smälttemperatur
* Min och max
användningstemperatur
* Värmeledning
* Specifik värmekapacitivitet
* Termisk utvidgning$kuggfri$, null, 11, true, $kuggfri$c68976abc$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ec4061e1-5ae9-56ea-8933-56c1d16de866', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$ge-minst-tva-exempel-pa-kemiska$kuggfri$, $kuggfri$Ge minst två exempel på kemiska egenskaper.$kuggfri$, $kuggfri$* Korrosion (“rostar”)
* Oxidation (reagerar med syre)
* Reaktioner i användningsmiljön
* Giftigt$kuggfri$, null, 12, true, $kuggfri$ca77cf929$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('4ea2d46c-c084-5a37-8ce0-0c1858d1cdd7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$ge-minst-tva-exempel-pa-miljoegenskaper$kuggfri$, $kuggfri$Ge minst två exempel på miljöegenskaper.$kuggfri$, $kuggfri$* CO₂ footprint: mängd CO₂-som
bildas vid framställning
* Embedded energy: mängd
energi som åtgår för
framställning
* Återvinningsbart
* Andra miljöbelastningar vid
utvinning, framställning,
produkttillverkning,
användning och skrotning$kuggfri$, null, 13, true, $kuggfri$c31c4d31a$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('3d74f292-698d-5b70-8b4a-61d1b81dc3a1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$adhesiv-forslitning$kuggfri$, $kuggfri$Adhesiv förslitning$kuggfri$, $kuggfri$Vid nötningen binds materialen samman med atomära bindningar, och material rycks bort när ytorna glider mot varandra. De två materialen svetsas punktvis samman, och slits isär.$kuggfri$, null, 14, true, $kuggfri$c0b397d47$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true, $kuggfri$Kortet saknar källa i 2025 och 2026 års föreläsningar: nötning (Ashby kap. 11) finns inte i läsanvisningen 2026, och baksidan är i stort sett facit till tentan 2019-10-26 uppg. 1f. Ingår adhesiv förslitning i årets kurs, eller ska kortet inaktiveras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('c5d3fc0c-c96d-53ef-812b-440f3f7dc952', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$abrasiv-forslitning$kuggfri$, $kuggfri$Abrasiv förslitning$kuggfri$, $kuggfri$Förslitning som fås när ett hårt material/medium avverkar ytan.$kuggfri$, null, 15, true, $kuggfri$c95ece9e1$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true, $kuggfri$Kortet saknar källa i 2025 och 2026 års föreläsningar: nötning (Ashby kap. 11) finns inte i läsanvisningen 2026, och baksidan är ordagrant facit till tentan 2016-10-29 uppg. 1c. Ingår abrasiv förslitning i årets kurs, eller ska kortet inaktiveras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('f00f3ae6-5a05-5a37-b015-ec75bf24f180', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$quiz-vad-ar-sant-for-atombindningar-tva$kuggfri$, $kuggfri$Vilka påståenden om atombindningar är sanna?$kuggfri$, $kuggfri$Keramer har kovalent- eller jonbindning. I metallbindningen lossnar valenselektronerna och bildar ett elektronmoln, vilket ger elektrisk och termisk ledning. Vätebindningar hör tillsammans med van der Waals-bindningar till de svaga bindningarna (t.ex. mellan polymerkedjor), medan jon-, kovalent- och metallbindning är starka. Av bindningstyperna i föreläsningen är det den kovalenta som beskrivs som riktningsberoende.$kuggfri$, null, 16, true, $kuggfri$cfcaf5af2$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Keramiska material kan ha jonbindningar.","correct":true},{"text":"Bindningstypen hos metaller ger elektrisk ledningsförmåga.","correct":true},{"text":"De starkaste bindningarna är vätebindningar.","correct":false},{"text":"Jonbindningar och metallbindningar är riktningsberoende.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 1, fråga 1; Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 14, 17; Canvas, Kapitel_04 Elastisk deformation, s. 34$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('ca5c1c46-9751-5cc9-ad3b-eb1921daf262', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$quiz-vad-ar-sant-for-keramiska-material-tva$kuggfri$, $kuggfri$Vilka påståenden om keramiska material är sanna?$kuggfri$, $kuggfri$Keramer är oftast kristallina, med glas som amorft undantag, och de har kovalent- eller jonbindning. Starka bindningar (djup bindningsenergikurva) ger hög smälttemperatur. Keramer är oorganiska föreningar mellan metall och icke-metall, inte föreningar med organiska material, och trots att de är spröda har de bra slitstyrka. Quizens alternativ "Alla keramer är kristallina förutom glas" är omformulerat till "oftast", som det står i föreläsningen.$kuggfri$, null, 17, true, $kuggfri$c8ee6894c$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Keramer är oftast kristallina; glas är ett undantag och är amorft.","correct":true},{"text":"Den starka atombindningen hos keramer ger hög smälttemperatur.","correct":true},{"text":"Keramer är föreningar mellan oorganiska och organiska material.","correct":false},{"text":"Spröda keramer har dålig slitstyrka.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 1, fråga 2; Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 16, 17; Canvas, Fo 7 Styvhet, s. 4$kuggfri$, false, $kuggfri$Quizens rätta alternativ "Alla keramer är kristallina förutom glas" är för starkt och har skrivits om till "Keramer är oftast kristallina; glas är ett undantag", som Fö 1 HT25 s. 17 säger. Godkänns omskrivningen, och ska Quiz vecka 1 fråga 2 i Canvas ändras likadant?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('e9e8deb4-e530-5098-ac44-4d30bb4ae975', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$quiz-mer-keramer-vad-ar-sant-tva-ratta-svar$kuggfri$, $kuggfri$Keramer: vilka påståenden är sanna?$kuggfri$, $kuggfri$Keramer är elektriskt och termiskt isolerande. De är spröda och tål dragbelastning dåligt men tryckbelastning bättre. Keramiska produkter gjuts inte vanligtvis utan formas av lera eller pulver och sintras vid ca 2/3 av smälttemperaturen. Glas är amorft och mjuknar och kan formas först mellan 800 och 1200 °C, vilket inte är en låg temperatur.$kuggfri$, null, 18, true, $kuggfri$c8d88b92f$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Keramer är vanligtvis isolatorer.","correct":true},{"text":"När man konstruerar med keramer bör man eftersträva tryckbelastning.","correct":true},{"text":"Keramer gjuts vanligtvis.","correct":false},{"text":"Glas är en keram med låg smälttemperatur.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 1, fråga 3; Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 17, 18$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('a4015a21-dade-54dc-be85-69c8934db437', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$quiz-vad-ar-sant-for-metaller-tva-ratta-svar$kuggfri$, $kuggfri$Vilka påståenden om metaller är sanna?$kuggfri$, $kuggfri$Spröda material har låg brottseghet, och keramer är spröda medan metaller inte är det. Att metaller kan gjutas står bland metallernas egenskaper i föreläsningen. Stål är järn och kol (Fe + C), och även andra metaller korroderar, t.ex. magnesium, som bildar ett poröst oxidskikt och därför har sämre korrosionsskydd. Quizens alternativ är förenklade: "högre brottseghet än plaster och keramer" är begränsat till keramer och "Alla metaller kan gjutas" till "Metaller kan gjutas", eftersom föreläsningstexten bara belägger det.$kuggfri$, null, 19, true, $kuggfri$c3e371929$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Metaller har generellt sett högre brottseghet än keramer.","correct":true},{"text":"Metaller kan gjutas.","correct":true},{"text":"Stål är en legering av järn och fosfor.","correct":false},{"text":"Den enda metall som korroderar är stål.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 1, fråga 9; Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 17, 19, 20; Canvas, Kapitel_02 Material och tillverkning databaser, s. 26; Canvas, Fo 13 Aluminium och andra metaller, s. 11$kuggfri$, false, $kuggfri$Quizens rätta alternativ är förenklade: "Alla metaller kan gjutas" har blivit "Metaller kan gjutas" (Fö 1 HT25 s. 20), och "högre brottseghet än plaster och keramer" har begränsats till keramer, eftersom jämförelsen med plaster inte står i föreläsningstexten. Godkänns omskrivningen, och ska Quiz vecka 1 fråga 9 ändras likadant?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6d5e9686-51c1-5107-924a-4208e44ec6e3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$quiz-vad-ar-sant-for-kompositer-tva-ratta$kuggfri$, $kuggfri$Vilka påståenden om kompositer är sanna?$kuggfri$, $kuggfri$En komposit är en kombination av två eller flera material, t.ex. plast och kolfiber, och förstärkningen kan vara långa fiber, korta fiber eller partiklar. Kompositens densitet beror på volymandelarna och densiteterna hos de ingående materialen: enligt blandningsregeln, $\rho = f\rho_A + (1-f)\rho_B$, viktas densiteterna med volymandelarna, så kompositens densitet hamnar mellan de ingående materialens och inte under båda. Återvinning av kompositer beskrivs i föreläsningen som en utmaning.$kuggfri$, null, 20, true, $kuggfri$c58875a0e$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"En komposit består vanligen av två olika material.","correct":true},{"text":"Förstärkningen i en komposit kan bestå av långa fiber, korta fiber eller partiklar.","correct":true},{"text":"En komposit har alltid lägre densitet än vart och ett av de ingående materialen.","correct":false},{"text":"Kompositer är oftast lätta att återvinna.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 1, fråga 10; Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 11, 23; Canvas, Fo 7 Styvhet, s. 3; Canvas, Kapitel_04 Elastisk deformation, s. 27; Canvas, Short_dictionary_ v2026, s. 12$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6102de48-4de8-5da3-8337-f9a86dd30efa', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$designbegransande-egenskap$kuggfri$, $kuggfri$Designbegränsande egenskap$kuggfri$, $kuggfri$En egenskap som avgör om ett material är lämpligt utifrån designkraven. Exempel: för ett flygplan är hållfasthet, styvhet och seghet designbegränsande; är någon av dem för låg kan flygplanet inte flyga.$kuggfri$, null, 21, true, $kuggfri$cf6a756a6$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, Kapitel_01 Intro till Material, s. 26$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('0643ae74-6de7-559d-95f2-940d3fbf10b4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$sex-materialfamiljer$kuggfri$, $kuggfri$Vilka av följande är egna familjer i kursens indelning i sex materialfamiljer?$kuggfri$, $kuggfri$De sex familjerna är metaller (med legeringar), keramer, glas, polymerer, elastomerer och hybrider (t.ex. kompositer). I den grövre indelningen i fyra grupper räknas glas till keramerna och elastomerer till polymererna. Legeringar hör till metallfamiljen och termoplaster är en undergrupp till polymererna, så ingen av dem är en egen familj.$kuggfri$, null, 22, true, $kuggfri$c686e29bb$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Glas","correct":true},{"text":"Elastomerer","correct":true},{"text":"Legeringar","correct":false},{"text":"Termoplaster","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_02 Material och tillverkning databaser, s. 3, 5; Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 15$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c088eced-3406-5c05-8a61-fb00a34545bb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '97aae7d0-af93-5132-ad15-c840e2825cb2', $kuggfri$komposit-kolfiber-begransningar$kuggfri$, $kuggfri$Vilka påståenden om kolfiberkompositer stämmer enligt kursen?$kuggfri$, $kuggfri$Kolfiberkompositer kombinerar hög styrka med låg vikt och används i t.ex. flygplan, vindkraft, sport och medicin. De kallas ibland "framtidens material", men återvinningen beskrivs i kursen som en utmaning. Priset är en viktig begränsning: i kursens stolsexempel (BM 65) avfärdas CFRP som för dyrt, och i SpaceX-exemplet bytte man från kolfiberkomposit och gjutet titan till rostfritt stål, bland annat för lägre kostnad per kilo och enklare tillverkning och reparation. Låg vikt betyder här låg densitet, så de har lägre densitet än stål, inte högre.$kuggfri$, null, 23, true, $kuggfri$ce8ace627$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"De har hög styrka och låg vikt och används t.ex. i flygplan, vindkraft och sport.","correct":true},{"text":"Återvinningen beskrivs som en utmaning.","correct":true},{"text":"De är billigare per kilo än rostfritt stål.","correct":false},{"text":"De har högre densitet än stål.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 11; Canvas, Kapitel_03 Materialval, s. 41; Canvas, Fo 13 Hallbarhet, s. 20$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('2be1d410-d260-5f60-b5a3-198d0c0cf76a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$vilka-ar-de-olika-stegen-i$kuggfri$, $kuggfri$Vilka är de olika stegen i materialvalsprocessen?$kuggfri$, $kuggfri$1. Översätta
2. Sålla
3. Rangordna
4. Sök dokumentation

Utöver de fyra stegen itererar man: materialvalet behöver ofta förfinas i flera steg innan man hittar en bra lösning.$kuggfri$, null, 24, true, $kuggfri$c126a4417$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: iteration stod som ett femte steg, men strategin har fyra steg och iterationen är ett tillägg; Canvas, Kapitel_03 Materialval, s. 26, 42; Canvas, Ashby et al Materials 3 utgavan PRELIMINAR Lasanvisning och detaljerade larmal Kap 1-12, s. 2$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "5. Iterera" stod som ett femte steg, men Kapitel_03 s. 26 och 42 numrerar fyra steg och tar upp iteration separat, och svarsförslaget till tentan 2025-10-30 talar om fyra steg. Fö 2 Materialval 2025 s. 9 har dock "Iterera" som en egen bild efter steg 4. Godkänns att kortet anger fyra steg plus iteration?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('a3576869-1462-5637-89ae-52b6fa1768a4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-vad-man-gor-i$kuggfri$, $kuggfri$Beskriv vad man gör i materialvalssteget: "Översätta".$kuggfri$, $kuggfri$Översätta krav på komponenten till krav på materialet:

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
Ex. tvärsnitt, material$kuggfri$, null, 25, true, $kuggfri$c24260826$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('a7bb3469-b345-53df-8186-e4c1cb157b04', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-vad-man-gor-i-2$kuggfri$, $kuggfri$Beskriv vad man gör i materialvalssteget: "Sålla".$kuggfri$, $kuggfri$Ta bort alla material som inte fyller kraven. (Använder vi dessa material så kommer komponenten inte att fungera som vi vill.) Materialegenskaper som vi använder i målfunktionen bör vi inte heller använda vid sållningen. (Ex. inget krav på densitet om målet är låg vikt.)$kuggfri$, null, 26, true, $kuggfri$cdb622b81$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3376edce-7584-52be-92d7-dcb736609e56', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-vad-man-gor-i-3$kuggfri$, $kuggfri$Beskriv vad man gör i materialvalssteget: "Rangordna".$kuggfri$, $kuggfri$* Använd funktion, mål och fria variabler för att bestämma
materialindex.
* Materialindex = numeriskt värde som beskriver hur bra ett material uppfyller målen!
* Ta hjälp av materialindexet för att rangordna materialen.
Ex: E-modul/pris, E-modul^(1/2)/densitet$kuggfri$, null, 27, true, $kuggfri$c563a2f62$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6a60025f-71d7-542e-98c2-4fba34214cb2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-vad-man-gor-i-4$kuggfri$, $kuggfri$Beskriv vad man gör i materialvalssteget: "Sök dokumentation".$kuggfri$, $kuggfri$Leta i dokumentation (handböcker, artiklar, standarder m.m.) för att se om det finns erfarenheter av materialet i liknande tillämpningar.$kuggfri$, null, 28, true, $kuggfri$c866b5ae0$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('352114ee-0597-5fa4-b1f4-d4c6f6844374', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-vad-man-gor-i-5$kuggfri$, $kuggfri$Vad innebär det att iterera materialvalet, och varför är det viktigt?$kuggfri$, $kuggfri$Materialvalet måste ofta förfinas och förbättras i flera steg innan man hittar en bra lösning. Det är bra att först börja med materialgrupperna och sedan begränsa sig. I CES (Granta EduPack) börjar man med nivå 1 för att hitta materialgrupper och går sedan vidare till nivå 2 och 3.$kuggfri$, null, 29, true, $kuggfri$ce4aaa64e$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet sa att man utökar mängden material efter första iterationen, men kursen säger att man börjar brett med materialgrupperna och sedan begränsar sig; Canvas, Kapitel_03 Materialval, s. 26, 42; Canvas, Fo 2 Materialval, s. 9$kuggfri$, true, $kuggfri$Rättelse av originalkortet: det sa att man brukar utöka mängden material efter första iterationen, men Kapitel_03 s. 26 och Fö 2 Materialval s. 9 säger att man börjar brett med materialgrupperna och sedan begränsar sig (CES nivå 1, sedan nivå 2 och 3). Framsidan kallar inte längre iterationen ett steg. Godkänns den nya texten?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('a446e3f7-5f57-5f56-987d-dbde37915688', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$vad-ar-ett-lastfall-och-varfor-ar-det$kuggfri$, $kuggfri$Vad är ett lastfall och varför är det viktigt i materialvalsprocessen?$kuggfri$, $kuggfri$* Ett lastfall är en isolerad belastningssituation som materialet kan utsättas för.
* Ex: En stång i tryck/drag/vridspänning, en balk i böjning/knäckning eller utsatt för utbredd last, ett tryckkärl utsatt för tryckskillnader.
* Lastfallet (tillsammans med vad som ska optimeras) bestämmer vilket materialindex som är lämpligt. Alla fall av böjning av en balk har t.ex. samma inverkan av materialet, så för materialvalet behöver man bara bestämma typen av lastfall.
* Exempel vid minsta vikt: dragstång $\rho/E$ (styvhet) eller $\rho/\sigma_y$ (hållfasthet), balk i böjning $\rho/E^{1/2}$ eller $\rho/\sigma_y^{2/3}$; välj material med lägsta värde.$kuggfri$, null, 30, true, $kuggfri$c32d632ee$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: påståendet att man ska använda det lastfall som förekommer oftast saknar stöd i kursmaterialet och är struket; dubbletten vad-har-lastfall-for-inverkan-pa är inaktiverad; Canvas, Fo 7 Styvhet, s. 15, 17; Canvas, Kapitel_03 Materialval, s. 33, 35$kuggfri$, true, $kuggfri$Rättelse av originalkortet: påståendet att man ska använda "lastfallet som förekommer oftast" saknar stöd i kursmaterialet och är struket; i stället står att bara typen av lastfall behövs (Fö 7 Styvhet s. 15) med indexexempel från Kapitel_03 s. 35. Dubbletten vad-har-lastfall-for-inverkan-pa är samtidigt inaktiverad. Godkänns rättelsen och inaktiveringen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c67240d8-2f57-5d95-902d-05aae6a70542', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$beskriv-ingaende-vad-ett-materialindex$kuggfri$, $kuggfri$Beskriv ingående vad ett materialindex är och hur det används.$kuggfri$, $kuggfri$* Ett numeriskt värde M som talar om hur effektivt ett material är i
ett visst lastfall och en viss form
* För att bestämma materialindex behöver vi veta vilken egenskap som skall optimeras (ex: styvhet, pris, vikt) och lastfall
* Detta bestäms av funktion, mål och fria variabler från
översättningen
* Materialindex används för att rangordna material i materialvalet$kuggfri$, null, 31, true, $kuggfri$cfccc05c5$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('55f44335-263b-5f37-aa6f-9617704990b5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$nar-ska-man-anvanda-materialindex-for$kuggfri$, $kuggfri$När ska man använda materialindex för styvhet, kontra sträckgräns?$kuggfri$, $kuggfri$* Använd materialindex för styvhet
om deformationen är
dimensionerande. (Krav på max
deformation)
* Använd materialindex för
sträckgräns om last utan plasticering
är dimensionerande. (Krav på max
spänning)$kuggfri$, null, 32, true, $kuggfri$ca46196e2$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('f9ca0bd4-1ef1-503d-9cec-63f4769c74c7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$quiz-materialval-vad-ar-sant-ett-ratt-svar$kuggfri$, $kuggfri$Materialval: vilket påstående är sant?$kuggfri$, $kuggfri$Material, form och process samverkar: en specificerad process begränsar valet av material och form. Minimal miljöpåverkan kan vara ett mål i materialvalet och uppskattas med en snabb eco audit, utan fullständig livscykelanalys. Sållningen tar bara bort material som inte klarar kraven och rangordningen avgör vilket av de kvarvarande som är bäst, så ett stort antal kvar är inget mål i sig. Fria variabler kan vara t.ex. tvärsnitt och material; i kursens kylflänsexempel är valet av material den enda fria variabeln.$kuggfri$, null, 33, true, $kuggfri$cf7defa95$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Materialvalet påverkas av möjliga tillverkningsmetoder.","correct":true},{"text":"Miljöbelastningen kan inte tas med i materialvalet utan kräver en livscykelanalys.","correct":false},{"text":"Ju fler material man har kvar efter sållningen, desto bättre.","correct":false},{"text":"Om tvärsnittet inte är en fri variabel kan man inte göra ett materialval.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 1, fråga 4; Canvas, Kapitel_03 Materialval, s. 8, 9, 25, 28, 43; Canvas, Fo 2 Materialval, s. 5, 6, 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('a43cf025-5dd7-5279-947c-9d33da39d142', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$quiz-materialval-vad-ar-sant-tva-ratta-svar$kuggfri$, $kuggfri$Materialval: vilka påståenden är sanna?$kuggfri$, $kuggfri$Sållningen tar bort alla material som inte fyller kraven, eftersom komponenten annars inte fungerar. De material som finns kvar uppfyller kraven och kan användas; rangordningen med materialindex avgör sedan vilket som är bäst. Översättning innebär att krav på komponenten översätts till funktion, krav, mål och fria variabler, och fria variabler är variabler hos komponenten som vi kan ändra, t.ex. tvärsnitt och material. Quizens alternativ "Alla material som är kvar efter att vi sållat kan användas för att göra produkten" är omformulerat så att det tydligt gäller kraven.$kuggfri$, null, 34, true, $kuggfri$ca0634913$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Material som inte klarar kraven kan inte användas i komponenten.","correct":true},{"text":"Material som finns kvar efter sållningen uppfyller kraven och kan därför användas i komponenten.","correct":true},{"text":"Med översättning menas att översätta materialkraven till danska.","correct":false},{"text":"Fria variabler är sådant som inte är nödvändigt.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 1, fråga 5; Canvas, Fo 2 Materialval, s. 5, 6, 7$kuggfri$, false, $kuggfri$Quizens rätta alternativ "Alla material som är kvar efter sållningen kan användas för att göra produkten" är tvetydigt, eftersom det är rangordningen som avgör vilket material som är bäst. Kortet säger nu att materialen "uppfyller kraven och kan därför användas i komponenten" (Fö 2 Materialval s. 5 till 7). Godkänns omformuleringen, och ska Quiz vecka 1 fråga 5 ändras likadant?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6b069be9-1fbe-56fa-99b1-7f1c4f73daab', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$quiz-for-att-bestamma-materialindex-behover$kuggfri$, $kuggfri$Vad behöver man veta för att bestämma ett materialindex?$kuggfri$, $kuggfri$Vilket materialindex som gäller bestäms av vilken egenskap som ska optimeras (målet, t.ex. låg vikt) och av lastfallet, dvs. av funktion, mål och fria variabler från översättningen. Materialdata som densitet, pris, sträckgräns och E-modul behövs först när indexet räknas ut för de olika materialen, inte för att bestämma vilket index som ska användas.$kuggfri$, null, 35, true, $kuggfri$c3506b81d$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Lastfall","correct":true},{"text":"Mål","correct":true},{"text":"Densitet och pris","correct":false},{"text":"Sträckgräns och E-modul","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 3, fråga 8; Canvas, Fo 7 Styvhet, s. 17; Canvas, Kapitel_03 Materialval, s. 26$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('496300cc-3655-5fe5-be03-5041ae662dd7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$quiz-materialindex-vad-ar-ratt-2-ratta-svar$kuggfri$, $kuggfri$Materialindex: vilka påståenden är rätt?$kuggfri$, $kuggfri$Materialindex rangordnar material efter hur väl de uppfyller målet; kraven används i sållningen, inte i rangordningen. Ett index kan vara en enda egenskap (t.ex. bara E om prestandan mäts som en balks styvhet) eller en kombination som $E/\rho$ eller $\sigma_y/\rho$, så det behöver inte innehålla densiteten. Finns det flera mål, t.ex. låg vikt och lågt pris, kan man behöva flera index och jämföra alternativen i ett paretodiagram.$kuggfri$, null, 36, true, $kuggfri$ca247c35f$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Materialindex används i sållningen för att ta bort de material som inte uppfyller kraven.","correct":false},{"text":"Ett materialindex kan innehålla en eller flera materialegenskaper.","correct":true},{"text":"Man kan behöva använda flera materialindex för att komma fram till ett bra materialval.","correct":true},{"text":"Alla materialindex måste innehålla materialets densitet.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 3, fråga 9; Canvas, Fo 2 Materialval, s. 6, 7; Canvas, Kapitel_03 Materialval, s. 35; Canvas, Kapitel_03 Materialval Repetition och Inlamningsuppgift, s. 24, 25; Canvas, performance-indices-booklet-bokpeien22, s. 2$kuggfri$, false, $kuggfri$Quizens felaktiga alternativ "materialindex rangordnar material efter hur bra de uppfyller kraven" var fel bara på ordet krav (index rangordnar efter målet) och kunde läsas som rätt. Det är utbytt mot "Materialindex används i sållningen för att ta bort de material som inte uppfyller kraven" (Fö 2 Materialval s. 6, 7; Kapitel_03 s. 26), så kortet avviker från Quiz vecka 3 fråga 9. Godkänns bytet?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('51c51044-1ab1-5620-9eb5-44dae79022db', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$materialval-krav-eller-mal$kuggfri$, $kuggfri$Vilka av följande är krav (och inte mål) i en översättning?$kuggfri$, $kuggfri$Krav är egenskaper som måste vara uppfyllda för att komponenten ska fungera, t.ex. användningstemperatur, att tåla vatten eller en viss brottseghet. Mål är egenskaper hos komponenten som vi vill optimera (minimera eller maximera), t.ex. vikt, pris och miljöbelastning. Kraven används i sållningen och målen i rangordningen.$kuggfri$, null, 37, true, $kuggfri$c4e76f422$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Tåla vatten","correct":true},{"text":"Viss brottseghet","correct":true},{"text":"Låg vikt","correct":false},{"text":"Lågt pris","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 2 Materialval, s. 5; Canvas, Kapitel_03 Materialval, s. 24, 25$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1ea82806-66b6-5ec9-b9fd-723706b2cc07', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$sallning-inget-krav-pa-malegenskap$kuggfri$, $kuggfri$Om målet är låg vikt bör man inte ställa något krav på densiteten vid sållningen.$kuggfri$, $kuggfri$Materialegenskaper som ingår i målfunktionen ska inte användas vid sållningen. Densiteten hanteras i stället i rangordningen, via materialindexet (t.ex. $\rho/\sigma_y$ för en lätt och stark dragstång).$kuggfri$, null, 38, true, $kuggfri$c9afd8f09$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 2 Materialval, s. 6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('33a3ee5d-2ee3-59e8-8b86-7df602bdcdfd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$materialindex-latt-stark-dragstang$kuggfri$, $kuggfri$Lätt och stark dragstång (får inte plasticera): vilket materialindex ska minimeras?$kuggfri$, $kuggfri$För en dragstång med minsta massa gäller $\rho/\sigma_y$ när hållfastheten (ingen plasticering) är dimensionerande och $\rho/E$ när styvheten är det. $\rho/E^{1/2}$ och $\rho/\sigma_y^{2/3}$ är indexen för en lätt balk i böjning (styvhet respektive hållfasthet). Man väljer material med lägsta värde på indexet, vilket är samma sak som högsta $\sigma_y/\rho$.$kuggfri$, null, 39, true, $kuggfri$c97faddb2$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"$\\rho/\\sigma_y$","correct":true},{"text":"$\\rho/E$","correct":false},{"text":"$\\rho/E^{1/2}$","correct":false},{"text":"$\\rho/\\sigma_y^{2/3}$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 35, 37$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('23fbd209-9bc2-5c01-841f-42299750f3c9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$materialindex-latt-styv-balk$kuggfri$, $kuggfri$Lätt och styv balk i böjning (tvärsnittsarean fri): vilket materialindex ska minimeras?$kuggfri$, $kuggfri$För en lätt och styv balk i böjning är indexet $\rho/E^{1/2}$ (minimeras), dvs. välj material med högsta $E^{1/2}/\rho$. $\rho/E$ gäller en styv dragstång, $\rho/E^{1/3}$ en styv panel i böjning och $\rho/\sigma_y^{2/3}$ en balk där hållfastheten är dimensionerande.$kuggfri$, null, 40, true, $kuggfri$ce3b231e5$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"$\\rho/E^{1/2}$","correct":true},{"text":"$\\rho/E$","correct":false},{"text":"$\\rho/E^{1/3}$","correct":false},{"text":"$\\rho/\\sigma_y^{2/3}$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 35, 36; Canvas, Fo 7 Styvhet, s. 20$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('40e424cb-f98e-59c1-b52d-a23618a555f2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$harled-materialindex-dragstang$kuggfri$, $kuggfri$Härled materialindex för en lätt och stark dragstång med given längd L och last F.$kuggfri$, $kuggfri$Översättning: funktion dragstång; mål minsta massa; krav längden L given och stången får inte gå sönder (plasticera) under lasten F; fria variabler materialet och tvärsnittsarean A.

1. Massan: $m = A L \rho$
2. Kravet: $F/A \le \sigma_y$, dvs. minsta area $A = F/\sigma_y$
3. Eliminera A: $m = F L \,(\rho/\sigma_y)$

F och L är givna, så massan blir minst för det material som har lägst $\rho/\sigma_y$. Det är materialindexet.$kuggfri$, null, 41, true, $kuggfri$c93c9db51$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 37; Canvas, Ashby et al Materials 3 utgavan PRELIMINAR Lasanvisning och detaljerade larmal Kap 1-12, s. 4$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('bf4ddb26-ea98-529a-a250-f0104833d6fa', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$materialindex-lutning-bubbeldiagram$kuggfri$, $kuggfri$I ett diagram med $\log E$ mot $\log \rho$ ligger material med samma värde på $E^{1/2}/\rho$ på en linje. Vilken lutning har linjen?$kuggfri$, $kuggfri$Om $E^{1/2}/\rho = C$ blir $E = C^2\rho^2$, och med logaritmer $\log E = 2\log\rho + 2\log C$: en rät linje med lutningen 2. Alla material på linjen har samma indexvärde och är lika bra; material längre upp till vänster är bättre.$kuggfri$, null, 42, true, $kuggfri$cfdeae004$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"2","correct":true},{"text":"1","correct":false},{"text":"1/2","correct":false},{"text":"3","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 36; Canvas, Fo 7 Styvhet, s. 23$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('76ebd325-9294-56c4-9449-b0140ae81683', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$konceptdesign-materialdata$kuggfri$, $kuggfri$I konceptfasen av designen behövs detaljerade data för ett enda specifikt material.$kuggfri$, $kuggfri$I konceptdesign står alla material till förfogande och man använder data med låg precision, enkla egenskaper som är typiska för varje materialgrupp. I primärdesign jämförs ett fåtal material med mer detaljerade data, och först i detaljdesignen behövs välspecificerade data för ett material och en process.$kuggfri$, null, 43, true, $kuggfri$c90bf62ab$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 3, 8$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('cad2d06f-432d-5d94-b874-d03e48bca6b2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$paretoyta-materialval$kuggfri$, $kuggfri$Vad är en Paretoyta (paretodiagram) i materialval och när används den?$kuggfri$, $kuggfri$Den används när det finns en konflikt mellan önskemål (mål), t.ex. låg vikt och lågt pris, och det är oklart vilken parameter som är viktigast. Ett paretodiagram visar vilka alternativ som är de bästa kompromisserna mellan målen.$kuggfri$, null, 44, true, $kuggfri$c73e6beec$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, Kapitel_03 Materialval Repetition och Inlamningsuppgift, s. 24, 25$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('517f9739-82d8-5e3f-9e93-1e39778ce0b3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$materialindex-latt-stark-panel$kuggfri$, $kuggfri$Lätt och stark panel i böjning (längd och bredd givna, tjockleken fri): vilket materialindex ska minimeras?$kuggfri$, $kuggfri$För minsta massa hos en panel i böjning, där hållfastheten är dimensionerande och tjockleken är den fria variabeln, är indexet $\rho/\sigma_y^{1/2}$; välj material med lägst värde, dvs. högst $\sigma_y^{1/2}/\rho$. $\rho/\sigma_y^{2/3}$ gäller en balk med fri tvärsnittsarea, $\rho/\sigma_y$ en dragstång och $\rho/E^{1/3}$ en panel där styvheten är dimensionerande.$kuggfri$, null, 45, true, $kuggfri$ccc575c6b$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"$\\rho/\\sigma_y^{1/2}$","correct":true},{"text":"$\\rho/\\sigma_y^{2/3}$","correct":false},{"text":"$\\rho/\\sigma_y$","correct":false},{"text":"$\\rho/E^{1/3}$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 34, 35; Canvas, Ovning 4 m losningar, s. 4$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('ca73bc6f-d903-59de-af50-1042c8bf9408', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$materialindex-billig-stark-balk$kuggfri$, $kuggfri$Billig och stark balk i böjning (längd och last givna, tvärsnittsarean fri): vilket materialindex ska maximeras?$kuggfri$, $kuggfri$När målet är lägsta materialkostnad i stället för lägsta vikt ersätts densiteten $\rho$ med $C_m\rho$, där $C_m$ är materialkostnaden per kg: kostnaden är massan gånger kilopriset. $\sigma_y^{2/3}/\rho$ är indexet för en lätt och stark balk. $\sigma_y^{2/3}/C_m$ saknar densiteten, som behövs eftersom $C_m$ är pris per kilo. $\sigma_y/(C_m\rho)$ gäller en billig och stark dragstång.$kuggfri$, null, 46, true, $kuggfri$c9c244117$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"$\\sigma_y^{2/3}/(C_m\\rho)$","correct":true},{"text":"$\\sigma_y^{2/3}/\\rho$","correct":false},{"text":"$\\sigma_y^{2/3}/C_m$","correct":false},{"text":"$\\sigma_y/(C_m\\rho)$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 34, 35$kuggfri$, false, $kuggfri$Kortet underkänner distraktorn σy^(2/3)/Cm för att densiteten saknas, i linje med Kapitel_03 s. 34 (Cm gånger ρ). Kursens egna lösningar skriver kostnadsindex utan ρ (Övning 3 m lösningar s. 5 svar 10d och Materialval Flera mål s. 4), så en student som följer lösningarna kan välja distraktorn. Är lösningarna en förkortning eller ett fel, och ska kortet nämna det?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6bfe5830-d1f0-5013-b9dc-a1293e97129d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$materialindex-lutning-hallfast-balk$kuggfri$, $kuggfri$Material för en lätt och stark balk rangordnas med $\sigma_y^{2/3}/\rho$. Vilken lutning har linjer med konstant indexvärde i ett diagram med $\log\sigma_y$ mot $\log\rho$?$kuggfri$, $kuggfri$$\sigma_y^{2/3}/\rho = C$ ger $\sigma_y^{2/3} = C\rho$, alltså $\sigma_y = C^{3/2}\rho^{3/2}$ och $\log\sigma_y = 1{,}5\log\rho + 1{,}5\log C$: en rät linje med lutningen 1,5. Alla material på linjen är lika bra. Material ovanför linjen har högre $\sigma_y$ vid samma densitet, alltså högre indexvärde, och är bättre. Samma härledning ger lutningen 2 för $E^{1/2}/\rho$ i ett $E$–$\rho$-diagram.$kuggfri$, null, 47, true, $kuggfri$cc59f8752$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"1,5","correct":true},{"text":"2/3","correct":false},{"text":"2","correct":false},{"text":"1","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 35, 36$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3deb68ea-b73d-5698-9acc-40c2d0120ed6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$lastfall-identifiera-komponent$kuggfri$, $kuggfri$Vilka par av komponent och typiskt lastfall stämmer?$kuggfri$, $kuggfri$I översättningen beskrivs komponentens funktion som ett typiskt lastfall, eftersom lastfallet avgör vilket materialindex som gäller. Stänger tar upp draglaster, balkar böjmoment, axlar vridmoment och pelare trycklaster. I kursens övning är läskburken ett skal med inre tryck, luftledningen en dragstång och både vindkraftverksbladet och skosulan balkar i böjning.$kuggfri$, null, 48, true, $kuggfri$ce02aa81f$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Läskburk: skal med inre tryck","correct":true},{"text":"Luftledning för el: dragstång (ren dragbelastning)","correct":true},{"text":"Vindkraftverksblad: balk i böjning","correct":true},{"text":"Skosula: dragstång","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Ovning 3 m losningar, s. 1, 5; Canvas, Kapitel_03 Materialval, s. 33$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('b1024079-16ab-54d1-82bc-ab2c6f8893e5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$materialindex-tryckkarl-cylinder$kuggfri$, $kuggfri$Lätt tryckkärl: en cylinder med givet inre tryck och given radie, där väggtjockleken är fri, får inte plasticera. Vilket materialindex ska maximeras?$kuggfri$, $kuggfri$I kursens indextabell för hållfasthetsbegränsad design med minsta massa gäller $\sigma_y/\rho$ för en cylinder med inre tryck där trycket och radien är givna och väggtjockleken är fri. Väggen belastas i drag, och indexet blir detsamma som för en stark dragstång. $\sigma_y^{2/3}/\rho$ gäller en balk, $\sigma_y^{1/2}/\rho$ en panel i böjning och $E^{1/2}/\rho$ en styv balk.$kuggfri$, null, 49, true, $kuggfri$c600aa51d$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"$\\sigma_y/\\rho$","correct":true},{"text":"$\\sigma_y^{2/3}/\\rho$","correct":false},{"text":"$\\sigma_y^{1/2}/\\rho$","correct":false},{"text":"$E^{1/2}/\\rho$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Ovning 4 m losningar, s. 4; Canvas, Kapitel_03 Materialval, s. 35$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d9d8716e-85ab-5a79-81b7-f22cf55f9260', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'e2f719bb-f9eb-549f-acbb-a21921adb0bc', $kuggfri$materialval-taltstang-oversattning$kuggfri$, $kuggfri$Tältstängerna till ett fjälltält ska vara så lätta som möjligt. Gör en översättning och välj materialindex.$kuggfri$, $kuggfri$* **Funktion:** balk i böjning, styvhetsbegränsad
* **Krav:** användningstemperatur −30 till 50 °C, viss brottseghet (5 MPa√m), viss sträckgräns (50 MPa), viss E-modul (50 GPa), kunna formas till tunna rör
* **Mål:** låg vikt
* **Fria variabler:** tvärsnittsarea och material (metall eller komposit)

Materialindex: $M = E^{1/2}/\rho$, som maximeras (lätt och styv balk). Kraven används i sållningen och målet i rangordningen. Ska stängerna dessutom vara billiga blir det ett andra index, där $\rho$ ersätts med $C_m\rho$, och målkonflikten hanteras med ett paretodiagram.$kuggfri$, null, 50, true, $kuggfri$c98a7bfae$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, Materialval Flera mal, s. 2, 3, 4; Canvas, Kapitel_03 Materialval, s. 34, 35; Canvas, Kapitel_03 Materialval Repetition och Inlamningsuppgift, s. 24, 25$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('71baf9d6-ddeb-5b91-b705-dfb55d49290b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$vad-ar-skillnaden-mellan-kristallin-och$kuggfri$, $kuggfri$Vad är skillnaden mellan kristallin- och amorf mikrostruktur?$kuggfri$, $kuggfri$* Kristallin = ordnad struktur
  - Metaller, keramer, vissa polymerer
* Amorf = oordnad struktur
  - Polymerer, glas$kuggfri$, null, 51, true, $kuggfri$ca25bd769$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('71bc6e75-1c5f-580e-ab9e-43cdbb002348', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$vad-ar-en-enhetscell-namn-minst-tva$kuggfri$, $kuggfri$Vad är en enhetscell? Nämn minst två olika typer av enhetsceller.$kuggfri$, $kuggfri$* En liten volym som kan beskriva hela kristallen
* I varje punkt sitter det en atom eller molekyl
* Sex parametrar: 3 längder, 3 vinklar

Ex: FCC (Face Centered Cubic), BCC (Body Centered Cubic), Triclinic, Simple Cubic, Close-Packed Hexagonal.$kuggfri$, null, 52, true, $kuggfri$c5e06cd5c$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('488e66a6-cc96-548e-b7d8-bf2bf19fe9fe', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$vad-kannetecknar-enhetscellen-fcc$kuggfri$, $kuggfri$Vad kännetecknar enhetscellen: "FCC"?$kuggfri$, $kuggfri$![Enhetscellerna BCC, FCC och HCP med packningsgrad 0,68, 0,74 och 0,74](/kort/materialteknik/enhetsceller-bcc-fcc-hcp.svg)

* Face centered cubic
* Ytcentrerad kubisk
* Ex: Al, Cu, Ni, Au, Ag, austenitiskt rostfritt stål (austenit = FCC-järn)
* Kantlängd a, vinkel 90 grader
* Tätpackad ytdiagonal
* Tätpackad struktur: packningsgrad 0,74, staplingsföljd ABCABC$kuggfri$, null, 53, true, $kuggfri$ce5a4fd50$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "rostfritt stål" som exempel gäller bara austenitiskt rostfritt stål, eftersom det även finns ferritiska och martensitiska rostfria stål; packningsgrad tillagd; Canvas, GLU 01 Kristallstrukturer, s. 11, 13, 15; Canvas, Fo 12 Stal, s. 28; Canvas, Short_dictionary_ v2026, s. 2$kuggfri$, true, $kuggfri$Rättelse av originalkortet: exemplet "Rostfritt stål" är ändrat till "austenitiskt rostfritt stål", eftersom ferritiska och martensitiska rostfria stål inte är FCC (Fö 12 Stål s. 28); packningsgrad 0,74 och ABCABC är tillagda (GLU 01 s. 11). GLU 01 2026 s. 15 skriver själv bara "Rostfritt stål". Godkänns preciseringen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('e0c74db4-eaf6-56f1-940d-2d603cf7e3fd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$vad-kannetecknar-enhetscellen-bcc$kuggfri$, $kuggfri$Vad kännetecknar enhetscellen: "BCC"?$kuggfri$, $kuggfri$![Enhetscellerna BCC, FCC och HCP med packningsgrad 0,68, 0,74 och 0,74](/kort/materialteknik/enhetsceller-bcc-fcc-hcp.svg)

* Body centered cubic
* Rymdcentrerad kubisk
* Ex: Fe (ferrit, $\alpha$-järn) från rumstemperatur upp till ca 913 °C; däröver är järnet FCC (austenit). Nära smältpunkten (1394–1538 °C) är järnet åter BCC, $\delta$-ferrit.
* Kantlängd a, vinkel 90 grader
* Tätpackad rymddiagonal
* Inte tätpackad struktur: packningsgrad 0,68$kuggfri$, null, 54, true, $kuggfri$cce3e0250$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "Ex: Fe" angavs utan temperatur, men järn är BCC (ferrit) bara upp till ca 913 °C och därefter FCC (austenit); packningsgrad tillagd; Canvas, GLU 01 Kristallstrukturer, s. 2, 12, 13, 16; Canvas, Short_dictionary_ v2026, s. 6; Canvas, Lab_PM_M2_v2026, s. 4$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "Ex: Fe" har fått temperaturgränser (BCC upp till ca 913 °C, FCC däröver och BCC igen som δ-ferrit mellan 1394 och 1538 °C) och packningsgrad 0,68. Kursmaterialet anger omvandlingen till 913 °C (GLU 01 s. 2), 912 °C (Lab_PM_M2_v2026 s. 4) och 910 °C (Fö 4 2025 s. 14). Godkänns rättelsen, och vilken temperatur ska korten använda?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('affc638b-908b-5e1c-ba33-b645f4bb8fa3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$det-finns-olika-typer-av-hal-i$kuggfri$, $kuggfri$Det finns olika typer av hål i kristallstrukturer, vad innebär detta?$kuggfri$, $kuggfri$* Mellan atomerna finns
hålrum med olika form
och storlek
* Avgör om små atomer
kan lösas in i
materialet (ex. C i Fe)$kuggfri$, null, 55, true, $kuggfri$c0ae0eb91$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('05549803-b3c4-5c64-9b20-5bb35005788b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$millerindex-beskriv-kortfattat-vad-det$kuggfri$, $kuggfri$Millerindex: Beskriv kortfattat vad det är och hur det tas fram.$kuggfri$, $kuggfri$![Planen (100), (110) och (111) markerade i var sin kub med axlarna x, y och z](/kort/materialteknik/millerindex-plan.svg)

Millerindex beskriver ett atomplans orientering i kristallen (jämför med planets normal). Enhetscellen definierar koordinatsystemet. Så tas planets index fram:
1. Bestäm planets skärningar med koordinataxlarna
2. Invertera
3. Gör heltalig → Millerindex (hkl)

(hkl) = specifikt plan
{hkl} = familj av plan

Riktningar beskrivs med riktningsvektorer i samma koordinatsystem, omvandlade till heltal (bara riktningen spelar roll, inte längden). I GLU 1 kallas de "Millerindex för riktningar", även kallat riktningsindex:
[hkl] = specifik riktning
\<hkl> = familj av riktningar

![Riktningarna 100, 110 och 111 som pilar från origo i var sin kub](/kort/materialteknik/millerindex-riktningar.svg)$kuggfri$, null, 56, true, $kuggfri$c08013d0a$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet påstod att riktningsindex inte kallas Millerindex, men GLU 1 2026 kallar dem "Millerindex för riktningar"; kortet beskrev också planets position i stället för orientering; Canvas, GLU 01 Kristallstrukturer, s. 19, 20$kuggfri$, true, $kuggfri$Rättelse av originalkortet: påståendet att riktningar "inte längre kallas Millerindex" är struket eftersom GLU 01 s. 20 har rubriken "Millerindex för riktningar", "planets position" är ändrat till orientering (GLU 01 s. 19) och meningen om origo i ett hörn är borttagen. Lärandemålen (GLU 01 s. 1, Fö 3 2025) och flera tentor skiljer dock på "riktningsindex" och "Miller-index". Vilken benämning ska kortet använda?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('eaa580ff-ee2d-5af3-b2b2-7bc74bd0971f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$kristallin$kuggfri$, $kuggfri$Kristallin$kuggfri$, $kuggfri$Atomer eller molekyler som sitter i en ordnad struktur.$kuggfri$, null, 57, true, $kuggfri$c508d9b78$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('11b32f49-60f5-5226-9df2-54ce6a5fed20', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$quiz-kristaller-nar-man-beskriver-plan-och$kuggfri$, $kuggfri$Vilka beteckningar anger ett specifikt atomplan eller en specifik riktning i en kristall?$kuggfri$, $kuggfri$(hkl) betecknar ett specifikt plan och [hkl] en specifik riktning. {hkl} betecknar en familj av plan, och \<hkl> en familj av riktningar.$kuggfri$, null, 58, true, $kuggfri$c42f0d700$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"(hkl)","correct":true},{"text":"[hkl]","correct":true},{"text":"{hkl}","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 2, fråga 1; Canvas, GLU 01 Kristallstrukturer, s. 19, 20$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('206fab61-c555-516f-b815-16e0bc52d222', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$quiz-kristallina-eller-amorfa-material-tva$kuggfri$, $kuggfri$Kristallina och amorfa material: vilka påståenden är sanna?$kuggfri$, $kuggfri$De flesta metaller är kristallina, med ett regelbundet upprepat mönster av atomer. Glas är amorft (amorf kiseldioxid är basen i de flesta glas), medan keramer i övrigt oftast är kristallina. Polymerer finns både som amorfa och som kristallina (vissa polymerer). Quizens alternativ "Metaller är alltid kristallina" är ändrat till "i regel", eftersom GLU 1 skriver "de flesta metaller".$kuggfri$, null, 59, true, $kuggfri$c841ba05f$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Metaller är i regel kristallina.","correct":true},{"text":"Kristallglas är den enda typen av glas som är kristallin.","correct":false},{"text":"Polymerer kan vara både amorfa och kristallina.","correct":true},{"text":"Alla keramer förutom glas är amorfa.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 2, fråga 2; Canvas, GLU 01 Kristallstrukturer, s. 11; Canvas, Fo 3 Kristallstruktur, s. 13; Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 17; Canvas, Kapitel_04 Elastisk deformation, s. 40$kuggfri$, false, $kuggfri$Quizens rätta alternativ "Metaller är alltid kristallina" är ändrat till "Metaller är i regel kristallina", eftersom GLU 01 s. 11 skriver "de flesta metaller är kristallina". Godkänns ändringen, och ska Quiz vecka 2 fråga 2 ändras likadant?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('098b516f-8838-56e5-ad6a-4133a392b2a0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$quiz-kristaller-och-enhetsceller-tva-ratt$kuggfri$, $kuggfri$Kristaller och enhetsceller: vilka påståenden är sanna?$kuggfri$, $kuggfri$Tätpackade plan är viktiga för att glidplanen, där dislokationer rör sig vid plastisk deformation, är de mest tätpackade planen. En enhetscell är en modell: den minsta volym som, upprepad i rummet, beskriver hela kristallen. Amorfa material saknar ordnad struktur (ingen fjärrordning) och beskrivs därför inte med enhetsceller. FCC har packningsgraden 0,74 och är tätpackad, BCC har 0,68. Quizens alternativ "Enhetsceller ... finns inte i verkligheten" är omformulerat efter föreläsningens definition, som inte säger så.$kuggfri$, null, 60, true, $kuggfri$cfda28357$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Tätpackade atomplan är viktiga eftersom det är där materialet spricker.","correct":false},{"text":"Enhetscellen är ett sätt att beskriva en kristall: den minsta volym som kan beskriva hela kristallen.","correct":true},{"text":"För att beskriva ett amorft material behövs speciella enhetsceller med fler atomer.","correct":false},{"text":"FCC-strukturen är tätpackad men inte BCC-strukturen.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 2, fråga 3; Canvas, GLU 01 Kristallstrukturer, s. 10, 11, 12; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 28; Canvas, Short_dictionary_ v2026, s. 1$kuggfri$, false, $kuggfri$Quizens rätta alternativ "Enhetsceller är ett sätt att beskriva kristaller, men finns inte i verkligheten" är omskrivet till GLU 01 s. 10:s definition, den minsta volym som kan beskriva hela kristallen, eftersom kursmaterialet inte säger att enhetsceller inte finns i verkligheten. Godkänns omskrivningen, och ska Quiz vecka 2 fråga 3 ändras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c472c5d1-62bf-5fa9-a2bf-8c27395c4616', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$tatpackade-strukturer-fcc-hcp$kuggfri$, $kuggfri$Vilka strukturer är tätpackade (packningsgrad 0,74)?$kuggfri$, $kuggfri$![Enhetscellerna BCC, FCC och HCP med packningsgrad 0,68, 0,74 och 0,74](/kort/materialteknik/enhetsceller-bcc-fcc-hcp.svg)

FCC och HCP är båda tätpackade med packningsgraden 0,74; de skiljer sig i staplingsföljden av de tätpackade skikten (ABCABC för FCC, ABAB för HCP). BCC har packningsgraden 0,68 och en amorf struktur högst 0,64.$kuggfri$, null, 61, true, $kuggfri$cf3d730a2$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"FCC","correct":true},{"text":"HCP","correct":true},{"text":"BCC","correct":false},{"text":"Amorf struktur","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 11, 12; Canvas, Kapitel_04 Elastisk deformation, s. 37$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('f427d509-8766-5146-9af2-585dc946747b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$staplingsfoljd-abcabc$kuggfri$, $kuggfri$Tätpackade atomskikt staplas i följden ABCABC. Vilken struktur ger det?$kuggfri$, $kuggfri$Staplingsföljden ABCABC ger FCC och ABAB ger HCP; båda är tätpackade med packningsgraden 0,74. BCC har en ABAB-följd av skikt som inte är fullt tätpackade (packningsgrad 0,68), och en amorf struktur saknar regelbunden stapling.$kuggfri$, null, 62, true, $kuggfri$c7a510e34$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"FCC","correct":true},{"text":"HCP","correct":false},{"text":"BCC","correct":false},{"text":"Amorf struktur","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 11, 12$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1115db9a-30f5-5ce7-bb8a-aebc23c81397', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$mikroskopi-lom-sem-tem$kuggfri$, $kuggfri$Vilka påståenden om mikroskopi av metaller stämmer?$kuggfri$, $kuggfri$Optiskt mikroskop används för att studera mikrostrukturen på kapade, slipade, polerade och etsade prover. SEM ger större skärpedjup och mycket högre förstoring och används t.ex. för brottytor. I TEM undersöker man bara en liten tunn skiva, och där syns dislokationer.$kuggfri$, null, 63, true, $kuggfri$c88637469$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"I transmissionselektronmikroskop (TEM) blir dislokationer synliga eftersom gittret är lokalt deformerat.","correct":true},{"text":"I optiskt mikroskop studeras plana, polerade och etsade prover, där t.ex. korngränser och porer syns.","correct":true},{"text":"I TEM undersöker man hela komponenter utan provberedning.","correct":false},{"text":"Svepelektronmikroskop (SEM) har mindre skärpedjup och lägre förstoring än optiskt mikroskop.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 7, 8, 9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d5ed15a7-54b9-5dbb-a152-1d26fbb48d08', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$e-modul-enkristall-riktningsberoende$kuggfri$, $kuggfri$En enkristall har samma E-modul i alla kristallriktningar.$kuggfri$, $kuggfri$E-modulen är riktningsberoende: en enkristall har olika styvhet i olika kristallografiska riktningar. I en polykristall med slumpmässigt orienterade korn jämnas det ut, så att styvheten blir i medeltal isotrop.$kuggfri$, null, 64, true, $kuggfri$c642a5f96$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 21; Canvas, Kapitel_04 Elastisk deformation, s. 12$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('9d97bfc8-3792-568e-87aa-24834ac6ac79', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$millerindex-berakna-plan$kuggfri$, $kuggfri$Ett plan skär x-axeln i 1/2, y-axeln i 1 och är parallellt med z-axeln. Vilket Millerindex har planet?$kuggfri$, $kuggfri$Skärningarna är 1/2, 1 och ∞ (parallellt med z). Inverterade blir de 2, 1 och 0, som redan är heltal, så planet är (210). (120) är i stället planet som skär x-axeln i 1 och y-axeln i 1/2, dvs. x och y omkastade.$kuggfri$, null, 65, true, $kuggfri$c2d82bd1e$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"(210)","correct":true},{"text":"(120)","correct":false},{"text":"(100)","correct":false},{"text":"(021)","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 19$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3c0c8fcc-f235-5abb-9942-81114bd817e0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$riktningsindex-berakna$kuggfri$, $kuggfri$En riktning går från origo till punkten (1/2, 1, 0) i enhetscellen. Vilket riktningsindex har den?$kuggfri$, $kuggfri$Riktningsvektorn är (1/2, 1, 0). Riktningar omvandlas alltid till heltal, eftersom bara riktningen spelar roll och inte längden: multiplicera med 2 och riktningen blir [120]. Till skillnad från Millerindex för plan inverteras komponenterna inte.$kuggfri$, null, 66, true, $kuggfri$cd64b2b9d$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"[120]","correct":true},{"text":"[210]","correct":false},{"text":"[110]","correct":false},{"text":"[021]","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 20$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('bb5da455-f004-5bb7-85fc-32070b20f01e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$millerindex-markerat-plan-110$kuggfri$, $kuggfri$Vilket Millerindex har det markerade planet? ![Kub med axlarna x, y och z och ett markerat plan som skär x- och y-axeln i 1 och är parallellt med z-axeln](/kort/materialteknik/millerindex-fraga-plan-1.svg)$kuggfri$, $kuggfri$Planet skär x-axeln i 1 och y-axeln i 1 och är parallellt med z-axeln (skärningen ∞). Inverterat blir det 1, 1 och 0, alltså (110). (100) är kubens främre yta (x = 1), (111) skär alla tre axlarna i 1, och (001) skär bara z-axeln (kubens översida).$kuggfri$, null, 67, true, $kuggfri$cdc41bdfe$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"(110)","correct":true},{"text":"(100)","correct":false},{"text":"(111)","correct":false},{"text":"(001)","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 19$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('fb0d2790-7571-5169-a529-5279e5a158d8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$millerindex-markerat-plan-111$kuggfri$, $kuggfri$Planet i kuben skär koordinataxlarna. Vilket Millerindex har det? ![Kub med axlarna x, y och z och ett markerat plan som skär alla tre axlarna i 1](/kort/materialteknik/millerindex-fraga-plan-2.svg)$kuggfri$, $kuggfri$Planet skär x-, y- och z-axeln i 1. Inverterat blir det 1, 1 och 1, alltså (111). (110) är parallellt med z-axeln, (100) är parallellt med både y- och z-axeln och (001) med både x- och y-axeln.$kuggfri$, null, 68, true, $kuggfri$c652bf72f$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"(111)","correct":true},{"text":"(110)","correct":false},{"text":"(100)","correct":false},{"text":"(001)","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 19$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('97311851-2026-5bae-b02e-f8df30a36cb8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$riktningsindex-markerad-110$kuggfri$, $kuggfri$Vilket riktningsindex har den markerade riktningen? ![Kub med axlarna x, y och z och en pil från origo till hörnet (1, 1, 0)](/kort/materialteknik/millerindex-fraga-riktning-1.svg)$kuggfri$, $kuggfri$Pilen går från origo till hörnet (1, 1, 0), diagonalt över kubens undersida, så riktningen är [110]. [111] är rymddiagonalen till (1, 1, 1), [100] går längs x-axeln och [011] är diagonalen i kubens bakre yta x = 0, till (0, 1, 1).$kuggfri$, null, 69, true, $kuggfri$c3d6eccad$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"[110]","correct":true},{"text":"[111]","correct":false},{"text":"[100]","correct":false},{"text":"[011]","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 20$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('536504fc-81a6-5bda-89ed-e403c464175d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$vad-kannetecknar-enhetscellen-hcp$kuggfri$, $kuggfri$Vad kännetecknar enhetscellen: "HCP"?$kuggfri$, $kuggfri$![Enhetscellerna BCC, FCC och HCP med packningsgrad 0,68, 0,74 och 0,74](/kort/materialteknik/enhetsceller-bcc-fcc-hcp.svg)

* Hexagonal close packed (HCP, även CPH)
* Tätpackad hexagonal
* Ritas som ett sexkantigt prisma med en atom i varje hörn, en mitt på varje sexkantig yta och tre i mittskiktet; prismat innehåller egentligen tre enhetsceller
* Tätpackad struktur: packningsgrad 0,74, samma som FCC, men de tätpackade skikten staplas ABAB (FCC: ABCABC)
* Få glidsystem, så HCP-metaller är svårare att deformera plastiskt än FCC-metaller
* Ex: Mg, Ti, Zn$kuggfri$, null, 70, true, $kuggfri$c52b75a5d$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 11, 13, 17; Canvas, Guided Learning Unit 1, s. 4 (GL1-4); Canvas, Fo 12 Stal, s. 2; Canvas, Fo 13 Aluminium och andra metaller, s. 11$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('3634426d-860b-55ae-8622-7319de06bf81', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$enhetscell-kanna-igen-bcc$kuggfri$, $kuggfri$Vilken av enhetscellerna är BCC (rymdcentrerad kubisk)? ![Tre omärkta enhetsceller märkta A, B och C](/kort/materialteknik/enhetsceller-omarkerade.svg)$kuggfri$, $kuggfri$C har en atom i varje hörn och en i kubens mitt: rymdcentrerad kubisk (BCC), där atomerna ligger tätt längs rymddiagonalen. A har atomer i hörnen och mitt på varje sidoyta: ytcentrerad kubisk (FCC). B är det sexkantiga prismat: tätpackad hexagonal (HCP). Lätt att blanda ihop: ytcentrerad = FCC, rymdcentrerad = BCC.$kuggfri$, null, 71, true, $kuggfri$c0c011519$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"A","correct":false},{"text":"B","correct":false},{"text":"C","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 12, 13, 15, 16, 17; Canvas, Guided Learning Unit 1, s. 4, 5 (GL1-4, GL1-5)$kuggfri$, false, $kuggfri$Kortet visar tre omärkta enhetsceller i en egen figur och frågar vilken som är BCC, vilket är samma uppgiftstyp som tentan 2024-01 uppg. 11 (namnge tre enhetsceller i en figur) och liknar 2025-10-30 uppg. 2a. Ligger kortet för nära tentan?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('23435d0b-4db9-5e48-bc2e-d5531ce49476', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$millerindex-negativt-index$kuggfri$, $kuggfri$Ett plan skär x-axeln i 1 och y-axeln i −1/2 och är parallellt med z-axeln. Vilket Millerindex har planet?$kuggfri$, $kuggfri$Skärningarna är 1, −1/2 och ∞. Inverterat blir det 1, −2 och 0, som redan är heltal. Ett negativt index skrivs med ett streck över siffran: $(1\bar{2}0)$. $(120)$ har tappat minustecknet, $(2\bar{1}0)$ fås om man gör x- och y-skärningarna (1 och −1/2) heltaliga utan att invertera dem, och $(1\bar{1}0)$ är planet som skär y-axeln i −1.$kuggfri$, null, 72, true, $kuggfri$cc1bbd1fd$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"$(1\\bar{2}0)$","correct":true},{"text":"$(120)$","correct":false},{"text":"$(2\\bar{1}0)$","correct":false},{"text":"$(1\\bar{1}0)$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 19; Canvas, Guided Learning Unit 1, s. 11 (GL1-11)$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('41ed46ac-d4ce-580d-bd85-13217d7dc58b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$millerindex-plan-genom-origo$kuggfri$, $kuggfri$Hur bestämmer man Millerindex för ett plan som går genom origo?$kuggfri$, $kuggfri$Ett plan genom origo skär axlarna i 0, och 1/0 går inte att invertera. Flytta därför planet en cellängd längs en axel (eller, likvärdigt, flytta origo till ett annat hörn av enhetscellen) så att planet inte går genom origo. Läs sedan av skärningarna, invertera och gör heltaligt som vanligt. En skärning på en axels negativa del ger ett negativt index, som skrivs med streck över siffran.

Exempel: diagonalplanet som innehåller x-axeln (y = z = 0) och den motsatta kanten (y = z = 1). Med origo flyttat till hörnet (0, 0, 1) är planet parallellt med x-axeln, skär y-axeln i 1 och z-axeln i −1. Inverterat blir det 0, 1 och −1, alltså $(01\bar{1})$.$kuggfri$, null, 73, true, $kuggfri$c6c7ac93e$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, Guided Learning Unit 1, s. 11, 19 (GL1-11, GL1-24); Canvas, GLU 01 Kristallstrukturer, s. 19$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6c33c986-4861-5ba1-9930-760bcaf786ab', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$millerindex-fran-index-till-plan$kuggfri$, $kuggfri$Planet $(213)$ i en kubisk enhetscell: var skär det axlarna?$kuggfri$, $kuggfri$Gå baklänges genom metoden: invertera indexen 2, 1 och 3 till skärningarna 1/2, 1 och 1/3, och rita planet genom de tre punkterna. Kontroll: inverteras skärningarna igen blir det 2, 1 och 3, alltså $(213)$. Att bara ta indexen som skärningar (2, 1, 3) glömmer inverteringen, och de två sista alternativen har bytt plats på axlarna. Ett index 0 betyder att planet är parallellt med den axeln.$kuggfri$, null, 74, true, $kuggfri$c14f053ee$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"x = 1/2, y = 1, z = 1/3","correct":true},{"text":"x = 2, y = 1, z = 3","correct":false},{"text":"x = 1/2, y = 1/3, z = 1","correct":false},{"text":"x = 1/3, y = 1, z = 1/2","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 19; Canvas, Guided Learning Unit 1, s. 11 (GL1-11)$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2fbac623-0511-5e5a-92ff-ad9739f772ec', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$riktningsindex-mellan-tva-punkter$kuggfri$, $kuggfri$En riktning går från punkten (0, 1, 1) till punkten (1, 1/2, 0) i enhetscellen. Vilket riktningsindex har den?$kuggfri$, $kuggfri$En riktning flyttas så att den börjar i origo, vilket är samma sak som att ta slutpunkten minus startpunkten: (1 − 0, 1/2 − 1, 0 − 1) = (1, −1/2, −1). Multiplicera med 2 för att få heltal: $[2\bar{1}\bar{2}]$. $[212]$ har tappat minustecknen, $[210]$ fås om man bara tar slutpunkten som om riktningen började i origo, och $[1\bar{2}\bar{1}]$ fås om man inverterar komponenterna som för ett plan; riktningar inverteras inte.$kuggfri$, null, 75, true, $kuggfri$cfe22f082$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"$[2\\bar{1}\\bar{2}]$","correct":true},{"text":"$[212]$","correct":false},{"text":"$[210]$","correct":false},{"text":"$[1\\bar{2}\\bar{1}]$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 20; Canvas, Guided Learning Unit 1, s. 13 (GL1-13)$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('15b9a93e-8dde-581f-b992-bf1cda08d494', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$riktningsfamilj-111$kuggfri$, $kuggfri$Vilka riktningar i en kubisk enhetscell hör till riktningsfamiljen $\langle 111\rangle$?$kuggfri$, $kuggfri$![Riktningarna 100, 110 och 111 som pilar från origo i var sin kub](/kort/materialteknik/millerindex-riktningar.svg)

$[hkl]$ är en specifik riktning och $\langle hkl\rangle$ en familj av likvärdiga riktningar. $\langle 111\rangle$ är rymddiagonalerna, t.ex. $[111]$, $[\bar{1}11]$, $[1\bar{1}1]$ och $[11\bar{1}]$ (och de motsatta riktningarna). Kubens kanter hör till $\langle 100\rangle$, dvs. $[100]$, $[010]$ och $[001]$, och ytdiagonalerna till $\langle 110\rangle$.$kuggfri$, null, 76, true, $kuggfri$c400f63d9$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Kubens rymddiagonaler, från ett hörn genom kubens mitt till det motsatta hörnet","correct":true},{"text":"Kubens kanter","correct":false},{"text":"Diagonalerna i kubens sidoytor","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 20; Canvas, Guided Learning Unit 1, s. 13 (GL1-13)$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('9d3cfd57-9baf-5bd4-817c-bf5948f6df0b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$planfamilj-100$kuggfri$, $kuggfri$Vilka plan hör till planfamiljen $\{100\}$ i en kubisk enhetscell?$kuggfri$, $kuggfri$![Planen (100), (110) och (111) markerade i var sin kub med axlarna x, y och z](/kort/materialteknik/millerindex-plan.svg)

$(hkl)$ är ett specifikt plan och $\{hkl\}$ en familj av likvärdiga plan. I en kub är sidoytorna likvärdiga, så $\{100\}$ omfattar $(100)$, $(010)$ och $(001)$ och motsvarande plan med negativa index. Diagonalplanen hör till $\{110\}$ och planen som skär alla tre axlarna i 1 till $\{111\}$.$kuggfri$, null, 77, true, $kuggfri$ca59fce4e$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Kubens sidoytor: $(100)$, $(010)$ och $(001)$ och de parallella ytorna på motsatt sida","correct":true},{"text":"Diagonalplanen genom två motstående kanter, t.ex. $(110)$","correct":false},{"text":"Planen som skär alla tre axlarna i 1, t.ex. $(111)$","correct":false},{"text":"Bara planet $(100)$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 19; Canvas, Guided Learning Unit 1, s. 11, 12 (GL1-11, GL1-12)$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('265dc13c-684c-5216-b10b-16b2bc4440c9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'd63240aa-9a49-52d8-8170-a0180269bc83', $kuggfri$bcc-gitterparameter-atomradie$kuggfri$, $kuggfri$En metall med BCC-struktur har atomradien r = 0,125 nm. Hur stor är gitterparametern (kantlängden) a?$kuggfri$, $kuggfri$I BCC ligger atomerna tätt längs rymddiagonalen, som är $a\sqrt{3}$ lång och rymmer fyra atomradier: $4r = a\sqrt{3}$, så $a = 4r/\sqrt{3} = 0{,}500/1{,}732 \approx 0{,}289$ nm. 0,354 nm fås med FCC:s samband $4r = a\sqrt{2}$ (tätpackad ytdiagonal), 0,250 nm om atomerna antas ligga tätt längs kanten ($a = 2r$) och 0,866 nm om man multiplicerar med $\sqrt{3}$ i stället för att dividera.$kuggfri$, null, 78, true, $kuggfri$cab15a51d$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 0,289 nm","correct":true},{"text":"Ca 0,354 nm","correct":false},{"text":"Ca 0,250 nm","correct":false},{"text":"Ca 0,866 nm","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 01 Kristallstrukturer, s. 15, 16; Canvas, Guided Learning Unit 1, s. 5 (GL1-5); Canvas, Ovning 2 GLU with corrections, s. 1$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('37e85615-60cb-5f0b-aad8-3c081af15a0f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$vad-ar-ett-fasdiagram-och-vad-anvands$kuggfri$, $kuggfri$Vad är ett fasdiagram och vad används det till?$kuggfri$, $kuggfri$Ett fasdiagram visar vilka faser som är stabila vid vilka specifika temperaturer och sammansättningar av de ingående metallerna i en legering (även tryck m.m.). Gäller vid långsamma förlopp så att utjämning av koncentrationsskillnader kan ske m.h.a. diffusion = jämvikt uppnås.$kuggfri$, null, 79, true, $kuggfri$ce27f51b8$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('b7f718c4-fd46-589a-b120-4292ac949dfc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$vad-ar-ferrit-och-nar-uppstar-det$kuggfri$, $kuggfri$Vad är Ferrit och när uppstår det?$kuggfri$, $kuggfri$![Järns unära fasdiagram med ferrit, austenit, delta-ferrit, smälta och ånga](/kort/materialteknik/jarn-unart-fasdiagram.svg)

Ferrit ($\alpha$-järn) är järn med BCC-struktur. I rent järn är det den stabila fasen upp till ca 913 °C. Ferrit har låg löslighet av kol.

Över ca 1394 °C blir rent järn BCC igen, då kallat $\delta$-ferrit.

Figuren följer Lab-PM:ets fasdiagram (912 °C); GLU 02 anger 913 °C.$kuggfri$, null, 80, true, $kuggfri$c77d4bbdf$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: temperaturen följer nu 2026 års material och δ-ferriten nämns, så att "upp till 910 °C" inte läses som enda BCC-området; Canvas, GLU 02 Fasdiagram, s. 4; Canvas, Lab_PM_M2_v2026, s. 4; Canvas, Fo 4 Fasdiagram, s. 14$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "rent järn upp till 910 °C" (Fö 4 2025 s. 14) är ändrat till ca 913 °C (GLU 02 s. 4), och δ-ferriten över ca 1394 °C är tillagd efter Lab-PM:ets fasdiagram, som visar 912 °C (Lab_PM_M2_v2026 s. 4); kortet förklarar själv skillnaden. Godkänns rättelsen, och ska korten ange 910, 912 eller 913 °C?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('b75e3374-5e46-5d9c-8da7-6108d70dec27', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$vad-ar-austenit-och-nar-uppstar-det$kuggfri$, $kuggfri$Vad är Austenit och när uppstår det?$kuggfri$, $kuggfri$![Järns unära fasdiagram med ferrit, austenit, delta-ferrit, smälta och ånga](/kort/materialteknik/jarn-unart-fasdiagram.svg)

Austenit ($\gamma$-järn) är järn med FCC-struktur. I rent järn är det den stabila fasen mellan ca 913 °C och ca 1394 °C. Austenit kan lösa upp till ca 2,1 % kol.

Figuren följer Lab-PM:ets fasdiagram (912 °C); GLU 02 anger 913 °C.$kuggfri$, null, 81, true, $kuggfri$cbb49c762$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "upp över 910 °C" gällde inte över ca 1394 °C, där rent järn blir delta-ferrit (BCC); Canvas, GLU 02 Fasdiagram, s. 4; Canvas, Lab_PM_M2_v2026, s. 4; Canvas, Fo 4 Fasdiagram, s. 14$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "rent järn upp över 910 °C" gällde inte över ca 1394 °C där järnet blir δ-ferrit, så kortet anger nu austenit mellan ca 913 °C (GLU 02 s. 4) och ca 1394 °C (Lab_PM_M2_v2026 s. 4); lösligheten ca 2,1 % C står kvar från Fö 4 s. 14. Figuren visar 912 °C. Godkänns rättelsen och temperaturen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('98158a2f-4921-5d45-87ce-a327352ae79f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$vad-ar-cementit-och-nar-uppstar-det$kuggfri$, $kuggfri$Vad är cementit och när uppstår det?$kuggfri$, $kuggfri$Cementit, Fe₃C, intermediär fas, 6,67 % C, mycket hård$kuggfri$, null, 82, true, $kuggfri$c65098bbb$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true, $kuggfri$Kortet kallar cementit en "intermediär fas" som Fö 12 Stål s. 17, men GLU 02 s. 18 och kortet intermetall använder intermediär för faser med brett sammansättningsintervall, och Fe3C har exakt sammansättning (6,67 % C). Baksidan säger dessutom inte när cementit uppstår, trots att frågan gäller det. Vilken term ska kortet använda, och ska baksidan kompletteras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3b439075-5235-5d41-804f-c8306d0daaf4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$metastabil$kuggfri$, $kuggfri$Metastabil$kuggfri$, $kuggfri$Ett tillstånd i ett lokalt energiminimum. För att uppnå tillståndet med lägst energi (stabilt) måste en energibarriär övervinnas genom tillförsel av termisk energi. Fasen har högre Gibbs fria energi men antar spontant inte den mer stabila fasen.$kuggfri$, null, 83, true, $kuggfri$c9be8fcfa$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('7c74f111-e32c-5294-a214-27bd32c6695f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$intermetall$kuggfri$, $kuggfri$Intermetall$kuggfri$, $kuggfri$En mellanliggande fas i fasdiagrammet som bara består av metaller (minst två). Den har exakt eller nära stökiometrisk sammansättning, t.ex. CuAl₂ i Al-Cu, och syns som ett smalt enfasområde. Mellanliggande faser med ett bredare sammansättningsintervall kallas intermediära faser.$kuggfri$, null, 84, true, $kuggfri$c866ad670$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Rättelse: definitionen var otydlig och saknade att fasen har (nära) stökiometrisk sammansättning; Canvas, GLU 02 Fasdiagram, s. 18, 21; Canvas, Fo 4 Fasdiagram, s. 13$kuggfri$, true, $kuggfri$Rättelse av originalkortet: definitionen har fått tillägget att fasen har exakt eller nära stökiometrisk sammansättning och att faser med bredare intervall kallas intermediära (GLU 02 s. 18). Fö 4 Fasdiagram 2025 s. 13 använder i stället intermediär fas som samlingsnamn och säger att en intermetallisk fas kan ha ett intervall, och cementitkortet kallar den stökiometriska Fe3C för intermediär fas. Vilken definition ska gälla?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('33f94e1a-b83d-5559-8184-a4a14ee15928', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$eutektikum$kuggfri$, $kuggfri$Eutektikum$kuggfri$, $kuggfri$En strukturbeståndsdel som består av två faser. Eutektikum bildas vid konstant temperatur
och koncentration genom en trefasreaktion där en smält fas L bildar två fasta faser: L → alpha + beta$kuggfri$, null, 85, true, $kuggfri$c41514b8f$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('487cb6ba-20b9-586c-a857-b0e2025341c0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$ja-nej-perlit-bildas-vid-en-eutektisk$kuggfri$, $kuggfri$Perlit bildas vid en eutektisk reaktion ur smälta.$kuggfri$, $kuggfri$![Förenklat Fe–C-diagram för stål med den eutektoida punkten S vid ca 0,8 % C och ca 723 °C](/kort/materialteknik/fe-c-stalhornet.svg)

Perlit bildas vid den eutektoida reaktionen, som sker i fast fas: austenit omvandlas till ferrit och cementit vid ca 0,8 % C och ca 723 °C. En eutektisk reaktion utgår från smälta ($L \to \alpha + \beta$); i Fe-C sker den vid 4,3 % C och 1147 °C och är relevant för gjutjärn.$kuggfri$, null, 86, true, $kuggfri$cfcebc15f$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 02 Fasdiagram, s. 19, 20; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 17; Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2; Canvas, Lab_PM_M2_v2026, s. 10$kuggfri$, true, $kuggfri$Originalkortet angav den eutektoida temperaturen till ca 727 °C, men omskrivningen till sant/falskt säger ca 0,8 % C och ca 723 °C som GLU 02 s. 19, medan Lab_PM_M2_v2026 s. 11 använder 0,77 % C och 727 °C. Påståendet och facit (falskt) är i övrigt entydiga. Vilka värden ska Fe-C-korten använda?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6675b4ec-52ec-55b3-b2a8-2df1ebeb4a6f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$loslighetsgrans$kuggfri$, $kuggfri$Löslighetsgräns$kuggfri$, $kuggfri$Den högsta koncentration av ett ämne som kan lösas i en fas.$kuggfri$, null, 87, true, $kuggfri$c979b9927$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('825a6b52-8e29-547f-886a-75b54524f3d6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$strukturbestandsdel$kuggfri$, $kuggfri$Strukturbeståndsdel$kuggfri$, $kuggfri$En urskiljbar del av materialet som består av en eller flera faser och kan ses som en enhet på
något sätt. Kan vara en fas, eutektikum eller eutektoid.$kuggfri$, null, 88, true, $kuggfri$ceb2ca583$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2966162f-6239-561d-997b-f65d8642ef18', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$fas$kuggfri$, $kuggfri$Fas$kuggfri$, $kuggfri$En del av materialet med homogena fysikaliska och kemiska egenskaper$kuggfri$, null, 89, true, $kuggfri$cf3070b69$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('bdf18512-3559-571c-b0cf-298f6985b446', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$quiz-vad-galler-for-gibbs-fria-energi-tva$kuggfri$, $kuggfri$Vilka påståenden om Gibbs fria energi är sanna?$kuggfri$, $kuggfri$Gibbs fria energi är entalpi minus temperatur gånger entropi, $G = H - TS$. Entalpin är energi lagrad i materialet, t.ex. elastisk töjning av atombindningarna, och entropin är kopplad till oordning, så ökad oordning sänker G. Begreppet gäller alla faser, även flytande och gas (is, vatten och vattenånga är olika faser), och ett material strävar mot den fas som har lägst G vid den aktuella temperaturen.$kuggfri$, null, 90, true, $kuggfri$c39bcb661$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Gibbs fria energi är summan av atomernas kinetiska energi.","correct":false},{"text":"Atombindningarnas potentiella energi ger ett bidrag till Gibbs fria energi.","correct":true},{"text":"Gibbs fria energi minskar med ökande oordning i materialet.","correct":true},{"text":"Gibbs fria energi gäller bara för fasta material.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 2, fråga 4; Canvas, GLU 02 Fasdiagram, s. 4, 5$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6fe80817-abbd-5524-b336-6dcff30a39db', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$quiz-jamvikt-och-stabilitet-tva-ratt$kuggfri$, $kuggfri$Jämvikt och stabilitet: vilka påståenden är sanna?$kuggfri$, $kuggfri$Den stabila fasen är den med lägst Gibbs fria energi. En metastabil fas har inte lägst G men kräver aktiveringsenergi (oftast värme) för att omvandlas till den stabila fasen, och kan därför finnas kvar, t.ex. martensit i härdat stål eller den övermättade $\alpha$-fasen i snabbkyld aluminium. Även en instabil fas har en fri energi; den omvandlas förr eller senare till den stabila fasen, med en hastighet som kan begränsas av diffusion.$kuggfri$, null, 91, true, $kuggfri$c906194dd$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Man kan använda Gibbs fria energi för att avgöra om materialet är i ett stabilt tillstånd.","correct":true},{"text":"Man kan använda Gibbs fria energi för att avgöra om materialet är i ett metastabilt tillstånd.","correct":true},{"text":"Gibbs fria energi är odefinierad när materialet är i ett instabilt tillstånd.","correct":false},{"text":"Ett material kan bara befinna sig i ett metastabilt tillstånd en kort tid (några sekunder till några dagar beroende på temperatur).","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 2, fråga 5; Canvas, GLU 02 Fasdiagram, s. 5, 6; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 23, 26; Canvas, Fo 5 Fasdiagram och mikrostruktur 2, s. 20$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('ebe9a8eb-beb9-5ed8-86bc-6365ae8f9f9a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$quiz-fasdiagram-tva-ratt$kuggfri$, $kuggfri$Fasdiagram: vilka påståenden är sanna?$kuggfri$, $kuggfri$I ett binärt fasdiagram skiljs enfasområdena åt av tvåfasområden, även mellan de smala strecken för stökiometriska faser. Fasdiagrammet visar vilka faser som är stabila (har lägst Gibbs fria energi) vid en viss temperatur och sammansättning; tiden finns inte med, och diagrammet gäller vid så långsamma förlopp att jämvikt uppnås. En metastabil fas som martensit finns därför inte i fasdiagrammet. Quizens alternativ ("Två enfasområden har alltid ett tvåfasområde mellan sig", "Ett fasdiagram visar bara stabila faser") är omformulerade utan "alltid" och "bara", som föreläsningarna inte använder; det första är dessutom preciserat till binära fasdiagram, eftersom enfasområdena i ett unärt fasdiagram (ett enda ämne, t.ex. järn) bara skiljs åt av omvandlingstemperaturer.$kuggfri$, null, 92, true, $kuggfri$c00375968$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"I ett binärt fasdiagram ligger det tvåfasområden mellan enfasområdena.","correct":true},{"text":"Ett fasdiagram visar hur stabila faser ändras med tiden.","correct":false},{"text":"Ett fasdiagram visar vilka faser som är stabila vid en viss temperatur och sammansättning.","correct":true},{"text":"Metastabila faser markeras vanligen med röd färg i fasdiagrammet.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 2, fråga 6; Canvas, GLU 02 Fasdiagram, s. 8, 14, 22; Canvas, Lab_PM_M2_v2026, s. 4, 6$kuggfri$, false, $kuggfri$Quizens rätta alternativ "Två enfasområden har alltid ett tvåfasområde mellan sig" och "Ett fasdiagram visar bara stabila faser" är omskrivna utan "alltid" och "bara"; det första gäller nu bara binära diagram, eftersom järnets unära diagram (Lab_PM_M2_v2026 s. 4) saknar tvåfasområden. Godkänns omskrivningen, och ska Quiz vecka 2 fråga 6 ändras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('1b3270bd-b25f-500f-be16-8b7593ec6f4e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$quiz-stals-fasdiagram-vad-ar-sant-tva-ratt$kuggfri$, $kuggfri$Ståls fasdiagram: vilka påståenden är sanna?$kuggfri$, $kuggfri$![Förenklat Fe–C-diagram för stål med faser och strukturbeståndsdelar kring den eutektoida punkten](/kort/materialteknik/fe-c-stalhornet.svg)

Faserna i Fe-C-diagrammet är ferrit, austenit och cementit; martensit är en metastabil fas som bildas vid snabbkylning och finns inte i fasdiagrammet. Cementit (Fe₃C) innehåller 6,67 % C, mer än austenit (upp till 2,1 %) och ferrit (låg löslighet). Perlit är en strukturbeståndsdel av ferrit och cementit som bildas vid den eutektoida punkten (ca 0,8 % C), och dess andel kan räknas fram med hävstångsregeln. Austenit är en egen fas med annan kristallstruktur (FCC-järn) än ferrit (BCC-järn). Quizens alternativ "Om man löser in kol i ferrit så bildas austenit" är omformulerat, eftersom det inte är entydigt fel: vid t.ex. 850 °C är rent järn ferrit men ett stål med 0,3 % C austenit.$kuggfri$, null, 93, true, $kuggfri$c46bd2e37$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Cementit, ferrit och martensit är alla faser i fasdiagrammet.","correct":false},{"text":"Cementit är den fas i stål som innehåller mest kol.","correct":true},{"text":"Perlit är inte en fas, men man kan ändå bestämma perlitens kolhalt och andel ur fasdiagrammet.","correct":true},{"text":"Austenit är ferrit med inlöst kol.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 2, fråga 7; Canvas, GLU 02 Fasdiagram, s. 4, 16, 19, 20; Canvas, Fo 4 Fasdiagram, s. 14; Canvas, Fo 5 Fasdiagram och mikrostruktur 2, s. 20; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 15; Canvas, Short_dictionary_ v2026, s. 2, 6$kuggfri$, false, $kuggfri$Quizens felaktiga alternativ "Om man löser in kol i ferrit så bildas austenit" kan läsas som sant (vid ca 850 °C är rent järn ferrit men ett stål med 0,3 % C austenit, GLU_5-8 s. 15) och är utbytt mot "Austenit är ferrit med inlöst kol". Godkänns bytet, och ska Quiz vecka 2 fråga 7 ändras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('ad53e5c4-a1a4-5562-a435-0de58aef0d72', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$quiz-eutektiska-och-eutektoida-reaktioner$kuggfri$, $kuggfri$Eutektiska och eutektoida reaktioner: vilka påståenden är sanna?$kuggfri$, $kuggfri$Trefasreaktioner sker vid konstant temperatur och koncentration: den eutektiska $L \to \alpha + \beta$ ur smälta och den eutektoida $\gamma \to \alpha + \beta$ i fast fas. Perlit bildas eutektoidt ur austenit, inte ur smälta. Vid en fasomvandling under svalning bildas värme, så ingen värme behöver tillföras, men reaktionen kräver diffusion av kol; vid snabbkylning hinner kolet inte diffundera och då bildas martensit i stället för perlit.$kuggfri$, null, 94, true, $kuggfri$cbd11d1a1$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Vid både eutektiska och eutektoida reaktioner är temperaturen konstant.","correct":true},{"text":"Perlit bildas vid en eutektisk reaktion ur smälta.","correct":false},{"text":"Eutektoida reaktioner kräver att värme tillförs, annars händer inget.","correct":false},{"text":"Eutektoida reaktioner kräver diffusion; utan diffusion sker ingen eutektoid reaktion.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 2, fråga 8; Canvas, GLU 02 Fasdiagram, s. 19, 20; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 2, 17; Canvas, Fo 5 Fasdiagram och mikrostruktur 2, s. 20$kuggfri$, false, $kuggfri$Quizens rätta alternativ "Eutektoida reaktioner kräver diffusion, annars händer inget" stämmer inte bokstavligt, eftersom det bildas martensit vid snabbkylning; kortet säger nu "utan diffusion sker ingen eutektoid reaktion". Godkänns omskrivningen, och ska Quiz vecka 2 fråga 8 ändras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('49123138-a782-526c-b495-0465127568b6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$quiz-fasdiagram-vad-ar-sant-tva-ratta-svar$kuggfri$, $kuggfri$Fasdiagram: vilka påståenden om löslighet och hävstångsregeln är sanna?$kuggfri$, $kuggfri$![Fasdiagrammet för Pb–Sn med eutektisk punkt vid 61,9 % Sn och 183 °C](/kort/materialteknik/pb-sn-fasdiagram.svg)

Vid obegränsad löslighet, t.ex. Cu-Ni, finns en enda fast fas vid alla sammansättningar under soliduslinjen. Löslighetsgränsen är den maximala koncentrationen av ett ämne som kan lösas in i ett annat, och den beror på temperaturen (i Pb-Sn är lösligheten av Sn i Pb störst, 18,3 %, vid 183 °C). Hävstångsregeln gäller i alla tvåfasområden, även där smälta och fast fas samexisterar.$kuggfri$, null, 95, true, $kuggfri$cea08b765$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ett fasdiagram med obegränsad löslighet har bara en fast fas.","correct":true},{"text":"Löslighetsgränsen förändras vanligen med temperaturen.","correct":true},{"text":"Hävstångsregeln gäller bara för faser i fast tillstånd.","correct":false},{"text":"Löslighetsgränsen talar om hur svårt det är att legera en metall.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 2, fråga 10; Canvas, GLU 02 Fasdiagram, s. 10, 13, 14, 16; Canvas, Fo 4 Fasdiagram, s. 8, 9; Canvas, Lab_PM_M2_v2026, s. 6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('dc423845-c891-5190-a8fe-cf7fa70faaa2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$havstang-pbsn-40-strukturbestandsdelar$kuggfri$, $kuggfri$Pb-40 % Sn svalnar långsamt från smälta. Hur stor andel är primär $\alpha$ respektive eutektikum strax under 183 °C? ![Fasdiagrammet för Pb–Sn med 18,3 %, 61,9 % och 97,8 % Sn vid 183 °C](/kort/materialteknik/pb-sn-fasdiagram.svg)$kuggfri$, $kuggfri$Strax ovanför 183 °C består legeringen av Pb-rik fas $\alpha$ (18,3 % Sn) och smälta med eutektisk sammansättning (61,9 % Sn). Hävstångsregeln ger andelen primär $\alpha$ $= \frac{61{,}9-40}{61{,}9-18{,}3} = \frac{21{,}9}{43{,}6} \approx 0{,}50$. Resten, ca 50 %, är smälta som vid 183 °C stelnar till eutektikum. 73 % är andelen av fasen $\alpha$ totalt (primär $\alpha$ plus $\alpha$ i eutektikumet), inte av strukturbeståndsdelen primär $\alpha$.$kuggfri$, null, 96, true, $kuggfri$c097e24c5$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 50 % primär $\\alpha$ och 50 % eutektikum","correct":true},{"text":"Ca 40 % primär $\\alpha$ och 60 % eutektikum","correct":false},{"text":"Ca 73 % primär $\\alpha$ och 27 % eutektikum","correct":false},{"text":"100 % eutektikum","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 02 Fasdiagram, s. 14, 15, 17; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 10, 11$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('592a47c1-3597-58c2-a5bd-bb1f5edc9895', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$havstang-pbsn-40-faser$kuggfri$, $kuggfri$Pb-40 % Sn strax under 183 °C: hur stora är andelarna av faserna $\alpha$ och $\beta$? ![Fasdiagrammet för Pb–Sn med 18,3 %, 61,9 % och 97,8 % Sn vid 183 °C](/kort/materialteknik/pb-sn-fasdiagram.svg)$kuggfri$, $kuggfri$Strax under 183 °C finns två faser: $\alpha$ med 18,3 % Sn och $\beta$ med 97,8 % Sn (lösligheten av Pb i Sn är bara 2,2 %). Hävstångsregeln ger andelen $\alpha$ $= \frac{97{,}8-40}{97{,}8-18{,}3} = \frac{57{,}8}{79{,}5} \approx 0{,}73$ och andelen $\beta \approx 0{,}27$. Fasandelarna skiljer sig från andelarna av strukturbeståndsdelarna (primär $\alpha$ och eutektikum, ca 50 % var).$kuggfri$, null, 97, true, $kuggfri$cd92f93ac$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 73 % $\\alpha$ och 27 % $\\beta$","correct":true},{"text":"Ca 50 % $\\alpha$ och 50 % $\\beta$","correct":false},{"text":"Ca 60 % $\\alpha$ och 40 % $\\beta$","correct":false},{"text":"Ca 27 % $\\alpha$ och 73 % $\\beta$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 02 Fasdiagram, s. 14, 17$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('65e63bdc-ec33-5eb3-9f1b-9bebc53bb999', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$havstangsregeln-metod$kuggfri$, $kuggfri$Hur använder man hävstångsregeln i ett tvåfasområde?$kuggfri$, $kuggfri$1. Dra en horisontell linje (förbindelselinje) vid aktuell temperatur genom legeringens sammansättning $C$ ut till tvåfasområdets gränser.
2. Läs av fasernas koncentrationer $C_\alpha$ och $C_\beta$ vid gränserna.
3. Andelen av en fas är den bortre hävstångsarmen delat med hela hävstången:

$f_\alpha = \dfrac{C_\beta - C}{C_\beta - C_\alpha}, \qquad f_\beta = \dfrac{C - C_\alpha}{C_\beta - C_\alpha}$

Det är linjär interpolation: vid $C = C_\alpha$ är andelen $\beta$ 0 % och vid $C = C_\beta$ 100 %.$kuggfri$, null, 98, true, $kuggfri$cca0107d9$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, Fo 4 Fasdiagram, s. 8, 9; Canvas, GLU 02 Fasdiagram, s. 16, 17; Canvas, Short_dictionary_ v2026, s. 14$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('4a59ac92-316f-593a-ba27-dd15e86670c9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$segring$kuggfri$, $kuggfri$Segring$kuggfri$, $kuggfri$Koncentrationsskillnader i kornen som uppstår vid stelningen, eftersom diffusionen är för begränsad för att jämna ut sammansättningen. Förekommer nästan alltid vid gjutning i praktiken.$kuggfri$, null, 99, true, $kuggfri$cb6068b50$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 13; Canvas, Lab_PM_M2_v2026, s. 6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('913220b3-efa1-5d61-a133-e43a2dcfcc24', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$karnbildning$kuggfri$, $kuggfri$Kärnbildning$kuggfri$, $kuggfri$Att nya kristaller bildas i smältan och sedan tillväxer. Kärnbildningen sker lättare på fasta partiklar och ytor, och vid gjutning tillsätts därför små partiklar för att få en finkornigare kornstruktur. Kornen växer tills de möts och bildar materialets kornstruktur och korngränser.$kuggfri$, null, 100, true, $kuggfri$c5efc7de7$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 5$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d3dee631-b091-5489-a78f-50e3c7b9014b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$ren-metall-stelningstemperatur$kuggfri$, $kuggfri$En ren metall stelnar inom ett temperaturintervall.$kuggfri$, $kuggfri$En ren metall har en distinkt smälttemperatur. När den stelnar bildas värme, och avsvalningskurvan får en platå tills allt har stelnat. En legering stelnar däremot i regel inom ett temperaturintervall, där smälta och fasta kristaller finns i jämvikt i ett tvåfasområde.$kuggfri$, null, 101, true, $kuggfri$c9b74d835$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 02 Fasdiagram, s. 9; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 2, 4; Canvas, Lab_PM_M2_v2026, s. 5$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('e8cf2321-3976-56b8-8287-1b97b1b41ab9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$eutektoidiskt-stal-faser-strukturbestandsdel$kuggfri$, $kuggfri$Ett eutektoidiskt stål (ca 0,8 % C) som svalnat långsamt består av två faser men bara en strukturbeståndsdel.$kuggfri$, $kuggfri$![Förenklat Fe–C-diagram för stål med faser och strukturbeståndsdelar kring den eutektoida punkten](/kort/materialteknik/fe-c-stalhornet.svg)

Under den eutektoida temperaturen består stålet av faserna ferrit och cementit, men de förekommer tillsammans som den enda strukturbeståndsdelen perlit (lameller av ferrit och cementit). Över den eutektoida temperaturen är stålet en enda fas, austenit, som också är den enda strukturbeståndsdelen.$kuggfri$, null, 102, true, $kuggfri$c2ef16a71$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Lab_PM_M2_v2026, s. 10, 11, 12; Canvas, GLU 02 Fasdiagram, s. 19, 20$kuggfri$, false, $kuggfri$Kortet och figuren anger den eutektoida punkten till ca 0,8 % C och 723 °C och hänvisar till Lab_PM_M2_v2026 s. 10 till 12, men labb-PM:et använder 0,77 % C och 727 °C (GLU 02 s. 19 har 0,8 % och 723 °C). Samma värden finns på alla Fe-C-kort, och studenterna möter båda på labben. Ska korten nämna labb-PM:ets värden, som ferrit- och austenitkorten gör för 912/913 °C?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('eece5eea-efd7-5bb1-b1dc-c66702e31eb6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$undereutektoidiskt-stal-strukturbestandsdelar$kuggfri$, $kuggfri$Vilka strukturbeståndsdelar har ett undereutektoidiskt stål (under ca 0,8 % C) efter långsam svalning?$kuggfri$, $kuggfri$![Förenklat Fe–C-diagram för stål med faser och strukturbeståndsdelar kring den eutektoida punkten](/kort/materialteknik/fe-c-stalhornet.svg)

Vid långsam svalning bildas först primär (proeutektoid) ferrit, och vid den eutektoida temperaturen omvandlas resten av austeniten till perlit. Bara perlit fås vid ca 0,8 % C, och perlit med cementit i gränserna mellan perlitområdena i övereutektoida stål. Martensit bildas bara vid snabbkylning från austenitområdet.$kuggfri$, null, 103, true, $kuggfri$cf23ca027$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Primär ferrit och perlit","correct":true},{"text":"Perlit och cementit","correct":false},{"text":"Bara perlit","correct":false},{"text":"Martensit","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 15, 18, 23; Canvas, Lab_PM_M2_v2026, s. 12$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('b5bf398f-324b-5d5f-9724-ff6c25bc67dc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$tvafasomrade-fasernas-sammansattning$kuggfri$, $kuggfri$I ett tvåfasområde har båda faserna samma sammansättning som legeringen.$kuggfri$, $kuggfri$I ett tvåfasområde läser man av fasernas koncentrationer vid områdets gränser, längs en horisontell linje vid aktuell temperatur, och de skiljer sig från legeringens sammansättning. Det är bara i ett enfasområde som fasen har samma koncentration som legeringen.$kuggfri$, null, 104, true, $kuggfri$c5ddb3062$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 4 Fasdiagram, s. 8, 9; Canvas, GLU 02 Fasdiagram, s. 17$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('270c7024-1219-5d1d-80cf-211f849c0aee', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$stelning-pbsn-40$kuggfri$, $kuggfri$Beskriv hur en Pb-40 % Sn-legering stelnar och svalnar långsamt från smälta till rumstemperatur.$kuggfri$, $kuggfri$![Fasdiagrammet för Pb–Sn med eutektisk punkt vid 61,9 % Sn och 183 °C](/kort/materialteknik/pb-sn-fasdiagram.svg)

* Ca 240 till 184 °C: Pb-rik fas ($\alpha$) bildas gradvis i jämvikt med smältan, upp till ca 50 %.
* 183 °C: den kvarvarande smältan, som då har eutektisk sammansättning (61,9 % Sn), stelnar till eutektikum, en finfördelad blandning av $\alpha$ och $\beta$.
* Under 183 °C: lösligheten av Sn i Pb minskar, så Sn-rik fas ($\beta$) skiljs ut som utskiljningar i den Pb-rika fasen.

Resultatet är primär $\alpha$ (med $\beta$-utskiljningar) och eutektikum, ungefär hälften av varje.$kuggfri$, null, 105, true, $kuggfri$c1a0346ef$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 10, 11; Canvas, Fo 5 Fasdiagram och mikrostruktur 2, s. 8; Canvas, GLU 02 Fasdiagram, s. 14$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1ebb3760-b6bf-5511-84f4-0d150f604e27', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$jarn-fas-vid-1000$kuggfri$, $kuggfri$Vilken fas är stabil i rent järn vid 1000 °C?$kuggfri$, $kuggfri$![Järns unära fasdiagram med ferrit, austenit, delta-ferrit, smälta och ånga](/kort/materialteknik/jarn-unart-fasdiagram.svg)

I rent järn är austenit stabil mellan ca 912 °C och 1394 °C, så vid 1000 °C är järnet austenitiskt (FCC). Ferrit ($\alpha$) är stabil under ca 912 °C, $\delta$-ferrit mellan 1394 °C och smältpunkten 1538 °C. GLU 02 anger omvandlingen ferrit–austenit till 913 °C, Lab-PM:ets fasdiagram 912 °C.$kuggfri$, null, 106, true, $kuggfri$c62529340$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Austenit ($\\gamma$-järn, FCC)","correct":true},{"text":"Ferrit ($\\alpha$-järn, BCC)","correct":false},{"text":"$\\delta$-ferrit (BCC)","correct":false},{"text":"Smälta","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Lab_PM_M2_v2026, s. 4; Canvas, GLU 02 Fasdiagram, s. 4, 19$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('76abd71f-c826-5f34-bf8f-f1ca43495683', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$jarn-bcc-rumstemp-och-nara-smaltpunkten$kuggfri$, $kuggfri$Rent järn har BCC-struktur både vid rumstemperatur och strax under smältpunkten.$kuggfri$, $kuggfri$![Järns unära fasdiagram med ferrit, austenit, delta-ferrit, smälta och ånga](/kort/materialteknik/jarn-unart-fasdiagram.svg)

Sant. Vid rumstemperatur är rent järn ferrit ($\alpha$-järn, BCC). Mellan 1394 °C och smältpunkten 1538 °C är det $\delta$-ferrit, som också är BCC. Däremellan, från ca 912 °C till 1394 °C, är järnet austenit (FCC).$kuggfri$, null, 107, true, $kuggfri$cdb18cca3$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Lab_PM_M2_v2026, s. 3, 4; Canvas, GLU 02 Fasdiagram, s. 19$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('930a15a5-c770-5e8e-81d4-d614e167a1c8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$pbsn-40-vid-200$kuggfri$, $kuggfri$En Pb–Sn-legering med 40 % Sn hålls vid 200 °C. Vilka faser finns? ![Fasdiagrammet för Pb–Sn med enfas- och tvåfasområden kring den eutektiska linjen vid 183 °C](/kort/materialteknik/pb-sn-fasdiagram.svg)$kuggfri$, $kuggfri$Punkten 40 % Sn, 200 °C ligger ovanför den eutektiska linjen vid 183 °C men under likviduslinjen (som vid 40 % Sn ligger vid ca 240 °C), alltså i tvåfasområdet $\alpha$ + L. $\alpha$ + $\beta$ finns först under 183 °C, och ett rent $\alpha$-område finns vid 200 °C bara för låga Sn-halter.$kuggfri$, null, 108, true, $kuggfri$c49f2f7e8$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Pb-rik fast fas ($\\alpha$) och smälta (L)","correct":true},{"text":"Bara smälta (L)","correct":false},{"text":"$\\alpha$ och $\\beta$","correct":false},{"text":"Bara $\\alpha$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 02 Fasdiagram, s. 14, 15; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 10$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('27ccd87f-0ced-5ca4-954e-1cc22e6fba3b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$stal-03-primar-ferrit$kuggfri$, $kuggfri$Ett stål med 0,3 % C svalnar långsamt från austenitområdet. Vad händer mellan ca 820 °C och ca 723 °C?$kuggfri$, $kuggfri$![Förenklat Fe–C-diagram för stål med faser och strukturbeståndsdelar kring den eutektoida punkten](/kort/materialteknik/fe-c-stalhornet.svg)

Mellan ca 820 °C och 723 °C ligger stålet i tvåfasområdet $\alpha$ + $\gamma$, där primär ferrit bildas. Vid 723 °C omvandlas den kvarvarande austeniten eutektoidt till perlit, så stålet består till slut av primär ferrit och perlit. Cementit i gränserna mellan perlitområdena hör till övereutektoida stål, och martensit bildas bara vid snabbkylning.$kuggfri$, null, 109, true, $kuggfri$c6670e7f5$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Primär (proeutektoid) ferrit bildas ur austeniten.","correct":true},{"text":"Den eutektoida reaktionen bildar perlit.","correct":false},{"text":"Cementit skiljs ut i korngränserna.","correct":false},{"text":"Austeniten omvandlas till martensit.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 15, 18; Canvas, GLU 02 Fasdiagram, s. 19$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3bda223c-8ee9-54c4-99f7-09bd33c8e78e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$binart-fasdiagram$kuggfri$, $kuggfri$Binärt fasdiagram$kuggfri$, $kuggfri$Ett fasdiagram för ett system av två ämnen (komponenter), t.ex. Cu–Ni eller Pb–Sn. Det visar vilka faser som är stabila vid jämvikt vid olika temperaturer (y-axeln) och sammansättningar (x-axeln, halten av det ena ämnet). Enfasområdena skiljs åt av tvåfasområden. I Cu–Ni, med obegränsad löslighet, finns en enda fast fas. I Pb–Sn, med begränsad löslighet, finns två fasta faser och en eutektisk punkt.$kuggfri$, null, 110, true, $kuggfri$c3eeba566$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, Fo 4 Fasdiagram, s. 8; Canvas, GLU 02 Fasdiagram, s. 10, 14; Canvas, Lab_PM_M2_v2026, s. 5, 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('7054a8fa-63ce-5b2d-8537-051b9450c908', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$eutektisk-sammansattning-lagst-smalttemperatur$kuggfri$, $kuggfri$I systemet Pb–Sn har legeringen med eutektisk sammansättning lägre smälttemperatur än både rent bly och rent tenn.$kuggfri$, $kuggfri$![Fasdiagrammet för Pb–Sn med eutektisk punkt vid 61,9 % Sn och 183 °C](/kort/materialteknik/pb-sn-fasdiagram.svg)

Sant. Likviduslinjerna sjunker från rent Pb (327 °C) och rent Sn (232 °C) och möts i den eutektiska punkten vid 61,9 % Sn och 183 °C, den lägsta temperatur där smälta finns i systemet. En smälta med eutektisk sammansättning har inget stelningsintervall utan stelnar vid en enda temperatur till eutektikum. Samma mönster finns i Al–Si: den eutektiska temperaturen, ca 577 °C (vid 12,6 % Si), ligger lägre än smältpunkterna för både Al (660 °C) och Si (1414 °C).$kuggfri$, null, 111, true, $kuggfri$c39a161ad$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 02 Fasdiagram, s. 14, 15; Canvas, Lab_PM_M2_v2026, s. 7, 8, 9$kuggfri$, false, $kuggfri$Kortet anger den eutektiska temperaturen i Al-Si till ca 577 °C som Lab_PM_M2_v2026 s. 9, men bilden i Exempel fasdiagram s. 8 visar enligt granskningen 557 °C. Stämmer 577 °C, och ska bilden i Exempel fasdiagram rättas?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('f9425db1-93b5-55bf-b467-e31bfecdc655', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$avsvalningskurvor-former$kuggfri$, $kuggfri$Hur ser avsvalningskurvan ut när en ren metall, en legering som stelnar till en enda fas och en legering med primär fas och eutektikum stelnar?$kuggfri$, $kuggfri$När en fas bildas frigörs värme, som bromsar avsvalningen. I ett enfasområde styrs kurvan bara av värmeledningen.

* **Ren metall (och eutektisk sammansättning):** en platå (hållpunkt) vid en enda temperatur tills allt har stelnat.
* **Legering som stelnar till en enda fas** (tvåfasområdet smälta + fast fas): en knick där stelningen börjar (likviduslinjen), en flackare kurva genom stelningsintervallet och en ny knick där stelningen är klar (soliduslinjen).
* **Legering mellan en primär fas och eutektikum:** först en knick när den primära fasen börjar bildas, sedan en platå vid den eutektiska temperaturen när resten av smältan stelnar till eutektikum.

![Tre avsvalningskurvor, temperatur mot tid: ren metall med platå, legering med knick vid likvidus och solidus, legering med knick vid likvidus och platå vid den eutektiska temperaturen](/kort/materialteknik/avsvalningskurvor.svg)$kuggfri$, null, 112, true, $kuggfri$c0e14ec1e$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 2, 3, 4, 9, 10; Canvas, Lab_PM_M2_v2026, s. 5, 7, 8$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('0705e54d-d9d5-5a92-8bc2-c43558d5c307', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$avsvalningskurva-pbsn-knick-plata$kuggfri$, $kuggfri$En Pb–Sn-legering svalnar långsamt från smälta. Avsvalningskurvan har först en knick och sedan en platå vid 183 °C. Vilken sammansättning kan legeringen ha? ![Fasdiagrammet för Pb–Sn med 18,3 %, 61,9 % och 97,8 % Sn vid 183 °C](/kort/materialteknik/pb-sn-fasdiagram.svg)$kuggfri$, $kuggfri$Knicken visar att primär $\alpha$ börjar bildas när temperaturen når likviduslinjen. Platån vid 183 °C är den eutektiska reaktionen, där resten av smältan stelnar till eutektikum vid konstant temperatur. Pb–61,9 % Sn har eutektisk sammansättning och ger bara en platå. Pb–10 % Sn stelnar helt till en fas ($\alpha$) inom ett temperaturintervall och når aldrig den eutektiska linjen, så kurvan får knickar men ingen platå. Rent Sn ger bara en platå, vid tennets smältpunkt.$kuggfri$, null, 113, true, $kuggfri$c7d6d4b6e$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Pb–30 % Sn","correct":true},{"text":"Pb–61,9 % Sn","correct":false},{"text":"Pb–10 % Sn","correct":false},{"text":"Rent Sn","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 9, 10; Canvas, Lab_PM_M2_v2026, s. 7, 8; Canvas, GLU 02 Fasdiagram, s. 14$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('1afdb3c8-3c2d-56e3-9b97-27c33be7b365', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$havstang-stal-035-andel-perlit$kuggfri$, $kuggfri$Ett stål med 0,35 % C svalnar långsamt från austenitområdet. Ungefär hur stor andel perlit och primär ferrit får det? (Perlit bildas ur austenit med 0,8 % C; ferritens kolhalt kan försummas.)$kuggfri$, $kuggfri$![Förenklat Fe–C-diagram för stål med faser och strukturbeståndsdelar kring den eutektoida punkten](/kort/materialteknik/fe-c-stalhornet.svg)

Strax ovanför den eutektoida temperaturen (ca 723 °C) består stålet av primär ferrit och austenit med 0,8 % C, och all den austeniten blir perlit vid den eutektoida reaktionen. Hävstångsregeln mellan ferrit (≈ 0 % C) och austenit (0,8 % C): andel perlit $= \dfrac{0{,}35 - 0}{0{,}8 - 0} \approx 0{,}44$, resten, ca 56 %, är primär ferrit. 56 % perlit fås om hävstångsarmarna byts, 35 % om kolhalten tas som andel, och 100 % perlit gäller bara vid ca 0,8 % C.$kuggfri$, null, 114, true, $kuggfri$c94946a5e$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 44 % perlit och 56 % primär ferrit","correct":true},{"text":"Ca 56 % perlit och 44 % primär ferrit","correct":false},{"text":"Ca 35 % perlit och 65 % primär ferrit","correct":false},{"text":"100 % perlit","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 02 Fasdiagram, s. 16, 17, 19; Canvas, Fo 12 Stal, s. 17, 18; Canvas, Lab_PM_M2_v2026, s. 12$kuggfri$, false, $kuggfri$Kortet räknar rätt med hävstångsregeln (0,35 % C ger ca 56 % primär ferrit), men GLU_5-8 s. 15 säger att ett stål med 0,3 % C får "ca 30 %" primär ferrit, medan hävstångsregeln ger ca 63 %. Studenter som jämför kortet med bilden får olika svar. Är siffran på bilden fel, och ska den rättas i Canvas?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('09091dae-1a17-5203-bc10-6b3cabbf4975', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$stal-austenit-blir-perlit-andel$kuggfri$, $kuggfri$Andelen perlit i ett undereutektoidiskt stål efter långsam svalning är lika stor som andelen austenit strax ovanför den eutektoida temperaturen.$kuggfri$, $kuggfri$Sant. I tvåfasområdet ferrit + austenit bildas primär ferrit, och vid den eutektoida temperaturen omvandlas den kvarvarande austeniten, som då har ca 0,8 % C, till perlit. Andelen austenit strax ovanför den eutektoida temperaturen, räknad med hävstångsregeln, blir alltså andelen perlit. Högre upp i tvåfasområdet har austeniten lägre kolhalt och andelen austenit är större; där läser man av austenitens kolhalt vid tvåfasområdets gräns vid den aktuella temperaturen.$kuggfri$, null, 115, true, $kuggfri$cbebee8dd$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 02 Fasdiagram, s. 17, 19; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 15, 18; Canvas, Lab_PM_M2_v2026, s. 11, 12$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('dd2184d0-d06c-542a-ab62-469b778e0f62', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$fe-c-andel-perlit-overeutektoid$kuggfri$, $kuggfri$Ett stål med 1,3 % C svalnar långsamt. Ungefär hur stora andelar perlit och cementit har det vid rumstemperatur? (Perlit 0,8 % C, cementit 6,67 % C.)$kuggfri$, $kuggfri$Ett övereutektoidiskt stål består av perlit och cementit, som ligger i gränserna mellan perlitområdena. Hävstångsregeln mellan perlit (0,8 % C) och cementit (6,67 % C) ger andelen perlit $= \dfrac{6{,}67 - 1{,}3}{6{,}67 - 0{,}8} = \dfrac{5{,}37}{5{,}87} \approx 0{,}91$. 62 % fås av $0{,}8/1{,}3$, och 81 % $= (6{,}67 - 1{,}3)/6{,}67$ är andelen av fasen ferrit (hävstång mellan ferrit och cementit), inte av strukturbeståndsdelen perlit.$kuggfri$, null, 116, true, $kuggfri$cd89d66f0$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 91 % perlit och 9 % cementit","correct":true},{"text":"Ca 62 % perlit och 38 % cementit","correct":false},{"text":"Ca 81 % perlit och 19 % cementit","correct":false},{"text":"100 % perlit","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 12 Stal, s. 17, 18; Canvas, GLU 02 Fasdiagram, s. 16, 17, 19; Canvas, Lab_PM_M2_v2026, s. 11, 12$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2c55a554-fe63-554e-bcf8-8ce1c71ec933', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$fe-c-eutektisk-reaktion$kuggfri$, $kuggfri$Vad bildas när smälta med 4,3 % C svalnar genom den eutektiska punkten i Fe–C-diagrammet (ca 1147 °C)?$kuggfri$, $kuggfri$Den eutektiska reaktionen i Fe–C är smälta → austenit + cementit ($L \to \gamma + \text{Fe}_3\text{C}$) vid 4,3 % C och ca 1147 °C. Den utnyttjas vid gjutning av gjutjärn (2–4 % C). Perlit (ferrit + cementit) bildas i stället vid den eutektoida reaktionen ur austenit, vid ca 0,8 % C och 723 °C. Martensit bildas bara vid snabbkylning av austenit, och en enda fas är inget eutektikum.$kuggfri$, null, 117, true, $kuggfri$cb9a7059a$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Austenit och cementit, i ett eutektikum","correct":true},{"text":"Ferrit och cementit, dvs. perlit","correct":false},{"text":"Martensit","correct":false},{"text":"Bara austenit","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Lab_PM_M2_v2026, s. 9; Canvas, GLU 02 Fasdiagram, s. 19, 20$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('a5a61f66-f780-50df-b1dd-83616cb0f43f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$pbsn-stelning-sammansattning-andre$kuggfri$, $kuggfri$En Pb–30 % Sn-legering svalnar långsamt genom tvåfasområdet $\alpha$ + L ned mot 183 °C. Vad händer?$kuggfri$, $kuggfri$![Fasdiagrammet för Pb–Sn med enfas- och tvåfasområden kring den eutektiska linjen vid 183 °C](/kort/materialteknik/pb-sn-fasdiagram.svg)

I ett tvåfasområde läser man av fasernas koncentrationer vid områdets gränser, längs en horisontell linje vid den aktuella temperaturen: smältans på likviduslinjen och den fasta fasens på soliduslinjen. När en Sn-fattigare fast fas skiljs ut anrikas smältan på Sn, och andelen $\alpha$ ökar enligt hävstångsregeln. Strax ovanför 183 °C återstår $\frac{30-18{,}3}{61{,}9-18{,}3} \approx 0{,}27$, alltså ca 27 % smälta med eutektisk sammansättning, som stelnar till eutektikum.$kuggfri$, null, 118, true, $kuggfri$ce3690c5f$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Smältans Sn-halt följer likviduslinjen och ökar mot 61,9 % Sn.","correct":true},{"text":"Andelen av den fasta Pb-rika fasen ($\\alpha$) ökar.","correct":true},{"text":"Smältan har hela tiden legeringens sammansättning, 30 % Sn.","correct":false},{"text":"Andelen smälta är konstant tills 183 °C nås.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Lab_PM_M2_v2026, s. 6, 7; Canvas, GLU 02 Fasdiagram, s. 14, 17; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 10$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2867df40-182e-5165-999e-60fdfbc668f6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$havstang-pbsn-70-strukturbestandsdelar$kuggfri$, $kuggfri$Pb–70 % Sn svalnar långsamt från smälta. Ungefär hur stor andel primär $\beta$ respektive eutektikum finns strax under 183 °C? ![Fasdiagrammet för Pb–Sn med 18,3 %, 61,9 % och 97,8 % Sn vid 183 °C](/kort/materialteknik/pb-sn-fasdiagram.svg)$kuggfri$, $kuggfri$Legeringen ligger på Sn-sidan om den eutektiska punkten, så först bildas den Sn-rika fasen $\beta$ (97,8 % Sn vid 183 °C). Strax ovanför 183 °C är andelen primär $\beta$ $= \dfrac{70-61{,}9}{97{,}8-61{,}9} = \dfrac{8{,}1}{35{,}9} \approx 0{,}23$. Resten, ca 77 %, är smälta med eutektisk sammansättning, som stelnar till eutektikum vid 183 °C.$kuggfri$, null, 119, true, $kuggfri$cae99544f$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 23 % primär $\\beta$ och 77 % eutektikum","correct":true},{"text":"Ca 77 % primär $\\beta$ och 23 % eutektikum","correct":false},{"text":"Ca 70 % primär $\\beta$ och 30 % eutektikum","correct":false},{"text":"100 % eutektikum","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 02 Fasdiagram, s. 14, 15, 17; Canvas, Lab_PM_M2_v2026, s. 7, 8$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('8487011d-a751-5bae-b963-b2b341cd1fdb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$pbsn-strukturbestandsdelar-under-eutektisk$kuggfri$, $kuggfri$När en Pb–Sn-legering av primär $\alpha$ och eutektikum svalnar vidare från 183 °C till rumstemperatur ändras inte andelen eutektikum, men Sn-rik $\beta$ skiljs ut i den Pb-rika fasen.$kuggfri$, $kuggfri$Sant. Strukturbeståndsdelarna, primär $\alpha$ och eutektikum, bildas vid stelningen och finns kvar vid fortsatt svalning. Under 183 °C minskar lösligheten av Sn i Pb, så Sn-rik fas $\beta$ bildas som utskiljningar i den Pb-rika fasen. Andelarna av faserna $\alpha$ och $\beta$ ändras alltså något, medan andelarna av strukturbeståndsdelarna är desamma.$kuggfri$, null, 120, true, $kuggfri$c0fbf9ffd$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 9, 10; Canvas, Lab_PM_M2_v2026, s. 7, 8; Canvas, GLU 02 Fasdiagram, s. 13, 14$kuggfri$, false, $kuggfri$Kortet säger att andelen eutektikum inte ändras när en Pb-Sn-legering svalnar från 183 °C till rumstemperatur. GLU_5-8 s. 10 beskriver bara att Sn-rik fas skiljs ut i den Pb-rika fasen, och att andelen eutektikum är oförändrad står uttryckligen bara i svarsförslaget till tentan 24-10 uppg. 3c. Räcker det som belägg?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('aaf27071-eaf8-51ef-a59d-96fdd1e7ef6a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$havstang-faser-i-eutektikum$kuggfri$, $kuggfri$Hur stor andel av själva eutektikumet i Pb–Sn är $\beta$-fas strax under 183 °C, när eutektikumet just har bildats? ![Fasdiagrammet för Pb–Sn med 18,3 %, 61,9 % och 97,8 % Sn vid 183 °C](/kort/materialteknik/pb-sn-fasdiagram.svg)$kuggfri$, $kuggfri$Eutektikumet har sammansättningen 61,9 % Sn och består av $\alpha$ (18,3 % Sn) och $\beta$ (97,8 % Sn). Hävstångsregeln med eutektikumets egen sammansättning ger strax under 183 °C andelen $\beta = \dfrac{61{,}9 - 18{,}3}{97{,}8 - 18{,}3} = \dfrac{43{,}6}{79{,}5} \approx 0{,}55$ och andelen $\alpha \approx 0{,}45$. 62 % är eutektikumets Sn-halt, inte andelen $\beta$ vid 183 °C, och 27 % är andelen $\beta$ i hela legeringen Pb–40 % Sn strax under 183 °C. Vid fortsatt långsam svalning blir faserna nästan rent Pb och rent Sn, och då närmar sig andelen $\beta$ i eutektikumet dess Sn-halt, ca 62 %.$kuggfri$, null, 121, true, $kuggfri$c793b82ab$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 55 %","correct":true},{"text":"Ca 62 %","correct":false},{"text":"Ca 27 %","correct":false},{"text":"Ca 50 %","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU 02 Fasdiagram, s. 14, 15, 16, 17; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('c12c9f4c-7252-5d54-a410-75153dbd1a03', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$al-cu-max-halt-utskiljningshardning$kuggfri$, $kuggfri$Ungefär vilken är den högsta Cu-halt en Al–Cu-legering kan ha om all Cu ska kunna lösas i $\alpha$ vid upplösningsbehandlingen? ![Al-hörnet av fasdiagrammet Al–Cu med aluminiumfasen (Al), eutektisk linje vid 548 °C och fasen θ = CuAl₂](/kort/materialteknik/al-cu-alhornet.svg)$kuggfri$, $kuggfri$Upplösningsbehandlingen kräver att legeringen blir en enda fas, $\alpha$, så att all Cu är löst före snabbkylningen. Lösligheten av Cu i $\alpha$ är störst vid den eutektiska temperaturen 548 °C, där $\alpha$-områdets gräns möter den eutektiska linjen, vid knappt 6 % Cu. Vid högre Cu-halt bildas eutektikum ($\alpha$ + $\theta$) vid stelningen, och det finns ingen temperatur där all Cu är löst i fast $\alpha$. Ca 33 % är den eutektiska sammansättningen, ca 54 % är fasen $\theta$ (CuAl₂), och ca 1 % är lösligheten vid en betydligt lägre temperatur, inte den största lösligheten.$kuggfri$, null, 122, true, $kuggfri$c723c2d76$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Knappt 6 % Cu","correct":true},{"text":"Ca 33 % Cu","correct":false},{"text":"Ca 54 % Cu","correct":false},{"text":"Ca 1 % Cu","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Exempel fasdiagram, s. 7; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 26; Canvas, GLU 02 Fasdiagram, s. 13; Canvas, Lab_PM_M2_v2026, s. 7$kuggfri$, false, $kuggfri$Svaret "knappt 6 % Cu" och figuren al-cu-alhornet.svg bygger på en avläsning av Exempel fasdiagram s. 7, där maxlösligheten inte står utskriven, medan svarsförslaget till tentan 2025-01 uppg. 8c säger "under 5,5 % Cu". Kortet prövar samma kunskap som 25-01 uppg. 8c och 24-08 uppg. 3a men med egen formulering. Stämmer avläsningen, och ligger kortet tillräckligt långt från tentorna?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('9c5b4842-aa94-5196-98a8-7b768fb54dec', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '9d686bd9-37fb-54a7-aa3c-feaa3668034c', $kuggfri$al-cu-havstang-andel-theta$kuggfri$, $kuggfri$En Al–3 % Cu-legering har svalnat långsamt till rumstemperatur. Ungefär hur stor viktandel $\theta$ (CuAl₂) har den? ($\alpha$ har då nästan 0 % Cu och $\theta$ ca 54 % Cu.)$kuggfri$, $kuggfri$![Al-hörnet av fasdiagrammet Al–Cu med aluminiumfasen (Al), eutektisk linje vid 548 °C och fasen θ = CuAl₂](/kort/materialteknik/al-cu-alhornet.svg)

Hävstångsregeln mellan $\alpha$ (≈ 0 % Cu) och $\theta$ (≈ 54 % Cu): andel $\theta$ $= \dfrac{3-0}{54-0} \approx 0{,}056$, alltså ca 6 %, och ca 94 % $\alpha$. 3 % är legeringens Cu-halt, inte andelen $\theta$; eftersom $\theta$ själv består till drygt hälften av Cu blir andelen $\theta$ nästan dubbelt så stor som Cu-halten. Ca 9 % fås om man räknar mot den eutektiska sammansättningen (ca 33 % Cu) i stället för mot $\theta$.$kuggfri$, null, 123, true, $kuggfri$ca3b16cb2$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 6 %","correct":true},{"text":"3 %","correct":false},{"text":"Ca 9 %","correct":false},{"text":"Ca 94 %","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Exempel fasdiagram, s. 7; Canvas, GLU 02 Fasdiagram, s. 16, 17, 21$kuggfri$, false, $kuggfri$Kortet räknar med att θ (CuAl2) har ca 54 % Cu, ett värde som är avläst i Exempel fasdiagram s. 7 där det inte står utskrivet; svaret blir ca 6 % θ och räkningen stämmer. Stämmer avläsningen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1f10e3ac-c277-5ae0-99d3-e1f78cbfaffe', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vad-beror-ett-materials-densitet-pa-for$kuggfri$, $kuggfri$Vad beror ett materials densitet på för faktorer?$kuggfri$, $kuggfri$* Atomvikten hos atomerna i materialet
* Antalet atomer/volym
* Densiteten hos kompositer beror på volymandel och densitet på de ingående materialen
* Densiteten i polymerskum, trä m.m blir låg p.g.a. hålrummen.$kuggfri$, null, 124, true, $kuggfri$cea5cf0cf$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('a5d5e6cf-4695-5d9d-919c-45aca7d7469a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$atombindningar-kan-jamforas-med-linjara$kuggfri$, $kuggfri$Atombindningar kan jämföras med linjära fjädrar. Hur kommer detta sig och varför gör man det?$kuggfri$, $kuggfri$Man brukar likna atombindningar med linjära fjädrar för att de har liknande egenskaper.
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
  - Hög smälttemperatur$kuggfri$, null, 125, true, $kuggfri$c06101815$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true, $kuggfri$Kortet anger "E-modulen = S x n" med S som bindningens styvhet och n som antalet bindningar per area, ordagrant från Fö 7 Styvhet 2025. Sambandet går inte ihop i enheter (N/m gånger 1/m² ger N/m³, inte Pa); fjädermodellen ger E ≈ S/r0 där r0 är atomavståndet (Ashby). Ska formeln rättas, eller skrivas som ett proportionalitetssamband?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('b6fbe14c-8a65-5414-8cd1-c8a662b058b5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vad-har-ett-materials-atombindningar$kuggfri$, $kuggfri$Vad har ett materials atombindningar för inverkan på dess egenskaper?$kuggfri$, $kuggfri$* Påverkar styvhet, termisk utvidgning,
smälttemperatur, elektrisk ledningsförmåga m.m.
* Kan ej förändras med processer$kuggfri$, null, 126, true, $kuggfri$c7dae83a1$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2eaf03ac-75d0-5f23-96b7-17e66a9784d8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$hur-ser-ett-typiskt-dragprov-ut-for-ett$kuggfri$, $kuggfri$Hur ser ett typiskt dragprov ut för ett sprött material?$kuggfri$, $kuggfri$* Elastiskt beteende upp till
brottgränsen
* Brottgränsen =den spänning
där brott sker
* Keramer, glas$kuggfri$, null, 127, true, $kuggfri$cf8e91586$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('b9598645-8b12-5add-b41c-ea6dda4985cf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$hur-ser-ett-typiskt-dragprov-ut-for-ett-2$kuggfri$, $kuggfri$Hur ser ett typiskt dragprov ut för ett segt material?$kuggfri$, $kuggfri$* Elastiskt beteende upp till
sträckgränsen
* Sträckgränsen = den spänning där
materialet börjar plasticera
* Brottgränsen = högsta spänningen
* Elastisk avlastning även i plastiska
området
* Metaller, delkristallina termoplaster (mellan Tg och Tm)$kuggfri$, null, 128, true, $kuggfri$c40ba9ab2$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "polymerer" som exempel på sega material stämmer inte generellt, eftersom amorfa termoplaster (med undantag som PC) och härdplaster är spröda vid rumstemperatur; det är de delkristallina termoplasterna, mellan Tg och Tm, som är sega; Canvas, MTT085 Polymeric materials L6, s. 7, 8; Canvas, Lab-PM Polymer_MTT085-1, s. 2; Canvas, MTT085-Turorials-Part12, s. 3; Canvas, Fo 7 Styvhet, s. 7$kuggfri$, true, $kuggfri$Rättelse av originalkortet: exemplen på sega material var "Metaller, polymerer" (ordagrant Fö 7 Styvhet s. 7), men amorfa termoplaster (utom t.ex. PC) och härdplaster är spröda vid rumstemperatur (L6 s. 7, 8; Lab-PM Polymer s. 2). Nu står "Metaller, delkristallina termoplaster (mellan Tg och Tm)", vilket avviker från metalldelens bild. Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('33289dc7-b673-55d4-a065-92d76b09c55a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vilka-egenskaper-kan-observeras$kuggfri$, $kuggfri$Vilka egenskaper kan observeras/kartläggas med hjälp av dragprov?$kuggfri$, $kuggfri$![Spännings–töjningskurva från dragprov med E, Rp0,2, Rm och brottförlängning](/kort/materialteknik/dragprovkurva.svg)

* E-modul (styvhet) GPa
* Sträckgräns (börjar plasticera) MPa
* Brottgräns (största spänningen innan brott) MPa
* Brottförlängning (plastisk töjning efter brott) %
* Arean under kurvan: brottarbetet, dvs. energin per volymenhet fram till brott. (Seghet i betydelsen motstånd mot spricktillväxt, brottseghet, kan däremot inte mätas med dragprov, eftersom provet saknar spricka.)$kuggfri$, null, 129, true, $kuggfri$c58afc603$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "seghet = arean under dragprovkurvan" (2025) krockar med 2026 års definition av seghet som motstånd mot spricktillväxt, som inte kan fås ur dragprov; arean beskrivs nu som brottarbete; Canvas, Kapitel_08 Seghet och Brott, s. 2, 7; Canvas, Fo 9 Brott och brottseghet, s. 11; Canvas, Kapitel_04 Elastisk deformation, s. 20; Canvas, Fo 7 Styvhet, s. 9; Canvas, Kapitel_03 Materialval, s. 15; Canvas, Fo 8 Plasticitet, s. 2$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "Seghet = arean under dragprovkurvan" (Fö 7 Styvhet 2025 s. 9) krockar med 2026 års definition av seghet som motstånd mot spricktillväxt, som enligt Kapitel_08 s. 2 inte kan fås från dragprov. Arean kallas nu brottarbete (Fö 9 s. 11). Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('cb79bcf0-c444-5b47-9791-d98f7f31caf8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$dragprov-rp02-bestamning$kuggfri$, $kuggfri$Hur bestäms sträckgränsen $R_{p0{,}2}$ ur en dragprovkurva?$kuggfri$, $kuggfri$![Spännings–töjningskurva från dragprov med E, Rp0,2, Rm och brottförlängning](/kort/materialteknik/dragprovkurva.svg)

Sträckgränsen bestäms med en standardiserad offsetmetod: $R_{p0{,}2}$ är spänningen vid 0,2 % kvarstående (plastisk) töjning. Kurvans högsta spänning är brottgränsen $R_m$ (draghållfastheten), och lutningen i det elastiska området är E-modulen, $E = \Delta\sigma/\Delta\varepsilon$.$kuggfri$, null, 130, true, $kuggfri$cf2148830$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"En linje dras parallellt med kurvans elastiska del, förskjuten 0,2 % töjning, och sträckgränsen är spänningen där linjen skär kurvan.","correct":true},{"text":"Den är kurvans högsta spänning.","correct":false},{"text":"Den är spänningen när provet går av.","correct":false},{"text":"Den är lutningen hos kurvans elastiska del.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 15; Canvas, Kapitel_04 Elastisk deformation, s. 10; Canvas, Fo 8 Plasticitet, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('bfe7d804-7b1d-5940-ad1a-3011a4e724dc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$dragprov-rm-vid-brott$kuggfri$, $kuggfri$Brottgränsen $R_m$ är spänningen i det ögonblick provstaven går av i ett dragprov av en seg metall.$kuggfri$, $kuggfri$![Spännings–töjningskurva från dragprov med E, Rp0,2, Rm och brottförlängning](/kort/materialteknik/dragprovkurva.svg)

Falskt. Brottgränsen (draghållfastheten) $R_m$ är kurvans högsta spänning. För en seg metall sjunker den tekniska spänningen efter maximum, när provet får en midja, så spänningen vid brott är lägre än $R_m$.$kuggfri$, null, 131, true, $kuggfri$c6ade5745$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 15; Canvas, Kapitel_04 Elastisk deformation, s. 10; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 3$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('b00edef7-d562-5966-b3b2-4ef281fd25df', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$styvheten-hos-kompositer-beror-pa-fler$kuggfri$, $kuggfri$Styvheten hos kompositer beror på fler faktorer än homogena material gör, nämn minst två av dessa.$kuggfri$, $kuggfri$Styvheten beror på:

* De ingående komponenternas
egenskaper
* Volymfraktion
* Orientering
* Form

Ex: Fiberriktning$kuggfri$, null, 132, true, $kuggfri$c0859f190$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('60ee4565-6c5e-5669-b67f-8858de7bd4ca', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vad-ar-tojning$kuggfri$, $kuggfri$Vad är töjning?$kuggfri$, $kuggfri$Töjning är en geometrisk storhet: den relativa längdändringen, $\varepsilon = (L - L_0)/L_0$. Den är dimensionslös och anges ofta i procent (0,05 = 5 %). Dragspänning ger positiv töjning och tryckspänning negativ.

* Töjning kan orsakas av:

Mekaniska laster:
$\sigma = E\,\varepsilon$
Temperatur:
$\varepsilon = \alpha\,\Delta T$
$\alpha$ = längdutvidgningskoefficienten
Elektriska och magnetiska fält
Fukt m.m.$kuggfri$, null, 133, true, $kuggfri$c24d3d449$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Rättelse: töjning beskrevs som den procentuella förlängningen, men är den relativa längdändringen, dimensionslös och negativ vid tryck; Canvas, Kapitel_04 Elastisk deformation, s. 6, 7, 22; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 2; Canvas, Fo 7 Styvhet, s. 12$kuggfri$, true, $kuggfri$Rättelse av originalkortet: töjning beskrevs som "den procentuella förlängningen", men enligt Kapitel_04 s. 6 och 7 är den den relativa längdändringen ΔL/L0, dimensionslös och negativ vid tryck, och anges ofta i procent. Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('fc3d7020-a55c-5b64-8d7c-0ab7141a10cd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$vad-kannetecknar-ett-isotropt-material$kuggfri$, $kuggfri$Vad kännetecknar ett isotropt material?$kuggfri$, $kuggfri$Ett isotropt material har samma egenskaper oavsett i vilken riktning de mäts. Dess elastiska beteende beskrivs av två elastiska konstanter:

* E-modul
* Poissons tal, tvärkontraktion

Övriga moduler följer av dem, t.ex. skjuvmodulen $G = E/(2(1+\nu))$. Fler elastiska konstanter behövs i t.ex. kompositer och trä → anisotropt material.$kuggfri$, null, 134, true, $kuggfri$c36c31eca$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Rättelse: isotropi definierades som att materialet kan beskrivas med minst två elastiska konstanter, men definitionen är att egenskaperna är lika i alla riktningar; Canvas, Kapitel_04 Elastisk deformation, s. 15, 21, 23; Canvas, Short_dictionary_ v2026, s. 8; Canvas, Fo 7 Styvhet, s. 13$kuggfri$, true, $kuggfri$Rättelse av originalkortet: isotropi definierades som att materialet "kan beskrivas med minst två elastiska konstanter" (en läsning av Fö 7 Styvhet 2025 s. 13), men definitionen är att egenskaperna är desamma i alla riktningar (Kapitel_04 s. 23); E och ν står kvar och G = E/(2(1+ν)) är tillagt (Kapitel_04 s. 21). Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('fa1984b2-f558-570c-a331-a604f2b4d29c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$anisotropt$kuggfri$, $kuggfri$Anisotropt$kuggfri$, $kuggfri$Olika egenskaper i olika riktningar$kuggfri$, null, 135, true, $kuggfri$cb59ba541$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c3c66c32-5ded-5101-8c9e-271dc8f5b15b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$styvhet$kuggfri$, $kuggfri$Styvhet$kuggfri$, $kuggfri$Ett mått på hur mycket ett material deformeras elastiskt när det utsätts för en last.$kuggfri$, null, 136, true, $kuggfri$c6b630f01$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('957800a7-7c8a-5c24-9f39-dbdf80fe5599', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$ja-nej-basta-sattet-att-oka-e-modulen$kuggfri$, $kuggfri$Det bästa sättet att öka en metalls E-modul är att värmebehandla (härda) den.$kuggfri$, $kuggfri$E-modulen bestäms av atombindningarnas styvhet och antalet bindningar per area, och i metaller påverkar värmebehandling och bearbetning inte E-modulen. Härdning höjer i stället sträckgräns och hårdhet. Vill man ändra E-modulen är det mest effektivt att kombinera material i makroskala, t.ex. styva fibrer i en mindre styv matris i en komposit.$kuggfri$, null, 137, true, $kuggfri$cd6d7f27e$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_04 Elastisk deformation, s. 12, 24, 26; Canvas, Fo 7 Styvhet, s. 4, 5; Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('b4c5783f-d35b-52cf-a5df-727f449202b2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$ja-nej-dislokationer-ar-lika-viktiga$kuggfri$, $kuggfri$Dislokationer är lika viktiga för ett materials E-modul som för dess sträckgräns.$kuggfri$, $kuggfri$Dislokationsrörelse ger plastisk deformation, och genom att försvåra den höjs sträckgränsen. E-modulen beskriver elastisk deformation och bestäms av atombindningarnas styvhet; den påverkas inte av värmebehandling och bearbetning, som ändrar dislokationsstrukturen.$kuggfri$, null, 138, true, $kuggfri$cfb898e48$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 18, 30; Canvas, Kapitel_04 Elastisk deformation, s. 12; Canvas, Fo 7 Styvhet, s. 4; Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('34aea368-5a8b-51c0-9712-df9ef011bca4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$quiz-styvhet-vad-ar-sant-tva-ratta-svar$kuggfri$, $kuggfri$Styvhet: vilka påståenden är sanna?$kuggfri$, $kuggfri$Styvhet är motståndet mot elastisk formförändring, och E-modulen är lutningen i den elastiska delen av spännings-töjningskurvan ($\sigma = E\varepsilon$). Låg E-modul ger alltså stor elastisk töjning vid en given spänning, ett vekt material, medan hög E-modul ger liten deformation. Sprödhet hänger ihop med låg brottseghet, inte med låg E-modul. Quizens "lätta att deformera" är preciserat till elastisk deformation.$kuggfri$, null, 139, true, $kuggfri$c8fa45056$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Material med låg E-modul är lätta att deformera elastiskt.","correct":true},{"text":"Material med låg E-modul är veka.","correct":true},{"text":"Material med hög E-modul kan deformeras mycket.","correct":false},{"text":"Material med låg E-modul är spröda.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 1, fråga 8; Canvas, Kapitel_04 Elastisk deformation, s. 2, 9, 12; Canvas, Kapitel_01 Intro till Material, s. 16$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('eb16f80b-2faa-5900-bcb4-2feb958d4fcc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$quiz-vad-ar-ratt-for-styvhet-2-ratta-svar$kuggfri$, $kuggfri$Styvhet: vilka påståenden om E-modul och elastisk deformation är rätt?$kuggfri$, $kuggfri$Metaller som stål har en linjärt elastisk del av spännings-töjningskurvan (E ≈ 210 GPa för stål). Poissons tal är bara definierat i det elastiska området och beskriver, liksom E-modulen, elastisk deformation. E-modulen är en materialegenskap och kan bestämmas med både drag- och böjprov. Hög E-modul hänger ihop med starka atombindningar, och empiriskt har material med hög E-modul låg expansionskoefficient.$kuggfri$, null, 140, true, $kuggfri$cda01ac6b$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Stål kan inte deformeras elastiskt.","correct":false},{"text":"E-modul och Poissons tal beskriver båda elastisk deformation.","correct":true},{"text":"E-modulen är olika vid dragbelastning och böjbelastning.","correct":false},{"text":"Material med hög E-modul har oftast låg termisk utvidgningskoefficient.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 3, fråga 1; Canvas, Kapitel_04 Elastisk deformation, s. 12, 14; Canvas, 2026-09-25 Kapitel_12 Material och varme, s. 15$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('790cfd4a-27ed-546a-b726-1a74a9afcd44', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$quiz-styvhet-vad-ar-ratt-2-ratta-svar$kuggfri$, $kuggfri$Styvhet: vilka påståenden om att ändra E-modulen är rätt?$kuggfri$, $kuggfri$I metaller påverkar värmebehandling och bearbetning inte E-modulen, och att ändra modulen genom legering (mikroskala) är mindre effektivt än att kombinera material i makroskala, t.ex. i en komposit. En komposit med orienterade fibrer är anisotrop och har olika E-modul i olika riktningar. I polymerer är kedjorna kovalent bundna, men bindningarna mellan kedjorna (van der Waals- och vätebindningar) är svaga. Quizens "de svaga atombindningarna" är preciserat till bindningarna mellan kedjorna.$kuggfri$, null, 141, true, $kuggfri$ce857280a$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Man kan öka en metalls E-modul genom härdning.","correct":false},{"text":"Ett vanligt sätt att öka en metalls E-modul är att legera med en tyngre metall.","correct":false},{"text":"E-modulen hos en komposit kan vara olika i olika riktningar.","correct":true},{"text":"Polymerers relativt låga E-modul förklaras av de svaga bindningarna mellan polymerkedjorna.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 3, fråga 2; Canvas, Kapitel_04 Elastisk deformation, s. 12, 23, 24, 26, 42; Canvas, Fo 1 Materialegenskaper och materialgrupper HT25, s. 14$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('18449a8e-ff18-58cc-a15a-3106400df92e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$poissons-tal-elastiska-omradet$kuggfri$, $kuggfri$Poissons tal är bara definierat i det elastiska området.$kuggfri$, $kuggfri$Poissons tal $\nu$ är den negativa kvoten mellan tvärtöjning och längstöjning vid dragbelastning, och det är definierat bara i det elastiska området. Typiska värden: metaller ca 0,3, keramer 0,2 till 0,3, polymerer ca 0,4 och gummi nära 0,5.$kuggfri$, null, 142, true, $kuggfri$c4036606f$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_04 Elastisk deformation, s. 14$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3707d01a-6c18-5113-a38a-1a3428bfd92f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$skjuvmodul-stal-berakning$kuggfri$, $kuggfri$Stål har E = 210 GPa och $\nu = 0{,}3$. Vilken skjuvmodul G ger det?$kuggfri$, $kuggfri$För ett isotropt material gäller $G = \dfrac{E}{2(1+\nu)} = \dfrac{210}{2 \cdot 1{,}3} \approx 81$ GPa. 105 GPa fås om man glömmer faktorn $(1+\nu)$, 162 GPa om man glömmer faktorn 2, och 273 GPa är $E(1+\nu)$, dvs. man har multiplicerat med $(1+\nu)$ och glömt faktorn 2.$kuggfri$, null, 143, true, $kuggfri$c167d859c$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 81 GPa","correct":true},{"text":"Ca 105 GPa","correct":false},{"text":"Ca 162 GPa","correct":false},{"text":"Ca 273 GPa","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_04 Elastisk deformation, s. 12, 14, 21$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3aba3671-9359-57ac-8cad-a0b47897cc09', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '7b4bdbf7-ac7f-5d46-8266-31205b083f96', $kuggfri$blandningsregeln$kuggfri$, $kuggfri$Blandningsregeln$kuggfri$, $kuggfri$En egenskap hos en komposit eller hybrid uppskattas genom att de ingående materialens egenskaper viktas med volymandelarna. För densiteten gäller $\rho = f\rho_A + (1-f)\rho_B$, där f är volymandelen av material A. För E-modulen ger blandningsregeln i stället en övre och en nedre gräns. I kursens exempel räknas modulen för långa parallella fibrer (längs fibrerna) och för små partiklar, som motsvarar den nedre gränsen.$kuggfri$, null, 144, true, $kuggfri$c78eee21d$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, Short_dictionary_ v2026, s. 12; Canvas, Kapitel_04 Elastisk deformation, s. 26, 27, 28$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('868c4718-d4ed-5563-adc5-688f003a52db', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$hur-mats-ett-materials-hardhet$kuggfri$, $kuggfri$Hur mäts ett materials hårdhet?$kuggfri$, $kuggfri$* Mäts med intryck
* Olika metoder med
olika form på
indenter och olika
last
* Kopplar till
sträckgräns$kuggfri$, null, 145, true, $kuggfri$cb2a80d92$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('9572836a-8873-57b7-acba-30ec59fa647d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-kan-det-finnas-for-defekter-i$kuggfri$, $kuggfri$Vad kan det finnas för defekter i kristaller?$kuggfri$, $kuggfri$* Vakanser = atomer saknas
* Inlösta atomer = atom av
annan sort
* Dislokationer = extra
atomplan
* Korngränser$kuggfri$, null, 146, true, $kuggfri$c0ab71ac0$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d7a8223b-69cb-5f19-8d0a-6c9a30699b40', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$beskriv-ingaende-vad-dislokationer-och$kuggfri$, $kuggfri$Beskriv ingående vad dislokationer och dislokationsrörelser är och vad det innebär för materialet.$kuggfri$, $kuggfri$Dislokationer är en typ av strukturmässig avvikelse i kristallen i form av "extra atomplan". De bryter alltså det annars uniforma mönstret hos kristallen.

* När kristallen belastas över sträckgränsen kan dislokationer röra sig
* Dislokationerna rör sig på glidsystem = glidplan + glidriktning
* Glidningen ger upphov till en förskjutning som har storlek och riktning som glidvektorn, Burgers vektor

Dislokationen kan sättas i rörelse av skjuvspänningar och rör sig sedan i små steg. Detta ger upphov till små förskjutningar eller annars kallat; plastiska deformationer i kristallstrukturen.

* Dislokationerna rör sig lättast i
riktningar nära 45 grader mot
belastningsriktningen
* Plasticering sker under
konstant volym
* Ger upphov till skjuvband =
band av plasticerat material$kuggfri$, null, 147, true, $kuggfri$c3fddec37$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('bdde4b07-0a8c-5e79-930a-1ec43cabd094', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-en-hardningsmekanism-namn-minst$kuggfri$, $kuggfri$Vad är en härdningsmekanism? Nämn minst två olika typer av härdningsmekanismer.$kuggfri$, $kuggfri$En förändring av mikrostrukturen för att göra dislokationsrörelser svårare. Det resulterar i högre sträckgräns, hårdhet och ofta lägre brottförlängning. De olika typerna av härdningsmekanismer är:

1. Lösningshärdning
2. Utskiljningshärdning
3. Deformationshärdning
4. Korngränshärdning$kuggfri$, null, 148, true, $kuggfri$cb564e8df$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('19c6729c-f900-5e59-a867-310a3bddcac4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-losningshardning-och-hur-gar-det$kuggfri$, $kuggfri$Vad är lösningshärdning och hur går det till?$kuggfri$, $kuggfri$* Atomer av annan sort löses in i
kristallen
* Spänningsfältet kring atomerna
hindrar dislokationsrörelse
* Större effekt med större
koncentration och större skillnad i
atomstorlek
* Sker med legering i smälta$kuggfri$, null, 149, true, $kuggfri$c560695e6$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('695a24b3-4bad-5386-8dcf-34119a088d8c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-utskiljningshardning-och-hur-gar$kuggfri$, $kuggfri$Vad är utskiljningshärdning och hur går det till?$kuggfri$, $kuggfri$* Partiklar av annan fas
bildas i materialet
* Partiklarna hindrar
dislokationsrörelse
* Sker med legering i smälta
och värmebehandling i
fast form$kuggfri$, null, 150, true, $kuggfri$c9c6febd6$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('27d1e234-cb5f-5cc9-8017-ecd793b9a6be', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-deformationshardning-och-hur-gar$kuggfri$, $kuggfri$Vad är deformationshärdning och hur går det till?$kuggfri$, $kuggfri$* Dislokationer hindrar andra
dislokationer att röra sig (låser
varandra)
* Mängden dislokationer ökar
kraftigt vid plastisk
deformation → plastiskt
hårdnande
* Sker vid kallbearbetning
(pressning, valsning, smide ...)$kuggfri$, null, 151, true, $kuggfri$cda37f5df$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6fbfcc5e-7066-58f1-8030-8b3841e89331', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$vad-ar-korngarnshardning-och-hur-gar$kuggfri$, $kuggfri$Vad är korngränshärdning och hur går det till?$kuggfri$, $kuggfri$* Minska storleken på kornen som utgör materialet så att antalet korngränser ökar
* Korngränser hindrar
dislokationer
* Små korn ger hårdare material
* Viktigt hos BCC-metaller (vissa
stål)$kuggfri$, null, 152, true, $kuggfri$c8f444b4e$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('4a90b17b-5925-5e27-9d4a-1c775d3725af', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$brottforlangning$kuggfri$, $kuggfri$Brottförlängning$kuggfri$, $kuggfri$Den plastiska förlängningen som kvarstår efter ett material har belastats till brott.$kuggfri$, null, 153, true, $kuggfri$c5a09cd20$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1a8920c7-444e-55dd-a0d3-e2b9fc75f32f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$ja-nej-malet-med-utskiljningshardning$kuggfri$, $kuggfri$Målet med utskiljningshärdning är att få bort dislokationerna.$kuggfri$, $kuggfri$Utskiljningshärdning skapar små, jämnt fördelade partiklar av en annan fas som hindrar dislokationernas rörelse. När dislokationerna får svårare att röra sig ökar sträckgränsen och hårdheten. Dislokationerna finns kvar; det är deras rörelse som bromsas.$kuggfri$, null, 154, true, $kuggfri$c585bb2a2$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 30, 33, 35; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 26; Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('287429c1-2dbd-5de2-b528-b53465e1cd6d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$quiz-strackgrans-vad-ar-sant-tva-ratta-svar$kuggfri$, $kuggfri$Sträckgräns: vilka påståenden är sanna?$kuggfri$, $kuggfri$Under sträckgränsen är deformationen elastisk och materialet återgår till sin ursprungliga form; över sträckgränsen uppstår permanent (plastisk) deformation. Hårdheten kopplar till sträckgränsen och korrelerar med brottgränsen för duktila material, så hårda material har i regel hög sträckgräns. Sträckgränsen är en spänning (MPa), inte en förlängning; den plastiska töjningen efter brott kallas brottförlängning.$kuggfri$, null, 155, true, $kuggfri$c13403641$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Vid belastning under sträckgränsen beter sig ett material elastiskt.","correct":true},{"text":"Hårda material har vanligen låg sträckgräns.","correct":false},{"text":"Vid belastning över sträckgränsen fås permanent formförändring.","correct":true},{"text":"Sträckgränsen är den maximala förlängningen vid en sträckning av materialet.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 1, fråga 7; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 3, 6; Canvas, Fo 8 Plasticitet, s. 3; Canvas, Fo 7 Styvhet, s. 9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2d437028-ade3-5787-be6f-40cb1b5cd05c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$quiz-strackgrans-vad-ar-ratt-tva-ratta-svar$kuggfri$, $kuggfri$Sträckgräns: vilka påståenden är rätt?$kuggfri$, $kuggfri$Under sträckgränsen är deformationen elastisk, oavsett hur hårt materialet är. Sträckgränsen bestäms med en standardiserad offsetmetod, $R_{p0{,}2}$, dvs. den spänning som ger 0,2 % kvarstående töjning. Vid plastisk deformation ökar dislokationstätheten och metallen deformationshärdas, så sträckgränsen stiger. Lösningshärdning beror på att de inlösta atomerna har en annan storlek än värdatomerna och stör dislokationsrörelsen, inte på att legeringsämnet är hårdare.$kuggfri$, null, 156, true, $kuggfri$cbda9afc4$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ett hårt material som belastas under sträckgränsen beter sig elastiskt.","correct":true},{"text":"Det vanligaste sättet att öka en metalls sträckgräns är att legera med en hårdare metall.","correct":false},{"text":"När man plasticerar en metall sjunker sträckgränsen.","correct":false},{"text":"Vid mätning definieras sträckgränsen som den spänning som ger 0,2 % plastisk töjning.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 3, fråga 3; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 3, 31, 36; Canvas, Kapitel_03 Materialval, s. 15; Canvas, Fo 8 Plasticitet, s. 11, 15$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('07aee70e-3f91-555b-bece-8d2f3c9e4f75', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$quiz-dislokationer-vad-ar-ratt-tva-ratta-svar$kuggfri$, $kuggfri$Dislokationer: vilka påståenden är rätt?$kuggfri$, $kuggfri$Dislokationer ger plastisk, inte elastisk, deformation, och genom att försvåra deras rörelse höjs sträckgränsen. Dislokationer är kristalldefekter i metaller och keramer och förklarar inte polymerers låga sträckgräns. Dislokationer rör sig lättast nära 45 grader mot belastningsriktningen, där skjuvspänningen på glidsystemet, $\tau = \sigma \cos\lambda \cos\varphi$, blir störst; ett korn börjar deformeras när skjuvspänningen på dess glidsystem blir tillräckligt hög. Quizens alternativ "För att en dislokation ska kunna ge plastisk töjning måste den röra sig på ett atomplan nära 45 grader" är omformulerat, eftersom föreläsningen säger "lättast" och inte "måste".$kuggfri$, null, 157, true, $kuggfri$c1f59a77c$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Dislokationer har stor betydelse för elastisk deformation.","correct":false},{"text":"Ett bra sätt att öka sträckgränsen är att försvåra dislokationsrörelse.","correct":true},{"text":"Polymerer har låg sträckgräns på grund av att de alltid innehåller många dislokationer.","correct":false},{"text":"Dislokationer rör sig lättast i riktningar nära 45 grader mot belastningsriktningen.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 3, fråga 4; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 16, 20, 30; Canvas, Kapitel_04 Elastisk deformation, s. 12; Canvas, Fo 8 Plasticitet, s. 9$kuggfri$, false, $kuggfri$Quizens rätta alternativ "måste den röra sig på ett atomplan som är nära 45 grader" är för starkt: Fö 8 Plasticitet s. 9 säger att dislokationerna rör sig "lättast" nära 45 grader, och Kapitel_06 s. 20 att glidning sker när skjuvspänningen på glidsystemet blir tillräckligt hög. Kortet har skrivit om alternativet till "rör sig lättast" och behållit det som rätt. Godkänns omskrivningen, och ska Quiz vecka 3 fråga 4 ändras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('0ab353c8-7ef0-539d-930c-05cf36a94977', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$quiz-hardningsmekanismer-vad-ar-ratt-2-ratta$kuggfri$, $kuggfri$Härdningsmekanismer: vilka påståenden är rätt?$kuggfri$, $kuggfri$Deformationshärdning kräver bara plastisk deformation (dislokationerna blir fler och låser varandra) och fungerar på både legerade och olegerade metaller. Utskiljningshärdning kräver ett legeringsämne som kan skiljas ut som partiklar. Värms en kallbearbetad metall bildas nya små korn med få dislokationer (rekristallisation), och sträckgränsen sjunker medan brottförlängningen ökar. Korngränser hindrar dislokationer, så det är små korn som ger hårdare material (korngränshärdning). Quizens två felaktiga alternativ ("När man värmebehandlar metaller så låser sig dislokationerna och sträckgränsen ökar" och "Om man minskar mängden kristalldefekter så ökar hållfastheten") är utbytta, eftersom de inte är entydigt fel: utskiljningshärdning är en värmebehandling där partiklar låser dislokationerna, och enligt kursen är det dislokationerna som gör att metaller inte når den ideala hållfastheten.$kuggfri$, null, 158, true, $kuggfri$c0bdc4bda$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Rena metaller kan deformationshärdas.","correct":true},{"text":"När en kallbearbetad metall värms så att den rekristalliserar ökar sträckgränsen.","correct":false},{"text":"Utskiljningshärdning kan bara göras på legeringar, inte på rena metaller.","correct":true},{"text":"Större korn (färre korngränser) ger högre hållfasthet.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 3, fråga 5; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 14, 15, 33, 35, 36; Canvas, Fo 8 Plasticitet, s. 13, 15, 17; Canvas, Fo 12 Stal, s. 5; Canvas, Svarsforslag Tentamen MTT085 25-01, s. 7$kuggfri$, false, $kuggfri$Quizens två felaktiga alternativ kunde läsas som sanna ("värmebehandling låser dislokationerna och sträckgränsen ökar" stämmer för utskiljningshärdning, Kapitel_06 s. 35; "färre kristalldefekter ger högre hållfasthet" stämmer i gränsen mot ideal hållfasthet, Kapitel_06 s. 14, 15) och är utbytta mot entydigt felaktiga om rekristallisation och grova korn. Godkänns bytet, och ska Quiz vecka 3 fråga 5 ändras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ac5c6f0f-b9d0-5c3e-8276-17046989f5d2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$quiz-kristalstorningar-kristalldefekter-vad$kuggfri$, $kuggfri$Kristallstörningar (kristalldefekter): vilka påståenden är rätt?$kuggfri$, $kuggfri$Kristalldefekter är avvikelser från den perfekta kristallen: vakanser, lösta atomer, dislokationer och korngränser. Porer och sprickor är defekter i materialet men inte kristalldefekter. Vakanser spelar roll vid diffusion, krypning och sintring men påverkar inte hållfastheten. Inlösta atomer ger lösningshärdning och höjer sträckgränsen, medan E-modulen i stort sett inte ändras av legering i mikroskala.$kuggfri$, null, 159, true, $kuggfri$cd6794fbe$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Porer och sprickor är exempel på kristalldefekter.","correct":false},{"text":"Vakanser och inlösta atomer är exempel på kristalldefekter.","correct":true},{"text":"Vakanser är en typ av kristalldefekt som försvagar materialet.","correct":false},{"text":"Inlösta atomer kan användas för att höja sträckgränsen, men påverkar E-modulen i liten omfattning.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 3, fråga 6; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 16, 17; Canvas, Fo 8 Plasticitet, s. 5, 11; Canvas, Kapitel_04 Elastisk deformation, s. 12, 26$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('f7368ca0-99f8-5fdf-83c9-17b4007a657b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$duktilitet$kuggfri$, $kuggfri$Duktilitet$kuggfri$, $kuggfri$Ett mått på formbarhet, dvs. hur formbart materialet är. I dragprov mäts den som brottförlängning (t.ex. 20 %) eller areakontraktion. Rörliga dislokationer är viktiga för metallers formbarhet och duktilitet, och starkare legeringar tenderar att ha lägre duktilitet.$kuggfri$, null, 160, true, $kuggfri$c46753837$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 3, 24; Canvas, Kapitel_08 Seghet och Brott, s. 2; Canvas, Short_dictionary_ v2026, s. 4$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('f28c6496-832f-5741-9b0f-7a45cf4f00f3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$glidsystem$kuggfri$, $kuggfri$Glidsystem$kuggfri$, $kuggfri$Kombinationen av ett glidplan och en glidriktning, där dislokationer rör sig. Glidplanen och glidriktningarna korrelerar med de mest tätpackade planen och de tätpackade riktningarna i dem. Ett korn börjar deformeras plastiskt när skjuvspänningen på ett glidsystem, $\tau = \sigma\cos\lambda\cos\varphi$, blir tillräckligt hög.$kuggfri$, null, 161, true, $kuggfri$c703ea533$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 20, 28$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('217772a9-04b7-5f05-909b-1a6ed287a226', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$skruvdislokation-burgers-vektor$kuggfri$, $kuggfri$I en skruvdislokation är Burgers vektor parallell med dislokationslinjen.$kuggfri$, $kuggfri$I en skruvdislokation förskjuts kristallens övre del parallellt med snittkanten, och Burgers vektor är parallell med dislokationslinjen. En kantdislokation kan ses som kanten av ett extra halvplan av atomer, och där är förskjutningen vinkelrät mot dislokationslinjen. Verkliga dislokationer växlar mellan de två typerna längs linjen.$kuggfri$, null, 162, true, $kuggfri$c9be464a3$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 18, 19, 22, 23, 24$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8bb74730-d8dc-52be-8b4b-8fba46a18178', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$hardning-okad-dislokationstathet$kuggfri$, $kuggfri$Vilken härdningsmekanism bygger på att dislokationstätheten ökar vid plastisk deformation?$kuggfri$, $kuggfri$Vid plastisk deformation (t.ex. kallvalsning eller smide) skapas fler dislokationer som hindrar varandra, och ju mer deformation, desto mer hårdnande. Lösningshärdning bygger på inlösta främmande atomer, utskiljningshärdning på små partiklar och korngränshärdning på att korngränserna hindrar dislokationer från att glida vidare till nästa korn.$kuggfri$, null, 163, true, $kuggfri$cdc800194$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Deformationshärdning","correct":true},{"text":"Lösningshärdning","correct":false},{"text":"Utskiljningshärdning","correct":false},{"text":"Korngränshärdning","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 31, 33, 36, 37, 40$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('7b45a40a-203f-5396-bde8-baf2b78b9fe8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$ideal-hallfasthet-dislokationer$kuggfri$, $kuggfri$Varför når metaller inte den ideala hållfastheten, dvs. den spänning som krävs för att bryta alla bindningar i ett plan samtidigt?$kuggfri$, $kuggfri$Därför att metaller innehåller dislokationer. För att en dislokation ska röra sig behöver bara bindningarna längs dislokationslinjen brytas, vilket är betydligt lättare än att bryta alla bindningar i glidplanet på en gång. Glidförskjutningen per dislokation är mycket liten, men när enormt många dislokationer passerar genom kristallen på flera glidplan deformeras materialet makroskopiskt redan vid en spänning långt under den ideala hållfastheten. (I keramer är förklaringen i stället att de inte kan skapa rörliga dislokationer och därför inte deformeras plastiskt; spänningarna kan inte fördelas till en större volym, och spänningskoncentrationer ger höga lokala spänningar.)$kuggfri$, null, 164, true, $kuggfri$c881c44e5$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 13, 14, 15, 27$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('32c379f2-2d2d-5c6f-9627-ca078a04fb87', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$hardhet$kuggfri$, $kuggfri$Hårdhet$kuggfri$, $kuggfri$Materialets motstånd mot intryckning. Vid ett hårdhetsprov pressas en diamant- eller kulformad intryckskropp in i ytan med bestämd kraft, och intrycket mäts (t.ex. diagonalerna i ett Vickersintryck). Hårdheten kopplar till sträckgränsen, alltså till motståndet mot plastisk deformation, och korrelerar ganska bra med brottgränsen för duktila material. Undantag: spröda material kan ha hög hårdhet men låg brottgräns i dragprov. Hårdhetsprov kräver bara en liten volym och är oftast oförstörande.$kuggfri$, null, 165, true, $kuggfri$cdd106f10$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 6; Canvas, Fo 8 Plasticitet, s. 3; Canvas, Short_dictionary_ v2026, s. 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2df6657b-e175-5a4d-a514-8fb2d5ebb695', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$hardningsmekanismer-kombineras$kuggfri$, $kuggfri$Vilka kombinationer av härdningsmekanismer används för aluminiumlegeringar enligt kursen?$kuggfri$, $kuggfri$Härdningsmekanismerna kombineras ofta, men ökad hållfasthet minskar i allmänhet duktiliteten. Alla verkar genom att försvåra dislokationsrörelse. Lösnings- och utskiljningshärdning kräver legeringsämnen, så ren aluminium härdas i stället t.ex. genom deformationshärdning.$kuggfri$, null, 166, true, $kuggfri$c362ac054$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Icke värmebehandlingsbara legeringar: lösningshärdning och deformationshärdning","correct":true},{"text":"Värmebehandlingsbara legeringar: utskiljningshärdning och deformationshärdning","correct":true},{"text":"Ren aluminium: lösningshärdning och utskiljningshärdning","correct":false},{"text":"Ingen kombination, eftersom en metall bara kan härdas med en mekanism åt gången","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 44; Canvas, Ovning 7 m losningar, s. 5; Canvas, Fo 13 Aluminium och andra metaller, s. 7, 8; Canvas, Fo 12 Stal, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('097f85b4-ce05-5785-94bc-2814c8770a28', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$glidsystem-fcc$kuggfri$, $kuggfri$Vilka plan och riktningar bildar glidsystemen i en FCC-metall?$kuggfri$, $kuggfri$Glidplan och glidriktningar korrelerar med de mest tätpackade planen och de tätpackade riktningarna i dem. I FCC ligger atomerna tätt längs ytdiagonalerna, $\langle 110\rangle$, och de tätpackade skikten (staplade ABCABC) syns när man tittar längs en rymddiagonal. De är alltså vinkelräta mot $\langle 111\rangle$, och eftersom Millerindex jämförs med planets normal är de $\{111\}$-planen. Ett $\{111\}$-plan, t.ex. triangeln genom (1, 0, 0), (0, 1, 0) och (0, 0, 1), innehåller tre $\langle 110\rangle$-riktningar längs triangelns sidor. Rymddiagonalen $\langle 111\rangle$ är tätpackad i BCC, inte i FCC. FCC har många glidsystem och är lätt att deformera plastiskt; HCP har få.$kuggfri$, null, 167, true, $kuggfri$c860cccff$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"De tätpackade planen $\\{111\\}$ och de tätpackade riktningarna $\\langle 110\\rangle$ i dem (ytdiagonalerna)","correct":true},{"text":"Kubens sidoytor $\\{100\\}$ och kanterna $\\langle 100\\rangle$","correct":false},{"text":"Planen $\\{110\\}$ och rymddiagonalerna $\\langle 111\\rangle$","correct":false},{"text":"Alla plan och riktningar, eftersom hela FCC-strukturen är tätpackad","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 20, 28; Canvas, GLU 01 Kristallstrukturer, s. 11, 15, 19; Canvas, Guided Learning Unit 1, s. 4 (GL1-4); Canvas, Fo 12 Stal, s. 2$kuggfri$, false, $kuggfri$Att glidsystemen i FCC är {111}<110> står inte ordagrant i kursmaterialets text; kortet härleder det ur Kapitel_06 s. 28 (glidsystemen följer de tätast packade planen och riktningarna) och GLU 01 s. 19, och beteckningen finns uttryckligen bara i tentan 2015-10-26 uppg. 4a. Räcker härledningen som belägg?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ecfe2d12-bdf6-53f5-b1f9-a5fc26fa4526', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'b1e2c1c7-3222-5068-b863-314ad83c0320', $kuggfri$plastisk-deformation-onskvard$kuggfri$, $kuggfri$I vilka situationer är plastisk deformation önskvärd?$kuggfri$, $kuggfri$Plastisk deformation ger en permanent formförändring. Den utnyttjas i de plastiska formningsmetoderna och i konstruktioner som ska ta upp mycket energi, t.ex. energiupptagande strukturer i bilar och krockbarriärer som deformeras plastiskt (de kan då inte återanvändas). En fjäder ska lagra så mycket elastisk energi som möjligt och får inte plasticera, och en bärande komponent dimensioneras normalt så att den inte plasticerar i drift.$kuggfri$, null, 168, true, $kuggfri$cea434ee3$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Vid formning av metaller, t.ex. valsning, smide, pressning och tråddragning","correct":true},{"text":"I energiupptagande konstruktioner, t.ex. krockbarriärer, som tar upp energi genom plastiskt arbete","correct":true},{"text":"I en fjäder, som ska lagra elastisk energi","correct":false},{"text":"I en bärande balk under normal drift","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 12 Stal, s. 7; Canvas, Ovning 4 m losningar, s. 1, 6; Canvas, Ovning 7 m losningar, s. 3$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d181901e-43d2-5b1c-b4b2-b828384d3ce2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$varfor-ar-sproda-material-extra$kuggfri$, $kuggfri$Varför är spröda material extra känsliga för defekter?$kuggfri$, $kuggfri$Största förekommande defekten i en komponent ger störst spänning vilket innebär att brottet börjar där. Brottstyrkan blir då beroende av sannolikheten för att det finns en defekt i det belastade området och ju större komponenten är desto högre blir sannolikheten att det förekommer defekter. Eftersom sprickor uppträder lättare i spröda material blir de mer defektkänsliga.$kuggfri$, null, 169, true, $kuggfri$c0fb684f5$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('1cbdc93f-ab00-5877-9864-891fd35453e0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$vad-har-temperatur-for-inverkan-pa-ett$kuggfri$, $kuggfri$Vad har temperatur för inverkan på ett materials brottseghet?$kuggfri$, $kuggfri$Vid låga temperaturer blir vissa metaller och alla polymerer spröda. När temperaturen sjunker ökar sträckgränsen för de flesta material, vilket minskar den plastiska zonen vid sprickspetsen och därmed segheten. Endast metaller med FCC-struktur förblir duktila vid de lägsta temperaturerna.

Övergången mellan segt och sprött beteende (omslagstemperaturen) bestäms med slagprovning.$kuggfri$, null, 170, true, $kuggfri$c7cc42439$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet sa att alla material blir sprödare när temperaturen sjunker, men metaller med FCC-struktur förblir duktila; Canvas, Kapitel_08 Seghet och Brott, s. 31; Canvas, Kapitel_08 Seghet och Brott, s. 37; Canvas, Fö 9 Brott och brottseghet, s. 3$kuggfri$, true, $kuggfri$Rättelse av originalkortet: det sa att materialen generellt blir sprödare när temperaturen sjunker, men metaller med FCC-struktur förblir duktila. Texten följer nu Kapitel_08 s. 31 (vissa metaller och alla polymerer blir spröda, sträckgränsen ökar, den plastiska zonen krymper). Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('14881e99-7c46-5d30-a7b6-0f202f4270f1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$vad-ar-skillnaden-mellan-ett-segt$kuggfri$, $kuggfri$Vad är skillnaden mellan ett segt- respektive sprött brott?$kuggfri$, $kuggfri$* **Segt brott** föregås av tydlig plastisk deformation och stora formändringar. Hålrum bildas vid inneslutningar, växer och går samman till brott. Brottytan är matt och ojämn (skål- och konformad). Typiskt för de flesta metaller vid rumstemperatur.
* **Sprött brott** sker utan nämnvärd plastisk deformation, ofta plötsligt. Brottytan är relativt jämn och glänsande med kornig struktur. Uppträder främst vid låga temperaturer, höga belastningshastigheter och i spröda material som keramer och härdat stål.$kuggfri$, null, 171, true, $kuggfri$c62d40822$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "deformeras plastiskt under en längre tid" var missvisande, det är mängden plastisk deformation och inte tiden som skiljer brotten åt; Canvas, Svarsförslag uppgift 4-6, IMS085 251030, s. 1; Canvas, Kapitel_08 Seghet och Brott, s. 27; Canvas, Kapitel_08 Seghet och Brott, s. 28$kuggfri$, true, $kuggfri$Rättelse av originalkortet: det sa att ett segt material deformeras plastiskt "under en längre tid", men det är mängden plastisk deformation och inte tiden som skiljer brotten åt (Kapitel_08 s. 27, 28). Den nya baksidan följer nästan ordagrant svarsförslaget till tentan 2025-10-30 uppg. 4 (t.ex. "relativt jämn och glänsande med kornig struktur"). Godkänns rättelsen, eller ska baksidan skrivas om med egna ord?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('2c88472e-7c27-5189-9afe-e136a56bbef9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$vad-anvander-man-for-typ-av-test-for$kuggfri$, $kuggfri$Vad använder man för typ av test för att undersöka ett materials brottseghet?$kuggfri$, $kuggfri$Brottsegheten $K_{1c}$ bestäms med prov som har en skarp spricka, t.ex. CT-prov (compact tension) eller SENB-prov (single edge notched beam). Båda provstavstyperna har en utmattningsspricka. Provet måste vara så brett att plant töjningstillstånd råder längs sprickfronten; först då blir $K_{1c}$ en ren materialegenskap.

Slagprovning (Charpy) med en anvisad provstav mäter i stället slagseghet, energin för att slå av staven. Den gör det möjligt att jämföra materials seghet och bestämma omslagstemperaturen, men ger inget sätt att uttrycka seghet som en materialegenskap.$kuggfri$, null, 172, true, $kuggfri$c9a59a12d$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet sa att brottseghet bestäms med slagprovning, men slagprovning mäter slagseghet; Canvas, Kapitel_08 Seghet och Brott, s. 8; Canvas, Kapitel_08 Seghet och Brott, s. 16; Canvas, Kapitel_08 Seghet och Brott, s. 21$kuggfri$, true, $kuggfri$Rättelse av originalkortet: det sa att brottseghet bestäms med slagprovning, men slagprovning ger slagseghet och inte seghet som materialegenskap (Kapitel_08 s. 8). Nu står CT- och SENB-prov med skarp spricka och plant töjningstillstånd (Kapitel_08 s. 16, 21), sidor som är märkta "Känna till, inga detaljfrågor på tentan". Godkänns rättelsen, och är detaljnivån rimlig?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('95ce58de-0758-5300-b2da-cfeda7f1e9dd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$hogcykelutmattning$kuggfri$, $kuggfri$Högcykelutmattning$kuggfri$, $kuggfri$Utmattning är brott som uppkommer vid cyklisk belastning. Vid högcykelutmattning är belastningen under sträckgränsen, och materialet plasticerar bara lokalt
vid sprickspetsen, vilket ger ett stort antal cykler till brott.$kuggfri$, null, 173, true, $kuggfri$cf45f3841$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('aec8731f-4b78-5bd7-82c7-91d8f13fa20b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$slagseghet$kuggfri$, $kuggfri$Slagseghet$kuggfri$, $kuggfri$Den energi som går åt för att slå av en anvisad provstav. Ett mått på hur segt eller sprött materialet är.$kuggfri$, null, 174, true, $kuggfri$c01d6c662$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('ba88eb7f-d3db-5349-ab49-7b8c7aeffce9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$ja-nej-omslagstemperatur-finns-hos$kuggfri$, $kuggfri$Omslagstemperatur finns hos vanligt (ferritiskt) stål men inte hos aluminium och austenitiskt rostfritt stål.$kuggfri$, $kuggfri$Sant. Vid låga temperaturer blir vissa metaller spröda, men metaller med FCC-struktur förblir duktila även vid de lägsta temperaturerna. Aluminium och austenit (FCC-järn) har FCC-struktur, så aluminium och austenitiska rostfria stål har ingen omslagstemperatur. Vanligt stål består av ferrit (BCC-järn) och perlit och går från segt till sprött beteende under omslagstemperaturen.

Tentan 2020 hade påståendet med bara "rostfritt stål" och facit ja; det gäller de austenitiska rostfria stålen, därför är påståendet preciserat.$kuggfri$, null, 175, true, $kuggfri$c341690ac$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2; Canvas, Kapitel_08 Seghet och Brott, s. 31; Canvas, Fö 12 Stål, s. 17; Canvas, Fö 12 Stål, s. 18; Canvas, Fö 13 Aluminium och andra metaller, s. 3; Canvas, Short_dictionary_ v2026, s. 2$kuggfri$, true, $kuggfri$Originalkortet (tentan 2020-10-24 uppg. 1e, facit ja) sa "rostfritt stål"; påståendet är nu preciserat till "vanligt (ferritiskt) stål" och "austenitiskt rostfritt stål", eftersom bara FCC-metaller förblir duktila (Kapitel_08 s. 31) och ferritiska och martensitiska rostfria stål har omslagstemperatur. Källraden saknar "Rättelse:". Godkänns preciseringen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('fa0f6670-4e74-5d91-aec7-552d8f350dd5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$ja-nej-utmattningsgransen-ar-antalet$kuggfri$, $kuggfri$Utmattningsgränsen är antalet cykler till brott vid en viss spänning.$kuggfri$, $kuggfri$![S–N-kurva med draghållfastheten och utmattningsgränsen vid tio miljoner cykler](/kort/materialteknik/s-n-kurva.svg)

Falskt. Utmattningsgränsen är en spänningsamplitud, inte ett antal cykler: under den inträffar brott inte alls eller först efter ett mycket stort antal cykler (t.ex. fler än $10^7$). Antalet cykler till brott vid en viss spänningsamplitud är utmattningslivslängden $N_f$, som kan läsas av i S-N-kurvan.$kuggfri$, null, 176, true, $kuggfri$c2d2c1c3a$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 5; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 6$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1244eb70-bef2-5e9d-9a19-68485a045555', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$sn-kurva-axlar$kuggfri$, $kuggfri$Vad visar en S–N-kurva?$kuggfri$, $kuggfri$![S–N-kurva med draghållfastheten och utmattningsgränsen vid tio miljoner cykler](/kort/materialteknik/s-n-kurva.svg)

S–N-kurvan har spänningsamplituden $\sigma_a$ på y-axeln och antalet cykler till brott $N_f$ i logaritmisk skala på x-axeln. Kurvan börjar vid draghållfastheten $\sigma_{ts}$ och planar ut mot utmattningsgränsen $\sigma_e$, där brott inte inträffar alls eller först efter mycket många cykler (t.ex. fler än $10^7$). Spänning mot töjning är dragprovskurvan, och spricktillväxt per cykel mot $\Delta K$ är diagrammet för spricktillväxt vid cyklisk belastning.$kuggfri$, null, 177, true, $kuggfri$c5b8aedfb$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Spänningsamplituden mot antalet cykler till brott, med antalet cykler i logaritmisk skala.","correct":true},{"text":"Spänningen mot töjningen i ett dragprov.","correct":false},{"text":"Spricktillväxten per cykel mot variationen i spänningsintensitetsfaktorn.","correct":false},{"text":"Antalet cykler till brott mot temperaturen.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 5, 15$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('44fded3b-b47b-5b74-9495-07fbb279c6d9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$ja-nej-sproda-brott-foljer-alltid$kuggfri$, $kuggfri$Spröda brott följer alltid korngränserna.$kuggfri$, $kuggfri$Falskt. En spröd brottyta kan vara både interkristallin (längs korngränserna) och transkristallin (genom kornen). Ett sprött klyvbrott följer atomplanen. Brott längs korngränserna uppstår när korngränserna har försvagats, t.ex. av föroreningar som samlats där eller av kemiskt angrepp.$kuggfri$, null, 178, true, $kuggfri$c40f4d1ff$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2; Canvas, Fö 9 Brott och brottseghet, s. 16; Canvas, Svar Materialteknik 2019-10-26, s. 2; Canvas, Kapitel_08 Seghet och Brott, s. 32$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('7ff14f04-381a-5fd9-901a-f51881b05291', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$utmattningsgrans$kuggfri$, $kuggfri$Utmattningsgräns$kuggfri$, $kuggfri$Den spänning under vilken inte utmattning sker.$kuggfri$, null, 179, true, $kuggfri$c71569cda$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true, $kuggfri$Kortet säger att utmattning inte sker alls under utmattningsgränsen, men Kapitel_09 Utmattning s. 5 säger att brott inte inträffar alls eller först efter ett mycket stort antal cykler (t.ex. fler än 10^7), vilket kortet ja-nej-utmattningsgransen-ar-antalet i samma fil också säger. Ska definitionen skrivas som på bilden?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('41b15a13-a92a-5380-bc10-a0719221fd31', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$segt-brott$kuggfri$, $kuggfri$Segt brott$kuggfri$, $kuggfri$Ett brott som föregås av mycket plasticering. Lång töjning innan brott sker med andra ord.$kuggfri$, null, 180, true, $kuggfri$ce8a483c6$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('b954d8c5-9a30-5d8e-84d1-a6382f200125', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$quiz-brott-hos-metaller-2-rattta-svar$kuggfri$, $kuggfri$Brott hos metaller: vilka påståenden är sanna?$kuggfri$, $kuggfri$För att en spricka ska växa måste tillräckligt yttre arbete utföras, och brottsegheten beror på energin som krävs för att driva sprickan. Sprickor växer när spänningsintensitetsfaktorn överskrider det kritiska värdet $K_{1c}$. Hög E-modul ger inte hög brottseghet: keramer har hög styvhet men sprött beteende. Högre sträckgräns minskar den plastiska zonen vid sprickspetsen och ger lägre seghet.

I quizen stod "Segt brott fås när spänningsintensitetsfaktorn är större än brottsegheten". Villkoret gäller sprickväxt i allmänhet, inte specifikt segt brott, så alternativet är omformulerat.$kuggfri$, null, 181, true, $kuggfri$c4e0ff14b$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Brottegenskaper är tätt kopplade till energi.","correct":true},{"text":"Material med hög E-modul har alltid hög brottseghet.","correct":false},{"text":"Material med hög sträckgräns har alltid hög brottseghet.","correct":false},{"text":"En spricka växer när spänningsintensitetsfaktorn överskrider brottsegheten.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 3, fråga 7; Canvas, Kapitel_08 Seghet och Brott, s. 14; Canvas, Kapitel_08 Seghet och Brott, s. 18; Canvas, Kapitel_08 Seghet och Brott, s. 37; Canvas, Fö 9 Brott och brottseghet, s. 7; Canvas, Tentamen med svarsförslag MTT085 251030, uppgift 1f$kuggfri$, false, $kuggfri$Quizens rätta alternativ "Segt brott fås när spänningsintensitetsfaktorn är större än brottsegheten" är omskrivet till "En spricka växer när spänningsintensitetsfaktorn överskrider brottsegheten", eftersom villkoret gäller sprickväxt i allmänhet och inte specifikt segt brott (Kapitel_08 s. 14). Godkänns omskrivningen, och ska Quiz vecka 3 fråga 7 ändras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('944b531f-0c68-5450-8e5a-4cc0e02c129d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$quiz-brott-2-ratta-svar$kuggfri$, $kuggfri$Brott i metaller och spröda material: vilka påståenden är sanna?$kuggfri$, $kuggfri$Kursen delar in brott i spröda och sega brott, inte elastiska och plastiska. Ett segt brott i en metall uppstår genom att hålrum bildas vid inneslutningar och växer samman, och ett sprött klyvbrott separerar atomerna; brott längs korngränserna kräver att korngränserna har försvagats, t.ex. av föroreningar eller kemiskt angrepp. I spröda material ger den största defekten störst spänning och brottet börjar där, eftersom $K_1 = Y\sigma\sqrt{\pi c}$ ökar med spricklängden.$kuggfri$, null, 182, true, $kuggfri$c3edf404b$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Brott delas in i elastiska brott och plastiska brott.","correct":false},{"text":"När en metall går sönder går brottet oftast längs korngränserna.","correct":false},{"text":"I metaller går brottet bara undantagsvis längs korngränserna, t.ex. när föroreningar har försvagat dem.","correct":true},{"text":"Hos spröda material är storleken på defekter som sprickor och porer avgörande för brottspänningen.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 3, fråga 10; Canvas, Kapitel_08 Seghet och Brott, s. 15; Canvas, Kapitel_08 Seghet och Brott, s. 27; Canvas, Kapitel_08 Seghet och Brott, s. 28; Canvas, Kapitel_08 Seghet och Brott, s. 32; Canvas, Fö 9 Brott och brottseghet, s. 15$kuggfri$, false, $kuggfri$Det rätta alternativet är omskrivet till "I metaller går brottet bara undantagsvis längs korngränserna", men "bara undantagsvis" står inte i kursen: Kapitel_08 s. 32 säger att föroreningar normalt samlas i korngränserna, och Fö 9 Brott och brottseghet s. 16 visar interkristallint brott som en av två vanliga spröda brottytor. Håller examinatorn med, eller ska det stå t.ex. "främst när korngränserna har försvagats"?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('4c9565c1-ef54-51dc-b4f8-34f07396ab37', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$brott-seghet-definition$kuggfri$, $kuggfri$Vad menas med seghet (toughness) i kursen?$kuggfri$, $kuggfri$Seghet är motståndet mot spricktillväxt. Motståndet mot plastisk deformation är hållfasthet, den elastiska deformationen beskrivs av styvheten och förlängningen till brott är duktilitet (brottförlängning). Seghet kan inte mätas med ett vanligt dragprov, eftersom provstaven inte har någon spricka att börja från.$kuggfri$, null, 183, true, $kuggfri$cc284ee27$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ett materials motstånd mot plastisk deformation","correct":false},{"text":"Ett materials motstånd mot spricktillväxt","correct":true},{"text":"Hur mycket ett material deformeras elastiskt när det belastas","correct":false},{"text":"Hur mycket ett material kan förlängas innan brott i ett dragprov","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_08 Seghet och Brott, s. 7; Canvas, Kapitel_08 Seghet och Brott, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d1d0c8a9-6995-5bed-9a14-8f631921a3e7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$brott-spanningsintensitetsfaktor$kuggfri$, $kuggfri$Hur beräknas spänningsintensitetsfaktorn $K_1$ för en spricka med längden $c$ i en plåt under dragspänningen $\sigma$?$kuggfri$, $kuggfri$Den lokala spänningen framför sprickspetsen skalar med $\sigma\sqrt{\pi c}$, så $K_1 = Y\sigma\sqrt{\pi c}$, där $Y$ är en geometrisk konstant (för en spricka i en bred plåt, $c \ll w$, är $Y$ ungefär 1). Enheten blir $\text{MPa}\sqrt{\text{m}}$, samma som för brottseghet, och sprickan växer när $K_1$ överskrider $K_{1c}$. Det är spänningen och inte E-modulen som driver sprickan, och $K_1$ ökar med roten ur spricklängden, inte linjärt.$kuggfri$, null, 184, true, $kuggfri$c00cb271a$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"$K_1 = Y\\sigma\\sqrt{\\pi c}$","correct":true},{"text":"$K_1 = Y\\sigma\\,\\pi c$","correct":false},{"text":"$K_1 = Y\\sigma/\\sqrt{\\pi c}$","correct":false},{"text":"$K_1 = YE\\sqrt{\\pi c}$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_08 Seghet och Brott, s. 13; Canvas, Kapitel_08 Seghet och Brott, s. 14; Canvas, Fö 9 Brott och brottseghet, s. 9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ca575193-3da1-5fc2-9afc-c3c7c1b054ea', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$brott-omslagstemperatur$kuggfri$, $kuggfri$Omslagstemperatur$kuggfri$, $kuggfri$Den temperatur där ett material går från segt (duktilt) till sprött brottbeteende, duktilt/sprött omslag (ductile-to-brittle transition). Under omslagstemperaturen blir materialet sprött. Den bestäms med slagprovning. Vissa metaller, t.ex. vanligt (ferritiskt) stål, och alla polymerer har en omslagstemperatur, medan metaller med FCC-struktur förblir duktila även vid de lägsta temperaturerna.$kuggfri$, null, 185, true, $kuggfri$c57202e9e$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, Short_dictionary_ v2026, s. 4; Canvas, Svar Materialteknik 2019-10-26, s. 2; Canvas, Kapitel_08 Seghet och Brott, s. 10; Canvas, Kapitel_08 Seghet och Brott, s. 31$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3006171a-c2da-59f5-ab1e-8e40a33da707', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$utm-lagcykelutmattning$kuggfri$, $kuggfri$Lågcykelutmattning$kuggfri$, $kuggfri$Utmattning där spänningsnivåerna varierar över sträckgränsen men under draghållfastheten, så att materialet deformeras både elastiskt och plastiskt i varje cykel (hysteresloop). Livslängden är kort räknat i antal cykler, den vänstra delen av livslängdsdiagrammet. Lågcykelutmattning provas oftast töjningsstyrt, och livslängden beskrivs av Coffins lag.$kuggfri$, null, 186, true, $kuggfri$c5f72cab7$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 3; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 6; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('b0369e8f-e7ba-5700-b0e5-9e30598c2b9d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$utm-basquin-hcf$kuggfri$, $kuggfri$Vilken lag beskriver utmattningslivslängden vid högcykelutmattning (HCF)?$kuggfri$, $kuggfri$Basquins lag beskriver högcykelutmattning, där spänningarna ligger under sträckgränsen och deformationen är elastisk. Coffins lag gäller lågcykelutmattning och använder det plastiska töjningsintervallet. Båda lagarna gäller komponenter som cyklas med konstant amplitud kring medelspänningen noll. Paris lag beskriver spricktillväxt per cykel och Palmgren-Miners regel skadeackumulering när amplituden varierar.$kuggfri$, null, 187, true, $kuggfri$cbba84aeb$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Basquins lag, $\\Delta\\sigma\\,N_f^{\\,b} = C_1$","correct":true},{"text":"Coffins lag, $\\Delta\\varepsilon^{pl}N_f^{\\,c} = C_2$","correct":false},{"text":"Paris lag, $dc/dN = A\\,\\Delta K^m$","correct":false},{"text":"Palmgren-Miners regel, $\\sum N_i/N_{f,i} = 1$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 6; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 11; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 15$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('7cd7d1a9-b072-5026-80d5-91437bb72df4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$utm-exempel-basquin-livslangd$kuggfri$, $kuggfri$En komponent följer Basquins lag med $b = 0{,}1$ och håller 200 000 cykler vid spänningsamplituden 100 MPa (medelspänning noll). Ungefär hur många cykler håller den om amplituden ökas till 120 MPa?$kuggfri$, $kuggfri$Spänningsintervallet är dubbla amplituden, alltså 200 respektive 240 MPa (att medelspänningen är noll behövs för att Basquins lag ska gälla). Basquins lag ger $\Delta\sigma_1 N_1^{\,b} = \Delta\sigma_2 N_2^{\,b}$, alltså $N_2 = N_1\left(\dfrac{\Delta\sigma_1}{\Delta\sigma_2}\right)^{1/b} = 200\,000\left(\dfrac{200}{240}\right)^{10} \approx 32\,300$ cykler. En ökning av spänningsamplituden med 20 % minskar livslängden med 84 %: utmattning är mycket känslig för spänningsnivån.

167 000 cykler fås om exponenten $1/b$ glöms bort, 196 000 om man använder $b$ i stället för $1/b$ och 1 240 000 om kvoten vänds.$kuggfri$, null, 188, true, $kuggfri$c03961302$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"1 240 000 cykler","correct":false},{"text":"196 000 cykler","correct":false},{"text":"167 000 cykler","correct":false},{"text":"32 300 cykler","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 8; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 5, 6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1ac749e6-f7b1-5808-b2d4-8f1be71bcf9f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$utm-paris-lag$kuggfri$, $kuggfri$Vad beskriver Paris lag, $dc/dN = A\,\Delta K^m$?$kuggfri$, $kuggfri$Paris lag beskriver spricktillväxten per cykel, $dc/dN$, som funktion av $\Delta K = K_{max} - K_{min} = \Delta\sigma\sqrt{\pi c}$. Eftersom sprickan växer ökar $\Delta K$ med tiden vid konstant cyklisk spänning, och snabbt brott inträffar när $K_{max}$ når $K_{1c}$. Lagen används för att beräkna hur många cykler som kan tillåtas innan sprickan når en farlig längd. De andra alternativen beskriver Basquins lag, Palmgren-Miners regel och Goodmans regel.$kuggfri$, null, 189, true, $kuggfri$c2f230ffd$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Hur mycket en utmattningsspricka växer per cykel som funktion av det cykliska spänningsintensitetsintervallet","correct":true},{"text":"Hur livslängden beror på spänningsamplituden vid högcykelutmattning","correct":false},{"text":"Hur skadan ackumuleras när spänningsamplituden varierar","correct":false},{"text":"Hur en medelspänning minskar det tillåtna spänningsintervallet","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 14; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 15; Canvas, Läsanvisningar Kapitel 9, s. 1$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ab1e0c14-84f2-53cf-af36-6ded72f2987f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$utm-palmgren-miner$kuggfri$, $kuggfri$Enligt Palmgren-Miners regel inträffar utmattningsbrott när summan $\sum N_i/N_{f,i}$ når 1.$kuggfri$, $kuggfri$Sant. När den cykliska spänningsamplituden ändras beräknas livslängden med Palmgren-Miners regel för linjär skadeackumulering, $\sum_{i=1}^{n} N_i/N_{f,i} = 1$. Här är $N_i$ antalet cykler med amplitud $i$ och $N_{f,i}$ livslängden om hela belastningen hade haft den amplituden.$kuggfri$, null, 190, true, $kuggfri$cabd96ecd$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 11$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('a7ca1ce6-f19e-558f-8588-15330e37d255', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$utm-goodman-medelspanning$kuggfri$, $kuggfri$Hur påverkar en medelspänning i drag utmattningslivslängden, enligt Goodmans regel?$kuggfri$, $kuggfri$Enligt Goodmans regel, $\Delta\sigma_{\sigma_m} = \Delta\sigma_{\sigma_m=0}\left(1 - \sigma_m/\sigma_{ts}\right)$, motsvarar ett spänningsintervall med medelspänningen $\sigma_m$ ett större intervall vid medelspänningen noll, och det korrigerade intervallet sätts in i Basquins lag. I exempel 9.2 ($\sigma_{ts} = 200$ MPa) sjunker livslängden från 200 000 till ungefär 11 550 cykler när medelspänningen ökar från 0 till 50 MPa. Utmattning är mycket känslig för medelspänningen, och därför bör restspänningar i ytan helst vara tryckspänningar.$kuggfri$, null, 191, true, $kuggfri$c62455792$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Livslängden minskar","correct":true},{"text":"Livslängden ökar, eftersom materialet deformationshärdas","correct":false},{"text":"Livslängden påverkas inte, bara spänningsamplituden spelar roll","correct":false},{"text":"Medelspänningen påverkar bara lågcykelutmattning","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 4; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 9; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 10$kuggfri$, false, $kuggfri$Kortet anger ca 11 550 cykler för exempel 9.2, men utan avrundning blir det ca 11 260 (200 000 gånger 0,75^10); 11 550 fås bara om det korrigerade spänningsintervallet avrundas till 266 MPa. Står 11 550 på bilden i Kapitel_09 Utmattning s. 10, eller ska siffran ändras till ca 11 300?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3bd22354-9b0f-5657-83be-2a6b21f1dca8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$utm-battre-utmattningsegenskaper$kuggfri$, $kuggfri$Vilka åtgärder ger bättre utmattningsegenskaper hos en metallkomponent?$kuggfri$, $kuggfri$Goda utmattningsegenskaper fås med liten kornstorlek, små inneslutningar och porer, släta ytor utan spänningskoncentrationer, skydd mot korrosion och tryckspänningar i ytan (kulbombning, nitrering, karburisering). Sprickor växer bara under dragdelen av en cykel, så tryckspänningar i ytan håller sprickorna stängda och minskar medelspänningen där, medan dragrestspänningar ökar den. Utmattningssprickor initieras oftast vid ytan, så en grov yta försämrar livslängden.$kuggfri$, null, 192, true, $kuggfri$cb9a6f8e9$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Liten kornstorlek","correct":true},{"text":"Grov, obearbetad yta","correct":false},{"text":"Tryckrestspänningar i ytan, t.ex. genom kulbombning","correct":true},{"text":"Dragrestspänningar i ytan","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 39; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 37; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 10; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 28$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('9951e13a-5c5a-5f4c-a8fc-e8fcf7c9da50', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$utm-initiering-vid-ytan$kuggfri$, $kuggfri$Utmattningssprickor initieras oftast vid ytan.$kuggfri$, $kuggfri$Sant. I ytliga korn med lämplig orientering bildas persistenta glidband (PSB) med mycket dislokationsaktivitet, som ger intrusioner och extrusioner i ytan. Atmosfär och oxidation skapar svaga zoner, och lokala spänningskoncentrationer gör att sprickan startar där. Sprickor kan initieras inne i materialet när ytan är jämn och har tryckrestspänningar, eller när det finns stora inre defekter som inneslutningar och porer.$kuggfri$, null, 193, true, $kuggfri$cb47ae1d9$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 28; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 29$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('a9bb99d5-5fd0-5385-848c-0f9bd8199bd5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$utm-tre-stadier-brottyta$kuggfri$, $kuggfri$Beskriv de tre stadierna i ett utmattningsbrott och hur brottytan ser ut.$kuggfri$, $kuggfri$1. **Initiering:** oftast som en skjuvspricka i ytliga korn med lämplig orientering (glidband), där ytan eller en spänningskoncentration hjälper till.
2. **Tillväxt:** sprickan korsar några korngränser och växer sedan som en lång spricka vinkelrätt mot huvudspänningen (mod 1). Materialet framför sprickspetsen deformeras plastiskt i varje cykel, och sprickan växer en liten bit per cykel. På brottytan syns striationer (avstånd typiskt ca 1 µm) och makroskopiska linjer (beach marks).
3. **Slutbrott (restbrott):** när spricklängden har blivit så stor att spänningsintensiteten når $K_{1c}$ vid den pålagda spänningen brister resten av tvärsnittet snabbt.$kuggfri$, null, 194, true, $kuggfri$c37680e5b$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 28; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 30; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 32; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 33; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 15$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('c0ed24fd-c97a-5e4b-88b7-e237d940b6c1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$brott-sprott-brottyta-kannetecken$kuggfri$, $kuggfri$Vilka kännetecken hör till ett sprött brott?$kuggfri$, $kuggfri$Ett sprött brott sker utan nämnvärd plastisk deformation och ger en relativt jämn, glänsande och kornig brottyta; i keramer och glas är klyvbrott karakteristiskt. En matt, ojämn skål- och konformad yta och hålrum som växer samman vid inneslutningar kännetecknar i stället segt brott. Sprött brott uppträder främst vid låga temperaturer, höga belastningshastigheter och i spröda material.$kuggfri$, null, 195, true, $kuggfri$ce3652630$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Det sker utan nämnvärd plastisk deformation, ofta plötsligt","correct":true},{"text":"Brottytan är matt och ojämn, skål- och konformad","correct":false},{"text":"Brottytan är relativt jämn och glänsande med kornig struktur","correct":true},{"text":"Hålrum bildas vid inneslutningar och växer samman till brott","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Svarsförslag uppgift 4-6, IMS085 251030, s. 1; Canvas, Kapitel_08 Seghet och Brott, s. 27; Canvas, Kapitel_08 Seghet och Brott, s. 28$kuggfri$, false, $kuggfri$Kortet är i stort sett tentan 2025-10-30 uppg. 4 omgjord till flerval: de rätta alternativen är svarsförslagets meningar om sprött brott och de felaktiga dess meningar om segt brott (Svarsförslag uppgift 4-6 IMS085 251030 s. 1), och brottytornas utseende står inte på Kapitel_08 s. 27, 28. Ska kortet skrivas om utifrån föreläsningen, eller tas bort?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('7e363efd-b54d-5879-aada-db61817436a6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$brott-weibullmodul$kuggfri$, $kuggfri$Vad innebär ett högt värde på Weibullmodulen $m$ för en keram?$kuggfri$, $kuggfri$Weibullmodulen styr hur känslig brottsannolikheten är för spänningen: låga värden ger stor spridning, höga värden ger betydligt större säkerhet för överlevnad under referensspänningen. Weibullstatistik används för keramer eftersom sannolikheten att en komponent innehåller en defekt av kritisk storlek ökar med volymen, så brottspänningen beror på storleken. Referensspänningen och $m$ bestäms empiriskt och är inte ett mått på brottsegheten.$kuggfri$, null, 196, true, $kuggfri$cd062a9eb$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Liten spridning i brottspänning och större säkerhet för överlevnad under referensspänningen","correct":true},{"text":"Stor spridning i brottspänning","correct":false},{"text":"Hög brottseghet $K_{1c}$","correct":false},{"text":"Att brottspänningen inte beror på komponentens storlek","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_08 Seghet och Brott, s. 34; Canvas, Kapitel_08 Seghet och Brott, s. 35$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('672973b2-e112-5592-b117-bfd94c151879', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$brott-exempel-ct-prov-last$kuggfri$, $kuggfri$Ett CT-prov ($K_{1c} = 25\ \text{MPa}\sqrt{\text{m}}$, $w = 50$ mm, $b = 20$ mm, sprickan $c = 10$ mm) följer $K_{1c} = 1{,}64\,\dfrac{F^*}{bw}\sqrt{\pi c}$. Vilken last $F^*$ krävs för brott?$kuggfri$, $kuggfri$$F^* = \dfrac{K_{1c}\,b\,w}{1{,}64\sqrt{\pi c}} = \dfrac{25\cdot 10^6 \cdot 0{,}020 \cdot 0{,}050}{1{,}64\sqrt{\pi \cdot 0{,}010}} \approx 86$ kN. I exempel 8.2 räcker därför inte en provningsmaskin med maxlasten 50 kN. 141 kN fås om faktorn 1,64 glöms bort och 8,6 kN om en tiopotens blir fel.$kuggfri$, null, 197, true, $kuggfri$c2acc7e8a$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"50 kN","correct":false},{"text":"86 kN","correct":true},{"text":"8,6 kN","correct":false},{"text":"141 kN","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_08 Seghet och Brott, s. 17; Canvas, Kapitel_08 Seghet och Brott, s. 14$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('821db7af-efc3-5e48-ad7d-4dd5d12bc613', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2207b77a-11fc-5b02-871d-12c0759eeabe', $kuggfri$vad-ar-brottseghet$kuggfri$, $kuggfri$Vad är brottseghet?$kuggfri$, $kuggfri$Ett materials motstånd mot spricktillväxt. Brottsegheten $K_{1c}$ ($\text{MPa}\sqrt{\text{m}}$; 1 för lastmod 1, c för kritisk) är det kritiska värdet på spänningsintensitetsfaktorn.

* En spricka växer när spänningsintensitetsfaktorn $K_1$ överskrider $K_{1c}$. Vid statisk last växer sprickan inte så länge $K_1$ är mindre än $K_{1c}$ (vid cyklisk last kan en utmattningsspricka däremot växa lite för varje cykel, se Paris lag).
* $K_1 = Y\sigma\sqrt{\pi c}$ tar hänsyn till både last (spänningen $\sigma$) och spricklängd $c$.
* Brottsegheten beror på energin som krävs för att driva sprickan: $K_{1c} = \sqrt{E\,G_c}$.$kuggfri$, null, 198, true, $kuggfri$c577a2469$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Rättelse: brottvillkoret var omvänt (kortet sa att brott sker när K1c > K1, så stod det också på en bild 2025); Canvas, Kapitel_08 Seghet och Brott, s. 7; Canvas, Kapitel_08 Seghet och Brott, s. 14; Canvas, Fö 9 Brott och brottseghet, s. 7; Canvas, Fö 9 Brott och brottseghet, s. 10; Canvas, Kapitel_08 Seghet och Brott, s. 13; Canvas, Kapitel_08 Seghet och Brott, s. 18; Canvas, 2026-09-23 Kapitel_09 Utmattning, s. 15$kuggfri$, true, $kuggfri$Rättelse av originalkortet: brottvillkoret var omvänt, "Brott när K1c > K1", som det står på Fö 9 Brott och brottseghet 2025 s. 7. Kortet säger nu att sprickan växer när K1 överskrider K1c (Fö 9 s. 10, Kapitel_08 s. 14), med tillägget "vid statisk last" eftersom en utmattningsspricka kan växa under K1c. Godkänns rättelsen, och ska bilden Fö 9 s. 7 rättas i Canvas?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('42cd2906-dbe4-574a-95b4-939dbae3d88c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-hander-med-material-nar$kuggfri$, $kuggfri$Vad händer med material när temperaturen höjs?$kuggfri$, $kuggfri$* Atomerna vibrerar med större amplitud
* Atombindningarna försvagas något
* Atomerna rör sig lättare (diffusion)
* Fasomvandlingar vid bestämda temperaturer eller temperaturintervall
* Kemiska reaktioner går snabbare, ofta med exponentiell ökning$kuggfri$, null, 199, true, $kuggfri$c8df22ba3$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "atomerna börjar vibrera" var fel, atomerna vibrerar redan och det är amplituden som ökar med temperaturen; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 2; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 7$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "atomerna börjar vibrera" (Fö 10 Material och värme 2025 s. 2) var fel, atomerna vibrerar redan och det är amplituden som ökar. Kortet följer nu ordagrant Kapitel_12 Material och värme 2026 s. 2. Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('4e2ac4fa-a0d0-54ee-9c03-80217a77bd04', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$beskriv-utforligt-vad-smalttemperatur$kuggfri$, $kuggfri$Beskriv utförligt vad smälttemperatur och glasomvandlingstemperatur är och vilka material respektive är relevant för.$kuggfri$, $kuggfri$Smälttemperatur:

* Kristallina material
* Metaller, keramer, delkristallina termoplaster (som har både Tm och Tg)
* Går från fast till "lågviskös"
vätska vid smälttemperaturen, "Tm"

Glasomvandlingstemperatur

* Amorfa material
* Termoplaster, glas
* Gradvis övergång från fast till "viskös" vid
glasomvandlingstemperaturen "Tg".$kuggfri$, null, 200, true, $kuggfri$c08e6dbba$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet listade termoplaster bara under glasomvandlingstemperatur, men delkristallina termoplaster har både Tg (de amorfa delarna) och Tm (kristalliterna); Canvas, MTT085 PM 2, s. 4; Canvas, 2025 MTT085 Fo16, s. 21$kuggfri$, true, $kuggfri$Rättelse av originalkortet: termoplaster stod bara under glasomvandlingstemperatur, men delkristallina termoplaster har både Tg och Tm (MTT085 PM 2 s. 4, Fö16 2025 s. 21), så de står nu också under smälttemperatur. Metalldelens bild Kapitel_12 s. 4 har originalets uppdelning. Godkänns tillägget?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('e7f65988-e404-597e-8ffe-eb9835e1a120', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-definierar-ett-materials-relevanta$kuggfri$, $kuggfri$Vad definierar ett materials relevanta användningstemperatur?$kuggfri$, $kuggfri$Maximal användningstemperatur begränsas
t.ex. av:

* Försämrade mekaniska egenskaper
* Fasomvandlingar och kemiska förändringar
* Oxidation

Minimal användningstemperatur
begränsas t.ex. av:

* Sprödhet$kuggfri$, null, 201, true, $kuggfri$c82de5c58$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('dd31f06f-87e6-5917-b386-e6757657c8cb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-ar-termisk-utvidgning-respektive$kuggfri$, $kuggfri$Vad är termisk utvidgning respektive termiska spänningar?$kuggfri$, $kuggfri$**Termisk utvidgning:** ett fast ämne expanderar vid uppvärmning eftersom atomerna rör sig längre från varandra. Den termiska töjningen är $\varepsilon_T = \alpha\,(T - T_0)$, där $\alpha$ är den termiska utvidgningskoefficienten (svagt temperaturberoende) och $T_0$ en referenstemperatur. Volymutvidgningen är ungefär tre gånger så stor som den linjära.

**Termiska spänningar:** termisk utvidgning ger upphov till spänningar, till exempel

* när två sammanfogade material har olika $\alpha$, så att det ena expanderar mer än det andra
* av temperaturgradienter, dvs. när olika delar av materialet har olika temperatur

Upprepade temperaturvariationer kan ge termisk utmattning.$kuggfri$, null, 202, true, $kuggfri$c013514e0$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "termiska gradienter" beskrevs som utvidgningens storlek och riktning på vektorform, men det är temperaturskillnader i materialet; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 13; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 15; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 16$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "termiska gradienter" beskrevs som utvidgningens storlek och riktning på vektorform, men det är temperaturskillnader i materialet (Kapitel_12 s. 13, 16); kortet säger också att α är svagt temperaturberoende och att volymutvidgningen är ca tre gånger den linjära. Formeln för termisk töjning på bilden s. 13 saknar parentesen, kortets är rätt. Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('66a397bd-fb7c-5288-af49-d83c48ac3e8b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-har-atombindningar-med-termisk$kuggfri$, $kuggfri$Vad har atombindningar med termisk utvidgning att göra?$kuggfri$, $kuggfri$Ett fast ämne expanderar vid uppvärmning eftersom atomerna rör sig längre från varandra. Starka atombindningar (djup bindningsenergikurva) ger både hög E-modul och hög smälttemperatur, och empiriskt har material med hög E-modul (styva fjädrar) låg utvidgningskoefficient.

Alla kristallina fasta ämnen expanderar ungefär 2 % från absoluta nollpunkten till smältpunkten. Därför är $\alpha$ ungefär omvänt proportionell mot $T_m$: svaga bindningar ger låg smälttemperatur och stor termisk utvidgning.$kuggfri$, null, 203, true, $kuggfri$c05867c2f$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet påstod att utvidgningskoefficienten beror på temperaturen eftersom bindningsstyrkan gör det, vilket inte stöds av föreläsningen, och upprepade formeln från kortet ovan; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 14; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 15; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 26$kuggfri$, true, $kuggfri$Rättelse av originalkortet: det sa att α beror på temperaturen eftersom bindningsstyrkan gör det, en förklaring som inte finns i materialet (Fö 10 2025 s. 8 säger bara att α beror på temperaturen, Kapitel_12 s. 13 kallar den svagt temperaturberoende). Kortet bygger nu på Kapitel_12 s. 14, 15 och 26 (starka bindningar ger hög E och hög Tm, α ungefär omvänt proportionell mot Tm). Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('612ccd11-7365-5b5f-adc2-520a883bccf1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vilka-faktorer-ar-avgorande-for-ett$kuggfri$, $kuggfri$Vilka faktorer är avgörande för ett materials termiska ledningsförmåga?$kuggfri$, $kuggfri$Värme leds med två mekanismer:

* Kristallvibrationer (fononer): elastiska vågpaket som färdas med ljudets hastighet men bara en kort sträcka (medelfri väg, vanligen under 0,01 µm) innan de sprids
* Elektroner, som gör att metaller leder värme mycket bra

Både fononer och elektroner överför energi från områden med hög temperatur till områden med låg temperatur.

Fononerna hindras och sprids av kristallstörningar, t.ex. dislokationer och inlösta atomer. Inlösta legeringsatomer är sådana störningar, så legering förbättrar inte en metalls värmeledningsförmåga.$kuggfri$, null, 204, true, $kuggfri$c0d8147f6$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "rena legeringar har bäst termisk ledningsförmåga" var självmotsägande (legering förbättrar inte ledningsförmågan), och energin går till område med låg temperatur (inte "låg energi"); Canvas, Fö 10 Material och värme, s. 10; Canvas, Fö 10 Material och värme, s. 11; Canvas, Fö 10 Material och värme, s. 12; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 20; Canvas, Quiz vecka 4, fråga 9; Canvas, Ashby et al Materials 3 utgåvan PRELIMINÄR Läsanvisning och detaljerade lärmål Kap 1-12, s. 4$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "Rena legeringar har bäst termisk ledningsförmåga" var självmotsägande och "till område med låg energi" är ändrat till låg temperatur; nu står att legering inte förbättrar värmeledningen (Fö 10 2025 s. 10, 11; Kapitel_12 s. 20; Quiz vecka 4 fråga 9). Förklaringen går via fononer, men i metaller leds värmen främst av fria elektroner, som också sprids av inlösta atomer. Godkänns rättelsen, och räcker fononförklaringen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('7b0b11c5-e7d0-5cdb-9636-62bbd41a124e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$beskriv-kort-vad-varmeflode-ar-och-hur$kuggfri$, $kuggfri$Beskriv kort vad värmeflöde är och hur det beräknas$kuggfri$, $kuggfri$Värmeflödet $q$ (W/m²) är den värmemängd per tidsenhet och area som leds genom materialet. Vid stationärt tillstånd (steady state) ges det av Fouriers lag, $q = -\lambda\,\Delta T/\Delta x$, där $\lambda$ är värmeledningsförmågan (W/(m K)) och $\Delta T/\Delta x$ temperaturgradienten. Minustecknet anger att värmen flödar från hög mot låg temperatur.

För en vägg med tjockleken $t$ och temperaturerna $T_i$ och $T_o$ på var sin sida blir effektförlusten $q = \lambda\,(T_i - T_o)/t$.

Om temperaturen i stället ändras med tiden (transient värmeledning) styrs förloppet av den termiska diffusiviteten $a = \lambda/(\rho C_p)$ (m²/s).$kuggfri$, null, 205, true, $kuggfri$cddbcfdf1$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet påstod att beräkning av värmeflöde inte ingår i kursen, men läsanvisningen 2026 kräver att man kan beräkna värmeflöde vid steady state; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 21; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 22; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 29; Canvas, Ashby et al Materials 3 utgåvan PRELIMINÄR Läsanvisning och detaljerade lärmål Kap 1-12, s. 5$kuggfri$, true, $kuggfri$Rättelse av originalkortet: det sa att beräkning av värmeflöde inte ingår i kursen, men läsanvisningen 2026 s. 5 kräver att man kan beräkna värmeflöde vid steady state. Kortet visar nu Fouriers lag, väggformeln och termisk diffusivitet (Kapitel_12 s. 21, 22, 29). Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('40372cb8-24a4-5720-9294-3325e3b400fd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-ar-diffusion$kuggfri$, $kuggfri$Vad är diffusion?$kuggfri$, $kuggfri$Diffusion i ett fast material är den temperaturberoende process där atomer förflyttar sig genom kristallstrukturen via atomhopp. Rörelsen är slumpmässig men går netto från hög till låg koncentration, så diffusion jämnar ut koncentrationsskillnader. Notera särskilt att:

* Diffusionshastigheten ökar exponentiellt med temperaturen
* Den beror på vilken atom som rör sig i vilken kristall; små atomer rör sig snabbare än stora$kuggfri$, null, 206, true, $kuggfri$cf7e6a436$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Rättelse: kortet blandade ihop atomdiffusion med temperaturspridning och beskrev diffusion som något som främst gäller gaser och vätskor; Canvas, Tentamen med svarsförslag MTT085 251030, uppgift 1j; Canvas, GLU 02 Fasdiagram, s. 7; Canvas, Fö 10 Material och värme, s. 13$kuggfri$, true, $kuggfri$Rättelse av originalkortet: det blandade ihop atomdiffusion med temperaturspridning och sa att diffusion främst gäller gaser och vätskor. Nu definieras diffusion i fast material som atomer som förflyttar sig "via atomhopp", nästan ordagrant det rätta alternativet i tentan 2025-10-30 uppg. 1j, medan GLU 02 s. 7 bara säger "slumpmässig rörelse av atomer". Godkänns rättelsen, eller ska första meningen skrivas om efter GLU 02 s. 7?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('7304b2bd-fdea-5abb-a6ea-26586c4eabf9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vilka-ar-ficks-1-a-och-2-a-lag$kuggfri$, $kuggfri$Vilka är Ficks 1:a och 2:a lag?$kuggfri$, $kuggfri$Ficks lagar beskriver hur diffusion beter sig i ett material. Proportionalitetskonstanten i dem är diffusionskoefficienten D, som ökar exponentiellt med temperaturen, $D = D_0 e^{-Q/RT}$.

Fick's 1:a lag beskriver hur flödet (J) är proportionellt mot den partiella derivatan av koncentrationen och Fick's 2:a beskriver hur den partiella derivatan av koncentrationen med avseende på tiden är proportionell mot andraderivatan av koncentrationen.

Första lagen används vid stationärt tillstånd (steady state), när koncentrationsprofilen inte ändras med tiden; den andra behövs när koncentrationen ändras med tiden (icke-stationärt).$kuggfri$, null, 207, true, $kuggfri$ca248b848$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet sa att Ficks lagar inte behöver vara relaterade till temperatur och att ekvationerna bäst löses numeriskt, men diffusionskoefficienten i lagarna ökar exponentiellt med temperaturen och kursen kräver att man kan räkna diffusion vid stationärt tillstånd med Ficks första lag; Canvas, Fo 10 Material och varme, s. 13; Canvas, Lasanvisningar Kapitel 12 och 13, s. 1; Canvas, Short_dictionary_ v2026, s. 10, 13$kuggfri$, true, $kuggfri$Rättelse av originalkortet: det sa att Ficks lagar inte behöver ha med temperatur att göra och att ekvationerna bäst löses numeriskt; nu står att D ökar exponentiellt med temperaturen (Fö 10 2025 s. 13) och när första och andra lagen används. Fick nämns bara i läsanvisningen för kapitel 12 och 13 från 2025, och kapitel 13 finns inte i den preliminära läsanvisningen 2026. Godkänns rättelsen, och ingår Ficks lagar i årets kurs?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c243a915-c6e2-5c03-af1c-d492dc7cec90', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$beskriv-narmare-vad-diffusionskrypning$kuggfri$, $kuggfri$Beskriv närmare vad diffusionskrypning är.$kuggfri$, $kuggfri$Diffusionskrypning:

* Förändring av kristallernas korn
m.h.a. diffusion
* Kornen förlängs i
belastningsriktningen$kuggfri$, null, 208, true, $kuggfri$c7a27a1d1$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('90041ba4-0b37-5e7b-bfe3-f589755386f3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$beskriv-narmare-vad-dislokationskrypning$kuggfri$, $kuggfri$Beskriv närmare vad dislokationskrypning är.$kuggfri$, $kuggfri$Dislokationskrypning:

* Plastisk deformation m.h.a.
dislokationsrörelse
* Diffusion hjälper dislokationerna att
komma runt hinder$kuggfri$, null, 209, true, $kuggfri$cef036588$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('f0ade95a-2159-538e-9fc9-7a71b74ba8c4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$vad-ar-ett-krypbrott$kuggfri$, $kuggfri$Vad är ett krypbrott?$kuggfri$, $kuggfri$Krypbrott fås när det har
initierats porer som har tillväxt
till brott till följd av krypning.$kuggfri$, null, 210, true, $kuggfri$c3dc6cab1$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('a2697d01-2f97-5e6b-ba82-dc00af47da4a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$krypning$kuggfri$, $kuggfri$Krypning$kuggfri$, $kuggfri$![Krypkurva: töjning mot tid med primär krypning, steady state-krypning och tertiär krypning fram till brott](/kort/materialteknik/krypkurva.svg)

Långsam plastisk (permanent) deformation som beror på temperatur, tid och last. I metaller sker den vid temperaturer över cirka halva smälttemperaturen (i kelvin), och kryphastigheten ökar exponentiellt med temperaturen.

Två mekanismer: diffusionskrypning och power-law-krypning (dislokationskrypning). Vilken mekanism som dominerar beror på temperatur och spänning. Förloppet delas in i primär krypning (snabb deformation tills dislokationerna möter hinder), steady state-krypning med konstant töjningshastighet och tertiär krypning, där skador uppstår i materialet.$kuggfri$, null, 211, true, $kuggfri$cfc563866$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, Fö 10 Material och värme, s. 14; Canvas, Fö 10 Material och värme, s. 15; Canvas, Fö 10 Material och värme, s. 16; Canvas, Fö 10 Material och värme, s. 17; Canvas, Läsanvisningar Kapitel 12 och 13, s. 1; Canvas, Svar Materialteknik 2018-10-27, s. 1; Canvas, Svarsförslag Tentamen IMS085 2023-10-25, s. 1$kuggfri$, true, $kuggfri$Kortet och krypkurvan (krypkurva.svg) bygger bara på Fö 10 Material och värme 2025 s. 14 till 17; krypning tas bara upp i förbigående i 2026 års material (Kapitel_12 s. 3), och kapitel 13 saknas i den preliminära läsanvisningen 2026. Samma fråga gäller övriga krypkort (krypning-pastaenden, vad-ar-ett-krypbrott, diffusions- och dislokationskrypning). Ingår krypning i årets kurs?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('b8c0e7b7-a696-5fd7-9867-30ee0a1965a8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$kryp-konstant-tojningshastighet$kuggfri$, $kuggfri$I vilket stadium av krypkurvan är töjningshastigheten konstant?$kuggfri$, $kuggfri$![Krypkurva: töjning mot tid med primär krypning, steady state-krypning och tertiär krypning fram till brott](/kort/materialteknik/krypkurva.svg)

Efter den initiala elastiska töjningen kommer primär krypning, en snabb deformation tills dislokationerna möter hinder. Sedan följer steady state-krypning med konstant töjningshastighet, där kurvan är rak. I tertiär krypning uppstår skador i materialet, töjningen ökar allt snabbare och provet går till brott.$kuggfri$, null, 212, true, $kuggfri$c22353061$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Steady state-krypning","correct":true},{"text":"Primär krypning","correct":false},{"text":"Tertiär krypning","correct":false},{"text":"Den initiala elastiska töjningen","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fö 10 Material och värme, s. 14$kuggfri$, false, $kuggfri$Kortets enda källa är Fö 10 Material och värme 2025 s. 14, och krypkurvan finns inte i 2026 års material; svaret (steady state) stämmer med källan. Ska kortet vara med i år? Det avgörs av samma beslut som för kortet krypning.$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ec0cbb3f-b72d-511a-a44b-4f2de7843737', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$aktiveringsenergi$kuggfri$, $kuggfri$Aktiveringsenergi$kuggfri$, $kuggfri$Den energibarriär som måste övervinnas m.h.a. termisk energi för att vissa processer skall kunna
ske, t.ex. kemiska reaktioner, diffusion, krypning.$kuggfri$, null, 213, true, $kuggfri$cfa1c56ac$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8c55cc97-bd3e-51dd-99fa-c4487047393e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$specifik-varmekapacitet$kuggfri$, $kuggfri$Specifik värmekapacitet$kuggfri$, $kuggfri$Värmekapacitet är den mängd energi som krävs för att höja temperaturen en grad (1 K) i en viss mängd material.
Specifik värmekapacitet, även kallad värmekapacitivitet, är den energi som krävs för att höja temperaturen 1 K för 1 kg av materialet, J/(kg K).$kuggfri$, null, 214, true, $kuggfri$c0472ef4a$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 8; Canvas, Short_dictionary_ v2026, s. 13; Canvas, Tentamen Materialteknik med svar 2022-11-29, s. 2$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('57418a68-f6a4-50bb-9f40-1b3abe8fd4e8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$diffusionskoefficient$kuggfri$, $kuggfri$Diffusionskoefficient$kuggfri$, $kuggfri$Ett mått på hur snabbt atomer rör sig (diffunderar) i ett material. Beror på temperaturen och vilka atomer som diffunderar, och i vilket material.$kuggfri$, null, 215, true, $kuggfri$cfdaa7092$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('8fb71a02-bb47-524d-9d58-e83dcd056a5d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$ja-nej-krypning-ar-ett-fenomen-som-bara$kuggfri$, $kuggfri$Krypning i metaller sker vid temperaturer över ungefär halva smälttemperaturen, räknat i kelvin.$kuggfri$, $kuggfri$Sant. Krypning är långsam plastisk deformation som beror på temperatur, tid och last, och i metaller sker den över cirka $0{,}5\,T_m$ (i kelvin). Vad som är en "hög" temperatur beror alltså på materialets smälttemperatur.

Tentan 2020 hade påståendet "Krypning är ett fenomen som bara uppstår vid höga temperaturer" med facit ja. Det är omformulerat, eftersom "höga temperaturer" bara blir entydigt i förhållande till smälttemperaturen.$kuggfri$, null, 216, true, $kuggfri$c30267b1f$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2; Canvas, Fö 10 Material och värme, s. 14; Canvas, Svar Materialteknik 2018-10-27, s. 1; Canvas, Svarsförslag Tentamen IMS085 2023-10-25, s. 1$kuggfri$, true, $kuggfri$Originalkortet (tentan 2020-10-24 uppg. 1g, "Krypning är ett fenomen som bara uppstår vid höga temperaturer", facit ja) är omskrivet till "Krypning i metaller sker över ungefär halva smälttemperaturen, räknat i kelvin", eftersom "höga temperaturer" bara är entydigt i förhållande till Tm och polymerer kryper vid rumstemperatur. Fö 10 s. 14 säger ½ Tm och svarsförslaget 2023-10-25 säger 0,4 till 0,5 Tm; källraden saknar "Rättelse:". Godkänns omformuleringen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('9b1531a9-6306-5e4c-a812-d45ab526ac9e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$quiz-vad-ar-ratt-for-temperatur-tva-ratta$kuggfri$, $kuggfri$Vad stämmer om temperatur?$kuggfri$, $kuggfri$Värme är atomer i rörelse: atomerna vibrerar med en amplitud som ökar med temperaturen, så temperaturen hänger ihop med rörelseenergin och inte med bindningarnas potentiella energi. En temperaturhöjning ger större vibrationer, något svagare bindningar, snabbare diffusion, fasomvandlingar och snabbare kemiska reaktioner. Därför påverkas de flesta egenskaper, inte bara de mekaniska.$kuggfri$, null, 217, true, $kuggfri$cf475d7aa$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Den är ett mått på atomernas kinetiska energi (rörelse).","correct":true},{"text":"Den är ett mått på atomernas potentiella energi.","correct":false},{"text":"Den påverkar de flesta av materialens egenskaper.","correct":true},{"text":"Den påverkar bara materialens mekaniska egenskaper.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 4, fråga 1; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 2; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 3; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('ad588997-b72a-54d0-a338-a25e8d951abc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$quiz-temperatur-och-material-tva-ratta-svar$kuggfri$, $kuggfri$Temperatur och material: vilka påståenden är sanna?$kuggfri$, $kuggfri$Rena metaller har en distinkt smälttemperatur, medan en legering stelnar inom ett temperaturintervall där smälta och fasta kristaller finns samtidigt (undantaget är eutektisk sammansättning, som stelnar vid en temperatur). Glasomvandlingstemperaturen $T_g$ gäller amorfa material (termoplaster, glas) och är en gradvis övergång från fast till visköst tillstånd, inte en omvandling till glas. Maximal användningstemperatur begränsas av t.ex. försämrade mekaniska egenskaper, fasomvandlingar och oxidation och bestäms av praktiska erfarenheter, inte av en fast 50 %-gräns.

Quizens formuleringar "Bara rena kristallina material har en väl definierad smälttemperatur" och "Värmekapacitivitet är kvoten mellan tillsatt energi och temperaturökning" är preciserade efter föreläsningarna.$kuggfri$, null, 218, true, $kuggfri$cef63d9ec$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Rena metaller har en distinkt smälttemperatur, medan legeringar i regel har ett smältintervall.","correct":true},{"text":"Glasomvandlingstemperaturen är temperaturen då ett material omvandlas till glas.","correct":false},{"text":"Maximal användningstemperatur är temperaturen då de mekaniska egenskaperna har minskat till 50 %.","correct":false},{"text":"Värmekapacitivitet är den energi som krävs för att höja temperaturen 1 K för 1 kg material.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 4, fråga 2; Canvas, GLU 02 Fasdiagram, s. 9; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 4; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 9; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 4; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 6; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 8$kuggfri$, false, $kuggfri$Quizens rätta alternativ "Bara rena kristallina material har en väl definierad smälttemperatur" är omskrivet till "Rena metaller har en distinkt smälttemperatur, medan legeringar i regel har ett smältintervall" (GLU 02 s. 9, GLU_5-8 s. 9), och värmekapacitivitet är preciserad till per kg och K (Kapitel_12 s. 8). Det felaktiga alternativet "Glasomvandlingstemperaturen är temperaturen då ett material omvandlas till glas" kan dessutom läsas som sant, eftersom ett amorft material under Tg är i glastillstånd. Godkänns omskrivningen, och ska Tg-alternativet bytas ut?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('91bff1e0-b5ff-5662-8e61-d36d5478ac29', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$quiz-nar-man-hojer-temperaturen-2-ratt$kuggfri$, $kuggfri$Vad händer när man höjer temperaturen i ett fast material?$kuggfri$, $kuggfri$Ett fast ämne expanderar vid uppvärmning eftersom atomerna rör sig längre från varandra; samma massa tar större volym, så densiteten minskar. Diffusionen, och därmed t.ex. krypningen, ökar exponentiellt med temperaturen. Det gäller materialen generellt och är något man tar hänsyn till, t.ex. med en maximal användningstemperatur, inte ett skäl att undvika ett material. Vid högre temperatur försvagas atombindningarna och de mekaniska egenskaperna försämras; brottgränsen ökar inte.

Quizens "för alla material" är struket ur det rätta alternativet.$kuggfri$, null, 219, true, $kuggfri$c0b9d8dba$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Densiteten minskar, eftersom materialet expanderar.","correct":true},{"text":"Diffusionshastigheten ökar exponentiellt med temperaturen.","correct":true},{"text":"Material vars egenskaper ändras exponentiellt med temperaturen bör undvikas.","correct":false},{"text":"Sträckgränsen minskar men brottgränsen ökar.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 4, fråga 3; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 2; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 3; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 6; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 15; Canvas, GLU 02 Fasdiagram, s. 7$kuggfri$, false, $kuggfri$Quizens rätta alternativ "Diffusionshastigheten ökar exponentiellt med temperaturen för alla material" är för starkt, och "för alla material" är struket ur kortet. Godkänns ändringen, och ska Quiz vecka 4 fråga 3 ändras likadant?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('b39a64bd-9691-5720-8dfe-cdb4901672db', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$quiz-diffusion-2-ratt$kuggfri$, $kuggfri$Vad stämmer om diffusion?$kuggfri$, $kuggfri$Diffusion är slumpmässig rörelse av atomer som netto går från hög till låg koncentration, så koncentrationsskillnader jämnas ut, och små atomer rör sig snabbare än stora. Diffusion sker även i polymerer: vid formsprutning måste polymerkedjorna hinna diffundera över gränsen där två smältfronter möts, annars blir svetslinjen svag. Diffusionen ökar exponentiellt med temperaturen och beror på vilken atom som rör sig i vilken kristall. Krom tillsätts i stål för att ge ett skyddande kromoxidskikt (rostfritt stål), inte för att minska diffusionen.$kuggfri$, null, 220, true, $kuggfri$c119d4365$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Diffusion jämnar ut koncentrationsskillnader.","correct":true},{"text":"Diffusion finns bara i metaller och keramer, inte i amorfa polymerer.","correct":false},{"text":"Stora atomer diffunderar långsammare än små.","correct":true},{"text":"Legering med Cr är det bästa sättet att minska diffusionen i stål.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 4, fråga 5; Canvas, GLU 02 Fasdiagram, s. 7; Canvas, Fö 10 Material och värme, s. 13; Canvas, Svarsförslag uppgift 4-6, IMS085 251030, s. 2; Canvas, Fö 12 Stål, s. 24$kuggfri$, false, $kuggfri$Förklaringen säger att krom tillsätts i stål för oxidskiktet "inte för att minska diffusionen", men Fö 12 Stål s. 24 säger att legering också ökar härdbarheten eftersom stora legeringsatomer fördröjer perlitbildningen, alltså diffusionen; alternativet är bara fel på grund av "det bästa sättet". Meningen om att polymerkedjor måste diffundera över svetslinjen har bara stöd i svarsförslaget till tentan 2025-10-30. Ska förklaringen skrivas om?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3d84989b-21c3-540a-b408-690270b58dbd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$quiz-termiska-egenskaper-2-ratt$kuggfri$, $kuggfri$Termiska egenskaper: vilka påståenden är sanna?$kuggfri$, $kuggfri$Fouriers lag ger värmeflödet vid stationärt tillstånd; minustecknet visar att värmen går mot lägre temperatur. Värme leds av fononer och, i metaller, även av elektroner. Termisk utvidgning är en spänningsfri töjning som uppstår för att atomerna rör sig längre från varandra, inte en plastisk deformation. Fononerna hindras och sprids av kristallstörningar som inlösta atomer, så legering förbättrar inte värmeledningsförmågan.$kuggfri$, null, 221, true, $kuggfri$c1efb5f04$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Vid stationärt tillstånd är värmeflödet värmeledningsförmågan gånger temperaturgradienten, $q = -\\lambda\\,\\Delta T/\\Delta x$.","correct":true},{"text":"Värmeledning sker bland annat med fononer (kristallvibrationer).","correct":true},{"text":"Termisk utvidgning ger en plastisk förlängning av materialet.","correct":false},{"text":"En metalls värmeledningsförmåga förbättras när den legeras.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 4, fråga 9; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 12; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 15; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 21; Canvas, Fö 10 Material och värme, s. 10; Canvas, Fö 10 Material och värme, s. 11$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('85c89155-272c-5ebf-b602-d9a363232f1a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$varme-fourier-berakning$kuggfri$, $kuggfri$En ugnsvägg har isolering med $\lambda = 0{,}04$ W/(m K) och tjockleken 0,10 m. Inne är det 200 °C och ute 20 °C. Hur stort är värmeflödet genom väggen vid stationärt tillstånd?$kuggfri$, $kuggfri$Vid stationärt tillstånd är $q = \lambda\,\dfrac{T_i - T_o}{t} = 0{,}04 \cdot \dfrac{200 - 20}{0{,}10} = 72$ W/m². 7,2 W/m² fås om man glömmer att dela med tjockleken, 0,72 W/m² om man multiplicerar med den och 720 W/m² om tjockleken sätts till 0,01 m. Material med låg värmeledningsförmåga minimerar effektförlusten.$kuggfri$, null, 222, true, $kuggfri$c70f716b9$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"0,72 W/m²","correct":false},{"text":"7,2 W/m²","correct":false},{"text":"72 W/m²","correct":true},{"text":"720 W/m²","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 22; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 21; Canvas, Ashby et al Materials 3 utgåvan PRELIMINÄR Läsanvisning och detaljerade lärmål Kap 1-12, s. 5$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('e4b9ef81-0d7b-5798-98ba-29e3fc3e06cf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$varme-alfa-och-smalttemperatur$kuggfri$, $kuggfri$Material med hög smälttemperatur har i regel låg termisk utvidgningskoefficient.$kuggfri$, $kuggfri$Sant. Starka atombindningar ger hög smälttemperatur och hög E-modul, och alla kristallina fasta ämnen expanderar ungefär 2 % från absoluta nollpunkten till smältpunkten. Utvidgningskoefficienten korrelerar därför med $1/T_m$: blylegeringar har högt $\alpha$, medan titanlegeringar och stål har lägre.$kuggfri$, null, 223, true, $kuggfri$cb12a21d3$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 15; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 26$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c55ec76d-1d64-56ba-9aa1-82f9e3ca4f6a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$varme-undvika-termiska-spanningar$kuggfri$, $kuggfri$Hur kan man undvika stora termiska spänningar mellan två sammanfogade material?$kuggfri$, $kuggfri$Termiska spänningar uppstår när sammanfogade material har olika termisk utvidgningskoefficient $\alpha$, så att det ena expanderar mer än det andra vid en temperaturändring.

* Det enklaste är att välja material med liknande utvidgningskoefficienter, men det är ofta inte möjligt i en given konstruktion.
* Ett alternativ är en graderad fog: mellanliggande material med stegvis ändrat $\alpha$ (t.ex. stål fogat mot en nickellegering med lägre $\alpha$) fungerar som buffert och minskar skillnaden i utvidgning i varje fog.$kuggfri$, null, 224, true, $kuggfri$c0df07b71$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 16; Canvas, 2026-09-25 Kapitel_12 Material och värme, s. 18$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('04672563-5348-5b7a-9c27-3bc15c246b1d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$diffusion-arrhenius-samband$kuggfri$, $kuggfri$Hur beror diffusionskoefficienten D på temperaturen T och aktiveringsenergin Q?$kuggfri$, $kuggfri$$D_0$ är en preexponentiell konstant, Q aktiveringsenergin (J/mol), R den allmänna gaskonstanten (8,314 J/(mol K)) och T temperaturen i kelvin. Q är den energibarriär som atomerna måste övervinna med termisk energi för att kunna hoppa, och den är konstant för en viss atom i ett visst material; det är D, alltså diffusionshastigheten, som ökar exponentiellt med temperaturen. Ju högre Q, desto mindre blir $e^{-Q/RT}$ och därmed D vid en given temperatur, om $D_0$ är densamma. Med $+Q/RT$ i exponenten skulle diffusionen i stället avta med temperaturen.$kuggfri$, null, 225, true, $kuggfri$c81ad10be$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"$D = D_0\\,e^{-Q/RT}$","correct":true},{"text":"Vid en given temperatur (och samma $D_0$) ger en högre aktiveringsenergi Q en lägre D.","correct":true},{"text":"Det är Q som ökar exponentiellt med temperaturen.","correct":false},{"text":"$D = D_0\\,e^{Q/RT}$, så D minskar när T ökar.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 10 Material och varme, s. 13; Canvas, Lasanvisningar Kapitel 12 och 13, s. 1$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('7239a2d6-e893-5c5f-81e9-470f010cadaf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$diffusion-arrhenius-berakning$kuggfri$, $kuggfri$Självdiffusion i aluminium har aktiveringsenergin $Q = 142$ kJ/mol. Ungefär hur många gånger större är diffusionskoefficienten vid 500 °C än vid 400 °C?$kuggfri$, $kuggfri$$\dfrac{D_{500}}{D_{400}} = \exp\!\left[\dfrac{Q}{R}\left(\dfrac{1}{673} - \dfrac{1}{773}\right)\right] = \exp\!\left[\dfrac{142\,000}{8{,}314}\cdot 1{,}92\cdot 10^{-4}\right] \approx e^{3{,}28} \approx 27$. $D_0$ tar ut sig, och temperaturen ska vara i kelvin. 1,25 är bara kvoten 500/400 och 1,15 kvoten 773/673; ingen av dem tar hänsyn till det exponentiella beroendet. Ca 5 100 gånger fås om temperaturerna sätts in i °C. Diffusionen är alltså mycket känslig för temperaturen.$kuggfri$, null, 226, true, $kuggfri$cf8be0a59$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 27 gånger","correct":true},{"text":"Ca 1,25 gånger","correct":false},{"text":"Ca 1,15 gånger","correct":false},{"text":"Ca 5 100 gånger","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Ovning 8 m losningar, s. 4; Canvas, Fo 10 Material och varme, s. 13$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('e3dc990c-9421-5f41-9808-0d23ef53b5fb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '6aaaf25d-9bb7-5fe8-81a0-52e742379456', $kuggfri$krypning-pastaenden$kuggfri$, $kuggfri$Vilka påståenden om krypning stämmer?$kuggfri$, $kuggfri$Krypning är långsam, tidsberoende deformation under last. I metaller sker den över cirka 0,5 $T_m$ och ger plastisk (permanent) deformation. Mekanismerna är diffusionskrypning, där kornen förlängs i belastningsriktningen genom diffusion, och power-law-krypning, där diffusion hjälper dislokationer runt hinder; diffusionskrypning kräver alltså ingen dislokationsrörelse, och även amorfa polymerer kryper. När krypspänningen tas bort från en polymer återgår bara en del av töjningen; kedjor som har glidit förbi varandra stannar i sina nya lägen.$kuggfri$, null, 227, true, $kuggfri$c492242d1$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"I metaller blir krypning betydande först över ungefär halva smälttemperaturen (i kelvin).","correct":true},{"text":"Polymerer kryper redan vid rumstemperatur; kursens krypkurvor för t.ex. PMMA gäller 20 °C.","correct":true},{"text":"Krypdeformationen går helt tillbaka när lasten tas bort.","correct":false},{"text":"Krypning kräver dislokationsrörelse och kan därför bara ske i kristallina material.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 10 Material och varme, s. 14, 15, 16; Canvas, MTT085 Polymeric materials L6, s. 5; Canvas, 2021 MTT085 Ovningsuppgifter - Polymera material, s. 8$kuggfri$, false, $kuggfri$Tre av fyra alternativ motsvarar påståendena i tentan 2023-10-23 uppg. 1b (över halva smälttemperaturen, bara kristallina material, elastisk deformation som går tillbaka), omskrivna och preciserade för metaller. Ligger kortet för nära tentan?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('21ec6dcd-d6ff-57d5-83b7-8f9c9e551096', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-utgor-stal$kuggfri$, $kuggfri$Vad utgör stål?$kuggfri$, $kuggfri$Stål är järn legerat med kol som beroende på kolhalt och tillverkningsförhållanden kan ges olika egenskaper.$kuggfri$, null, 228, true, $kuggfri$c3b344416$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('57c5d9f0-71a4-5cb9-a79f-f28430b575bf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$beskriv-vad-en-anlopning-ar$kuggfri$, $kuggfri$Beskriv vad en anlöpning är.$kuggfri$, $kuggfri$Anlöpning görs efter martensithärdning, eftersom martensiten är mycket hård men ofta för spröd. Det härdade stålet värms till en måttlig temperatur, under den eutektoida temperaturen, ca 723 °C (727 °C i labb-PM:et). I föreläsningens exempel är anlöpningstemperaturen ca 200 till 650 °C, i labb-PM ca 500 °C.

* Martensiten sönderfaller till anlöpt martensit: ferrit med mycket små cementitpartiklar (inte perlit)
* Hårdheten och sträckgränsen sjunker något, men segheten ökar kraftigt
* Temperatur och tid avgör cementitpartiklarnas storlek, så hårdheten kan styras med anlöpningstemperaturen$kuggfri$, null, 229, true, $kuggfri$c429619e4$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet angav fel temperatur (precis under ca 910 °C) och fel produkt (perlit + cementit); anlöpning sker vid måttlig temperatur och ger ferrit med fina cementitpartiklar; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 24; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 25; Canvas, Lab_PM_M2_v2026, s. 11; Canvas, Lab_PM_M2_v2026, s. 13; Canvas, Lab_PM_M2_v2026, s. 14; Canvas, Fö 12 Stål, s. 16; Canvas, Fö 12 Stål, s. 22; Canvas, Fö 12 Stål, s. 23; Canvas, Fö 5 Fasdiagram och mikrostruktur 2, s. 22; Canvas, Fö 5 Fasdiagram och mikrostruktur 2, s. 23$kuggfri$, true, $kuggfri$Rättelse av originalkortet: anlöpning angavs ske precis under ca 910 °C och ge "perlit + cementit". Nu står måttlig temperatur under den eutektoida, ca 723 °C (727 °C i labb-PM:et), med exemplen ca 200 till 650 °C, och ferrit med mycket små cementitpartiklar (Fö 12 Stål s. 16, GLU_5-8 s. 25), men Fö 12 Stål s. 22, som står bland källorna, skriver fortfarande "perlit + cementit". Godkänns rättelsen, och ska bilden Fö 12 s. 22 rättas?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('fea1c5f8-d9ee-5264-bab3-991773e7f3b2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vilken-inverkan-har-kolhalten-pa$kuggfri$, $kuggfri$Vilken inverkan har kolhalten på stålets egenskaper?$kuggfri$, $kuggfri$Kolet bildar cementit ($\text{Fe}_3\text{C}$), en mycket hård fas. Vid långsam kylning ger 0 % C bara ferrit, under 0,8 % C ferrit och perlit, 0,8 % C bara perlit och över 0,8 % C perlit och cementit. Mer kol ger alltså mindre ferrit och mer cementit, och stålet blir hårdare och starkare men mindre duktilt. I härdade stål ger mer kol fler karbider, med samma effekt.

Stål med högre kolhalt (maskinstål, 0,25 till 0,75 % C) kan härdas men är svårare att svetsa än konstruktionsstål (under 0,25 % C).$kuggfri$, null, 230, true, $kuggfri$cc74f1375$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, Fö 12 Stål, s. 17; Canvas, Fö 12 Stål, s. 18; Canvas, Fö 12 Stål, s. 25; Canvas, Fö 12 Stål, s. 26; Canvas, Övning 7 m lösningar, s. 5$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('78f5947a-cb47-5cfd-9277-dbff23e2f513', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-ar-martensit-och-hur-uppstar-det$kuggfri$, $kuggfri$Vad är martensit och hur uppstår det?$kuggfri$, $kuggfri$Kan fås vid snabbkylning av stål från austenitområdet. Det är utöver det en metastabil fas med tetragonal struktur = distorderad BCC.$kuggfri$, null, 231, true, $kuggfri$c6e6ca694$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('f8e9dc00-4834-5ba7-9185-3b93ea3001f1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$varfor-legerar-man-stal-namn-minst-tva$kuggfri$, $kuggfri$Varför legerar man stål? Nämn minst två anledningar.$kuggfri$, $kuggfri$Stål legeras för att:

* lösningshärda ferriten
* öka härdbarheten: stora legeringsatomer fördröjer bildningen av perlit, så det finns mer tid att bilda martensit
* ge andra karbider än cementit, med stabilare högtemperaturegenskaper (t.ex. i verktygsstål)
* ge korrosionsmotstånd: med krom bildas ett skyddande kromoxidskikt (rostfritt stål)
* stabilisera austenit vid rumstemperatur (nickel i austenitiska rostfria stål)$kuggfri$, null, 232, true, $kuggfri$c4c3894f6$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, Fö 12 Stål, s. 24; Canvas, Fö 12 Stål, s. 27; Canvas, Fö 12 Stål, s. 28; Canvas, Övning 7 m lösningar, s. 5$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('63539781-4cc7-5fa0-b1cc-2f71d7545490', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-kannetecknar-underkategorin$kuggfri$, $kuggfri$Vad kännetecknar underkategorin: "Konstruktionsstål"?$kuggfri$, $kuggfri$* Kolhalt: < 0.25%

Konstruktionsstål kan delas in i två grupper; Kolstål och HSLA (High Strength Low Alloy)-steels, där låg kolhalt definieras som < 0.25%. Båda är svetsbara men kan ej härdas. Kolstål är billigt och används i exempelvis byggnader eller skepp. HSLA tillverkas mha en termomekanisk process som ger fin mikrostruktur och således hög sträckgräns. Används till exempel i fordonsplåtar och broar.$kuggfri$, null, 233, true, $kuggfri$c961c3901$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('97a3f631-75e9-5e4d-bda7-23035aa7f102', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-kannetecknar-underkategorin-2$kuggfri$, $kuggfri$Vad kännetecknar underkategorin: "Maskinstål"?$kuggfri$, $kuggfri$* Kolhalt: 0.25-0.75 %

Maskinstål kan härdas och är legerat för att öka härdbarheten. Dock är det svårare att svetsa än exempelvis konstruktionsstål. Exempel på användningsområden är järnvägsräls, handverktyg, maskindelar etc.$kuggfri$, null, 234, true, $kuggfri$c8caf953a$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1021c448-1f6f-58eb-8cfc-b6b301f1aa6b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-kannetecknar-underkategorin-3$kuggfri$, $kuggfri$Vad kännetecknar underkategorin: "Verktygsstål"?$kuggfri$, $kuggfri$* Kolhalt: 0.5-1.7 % C

Verktygsstål är legerat för att erhålla stabila karbider vid hög temperatur. Används i exempelvis gjutformar, pressverktyg, skärverktyg och kullager.$kuggfri$, null, 235, true, $kuggfri$c858b75c6$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('787e3a63-a165-5f3f-85c8-ac86e07302bf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-kannetecknar-underkategorin-4$kuggfri$, $kuggfri$Vad kännetecknar underkategorin: "Rostfritt stål"?$kuggfri$, $kuggfri$Legeras med Cr för att få ett kromoxidskikt på ytan → korrosionsskydd

* Ni, stabiliserar austenit vid rumstemperatur
* Tre typer: ferritiska (billiga), austenitiska (bäst korrosionsmotstånd, lågtemperaturegenskaper), martensitiska (kan härdas)$kuggfri$, null, 236, true, $kuggfri$cabac7777$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('87e465c8-9701-5028-b0ea-a8a44b73122a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-innebar-kalldeformation$kuggfri$, $kuggfri$Vad innebär kalldeformation?$kuggfri$, $kuggfri$Kallbearbetning, även kallat kalldeformation, är en process som stärker metall genom plastisk deformation som exempelvis kallvalsning och tråddragning.

Mycket högre dislokationsdensitet efter
kallbearbetning → högre sträckgräns
(deformationshärdning)$kuggfri$, null, 237, true, $kuggfri$c88bb3269$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Rättelse: kortet likställde kallbearbetning (processen) med deformationshärdning (härdningsmekanismen som processen ger); Canvas, Fo 12 Stal, s. 4, 13; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 36$kuggfri$, true, $kuggfri$Rättelse av originalkortet: det sa att kallbearbetning "även är känt som deformationshärdning" och likställde alltså processen med härdningsmekanismen. Nu står "även kallat kalldeformation", och deformationshärdningen beskrivs som följden av den högre dislokationstätheten (Fö 12 Stål s. 4, Kapitel_06 s. 36). Godkänns rättelsen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('ce391e59-9f19-59e1-b08f-c877fba14f51', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-innebar-rekristallation$kuggfri$, $kuggfri$Vad innebär rekristallisation?$kuggfri$, $kuggfri$Rekristallisation är en process inom metallbearbetning där en deformerad metall omstrukturerar sin inre kristallstruktur för att minska spänningar och återställa dess ursprungliga egenskaper. När metallen deformeras plastiskt, till exempel genom valsning eller smidning, blir dess kristallstruktur och dislokationer störda, vilket leder till hårdare och sprödare egenskaper (detta kallas kallbearbetning).
Rekristallisation sker när en deformerad metall värms upp till en specifik temperatur, kallad rekristallisationstemperaturen. Vid denna temperatur börjar nya, icke-deformerade korn att bildas inuti materialet. Dessa nya korn ersätter de gamla, deformerade kornen och bidrar till att:

* Sänka metallens hårdhet och öka dess duktilitet – metallen blir mjukare och mer formbar.
* Minska inre spänningar – som byggts upp under deformationen.
* Förbättra materialets struktur – den får en jämnare och mer homogen kornstruktur.$kuggfri$, null, 238, true, $kuggfri$c49b831c0$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true, $kuggfri$Kortet saknar källa och kallar egenskapen efter deformation för kallbearbetning ("hårdare och sprödare egenskaper (detta kallas kallbearbetning)"), medan Fö 12 Stål s. 5 säger att kallbearbetning ger högre sträckgräns och minskad brottförlängning, inte ett sprött material i kursens mening. "Återställa dess ursprungliga egenskaper" finns inte heller i materialet. Ska kortet kortas till föreläsningens formulering (nya små korn med få dislokationer, lägre sträckgräns, ökad brottförlängning)?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('4318305f-f0ff-5d20-a30b-5400f1b1e1a3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$vad-innebar-varmdeformation$kuggfri$, $kuggfri$Vad innebär varmdeformation?$kuggfri$, $kuggfri$Varmdeformation är en process där metaller deformeras vid temperaturer som är högre än deras rekristallisationstemperatur (ofta över cirka 0,5 gånger smälttemperaturen i kelvin). Vid dessa temperaturer kan metallens kristallstruktur rekonstrueras samtidigt som deformationen sker, vilket gör att nya korn kan bildas kontinuerligt under bearbetningen. Detta innebär att materialet inte härdas, och det behåller sin duktilitet och formbarhet. Varmdeformation används ofta för stora formändringar, exempelvis vid smidning och valsning i höga temperaturer.

Kortfattat:

* Ger deformation utan att höja sträckgränsen
* Stora deformationer är möjliga$kuggfri$, null, 239, true, $kuggfri$ce36f9930$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true, $kuggfri$Kortet säger att varmdeformation ofta sker över cirka 0,5 gånger smälttemperaturen i kelvin, men Fö 12 Stål s. 6 säger bara "över rekristallisationstemperaturen", och figuren på Fö 10 2025 s. 17 visar varmbearbetning vid ungefär 0,55 till 0,75 Tm. Ska siffran strykas eller ändras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('04a05efb-e55c-5270-8122-0b1ac989b140', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$beskriv-kortfattat-vad-skillnaden$kuggfri$, $kuggfri$Beskriv kortfattat vad skillnaden mellan kall- och varmdeformation är.$kuggfri$, $kuggfri$Skillnader kortfattat:

* Varmdeformation: Hög temperatur, inga spänningar byggs upp, materialet behåller sin formbarhet och stora dimensionsändringar kan ske under en och samma behandling.
* Kalldeformation: Låg temperatur, spänningar och hårdhet ökar, materialet blir starkare men samtidigt sprödare.$kuggfri$, null, 240, true, $kuggfri$cca0a1f06$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true, $kuggfri$Kortet säger att kalldeformerat material blir "starkare men samtidigt sprödare" och att inga spänningar byggs upp vid varmdeformation, medan Fö 12 Stål s. 5 och 6 säger högre sträckgräns och minskad brottförlängning respektive deformation utan att sträckgränsen höjs. Ska formuleringarna ändras till föreläsningens?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('16fb1c72-7d7a-5f85-8134-7aac280e17f9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$ge-exempel-pa-minst-tva-plastiska$kuggfri$, $kuggfri$Ge exempel på minst två plastiska formningsmetoder.$kuggfri$, $kuggfri$Exempel:

* Smide
* Valsning
* Pressning
* Tråddragning$kuggfri$, null, 241, true, $kuggfri$c00a9f430$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6f43d038-81cf-5128-a84d-8b8555e8f8e7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$redogor-for-vad-gjutning-innebar-for$kuggfri$, $kuggfri$Redogör för vad gjutning innebär för materialet och ge exempel på minst två gjutningsmetoder.$kuggfri$, $kuggfri$* Gjutstruktur – Olika struktur i
olika delar av gjutgodset
* Defekter – porer, sprickor
* Ofta något sämre mekaniska
egenskaper än valsade eller
smidda material

Exempel:

* Formgjutning
(högt och lågt tryck)
* Sandgjutning
* Lost wax- casting$kuggfri$, null, 242, true, $kuggfri$c42fcaab7$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2cd30d20-0100-53dd-bc85-68219f3627eb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$redogor-for-vad-svetsning-innebar-for$kuggfri$, $kuggfri$Redogör för vad svetsning innebär för materialet och ge exempel på minst två svetsmetoder.$kuggfri$, $kuggfri$* Svets där materialet har smält och
stelnat – gjutstruktur
* Värmepåverkad zon (HAZ) –
förändrad mikrostruktur,
korntillväxt, förändrad härdning
* Ofta sprickor

Ex: TIG/MIG/MAG$kuggfri$, null, 243, true, $kuggfri$c16f68117$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d83e65a5-c7e8-5056-af99-d6be43aa4222', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$beskriv-stalets-tillverkningsprocess-i$kuggfri$, $kuggfri$Beskriv stålets tillverkningsprocess i grova mått.$kuggfri$, $kuggfri$* Utgångsmaterial: järnoxid
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
* Kallvalsning, tråddragning, m.m. → plåt, räls, balkar, stång, tråd$kuggfri$, null, 244, true, $kuggfri$c3000bb92$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('29143e99-410b-5029-a80c-b4b741b849c0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$ge-minst-tva-exempel-pa$kuggfri$, $kuggfri$Ge minst två exempel på värmebehandlingar för stål.$kuggfri$, $kuggfri$* Normalisering: austenitisering + långsam kylning → primär ferrit eller cementit + perlit. Andel perlit ges av kolhalten. Ger ”normal” mikrostruktur, lämpligt för konstruktioner där styvheten är viktig.
* Mjukglödgning: värmning till temperatur under austenittemperatur (723 C) → diffusion och korntillväxt, sfäroidiserad perlit, lägre sträckgräns. Används för
stål som skall maskinbearbetas och därefter härdas.
* Martensithärdning:
1. Värmning till austenitområdet
2. Snabbkylning → martensit
3. Anlöpning → anlöpt martensit = ferrit med mycket små cementitpartiklar
Kolhalten avgör andelen cementit. Temperatur och tid för anlöpningen avgör storleken på cementitpartiklarna. Används när hårdhet och sträckgräns är viktigt.$kuggfri$, null, 245, true, $kuggfri$c3fb0cdea$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true, $kuggfri$Kortet säger om normalisering att den är "lämpligt för konstruktioner där styvheten är viktig" (Fö 12 Stål s. 15), men enligt Kapitel_04 s. 12 ändrar värmebehandling inte E-modulen i metaller. Ska bisatsen strykas eller förtydligas, på samma sätt som på kortet stal-normalisering?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('a07dfcae-611f-59ba-a558-0bb5070999d1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$ttt-diagram$kuggfri$, $kuggfri$TTT-diagram$kuggfri$, $kuggfri$TTT-diagram (time, temperature, transformation) visar hur lång tid det tar för instabil austenit att omvandlas, t.ex. till perlit, vid olika temperaturer. Ur diagrammet kan man därför avläsa hur snabbt man måste kyla från austenitområdet för att undvika perlit och i stället bilda martensit. Diagrammet är olika för olika stål och används för att bestämma tid och temperatur för värmebehandlingar.$kuggfri$, null, 246, true, $kuggfri$c2d566ff7$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, Fö 12 Stål, s. 20; Canvas, Fö 5 Fasdiagram och mikrostruktur 2, s. 21$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('46a9fe24-7e1b-5258-b01f-6e1daf283cc8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$mjukglodgning$kuggfri$, $kuggfri$Mjukglödgning$kuggfri$, $kuggfri$En värmebehandling av stål där man får sfäroidiserad perlit, vilket ger ett material med lägre sträckgräns men som är lättare att maskinarbeta. Stålet värms upp till en temperatur under austenitiseringstemperaturen, och
diffusion ger sfäroidiserad cementit.$kuggfri$, null, 247, true, $kuggfri$ca83d25c6$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('585b72a0-f107-5a46-9859-412f31526333', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$verktygsstal$kuggfri$, $kuggfri$Verktygsstål$kuggfri$, $kuggfri$Höglegerat stål med hög kolhalt. Används i härdat tillstånd. Hårt och värmetåligt.$kuggfri$, null, 248, true, $kuggfri$c3216b138$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true, $kuggfri$Kortet kallar verktygsstål "höglegerat stål med hög kolhalt", ordagrant facit till tentan 2016-10-29 uppg. 1d, men facit till tentan 2022-11-29 säger att verktygsstål "legeras ofta", Fö 12 Stål s. 14 placerar det under hög kolhalt utan krav på hög legering, och det finns olegerade kolverktygsstål. Ska "höglegerat" ändras till t.ex. "ofta legerat"?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('843de66d-7d6a-5be1-91b9-d310fa20cd83', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$ja-nej-nar-ett-material-varmvalsas-sa$kuggfri$, $kuggfri$När ett material varmvalsas ökar sträckgränsen.$kuggfri$, $kuggfri$Falskt. Varmbearbetning sker över rekristallisationstemperaturen, så plastisk deformation och rekristallisation sker samtidigt. Deformationen höjer därför inte sträckgränsen, och stora deformationer är möjliga. Det är vid kallbearbetning som dislokationsdensiteten och därmed sträckgränsen ökar (deformationshärdning).$kuggfri$, null, 249, true, $kuggfri$cadc511f2$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2; Canvas, Fö 12 Stål, s. 4; Canvas, Fö 12 Stål, s. 5; Canvas, Fö 12 Stål, s. 6$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('d0618afe-bca0-547e-af97-57e89cc816bb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$ja-nej-i-stal-bildar-kol-cementit-men-i$kuggfri$, $kuggfri$I grått gjutjärn och segjärn förekommer allt kol som ren grafit.$kuggfri$, $kuggfri$Falskt. Gjutjärn har 2 till 4 % C, och i de vanliga typerna gråjärn och segjärn består mikrostrukturen av perlit och grafit. Perlit är ferrit och cementit ($\text{Fe}_3\text{C}$), så en del av kolet är bundet som cementit. Grafiten är fjällformad i gråjärn och sfärisk i segjärn. I stål bildar kolet cementit.

Tentan 2020 hade påståendet "I stål bildar kol cementit, men i gjutjärn förekommer kolet som ren grafit" med facit ja. Det är en förenkling, därför är påståendet omformulerat.$kuggfri$, null, 250, true, $kuggfri$c569d825f$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2; Canvas, Fö 12 Stål, s. 17; Canvas, Fö 12 Stål, s. 29; Canvas, Lab_PM_M2_v2026, s. 12; Canvas, Övning 7 m lösningar, s. 5$kuggfri$, true, $kuggfri$Tentan 2020-10-24 uppg. 1j ("I stål bildar kol cementit, men i gjutjärn förekommer kolet som ren grafit", facit ja) är omskriven till "I grått gjutjärn och segjärn förekommer allt kol som ren grafit" med facit falskt, eftersom Fö 12 Stål s. 29 anger perlit och grafit. Men svaret beror på grundmassan: i ferritiskt gråjärn och segjärn finns i praktiken allt kol som grafit, så frågan prövar mest ordet "allt". Håller examinatorn med om facit falskt, eller ska påståendet formuleras om så att det blir entydigt?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8b407853-d672-5c01-80cc-efba89c5a5fa', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$quiz-ttt-diagram-tva-ratt$kuggfri$, $kuggfri$TTT-diagram: vilka påståenden är sanna?$kuggfri$, $kuggfri$TTT står för time, temperature, transformation. Diagrammet visar tiden för omvandling av instabil austenit till perlit vid olika temperaturer, och därmed vilken avsvalningshastighet som krävs för att i stället bilda martensit. Martensit bildas bara från austenit, genom snabbkylning; perlit omvandlas inte till martensit.$kuggfri$, null, 251, true, $kuggfri$c380d26ce$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ur TTT-diagrammet kan man läsa hur lång tid det tar för instabil austenit att omvandlas till perlit.","correct":true},{"text":"TTT står för tryck, temperatur, transition.","correct":false},{"text":"Med ett TTT-diagram kan man bestämma hur snabbt man måste kyla för att bilda martensit.","correct":true},{"text":"Ur TTT-diagrammet kan man läsa hur lång tid det tar för perlit att omvandlas till martensit.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 2, fråga 9; Canvas, Fö 12 Stål, s. 20; Canvas, Fö 5 Fasdiagram och mikrostruktur 2, s. 21; Canvas, Lab_PM_M2_v2026, s. 13$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('b6fe36bb-75e6-5ce4-8b3b-5d40d972b9ad', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$quiz-ttt-diagram-for-stal-2-ratt$kuggfri$, $kuggfri$TTT-diagram för stål: vilka påståenden är sanna?$kuggfri$, $kuggfri$TTT-diagrammet visar omvandlingstiden för instabil austenit och därmed den kylhastighet som krävs för martensit, dvs. fasomvandlingarnas kinetik. Hävstångsregeln används i fasdiagram, som visar de stabila faserna vid jämvikt. Martensit kan bara bildas ur austenit, så perlit som redan har bildats blir inte martensit vid snabbkylning.$kuggfri$, null, 252, true, $kuggfri$c5107fc67$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ett TTT-diagram för stål visar tiden för instabil austenit att omvandlas till perlit.","correct":true},{"text":"Med hävstångsregeln kan andelen av strukturbeståndsdelarna beräknas ur TTT-diagrammet.","correct":false},{"text":"Ett TTT-diagram visar hur snabbt man måste kyla från austenitområdet för att bilda martensit.","correct":true},{"text":"Genom att först bilda perlit och sedan snabbkyla och bilda martensit undviks sprickbildning.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 4, fråga 8; Canvas, Fö 5 Fasdiagram och mikrostruktur 2, s. 21; Canvas, Fö 12 Stål, s. 2; Canvas, GLU 02 Fasdiagram, s. 8; Canvas, Lab_PM_M2_v2026, s. 13$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c129d9e0-b3ec-5d1f-9865-71b180444c3b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$quiz-kall-och-varmbearbetning-2-ratt$kuggfri$, $kuggfri$Kall- och varmbearbetning: vilka påståenden är sanna?$kuggfri$, $kuggfri$Kallbearbetning ger mycket högre dislokationsdensitet, vilket höjer sträckgränsen (deformationshärdning) och minskar brottförlängningen; det beror inte på att atomerna trycks samman. Även rena metaller deformationshärdas, t.ex. ren aluminium och ren koppar. När ett kallbearbetat material värms upp rekristalliserar det: nya små korn med få dislokationer bildas, sträckgränsen sjunker och brottförlängningen ökar.

I quizen stod "brottgränsen" och "dislokationsfria korn"; föreläsningen talar om sträckgräns och om korn med få dislokationer.$kuggfri$, null, 253, true, $kuggfri$c78670dc8$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Rekristallisation innebär att nya korn med få dislokationer bildas när ett kallbearbetat material värms upp.","correct":true},{"text":"Vid kallvalsning ökar sträckgränsen och brottförlängningen minskar.","correct":true},{"text":"Vid kallvalsning trycks atomerna samman och materialet blir tätare.","correct":false},{"text":"För att en metall ska bli hårdare vid kallbearbetning måste den vara legerad.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 4, fråga 10; Canvas, Fö 12 Stål, s. 4; Canvas, Fö 12 Stål, s. 5; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 36; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 43$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('18756b90-2600-525f-b979-fcfbccdd1334', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$stal-normalisering$kuggfri$, $kuggfri$Normalisering$kuggfri$, $kuggfri$Värmebehandling av stål: austenitisering följd av långsam kylning i luft. Man får jämviktsstrukturen, primär ferrit eller cementit plus perlit, där andelen perlit ges av kolhalten. Normalisering ger en "normal" mikrostruktur, lämplig för konstruktioner där styvheten är viktig.$kuggfri$, null, 254, true, $kuggfri$c5115e3df$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, Short_dictionary_ v2026, s. 10; Canvas, Fö 12 Stål, s. 15; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 15; Canvas, Tentamen med svarsförslag MTT085 251030, uppgift 1h$kuggfri$, false, $kuggfri$Kortet säger att normalisering ger en mikrostruktur "lämplig för konstruktioner där styvheten är viktig", som på Fö 12 Stål s. 15, men enligt Kapitel_04 s. 12 påverkar värmebehandling inte E-modulen i metaller (och tentan 2020 uppg. 1a har facit nej på att värmebehandling ökar E-modulen). Menar bilden styrka eller seghet, och ska bisatsen strykas eller förtydligas?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('9e9d8319-bf10-515b-bed5-9bfb653cbbae', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$stal-hardbarhet-legering$kuggfri$, $kuggfri$Varför ökar legeringsämnen stålets härdbarhet?$kuggfri$, $kuggfri$Martensit bildas när stål kyls så snabbt från austenitområdet att kolet inte hinner diffundera och bilda perlit. Stora legeringsatomer fördröjer perlitbildningen, så det finns mer tid att bilda martensit; därför är t.ex. maskinstål legerade för att öka härdbarheten. TTT-diagrammet, som visar tiden för omvandling till perlit, är olika för olika stål. Härdning ändrar inte E-modulen, och snabbare koldiffusion skulle tvärtom underlätta perlitbildningen.$kuggfri$, null, 255, true, $kuggfri$c65e84784$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Stora legeringsatomer fördröjer bildningen av perlit, så det finns mer tid att bilda martensit vid kylningen","correct":true},{"text":"Legeringsatomerna bildar martensit redan vid stelningen","correct":false},{"text":"Legeringsatomerna höjer E-modulen så att stålet blir hårdare","correct":false},{"text":"Legeringsatomerna gör att kolet diffunderar snabbare","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fö 12 Stål, s. 24; Canvas, Fö 12 Stål, s. 26; Canvas, Fö 5 Fasdiagram och mikrostruktur 2, s. 20; Canvas, Fö 5 Fasdiagram och mikrostruktur 2, s. 21; Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('b57a3a08-5d1c-5579-9b2c-3002b7a1b4e3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$stal-gjutjarn-gra-och-seg$kuggfri$, $kuggfri$Vad stämmer för gråjärn och segjärn?$kuggfri$, $kuggfri$Gjutjärn har 2 till 4 % C. I de vanliga typerna gråjärn och segjärn består mikrostrukturen av perlit och grafit. I gråjärn är grafiten fjällformad, vilket ger lägre E-modul (ungefär hälften av ståls), ett relativt sprött material och god vibrationsdämpning. I segjärn är grafiten sfärisk, vilket ger högre seghet. Gjutjärn används t.ex. till maskindelar och maskinstativ.$kuggfri$, null, 256, true, $kuggfri$c01fe6a60$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Mikrostrukturen består av perlit och grafit","correct":true},{"text":"Gråjärn har fjällformad grafit, vilket ger lägre E-modul (ungefär hälften av ståls) och ett relativt sprött men vibrationsdämpande material","correct":true},{"text":"Segjärn har fjällformad grafit och är därför sprödare än gråjärn","correct":false},{"text":"Gjutjärn har lägre kolhalt än stål","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fö 12 Stål, s. 29; Canvas, Övning 7 m lösningar, s. 5$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('024198de-5fa3-5c24-8a6a-777bf707ca69', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$martensit-samma-kolhalt-som-austenit$kuggfri$, $kuggfri$Vid martensithärdning får martensiten samma kolhalt som austeniten hade före snabbkylningen.$kuggfri$, $kuggfri$Sant. Vid snabbkylningen hinner kolet inte diffundera och bilda cementit, så austeniten omvandlas diffusionslöst till martensit med samma kolhalt men en annan gitterstruktur (bct, som liknar ferritens bcc). Det tvångslösta kolet gör martensiten mycket hård. Austenit är den enda fas som kan omvandlas till martensit, så ferrit eller cementit som redan finns när kylningen börjar finns kvar.$kuggfri$, null, 257, true, $kuggfri$c3e95e60f$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Lab_PM_M2_v2026, s. 13; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 23, 25$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ad46e248-7ba4-57bc-9723-4d225eb01d09', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$stal-02-tvafas-snabbkylning$kuggfri$, $kuggfri$Ett stål med 0,2 % C hålls strax över 723 °C tills jämvikt har ställt in sig och snabbkyls sedan. Vilken struktur får det? (Austeniten har då ca 0,8 % C; ferritens kolhalt kan försummas.)$kuggfri$, $kuggfri$![Förenklat Fe–C-diagram för stål med faser och strukturbeståndsdelar kring den eutektoida punkten](/kort/materialteknik/fe-c-stalhornet.svg)

Strax över 723 °C ligger stålet i tvåfasområdet ferrit + austenit. Hävstångsregeln ger andelen austenit $= \dfrac{0{,}2 - 0}{0{,}8 - 0} = 0{,}25$. Vid snabbkylningen omvandlas bara austeniten, till martensit med samma kolhalt (ca 0,8 % C), medan ferriten finns kvar. 100 % martensit kräver att stålet först austenitiseras helt, och perlit bildas bara vid långsam kylning.$kuggfri$, null, 258, true, $kuggfri$cc41505ee$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 75 % ferrit och 25 % martensit med ca 0,8 % C","correct":true},{"text":"100 % martensit med 0,2 % C","correct":false},{"text":"Ca 25 % ferrit och 75 % martensit med ca 0,2 % C","correct":false},{"text":"Ca 75 % ferrit och 25 % perlit","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Lab_PM_M2_v2026, s. 13; Canvas, GLU 02 Fasdiagram, s. 17, 19; Canvas, Fo 12 Stal, s. 17$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('b26ee42c-04c7-5f7d-a430-0b0566c452dc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$stal-11-cementit-och-martensit$kuggfri$, $kuggfri$Ett verktygsstål med 1,1 % C hålls strax över 723 °C och snabbkyls. Vilka faser finns efteråt? (Austeniten har då ca 0,8 % C; cementit har 6,67 % C.)$kuggfri$, $kuggfri$Strax över 723 °C ligger ett övereutektoidiskt stål i tvåfasområdet austenit + cementit. Hävstångsregeln ger andelen cementit $= \dfrac{1{,}1 - 0{,}8}{6{,}67 - 0{,}8} \approx 0{,}05$ och andelen austenit ca 95 %. Vid snabbkylningen blir austeniten martensit med samma kolhalt, medan cementiten finns kvar; vid härdning av övereutektoidiska stål går man i vanliga fall inte så högt i temperatur att all cementit i korngränserna löses upp. 16 % fås om man räknar $1{,}1/6{,}67$, som om allt kol låg i cementit. Perlit och cementit bildas vid långsam kylning.$kuggfri$, null, 259, true, $kuggfri$c425a4c67$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 95 % martensit med ca 0,8 % C och 5 % cementit","correct":true},{"text":"100 % martensit med 1,1 % C","correct":false},{"text":"Ca 84 % martensit och 16 % cementit","correct":false},{"text":"Perlit och cementit","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Lab_PM_M2_v2026, s. 12, 13; Canvas, Fo 12 Stal, s. 17, 18; Canvas, GLU 02 Fasdiagram, s. 17$kuggfri$, false, $kuggfri$Kolhalten byttes efter granskningen från 1,2 till 1,1 % C för att inte ge samma svar som tentan 2023 uppg. 3b, men 1,1 % C är legeringen i tentan 2016-10-29 uppg. 4b, där svarsförslaget får samma fördelning 95/5 med samma hävstångsregel. Ändringen har inte granskats oberoende. Duger kortet, eller ska kolhalten bytas igen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('9fce153e-e046-55a8-95cf-d51987494c5b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$anlopning-andel-cementit$kuggfri$, $kuggfri$Ett stål med 0,45 % C härdas till 100 % martensit och anlöps sedan. Ungefär hur stor andel cementit innehåller det efter anlöpningen? (Cementit har 6,67 % C; ferritens kolhalt kan försummas.)$kuggfri$, $kuggfri$Anlöpt martensit är ferrit med mycket små cementitpartiklar, och kolhalten avgör andelen cementit. Hävstångsregeln mellan ferrit (≈ 0 % C) och cementit (6,67 % C) ger $0{,}45/6{,}67 \approx 0{,}07$, alltså ca 7 % cementit och 93 % ferrit. 56 % är andelen perlit ($0{,}45/0{,}8$) om samma stål i stället hade svalnat långsamt, och 45 % fås om man tar kolhalten som andel. Anlöpningen sker under den eutektoida temperaturen; martensiten sönderfaller då till ferrit och cementit.$kuggfri$, null, 260, true, $kuggfri$c737b5b7f$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 7 %","correct":true},{"text":"Ca 56 %","correct":false},{"text":"Ca 45 %","correct":false},{"text":"0 %, eftersom cementiten löses upp vid anlöpningen","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 12 Stal, s. 16, 17; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 24, 25; Canvas, Lab_PM_M2_v2026, s. 14; Canvas, GLU 02 Fasdiagram, s. 17$kuggfri$, false, $kuggfri$Kortet räknar andelen cementit i anlöpt martensit med hävstångsregeln mellan ferrit och cementit (0,45/6,67, ca 7 %), som facit till tentan 2020-10-24 uppg. 4b. Facit till 2023-10-23 uppg. 3c anger inga andelar, och Fö 12 Stål s. 16 säger bara att kolhalten avgör andelen cementit. Är det en beräkning kursen förväntar sig?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('560f5209-bfd9-5f5f-8cd7-790346f89499', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$ttt-avbruten-perlitomvandling$kuggfri$, $kuggfri$Ett eutektoidiskt stål kyls snabbt från austenitområdet till en temperatur där perlit bildas, hålls där tills ungefär en fjärdedel av austeniten har omvandlats och snabbkyls sedan till rumstemperatur. Vilken struktur får det?$kuggfri$, $kuggfri$TTT-diagrammet visar hur lång tid det tar för instabil austenit att omvandlas till perlit vid olika temperaturer. När hållningen avbryts finns tre fjärdedelar kvar som austenit. Vid snabbkylningen hinner kolet inte diffundera, så den kvarvarande austeniten blir martensit. Perlit som redan har bildats blir inte martensit, eftersom bara austenit kan omvandlas till martensit. Ferrit med sfäroidiserad cementit fås vid mjukglödgning.$kuggfri$, null, 261, true, $kuggfri$c482b88f3$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 25 % perlit och 75 % martensit","correct":true},{"text":"100 % perlit, eftersom omvandlingen fortsätter under snabbkylningen","correct":false},{"text":"100 % martensit, eftersom perliten omvandlas vid snabbkylningen","correct":false},{"text":"Ferrit med sfäroidiserad cementit","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 12 Stal, s. 20; Canvas, Lab_PM_M2_v2026, s. 13, 14; Canvas, Fo 5 Fasdiagram och mikrostruktur 2, s. 20, 21$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('e406e8b3-a788-5c6b-ab46-ea9a3d674c78', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$mjukglodgat-normaliserat-jamforelse$kuggfri$, $kuggfri$Två prov av samma eutektoida stål har värmebehandlats olika: det ena har mjukglödgats och det andra normaliserats. Vilka påståenden stämmer?$kuggfri$, $kuggfri$Båda behandlingarna ger jämviktsfaserna ferrit och cementit, och vid samma kolhalt ger hävstångsregeln samma fasandelar. Det som skiljer är cementitens form: normalisering (austenitisering och långsam kylning) ger lamellär perlit, medan mjukglödgning (värmning under ca 723 °C) genom diffusion ger sfäroidiserad cementit, lägre sträckgräns och ett stål som är lättare att maskinbearbeta.$kuggfri$, null, 262, true, $kuggfri$c7ac44c71$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"I det mjukglödgade provet är cementiten sfäroidiserad, som runda partiklar i ferrit.","correct":true},{"text":"Det normaliserade provet har lamellär perlit, omväxlande lameller av ferrit och cementit.","correct":true},{"text":"Båda proven har samma andel ferrit och cementit.","correct":true},{"text":"Det mjukglödgade provet har högre andel ferrit, eftersom cementiten har lösts upp.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 12 Stal, s. 15; Canvas, Lab_PM_M2_v2026, s. 11, 12; Canvas, GLU 02 Fasdiagram, s. 17, 19$kuggfri$, false, $kuggfri$Kortet gäller samma situation som tentan 2024-10-31 uppg. 4c och 4d (eutektoid stål, mjukglödgat mot normaliserat, samma andel ferrit), och två av alternativen motsvarar tentans alternativ i 4d. Ligger kortet för nära tentan?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8dd98fb1-7347-5587-9fd7-361182ad6e82', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '86266117-7fc7-5ca1-b416-41853cb7dbce', $kuggfri$stal-varmebehandling-strackgrans-ordning$kuggfri$, $kuggfri$Samma stål med medelhög kolhalt värmebehandlas på tre sätt: mjukglödgning, normalisering och härdning följd av anlöpning. Vilken ordning gäller för sträckgränsen, från lägst till högst?$kuggfri$, $kuggfri$Mjukglödgning ger sfäroidiserad cementit och lägre sträckgräns, så att stålet blir lätt att maskinbearbeta. Normalisering ger jämviktsstrukturen med lamellär perlit. Härdning och anlöpning ger ferrit med mycket små cementitpartiklar och används när hårdhet och sträckgräns är viktigt; de fina karbiderna ger den höga sträckgränsen. Duktiliteten går i regel åt andra hållet, eftersom starkare material tenderar att ha lägre duktilitet.$kuggfri$, null, 263, true, $kuggfri$c163236e5$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Mjukglödgat < normaliserat < härdat och anlöpt","correct":true},{"text":"Normaliserat < mjukglödgat < härdat och anlöpt","correct":false},{"text":"Härdat och anlöpt < normaliserat < mjukglödgat","correct":false},{"text":"Alla tre får samma sträckgräns, eftersom kolhalten är densamma","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 12 Stal, s. 15, 16, 23; Canvas, Ovning 7 m losningar, s. 5; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 46$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3b75db4a-1061-5ff9-8d7b-e716bf614bf0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$vad-kannetecknar-aluminium$kuggfri$, $kuggfri$Vad kännetecknar Aluminium?$kuggfri$, $kuggfri$* Lägre vikt än stål, densiteten är 2,7 kg/dm3
* FCC struktur → god plastisk formbarhet
* God maskinbarhet
* God elektrisk- och värmeledning
* Korrosionsskydd: Al reagerar med O₂ och bildar ett
skyddande oxidskikt på ytan$kuggfri$, null, 264, true, $kuggfri$c63c7cc6a$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ef2b31d6-ec9b-515d-b7fb-bc7a3776a9dc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$vad-kannetecknar-magnesium$kuggfri$, $kuggfri$Vad kännetecknar Magnesium?$kuggfri$, $kuggfri$* Låg densitet 1,8 kg/dm3
* HCP struktur → begränsad plastisk formbarhet
* God maskinbarhet
* God gjutbarhet, större delen används som gjutgods
* Bildar poröst oxidskikt, sämre korrosionsskydd
* Brännbart – men bara som pulver eller tunn plåt
* Energikrävande produktion$kuggfri$, null, 265, true, $kuggfri$c20735d95$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('9b03ecd8-4974-5c17-942b-5a4cef3f2271', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$vad-kannetecknar-titan$kuggfri$, $kuggfri$Vad kännetecknar Titan?$kuggfri$, $kuggfri$* Medel densitet 4,1 kg/dm3
* Utmärkt hållfasthet
* Utmärkt korrosionsskydd
* Dyrt på grund av tillverkningsprocessen
* Används i ren form eller legerat
* Biokompatibelt (inte negativt för kroppen), används t.ex. i implantat$kuggfri$, null, 266, true, $kuggfri$cd534598e$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "Titan är den enda metallen som är biokompatibel" är en överdrift; tentasvaren anger bara att titan är biokompatibelt; Canvas, Fö 13 Aluminium och andra metaller, s. 13; Canvas, Fö 13 Aluminium och andra metaller, s. 14; Canvas, Svar Materialteknik 2019-10-26, s. 2; Canvas, Tentamen Materialteknik mrd svar 2021-10-23 (korrigerad), uppgift 5$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "Titan är den enda metallen som är biokompatibel" (ordagrant Fö 13 Aluminium och andra metaller s. 13) är ändrat till "biokompatibelt", som i tentasvaren 2019 uppg. 5b och 2021 uppg. 5. Kortet anger också titanets densitet till 4,1 kg/dm³ som på samma bild, men värdet brukar anges till ca 4,5 kg/dm³. Godkänns rättelsen, och stämmer densiteten på bilden?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8ebec9f1-1a10-5584-8632-c04eaa66a0cc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$vad-kannetecknar-koppar-och-dess$kuggfri$, $kuggfri$Vad kännetecknar Koppar och dess legeringar?$kuggfri$, $kuggfri$* Hög densitet 8,9 kg/dm3
* Koppar: Utmärkt formbarhet, hög elektrisk och termisk
ledningsförmåga, pris=50 SEK/kg
* Mässing: legerat med 5-40 % Zn, bra form- och maskinbarhet.
* Brons: legerat med 5-25 % Sn, bra hållfasthet men lite
duktilitet, gjuts ofta
* Lagerbrons har bra tribologiska egenskaper$kuggfri$, null, 267, true, $kuggfri$c49d1abff$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('5ce3fa31-862d-55e9-a2ff-d4e5d50e41de', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$vad-kannetecknar-nickel-och-sa-kallade$kuggfri$, $kuggfri$Vad kännetecknar Nickel- och så kallade superlegeringar?$kuggfri$, $kuggfri$* Medel densitet 7,9-8,7 kg/dm3
* E-modul: 200-220 GPa
* Sträckgräns: 272-900 MPa
* Brottseghet: 127-251 $\text{MPa}\sqrt{\text{m}}$
* Användningstemperatur: -273-1040 °C
* Carbon footprint: 13 kg/kg
* Pris: 150 SEK/kg (för superlegeringar)
* Exceptionella högtemperatur- egenskaper med god
oxidations och korrosionsegenskaper
* Legeras med Cr, Co, Al, Ti Mo,
Zr, Fe, Hf$kuggfri$, null, 268, true, $kuggfri$c1e905552$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ba1b61a0-ef02-5e39-9723-449237f645f9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$varfor-anvander-man-inte-alltid-stal$kuggfri$, $kuggfri$Varför använder man inte alltid stål eftersom det är billigast?$kuggfri$, $kuggfri$Stål har bra mekaniska egenskaper, låg miljöbelastning per kilo och återfinns i många olika varianter för olika användningsområden till det billigaste priset, men aluminium har lägre densitet, fortfarande bra pris, är lättbearbetat och har bra naturligt korrosionsskydd.

Stål är bra, men i vissa situationer väljs andra material för att deras speciella egenskaper gör de särskilt fördelaktiga.$kuggfri$, null, 269, true, $kuggfri$cb19f9e5f$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('35410586-b689-51cf-b5f3-b1f791bf2152', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$aldring$kuggfri$, $kuggfri$Åldring$kuggfri$, $kuggfri$Sista steget i utskiljningshärdning, t.ex. av värmebehandlingsbara aluminiumlegeringar:

1. Upplösningsbehandling: legeringsämnet löses så att legeringen blir en enda fas ($\alpha$).
2. Snabbkylning: en metastabil, övermättad $\alpha$-fas bildas.
3. Åldring: vid förhöjd temperatur (artificiell åldring) eller rumstemperatur (naturlig åldring) ger diffusion små, jämnt fördelade utskiljningar, som höjer sträckgränsen.

Utskiljningarnas storlek beror på tid och temperatur, vilket ger underåldrat, toppåldrat (högst sträckgräns) och överåldrat tillstånd.$kuggfri$, null, 270, true, $kuggfri$c711d4568$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 26; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 27; Canvas, GLU 02 Fasdiagram, s. 1; Canvas, Fö 5 Fasdiagram och mikrostruktur 2, s. 18; Canvas, Fö 5 Fasdiagram och mikrostruktur 2, s. 19; Canvas, Short_dictionary_ v2026, s. 1; Canvas, Short_dictionary_ v2026, s. 10$kuggfri$, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('22b91be4-1d32-5d02-b3ec-d2f57e5208a0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$superlegering$kuggfri$, $kuggfri$Superlegering$kuggfri$, $kuggfri$Vanligtvis legeringar med Ni-bas som har excellenta högtemperaturegenskaper, oxidations- och korrosionsmotstånd.$kuggfri$, null, 271, true, $kuggfri$c1fc01a34$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d88c4686-0310-5539-a950-4eae049c8012', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$quiz-magnesium-2-ratt$kuggfri$, $kuggfri$Vad stämmer för magnesium?$kuggfri$, $kuggfri$Magnesium har HCP-struktur med få glidsystem, vilket ger begränsad plastisk formbarhet. Det har god gjutbarhet och god maskinbarhet, och ungefär 75 % används som gjutgods. Magnesium är relativt sprött: Mg-legeringarnas brottseghet är 12 till 18 $\text{MPa}\sqrt{\text{m}}$, lägre än aluminiumlegeringarnas (19 till 41 $\text{MPa}\sqrt{\text{m}}$).$kuggfri$, null, 272, true, $kuggfri$ca52f2112$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Det har många glidsystem för dislokationsrörelse och får därmed låg sträckgräns.","correct":false},{"text":"Det lämpar sig bäst för gjutning.","correct":true},{"text":"Det är svårt att maskinbearbeta.","correct":false},{"text":"En av de största nackdelarna är låg brottseghet.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 4, fråga 4; Canvas, Fö 13 Aluminium och andra metaller, s. 11; Canvas, Fö 13 Aluminium och andra metaller, s. 12; Canvas, Fö 13 Aluminium och andra metaller, s. 7; Canvas, Fö 13 Aluminium och andra metaller, s. 8; Canvas, Fö 12 Stål, s. 2; Canvas, Svar Materialteknik 2019-10-26, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('cbcdfa6c-9253-58fa-b9d5-9f9e374c360f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$quiz-aluminium-2-ratt$kuggfri$, $kuggfri$Vad stämmer för aluminium?$kuggfri$, $kuggfri$Aluminium reagerar med syre och bildar ett skyddande oxidskikt på ytan. Tillverkning av aluminium kräver betydligt mer energi per kilo än stål (i föreläsningens exempel med dryckesburkar 200 mot 23 per kg), men omsmältning vid återvinning kräver mycket mindre energi. Al-Cu-legeringar kan utskiljningshärdas. Aluminium har FCC-struktur och god plastisk formbarhet; det är magnesium som har HCP-struktur.

Quizens fjärde alternativ var ett påhittat legeringsnamn och har ersatts, och "korroderar inte" har preciserats.$kuggfri$, null, 273, true, $kuggfri$ccda120af$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Det skyddas mot korrosion av ett oxidskikt (Al₂O₃) som bildas på ytan.","correct":true},{"text":"Det kräver mindre energi per kilo att tillverka än stål.","correct":false},{"text":"Det kan utskiljningshärdas om det legeras med koppar.","correct":true},{"text":"Det har HCP-struktur och därför begränsad plastisk formbarhet.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 4, fråga 6; Canvas, Fö 13 Aluminium och andra metaller, s. 3; Canvas, Kapitel_03 Materialval, s. 45; Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 4; Canvas, Svarsförslag Tentamen MTT085 25-01, s. 6$kuggfri$, false, $kuggfri$Quizens alternativ "korroderar inte" är preciserat till "skyddas mot korrosion av ett oxidskikt (Al2O3)", och skämtalternativet med ett påhittat legeringsnamn är ersatt med den felaktiga "HCP-struktur" (Fö 13 Aluminium s. 3). Godkänns ändringarna, och ska Quiz vecka 4 fråga 6 ändras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('ffcf72fb-b29c-5da1-8008-8fbcf7be1673', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$quiz-indelning-och-legering-av-aluminium-2$kuggfri$, $kuggfri$Indelning och legering av aluminium: vilka påståenden är sanna?$kuggfri$, $kuggfri$Vid snabbkylning av en värmebehandlingsbar aluminiumlegering bildas en metastabil $\alpha$-fas; martensit bildas i stål. Lösnings- och utskiljningshärdning kräver legering, så ren aluminium härdas genom deformationshärdning (t.ex. hushållsfolie; valsad ren Al har högre sträckgräns än glödgad). Gjutlegeringar legeras med Si för att få ett eutektikum, som ger hållfasthet och slitstyrka och är lätt att gjuta. Aluminium har god maskinbarhet.

Quizens formulering "Enda sättet att höja sträckgränsen på ren aluminium är att deformationshärda" är uppmjukad, eftersom även en finkornigare struktur ger ett starkare material.$kuggfri$, null, 274, true, $kuggfri$cbcbfd6d0$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"När man snabbkyler aluminium kan metastabil martensit bildas.","correct":false},{"text":"Ren aluminium härdas i praktiken genom deformationshärdning, t.ex. valsning.","correct":true},{"text":"Gjutlegeringar legeras med Si för att öka användningstemperaturen.","correct":false},{"text":"En fördel med aluminium är att det är lätt att maskinbearbeta.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 4, fråga 7; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 5; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 12; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 26; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 31; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 43; Canvas, Kapitel_06 Plasticitet och Duktilitet, s. 45; Canvas, Fö 13 Aluminium och andra metaller, s. 3; Canvas, Fö 13 Aluminium och andra metaller, s. 9$kuggfri$, false, $kuggfri$Quizens rätta alternativ "Enda sättet att höja sträckgränsen på ren aluminium är att deformationshärda" är för starkt, eftersom även finare korn ger högre sträckgräns (GLU_5-8 s. 5); kortet säger nu "härdas i praktiken genom deformationshärdning" (Kapitel_06 s. 43, tabell 6.1). Godkänns uppmjukningen, och ska Quiz vecka 4 fråga 7 ändras?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('46148811-8ddd-5695-8be6-e634608cfb3b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$al-varmebehandlingsbara-legeringar$kuggfri$, $kuggfri$Vilka smideslegeringar av aluminium är värmebehandlingsbara, dvs. kan utskiljningshärdas?$kuggfri$, $kuggfri$Aluminiumlegeringar delas in i smideslegeringar och gjutlegeringar. Av smideslegeringarna är 2xxx, 6xxx och 7xxx värmebehandlingsbara: de utskiljningshärdas och får hög sträckgräns (t.ex. 2000- och 7000-serierna i flyg och rymd). Serierna 1000, 3000 och 5000 är inte värmebehandlingsbara, dvs. kan inte utskiljningshärdas, och härdas i stället genom lösnings- och deformationshärdning.$kuggfri$, null, 275, true, $kuggfri$c4e3862d2$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Serierna 2xxx, 6xxx och 7xxx","correct":true},{"text":"Serierna 3xxx och 5xxx","correct":false},{"text":"1000-serien (folie, elektriska ledare)","correct":false},{"text":"Alla smideslegeringar, oavsett legeringsämne","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fö 13 Aluminium och andra metaller, s. 4; Canvas, Fö 13 Aluminium och andra metaller, s. 7; Canvas, Fö 13 Aluminium och andra metaller, s. 8; Canvas, Övning 7 m lösningar, s. 5$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ba5df6c6-bba4-5e43-bfdb-9b6877750e68', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$al-toppaldrat$kuggfri$, $kuggfri$Vid åldring av en värmebehandlingsbar aluminiumlegering: vilket tillstånd ger högst sträckgräns?$kuggfri$, $kuggfri$Toppåldrat material är så starkt som legeringen kan bli, med måttlig seghet (t.ex. båtmaster och slalomstavar). Underåldrat är segare men har lite lägre sträckgräns. Överåldrat är lite svagare och segare men tåligare mot hög temperatur, eftersom utskiljningarna har vuxit klart; det används t.ex. i motorblock. Det är åldringen, som ger små jämnt fördelade utskiljningar, som höjer sträckgränsen efter snabbkylningen.$kuggfri$, null, 276, true, $kuggfri$c84d88f90$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Underåldrat","correct":false},{"text":"Toppåldrat (peak aged, T6)","correct":true},{"text":"Överåldrat","correct":false},{"text":"Direkt efter snabbkylningen, före åldringen","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 26; Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 27; Canvas, Fö 5 Fasdiagram och mikrostruktur 2, s. 19$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('41da04dc-532f-5e42-a748-9d85622b4ef4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$titan-anvandningstemperatur$kuggfri$, $kuggfri$Titanlegeringar kan användas vid betydligt högre temperaturer än aluminium- och magnesiumlegeringar.$kuggfri$, $kuggfri$Sant. Enligt föreläsningens data går titanlegeringar att använda upp till knappt 500 °C (487 °C), jämfört med ca 150–200 °C för aluminiumlegeringarna och ca 190 °C för magnesiumlegeringarna. Bland titanlegeringarnas användningsområden nämner föreläsningen kompressorn i jetmotorer, trots att titan är dyrt.$kuggfri$, null, 277, true, $kuggfri$cfbe9ee7b$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 13 Aluminium och andra metaller, s. 7, 8, 9, 12, 14$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('aeeb886d-b9ef-50f2-9f6c-cdc63d7391ba', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$metaller-tillampningar-ti-mg-cu$kuggfri$, $kuggfri$Vilka par av metall och typisk tillämpning stämmer enligt kursen?$kuggfri$, $kuggfri$Titan har utmärkt hållfasthet och korrosionsskydd och är biokompatibelt, men är dyrt på grund av tillverkningsprocessen. Magnesium har låg densitet (1,8 kg/dm³) och god gjutbarhet; ca 75 % används som gjutgods, bl.a. i flyg, fordon, sport och kåpor, men användningstemperaturen går bara upp till ca 190 °C. Koppar har hög densitet (8,9 kg/dm³) och väljs för sin utmärkta formbarhet och höga elektriska och termiska ledningsförmåga.$kuggfri$, null, 278, true, $kuggfri$cd4577a4b$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Titanlegeringar: kemisk industri, värmeväxlare, implantat och kompressorn i jetmotorer","correct":true},{"text":"Magnesiumlegeringar: gjutna kåpor till kameror, datorer och mobiltelefoner","correct":true},{"text":"Magnesiumlegeringar: komponenter som ska arbeta vid 500 °C","correct":false},{"text":"Koppar: lätta bärande konstruktioner där låg densitet är viktigast","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 13 Aluminium och andra metaller, s. 11, 12, 13, 14, 15$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('737d0e53-b7de-549e-ba3b-f06510075515', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$magnesium-egenskaper-begransningar$kuggfri$, $kuggfri$Vilka påståenden om magnesiumlegeringar stämmer?$kuggfri$, $kuggfri$Magnesium har låg densitet (1,8 kg/dm³), god gjutbarhet och god maskinbarhet. HCP-strukturen ger begränsad plastisk formbarhet, så ca 75 % används som gjutgods och 25 % som smidesgods. Legeringarna har låg E-modul, brottseghet 12–18 MPa√m och användningstemperatur upp till ca 190 °C. Typiska tillämpningar är lätta gjutna detaljer, t.ex. kåpor till maskiner, kameror, datorer och mobiltelefoner.$kuggfri$, null, 279, true, $kuggfri$ca537ea26$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Deras E-modul (ca 42–47 GPa) är lägre än aluminiumlegeringarnas (ca 68–76 GPa).","correct":true},{"text":"De används bara upp till måttliga temperaturer, ungefär 190 °C.","correct":true},{"text":"HCP-strukturen ger dem mycket god plastisk formbarhet.","correct":false},{"text":"De används mest som smidesgods.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 13 Aluminium och andra metaller, s. 7, 8, 9, 11, 12$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('49bc0ef4-c717-5439-8c91-6ab032adfcde', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '8ce9dd0a-ffc6-5dba-9cc9-a562ccc19e65', $kuggfri$al-cu-utskiljningshardning-steg$kuggfri$, $kuggfri$Utskiljningshärdning av en Al–4 % Cu-legering görs i tre steg. Vad åstadkommer upplösningsbehandlingen, snabbkylningen och åldringen var för sig?$kuggfri$, $kuggfri$![Al-hörnet av fasdiagrammet Al–Cu med aluminiumfasen (Al), eutektisk linje vid 548 °C och fasen θ = CuAl₂](/kort/materialteknik/al-cu-alhornet.svg)

1. **Upplösningsbehandlingen** löser all Cu i aluminiumet, så att bara $\alpha$ finns kvar. Legeringen värms in i enfasområdet $\alpha$: över solvuslinjen (ca 500 °C för 4 % Cu) men under solidus, så att inget smälter. I kursens exempel görs den strax under den eutektiska temperaturen 548 °C.
2. **Snabbkylningen** till rumstemperatur behåller all Cu i lösning: Cu hinner inte diffundera och bilda $\theta$, så en metastabil, övermättad $\alpha$-fas bildas. Vid långsam kylning skulle $\theta$ i stället bildas som grova partiklar, främst i korngränserna.
3. **Åldringen** vid måttligt förhöjd temperatur (eller vid rumstemperatur, naturlig åldring) låter Cu diffundera korta sträckor, så att små, jämnt fördelade $\theta$-utskiljningar bildas i $\alpha$. De hindrar dislokationsrörelse och höjer sträckgränsen. Tid och temperatur avgör utskiljningarnas storlek: underåldrat, toppåldrat eller överåldrat.$kuggfri$, null, 280, true, $kuggfri$cabf5eda2$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, GLU_5-8 Mikrostruktur och intro till Fasdiagram, s. 26, 27; Canvas, Fo 5 Fasdiagram och mikrostruktur 2, s. 18, 19; Canvas, Exempel fasdiagram, s. 7; Canvas, Fo 13 Aluminium och andra metaller, s. 5; Canvas, Ovning 7 m losningar, s. 5$kuggfri$, false, $kuggfri$Kortet anger solvus för Al med 4 % Cu till ca 500 °C, ett värde som är avläst i diagrammet i Exempel fasdiagram s. 7 och inte står i text någonstans; upplösningsbehandlingen anges som i kursens exempel, 540 till 548 °C. Stämmer avläsningen?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('acfeec12-ffff-579e-977d-1aa9cb574cd3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$vad-i-materialtillverkningsprocessen$kuggfri$, $kuggfri$Vad i materialtillverkningsprocessen kräver energi och vad innebär detta för miljön?$kuggfri$, $kuggfri$Energiintensiva processer:

* Energi för reducering av mineral till metall
* Övrig energi för tillverkning och formning, transport, användning. Kan minskas genom att återanvända värme.

Miljöbelastning:

* Ingrepp i naturen
* Utsläpp av CO₂
* Andra utsläpp och föroreningar
* CO₂ används som mått på miljöbelastning (carbon footprint)$kuggfri$, null, 281, true, $kuggfri$c3a2eab1c$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true, $kuggfri$Raden "Kan minskas genom att återanvända värme" går inte att belägga i kursmaterialet; resten av kortet stöds av Fö 12 Stål s. 12 och Fö 13 Hållbarhet s. 6. Ska raden stå kvar?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('a5f96185-f3ee-560e-9cff-60712edba982', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hur-ateranvandningsbara-ar-egentligen$kuggfri$, $kuggfri$Hur återanvändningsbara är egentligen metaller? Vad finns det för utmaningar med det?$kuggfri$, $kuggfri$* Metallskrot är en utmärkt råvara för metalltillverkning
* Kräver mindre energi än tillverkning från malm
* Ger mindre miljöbelastning
* Metall tillverkad från skrot kan ge lika bra material som metall tillverkad från mineral

Utmaningar:

* Legeringshalten måste kontrolleras – problem med blandat skrot och metallföroreningar
* Koppar och tenn förstör stål
* Fe försprödar Al
* Bly, kadmium och kvicksilver är ofta oönskat i
legeringar
* Skrotet måste samlas in, transporteras, sorteras$kuggfri$, null, 282, true, $kuggfri$ce7f0f5c6$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet sa att metall från skrot alltid har samma egenskaper som metall från mineral, men kursen säger att återvunnen metall kan ge lika bra material (och kortet räknar själv upp legeringsproblemen); energisiffrorna 1/10 för Al och 1/3 för stål går inte att belägga i kursmaterialet och är strukna; Canvas, Fo 13 Hallbarhet, s. 21; Canvas, Fo 12 Stal, s. 12; Canvas, Kapitel_03 Materialval, s. 45$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "har samma egenskaper" som metall från malm är ändrat till "kan ge lika bra material" (Fö 13 Hållbarhet s. 21), och energisiffrorna 1/10 för Al och 1/3 för stål är strukna eftersom de inte finns i kursmaterialets text. Raderna "Koppar och tenn förstör stål", "Fe försprödar Al" och "Bly, kadmium och kvicksilver är ofta oönskat i legeringar" står kvar utan källa (Fö 13 Hållbarhet s. 2 nämner bly och kadmium bara som hälsovådliga). Godkänns rättelsen, och ska de tre raderna beläggas eller strykas?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('6ef88389-170e-583b-a2ae-e3dc3e9e2f82', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hur-bra-ar-aluminium-sett-ur-ett$kuggfri$, $kuggfri$Hur bra är aluminium sett ur ett hållbarhetsperspektiv?$kuggfri$, $kuggfri$Aluminium:

* Al hör till de grundämnen som finns i god tillgång
* Framställning av primäraluminium kräver mycket energi, betydligt mer per kilo än stål
* Omsmältning vid återvinning kräver mycket mindre energi, bland annat för att smälttemperaturen är lägre än ståls → lämpligt för produkter som kan återvinnas, mindre lämpligt för produkter som inte kan återvinnas

Problem vid återvinning av aluminium:

* Legeringshalten måste ligga inom toleranserna för legeringen, så skrot av olika legeringar måste sorteras och hållas åtskilt.$kuggfri$, null, 283, true, $kuggfri$c82307e4a$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: kortet sa att aluminium är det vanligaste grundämnet i jordskorpan, vilket inte stämmer och inte står i kursmaterialet; Canvas, Fö 13 Hållbarhet, s. 13; Canvas, Fö 13 Hållbarhet, s. 17; Canvas, Kapitel_03 Materialval, s. 45; Canvas, Tentamen Materialteknik med svar 2022-11-29, s. 5$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "Det vanligaste grundämnet i jordskorpan" (det är syre) är ersatt med att Al finns i god tillgång (Fö 13 Hållbarhet s. 13), och raderna om 8 till 14 % Si och Fe-förorening är strukna eftersom de saknas i materialet. Kortet förklarar också den låga energin vid omsmältning med att Al har lägre smälttemperatur än stål (Kapitel_03 s. 45), men Kapitel_12 s. 8 säger att det krävs ungefär lika mycket energi att smälta om 1 kg stål som 1 kg aluminium. Godkänns rättelsen, och vilken förklaring ska kortet ge?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('da15976c-ee6f-565e-9b8e-3c68a9d4267e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hur-bra-ar-stal-respektive-rostfritt$kuggfri$, $kuggfri$Hur bra är stål respektive rostfritt stål sett ur ett hållbarhetsperspektiv?$kuggfri$, $kuggfri$Stål:

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
* Bra korrosionsmotstånd och livslängd. Bör återvinnas.$kuggfri$, null, 284, true, $kuggfri$cc6dd919a$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true, $kuggfri$Sammansättningen Cr ca 18 %, Ni ca 8 % och eventuellt Mo 2 % står inte i kursmaterialet; Fö 12 Stål s. 28 säger bara att rostfritt stål legeras med Cr och Ni, och siffrorna gäller vanliga austenitiska rostfria stål, inte ferritiska och martensitiska. Ska siffrorna stå kvar, t.ex. som exempel på austenitiskt rostfritt stål?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('5f8b0978-8f26-57e6-be83-caa802e2a03c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$vad-finns-det-for-problem-med$kuggfri$, $kuggfri$Vad finns det för problem med återvinningen av blandat skrot?$kuggfri$, $kuggfri$* Vid återanvändning av skrot är kontroll av legeringsämne ett problem
* Överflödiga legeringsämne och förorenande metaller kan vara eller är oekonomiska att ta bort
* Sorterat skrott är mer användbart och har högre värde$kuggfri$, null, 285, true, $kuggfri$cbd45b05d$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8b76e766-64a5-5f1a-8d74-b664b0cff35d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$vad-ar-co-footprint-respektive-embodied$kuggfri$, $kuggfri$Vad är "CO₂- footprint" respektive "Embodied Energy"?$kuggfri$, $kuggfri$CO₂ footprint:

* Mängd CO₂ som bildas vid produktion av 1 kg material

För metaller:
- CO₂ bildas vid produktion av energi
- CO₂ bildas vid kemiska reaktioner vid reduktion av malm till metall

Embodied energy:

* Energin som krävs för att producera 1 kg av materialet

För metaller:
- Energi som krävs för reduktionsreaktionen
- Transport, värmning, processer$kuggfri$, null, 286, true, $kuggfri$c195f485e$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('76812786-40c0-56b4-aafa-370453362126', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hur-ser-tillgangen-pa-metaller-i$kuggfri$, $kuggfri$Hur ser tillgången på metaller i jordskorpan ut?$kuggfri$, $kuggfri$* De vanligaste metallerna finns i stor omfattning i jordskorpan: Fe, Al, Mg, Ti
* Vissa legeringsämnen finns i begränsad mängd i jordskorpan
* 69 element räknas som strategiska eller kritiska: sällsynta
jordartsmetaller, platina-gruppen, fissionsämne (U, Th, Pu), W, Ta, Nb, Ga, In$kuggfri$, null, 287, true, $kuggfri$c4eb2a63d$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true, $kuggfri$Uppgiften att 69 element räknas som strategiska eller kritiska, och listan med bland annat U, Th, Pu, W, Ta och Nb, finns inte i kursmaterialet; Fö 13 Hållbarhet s. 8 nämner kritiska metaller utan antal och s. 13 listar Ti, Fe och Al (inte Mg) som tillgängliga. Plutonium förekommer knappt naturligt. Finns det en källa, eller ska kortet förenklas till det som står på bilderna?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('6373f8d9-c953-5059-a85d-59b636e61cda', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$sammanfatta-lite-kort-hur-metaller$kuggfri$, $kuggfri$Sammanfatta lite kort hur metaller lämpar sig för återvinning.$kuggfri$, $kuggfri$* Metaller lämpar sig väl för återvinning
  - Sparar resurser och energi
  - Kan ge lika bra material
* Problem med föroreningar och legeringsämne
* CO₂ footprint och embodied energy ger viss
vägledning – kan användas i materialindex
* Bör titta på totala miljöbelastningen under
livscykeln$kuggfri$, null, 288, true, $kuggfri$c64f732a0$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Rättelse: "Ger lika bra material" var ett absolut påstående; föreläsningen säger "Kan ge lika bra material", eftersom föroreningar och legeringsämnen kan ställa till problem; Canvas, Fo 13 Hallbarhet, s. 21$kuggfri$, true, $kuggfri$Rättelse av originalkortet: "Ger lika bra material" är ändrat till "Kan ge lika bra material", ordagrant Fö 13 Hållbarhet s. 21. Svarsförslaget till tentan 2025-10-30 uppg. 6c säger dock att återvinning alltid ger förluster och kvalitetsnedgång, medan tentan 2022 uppg. 5b säger att i princip inga egenskaper försämras. Godkänns rättelsen, och vilken linje ska korten följa?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('f6c41f1e-d664-5a78-bb12-3027eecc4bb3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$quiz-miljoegenskaper-vad-ar-sant-tva-ratta$kuggfri$, $kuggfri$Miljöegenskaper: vilka påståenden är sanna?$kuggfri$, $kuggfri$CO₂-avtryck och inbäddad energi kan användas i materialindex, genom att densiteten $\rho$ ersätts med $CO_2\,\rho$ eller $H_m\,\rho$ när utsläpp eller energi ska minimeras. Återvinning minskar behovet av råvara, energiåtgången och CO₂-utsläppen. Kursens "material för morgondagen" ska ha både lågt CO₂-avtryck och låg inbäddad energi. Stål har låga CO₂-utsläpp per kilo; det är den stora användningen som ger stora globala utsläpp.$kuggfri$, null, 289, true, $kuggfri$cdb2c8410$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"CO₂-avtryck (CO₂ footprint) och inbäddad energi (embodied energy) kan ge vägledning i materialvalet.","correct":true},{"text":"Material med högt CO₂-avtryck bör återvinnas.","correct":true},{"text":"Miljösmarta material har lågt CO₂-avtryck och hög inbäddad energi.","correct":false},{"text":"Problemet med stål är de stora CO₂-utsläppen per kilo tillverkat stål.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz vecka 1, fråga 6; Canvas, Fö 13 Hållbarhet, s. 6; Canvas, Fö 13 Hållbarhet, s. 11; Canvas, Fö 13 Hållbarhet, s. 13; Canvas, Tentamen Materialteknik med svar 2022-11-29, s. 5; Canvas, Tentamen Materialteknik mrd svar 2021-10-23 (korrigerad), formelbladet$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('0e690f81-2656-5683-9230-b0d5cf5dcddf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hallb-eco-audit-vagracken$kuggfri$, $kuggfri$I kursens eco audit-exempel med krockbarriärer: vilken livscykelfas dominerar för ett fast vägräcke respektive en barriär monterad på en bil?$kuggfri$, $kuggfri$Eco audit visar i vilken livscykelfas mest resurser används, och därmed vad materialvalet ska optimera. För det fasta vägräcket dominerar materialproduktionen, så kriteriet blir böjhållfasthet per energienhet, index $\sigma_y^{2/3}/(H_p\,\rho)$. För barriären på bilen dominerar användningen, så kriteriet blir böjhållfasthet per massa, $\sigma_y^{2/3}/\rho$.$kuggfri$, null, 290, true, $kuggfri$c3fd4acc7$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Vägräcket: materialproduktionen. Bilens barriär: användningen.","correct":true},{"text":"Vägräcket: användningen. Bilens barriär: materialproduktionen.","correct":false},{"text":"Materialproduktionen i båda fallen.","correct":false},{"text":"Användningen i båda fallen.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Kapitel_03 Materialval, s. 43; Canvas, Kapitel_03 Materialval, s. 46$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('14f66d86-e5b9-547e-81b4-36dae29462d3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hallb-co2-i-materialindex$kuggfri$, $kuggfri$Hur tar man hänsyn till CO₂-avtrycket i ett materialindex för en lätt och stark balk, $\sigma_y^{2/3}/\rho$?$kuggfri$, $kuggfri$För att minimera CO₂-utsläpp eller inbäddad energi i stället för massa ersätts $\rho$ med $CO_2\,\rho$ respektive $H_m\,\rho$, där $CO_2$ och $H_m$ är utsläpp respektive energi per kg material. Indexet blir då $\sigma_y^{2/3}/(CO_2\,\rho)$, och i kursens vägräckesexempel används på samma sätt $\sigma_y^{2/3}/(H_p\,\rho)$. Att multiplicera indexet med CO₂-avtrycket skulle gynna material med höga utsläpp.$kuggfri$, null, 291, true, $kuggfri$c7c5e3009$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Densiteten $\\rho$ ersätts med $CO_2\\,\\rho$ (CO₂-avtryck per kg gånger densitet)","correct":true},{"text":"Indexet multipliceras med CO₂-avtrycket","correct":false},{"text":"Sträckgränsen $\\sigma_y$ ersätts med CO₂-avtrycket","correct":false},{"text":"CO₂-avtrycket kan inte användas i ett materialindex, det kräver en livscykelanalys","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Tentamen Materialteknik mrd svar 2021-10-23 (korrigerad), formelbladet; Canvas, Kapitel_03 Materialval, s. 46; Canvas, Fö 13 Hållbarhet, s. 6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3a294a95-c4a8-5b72-bd4f-4fc16511a0c4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hallb-hoghallfast-mindre-material$kuggfri$, $kuggfri$Höghållfasta metaller kan minska en produkts miljöbelastning, eftersom mindre material behövs.$kuggfri$, $kuggfri$Sant. Föreläsningen nämner höghållfasta metaller, som ger mindre material, tillsammans med bättre design, förbättrade tillverkningsmetoder, lätta metaller och kompositer när låg vikt behövs och återvunnen metall som sätt att konstruera miljövänligare med metaller.$kuggfri$, null, 292, true, $kuggfri$c04638664$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fö 13 Hållbarhet, s. 17$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2117259a-e60c-59cb-8f1d-cf8ebb9cfbda', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$plast-bionedbrytbar-biobaserad$kuggfri$, $kuggfri$Bionedbrytbar respektive biobaserad plast$kuggfri$, $kuggfri$**Bionedbrytbar:** plasten bryts ned av mikroorganismer till bland annat koldioxid, vatten och ny biomassa (utan syre även metan). För att räknas som fullständigt bionedbrytbar enligt den europeiska standarden EN 13432 ska minst 90 % ha brutits ned på mindre än 6 månader.

**Biobaserad:** plasten är framställd av biomassa, alltså förnybara råvaror från växter, djur eller mikroorganismer, i stället för fossila (petrokemiska) råvaror.

De två egenskaperna är oberoende av varandra: råvaran avgör inte om plasten är bionedbrytbar.$kuggfri$, null, 293, true, $kuggfri$ce70faa9c$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 20, 21, 22$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('38e3926b-9a5a-5b87-9b17-c753cca648d5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$plast-bio-indelning-exempel$kuggfri$, $kuggfri$Vilka exempel är rätt placerade i indelningen efter råvara (biobaserad eller fossil) och bionedbrytbarhet?$kuggfri$, $kuggfri$Kursens fyrfältsdiagram har råvaran på ena axeln och bionedbrytbarheten på den andra. PLA och stärkelseblandningar är både biobaserade och bionedbrytbara. Biobaserad PE, PET och PA tillverkas av förnybara råvaror men bryts inte ned biologiskt; biobaserad PE har samma repeterande enhet som fossil PE, det som skiljer är råvaran. PCL och PBAT är fossilbaserade men bionedbrytbara. Konventionella plaster som PE, PP och PET är fossilbaserade och inte bionedbrytbara.$kuggfri$, null, 294, true, $kuggfri$cb60bfcb2$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"PLA: biobaserad och bionedbrytbar","correct":true},{"text":"Biobaserad PE: biobaserad men inte bionedbrytbar, med samma kemiska uppbyggnad som vanlig PE","correct":true},{"text":"PCL: fossilbaserad men bionedbrytbar","correct":true},{"text":"Konventionell PP: fossilbaserad och bionedbrytbar","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 22, 23, 24, 25$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('f115f202-ca70-58d7-9438-cda541698e3a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hallb-atervinning-ensam-racker-inte$kuggfri$, $kuggfri$Vilka påståenden om återvinning av metaller stämmer enligt kursen?$kuggfri$, $kuggfri$En modell för cirkulär ekonomi fungerar inte enbart, eftersom efterfrågan på marknaden för närvarande överstiger mängden skrot, enligt föreläsningen med ungefär två tredjedelar. Därför behöver alla led i metallanvändningen förbättras, från primärproduktion och tillverkning till användning och återvinning. Metaller lämpar sig väl för återvinning, sparar resurser och energi och kan ge lika bra material. För många kritiska metaller, t.ex. gallium, indium och germanium i halvledare, är återvinningsgraden däremot mycket låg.$kuggfri$, null, 295, true, $kuggfri$c012f22eb$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Efterfrågan på metaller är i dag större än mängden skrot som finns att återvinna.","correct":true},{"text":"Alla material kan återvinnas, men återvinningen kostar energi och resurser.","correct":true},{"text":"Metaller förlorar alltid sina egenskaper när de återvinns.","correct":false},{"text":"Kritiska metaller som gallium och indium återvinns redan i mycket hög grad.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Fo 13 Hallbarhet, s. 7, 8, 21$kuggfri$, false, $kuggfri$Det felaktiga alternativet "Metaller förlorar alltid sina egenskaper när de återvinns" följer Fö 13 Hållbarhet s. 21 ("kan ge lika bra material"), men svarsförslaget till tentan 2025-10-30 uppg. 6c säger att det alltid uppstår förluster och kvalitetsnedgång vid återvinning, så en student som läst svarsförslaget kan välja alternativet. Är alternativet entydigt fel?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3ef9f425-3e52-58a4-98dc-994bac008225', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '2a0cb9e4-83a2-5694-93d8-c2458390173a', $kuggfri$hallbara-produkter-kombination$kuggfri$, $kuggfri$Enligt kursen finns inga hållbara material. Hur kan en produkt ändå göras mer hållbar?$kuggfri$, $kuggfri$Genom en kombination av rätt materialval, bra design, rätt tillverkningsmetod och rätt återvinning, alltså bra ingenjörsarbete. I materialvalet tar man med resursförbrukning, energiförbrukning och CO₂-utsläpp över hela kedjan (materialtillverkning, produkttillverkning, användning, skrotning och återvinning), t.ex. med materialindex för CO₂-avtryck och inbäddad energi, och väljer återvinningsbara material. Dessutom: refabricering, återbruk och återvinning, och värdefulla produkter med lång livslängd.$kuggfri$, null, 296, true, $kuggfri$ccc8a30ea$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, Fo 13 Hallbarhet, s. 6, 18, 21, 22$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('6d7e0d18-64af-599f-81cf-b01a66a055f3', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$namn-minst-tva-olika-typer-av-polymerer$kuggfri$, $kuggfri$Nämn minst två olika typer av polymerer och vad som kännetecknar dem.$kuggfri$, $kuggfri$* Termoplaster
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
  - Inte återvinningsbara$kuggfri$, null, 297, true, $kuggfri$c68b296ed$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, null, true, $kuggfri$Kortet anger "Kovalenta bindningar" som kännetecken för härdplaster, men även termoplasternas kedjor hålls ihop av kovalenta bindningar; det som skiljer är kovalenta tvärbindningar mellan kedjorna (MTT085 PM 1 s. 10). Ska det stå "kovalenta tvärbindningar mellan kedjorna"?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('283dbbeb-23e8-5332-9eeb-f0f2ac460b39', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$quiz-a-semi-crystalline-polymer-en$kuggfri$, $kuggfri$Vad stämmer om en delkristallin (semi-crystalline) polymer?$kuggfri$, $kuggfri$Termoplaster delas in i amorfa och delkristallina. Över Tm är polymeren en smälta, och i smält tillstånd är alla polymerer amorfa. Om en polymer kan bli delkristallin beror på hur ordnad kedjan är (kedjorna måste kunna packas sida vid sida), inte på gjutning; en amorf polymer blir inte delkristallin av att gjutas. Tm ligger över Tg: vid Tg mjuknar de amorfa delarna medan kristalliterna håller ihop materialet ända upp till Tm.$kuggfri$, null, 298, true, $kuggfri$ca78ba465$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Den är en typ av termoplast","correct":true},{"text":"Den är amorf över smälttemperaturen","correct":true},{"text":"Den tillverkas genom att en amorf polymer (t.ex. PS) gjuts","correct":false},{"text":"Den smälter under glasomvandlingstemperaturen","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fo15-18, fråga 1; Canvas, MTT085 PM 1, s. 7, 9; Canvas, MTT085 PM 2, s. 4; Canvas, MTT085 PM 3, s. 4$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('9951067a-f742-56ab-9cac-75f9e454e930', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$quiz-thermoplastic-polymers-termoplastiska$kuggfri$, $kuggfri$Vad stämmer om termoplaster?$kuggfri$, $kuggfri$Termoplaster är antingen amorfa eller delkristallina. Som smälta är de skjuvförtunnande: viskositeten minskar när skjuvhastigheten ökar. De hårdnar inte vid uppvärmning; modulen sjunker kraftigt vid Tg (och vid Tm för delkristallina). Polymerer är termiska isolatorer eftersom långa molekyler kan fördela värmeenergin på många vibrationsmoder.$kuggfri$, null, 299, true, $kuggfri$c59338e62$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Som smälta har de en skjuvförtunnande viskositetsfunktion","correct":true},{"text":"De är amorfa eller delkristallina","correct":true},{"text":"De hårdnar när temperaturen ökar","correct":false},{"text":"De är värmeledande polymerer","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fo15-18, fråga 2; Canvas, MTT085 PM 1, s. 7; Canvas, MTT085 PM 3, s. 6; Canvas, MTT085 PM 2, s. 1, 3$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('9ab0affa-2df7-52a4-b3ab-ec709c2492ba', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$quiz-copolymers-sampolymerer-tva-ratta-svar$kuggfri$, $kuggfri$Vad stämmer om sampolymerer (copolymers)?$kuggfri$, $kuggfri$En sampolymer har två eller fler monomertyper i samma kedja och kan vara linjär eller (långkedje)grenad. Efter hur monomererna är ordnade skiljer man på slumpvisa, alternerande, block- och ympsampolymerer (graft); slagseg polystyren (PS-HI) görs till exempel genom att polystyren ympas på polybutadien. Polydispersitetsindex, PDI = Mw/Mn, beskriver hur bred molekylviktsfördelningen är och har inget med antalet monomertyper att göra. Eftersom Mw ≥ Mn kan PDI aldrig bli negativt.$kuggfri$, null, 300, true, $kuggfri$cdf9d9463$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"De innehåller två eller fler typer av monomerer i samma kedja","correct":true},{"text":"De kan vara linjära eller grenade","correct":true},{"text":"De är polymerer med högt polydispersitetsindex","correct":false},{"text":"De är polymerer med negativt polydispersitetsindex","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fo15-18, fråga 3; Canvas, Tentamen MTT085 24-01, s. 8; Canvas, Svarsforslag Tentamen MTT085 24-01, s. 3; Canvas, 05142_03-3 (Osswald kap. 3), s. 25–26; Canvas, MTT085-Turorials-Part12, s. 1; Canvas, MTT085 PM 1, s. 6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('ffdcde92-80fd-5de8-907a-56ab654808bf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$quiz-thermosets-hardplaster-tva-ratta-svar$kuggfri$, $kuggfri$Vad stämmer om härdplaster (thermosets)?$kuggfri$, $kuggfri$Härdplaster är högt tvärbundna amorfa polymerer. Nätverket bildas vid härdningen (curing) av monomerer som kan binda till fler än två andra monomerer. Som amorfa polymerer har de ett Tg, men de bryts ned innan de hinner smälta och har därför ingen Tm. Härdplast är en indelning efter struktur (hög tvärbindningsgrad), inte efter användningsområde; epoxi, den vanligaste härdplasten, har till exempel ett Tg kring 120 °C.$kuggfri$, null, 301, true, $kuggfri$ce3d36f16$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"De tillverkas av monomerer med fler än två bindningsställen (funktionalitet > 2)","correct":true},{"text":"De är amorfa","correct":true},{"text":"De saknar glasomvandlingstemperatur men har en smälttemperatur","correct":false},{"text":"De definieras som den grupp polymerer som tagits fram för högtemperaturtillämpningar","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fo15-18, fråga 4; Canvas, MTT085 PM 1, s. 10; Canvas, 2025 MTT085 Fo15, s. 44; Canvas, MTT085 PM 2, s. 4$kuggfri$, false, $kuggfri$Quizens felaktiga alternativ "är gjorda för högtemperaturapplikationer" kan uppfattas som delvis rätt (härdplaster används både över och under Tg, Lab-PM Polymer s. 2) och är omskrivet till "De definieras som den grupp polymerer som tagits fram för högtemperaturtillämpningar". Godkänns omskrivningen, eller ska quizens ordalydelse stå kvar?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('bd6ff061-f62f-5707-a296-f26502b37a58', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-mn-mw-berakning$kuggfri$, $kuggfri$En polymer består av lika många kedjor med molekylvikten 100 000, 200 000 och 300 000 g/mol. Vad blir Mn och Mw?$kuggfri$, $kuggfri$Med $n_i$ kedjor av molekylvikten $M_i$ (här $n_i$ lika för alla tre):

$M_n = \dfrac{\sum n_i M_i}{\sum n_i} = \dfrac{100\,000 + 200\,000 + 300\,000}{3} = 200\,000$ g/mol

$M_w = \dfrac{\sum n_i M_i^2}{\sum n_i M_i} = \dfrac{(1 + 4 + 9)\cdot 10^{10}}{6 \cdot 10^{5}} \approx 233\,333$ g/mol

Mw väger de tunga kedjorna tyngre och blir därför större än Mn; Mw = Mn gäller bara om alla kedjor är lika långa. PDI blir här ungefär $1{,}17$.$kuggfri$, null, 302, true, $kuggfri$c90687122$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Mn = 200 000 g/mol och Mw ≈ 233 000 g/mol","correct":true},{"text":"Mn ≈ 233 000 g/mol och Mw = 200 000 g/mol","correct":false},{"text":"Mn = Mw = 200 000 g/mol","correct":false},{"text":"Mn = 200 000 g/mol och Mw = 300 000 g/mol","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo15, s. 28; Canvas, MTT085 PM 1, s. 5$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('83779b45-3c8f-5f5b-aa02-fb3a917ad7c0', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-polymerisationsgrad-pe-berakning$kuggfri$, $kuggfri$Uppskatta polymerisationsgraden för en polyeten med molekylvikten 150 000 g/mol (etenmonomeren väger 28 g/mol).$kuggfri$, $kuggfri$Polymerisationsgraden är antalet repeterande enheter: $DP = M/M_0 = 150\,000/28 \approx 5\,357$. Etenmonomeren C₂H₄ väger $2\cdot 12 + 4\cdot 1 = 28$ g/mol. 3 570 är svaret för en kedja på 100 000 g/mol, 10 700 fås om man räknar med CH₂ (14 g/mol) i stället för hela monomeren, och 4 200 000 fås om man multiplicerar i stället för att dividera.$kuggfri$, null, 303, true, $kuggfri$c2df8648e$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 5 360 repeterande enheter","correct":true},{"text":"Ca 3 570 repeterande enheter","correct":false},{"text":"Ca 10 700 repeterande enheter","correct":false},{"text":"Ca 4 200 000 repeterande enheter","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085-Turorials-Part12, s. 4; Canvas, 2021 MTT085 Ovningsuppgifter - Polymera material, s. 2; Canvas, MTT085 PM 1, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('dadb2efa-4868-535b-a1ec-17949a1e290a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-kedjelangd-pe-berakning$kuggfri$, $kuggfri$Hur lång är en fullt utsträckt polyetenmolekyl med molekylvikten 84 000 g/mol? (Repeterande enhet 28 g/mol, 0,252 nm per enhet.)$kuggfri$, $kuggfri$Antalet repeterande enheter är $n = 84\,000/28 = 3\,000$. Den utsträckta längden blir $l = 3\,000 \cdot 0{,}252 \text{ nm} = 756 \text{ nm} \approx 0{,}76$ µm. 0,76 nm är ett enhetsfel (nm i stället för µm), 1,5 µm fås om man räknar med CH₂ (14 g/mol) som enhet men behåller 0,252 nm, och 21 µm fås om man multiplicerar molekylvikten direkt med 0,252 nm i stället för antalet enheter.$kuggfri$, null, 304, true, $kuggfri$c5a105386$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ca 760 nm (0,76 µm)","correct":true},{"text":"Ca 0,76 nm","correct":false},{"text":"Ca 1,5 µm","correct":false},{"text":"Ca 21 µm","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085-Turorials-Part12, s. 4$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('dc47a08e-fe2b-56d8-b92d-1a07dc442765', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-vinylpolymerer-sidogrupper$kuggfri$, $kuggfri$Vinylpolymerer har den repeterande enheten –[CH₂–CHX]ₙ–. Vilka par av sidogrupp X och polymer är rätt?$kuggfri$, $kuggfri$Sidogrupperna i kursen: X = H ger PE, X = CH₃ ger PP, X = C₆H₅ (fenylgrupp) ger PS och X = Cl ger PVC. De två felaktiga alternativen har bytt plats på PP och PS.$kuggfri$, null, 305, true, $kuggfri$c5066b850$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"X = H ger polyeten (PE)","correct":true},{"text":"X = Cl ger polyvinylklorid (PVC)","correct":true},{"text":"X = CH₃ ger polystyren (PS)","correct":false},{"text":"X = C₆H₅ ger polypropen (PP)","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo15, s. 20; Canvas, MTT085 PM 1, s. 3; Canvas, Svar Materialteknik 2018-10-27, s. 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('97c92a0c-779a-52d9-b40a-f5b3b9cc448a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-overgangstemperaturer-per-typ$kuggfri$, $kuggfri$Vilka övergångstemperaturer har de olika polymertyperna?$kuggfri$, $kuggfri$Amorfa termoplaster har bara Tg. Delkristallina har Tg, där de amorfa delarna mjuknar, och Tm, där kristalliterna smälter. Tvärbundna polymerer (härdplaster och elastomerer) är amorfa och har därför ett Tg, men de bryts ned innan de smälter och har ingen Tm.$kuggfri$, null, 306, true, $kuggfri$c1e6aca44$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Amorf termoplast: Tg men ingen Tm","correct":true},{"text":"Delkristallin termoplast: både Tg och Tm","correct":true},{"text":"Härdplast: både Tg och Tm","correct":false},{"text":"Tvärbunden elastomer: Tm men inget Tg","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo16, s. 21; Canvas, MTT085 PM 2, s. 3–4$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('da6e82be-8e94-5770-8792-c2e354ffaf16', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-anvandningsintervall-delkristallin$kuggfri$, $kuggfri$Inom vilket temperaturintervall används en delkristallin termoplast?$kuggfri$, $kuggfri$Mellan Tg och Tm har de amorfa delarna mjuknat medan kristalliterna håller ihop materialet, och segheten ökar i det intervallet. Under Tg blir delkristallina polymerer typiskt mycket spröda, och över Tm är de smältor. Användningsintervallet är därför Tg < T < Tm.$kuggfri$, null, 307, true, $kuggfri$cd1ff0ef1$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Mellan Tg och Tm","correct":true},{"text":"Under Tg","correct":false},{"text":"Över Tm","correct":false},{"text":"Mellan Tm och nedbrytningstemperaturen","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 2, s. 4; Canvas, 2025 MTT085 Fo16, s. 18$kuggfri$, false, $kuggfri$Alternativet "Under Tg" är markerat som fel enligt MTT085 PM 2 s. 4, men det finns delkristallina termoplaster som används under sitt Tg, t.ex. PET (Tg ca 75 °C) i flaskor, så distraktorn är inte entydigt fel. Ska frågan precisera "typiskt" eller distraktorn bytas ut?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('de64eb5d-aeb9-5579-883e-62a43fcaf17c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-skjuvmodul-amorf-vid-tg$kuggfri$, $kuggfri$Vad händer med skjuvmodulen hos en amorf termoplast, t.ex. PS, när temperaturen passerar Tg?$kuggfri$, $kuggfri$Vid Tg vibrerar kedjorna så kraftigt att de kan röra sig betydligt friare, och skjuvmodulen faller med ungefär tre dekader (logaritmisk axel i DMTA-kurvan). En amorf termoplast har ingen Tm och inga kristalliter; det är i en delkristallin polymer som kristalliterna håller ihop materialet över Tg.$kuggfri$, null, 308, true, $kuggfri$ce620e682$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Den sjunker med ungefär tre dekader (ca 1 000 gånger)","correct":true},{"text":"Den ökar, eftersom kedjorna låses fast","correct":false},{"text":"Den är i stort sett oförändrad tills Tm nås","correct":false},{"text":"Den sjunker bara lite, eftersom kristalliterna håller ihop materialet","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 2, s. 3–4; Canvas, 2025 MTT085 Fo16, s. 13$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1ceedd76-2354-5513-867a-3121cd74963c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-tillsats-mjukgorare$kuggfri$, $kuggfri$Vilken tillsats sänker hårdheten och styvheten hos en plast?$kuggfri$, $kuggfri$Mjukgörare ökar avståndet mellan molekylerna, vilket sänker styvheten och Tg. Stabilisatorer skyddar mot termisk och kemisk nedbrytning (värme, solljus, syre), antistatmedel hindrar att plasten laddas upp elektrostatiskt och flamskyddsmedel minskar brännbarheten.$kuggfri$, null, 309, true, $kuggfri$cab95d481$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Mjukgörare","correct":true},{"text":"Stabilisator","correct":false},{"text":"Antistatmedel","correct":false},{"text":"Flamskyddsmedel","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085-Turorials-Part12, s. 1–2; Canvas, 05142_03-3 (Osswald kap. 3), s. 3$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8d938d92-46f9-5232-92b4-b7c055b734a1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-pdi-ett-monodispers$kuggfri$, $kuggfri$Ett PDI på 1 betyder att alla kedjor i polymeren är lika långa.$kuggfri$, $kuggfri$Eftersom Mw ≥ Mn är PDI = Mw/Mn alltid minst 1. Mw = Mn, alltså PDI = 1, gäller bara om alla kedjor är lika långa (monodispers polymer). De flesta polymerer är polydispersa med PDI > 1.$kuggfri$, null, 310, true, $kuggfri$c5cfc2051$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 1, s. 6; Canvas, 05142_03-3 (Osswald kap. 3), s. 6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('63e21d2d-46bb-59c9-b07c-3397a3f2fec7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-ataktisk-pp-kristallinitet$kuggfri$, $kuggfri$Ataktisk polypropen når lättare en hög kristallinitetsgrad än isotaktisk polypropen.$kuggfri$, $kuggfri$Det är tvärtom. I isotaktisk PP sitter alla CH₃-grupper på samma sida, så kedjorna kan packas sida vid sida och nå hög kristallinitet. I ataktisk PP sitter sidogrupperna slumpvis, vilket gör det svårt för grannkedjorna att låsas i ett ordnat läge.$kuggfri$, null, 311, true, $kuggfri$c5f7a04e4$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 1, s. 9; Canvas, 05142_03-3 (Osswald kap. 3), s. 9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d01cfe0c-6d62-58e3-ab60-226999748744', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-restmonomer-tg$kuggfri$, $kuggfri$Restmonomer som finns kvar i polymeren efter polymerisationen, och som är löslig i polymeren, höjer dess Tg.$kuggfri$, $kuggfri$Restmonomer som är löslig i polymeren fungerar som mjukgörare och sänker Tg. Mjukgörare ökar avståndet mellan molekylerna så att de rör sig lättare.$kuggfri$, null, 312, true, $kuggfri$c93b310f5$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085-Turorials-Part12, s. 4; Canvas, 05142_03-3 (Osswald kap. 3), s. 3$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('dbfb6179-eb1b-5c5b-b5ee-1379f6c12e07', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-amorf-termoplast-under-tg$kuggfri$, $kuggfri$En amorf termoplast används, med säkerhetsmarginal, vid temperaturer under sitt Tg.$kuggfri$, $kuggfri$Över Tg förlorar en amorf termoplast sin styvhet, eftersom det inte finns några kristalliter som håller ihop materialet. Användningstemperaturen är därför T < Tg med en säkerhetsmarginal. För delkristallina termoplaster är det i stället Tm som begränsar uppåt.$kuggfri$, null, 313, true, $kuggfri$c9472a283$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 2, s. 4; Canvas, Lab-PM Polymer_MTT085-1, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('d6f86627-50aa-5d14-a95d-a597122bb60a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-kovalent-och-van-der-waals$kuggfri$, $kuggfri$I polyeten hålls huvudkedjan ihop av starka kovalenta C–C-bindningar, medan kedjorna binds till varandra av svaga van der Waals-krafter.$kuggfri$, $kuggfri$C–C-bindningarna i huvudkedjan är kovalenta och starka, medan krafterna mellan kedjorna är van der Waals-krafter och svaga. Därför bestäms polymerens hållfasthet i praktiken av krafterna mellan kedjorna, och längre kedjor ger ett starkare material.$kuggfri$, null, 314, true, $kuggfri$cb5be5cb0$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 1, s. 3; Canvas, 05142_03-3 (Osswald kap. 3), s. 2; Canvas, 2025 MTT085 Fo15, s. 14$kuggfri$, false, $kuggfri$Påståendet slår ihop två av de rätta påståendena i tentan 2025-10-30 uppg. 7a (kovalenta bindningar i kedjan, van der Waals mellan kedjorna), och förklaringen följer facit till tentan 2016-10-29 uppg. 7.2; samma fakta står i PM 1 s. 3. Ligger kortet för nära tentan?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3a6aebce-c633-5399-9940-c33f754f420b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-hdpe-ldpe-kristallinitet$kuggfri$, $kuggfri$HDPE har högre kristallinitet än LDPE eftersom LDPE:s långkedjeförgreningar hindrar kedjorna från att packas tätt.$kuggfri$, $kuggfri$HDPE består av linjära molekyler och kan nå en kristallinitet på upp till ca 75 %. LDPE har långkedjeförgreningar som hindrar grannkedjorna från att närma sig och låsas sida vid sida, vilket ger lägre kristallinitet.$kuggfri$, null, 315, true, $kuggfri$c1525bf68$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 1, s. 9; Canvas, 2025 MTT085 Fo15, s. 35$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8f684ce6-4de6-5b9f-b4ce-adfed2527c47', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-monomer$kuggfri$, $kuggfri$Monomer$kuggfri$, $kuggfri$Den repeterande byggstenen i en polymer: en molekyl som kan binda till likadana molekyler och bilda en polymerkedja genom polymerisation. Exempel: eten (C₂H₄, en gas) är monomeren i polyeten.$kuggfri$, null, 316, true, $kuggfri$c48089322$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085-Turorials-Part12, s. 1; Canvas, MTT085 PM 1, s. 1$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('460329c1-b30b-5eb3-ac6f-56bf7a551b15', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-polymerisationsgrad$kuggfri$, $kuggfri$Polymerisationsgrad$kuggfri$, $kuggfri$Antalet repeterande enheter n i en polymerkedja. Den kan uppskattas som molekylvikten delad med monomerens molekylvikt: $DP = M/M_0$.$kuggfri$, null, 317, true, $kuggfri$c5a1405a4$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085 PM 1, s. 2; Canvas, 05142_03-3 (Osswald kap. 3), s. 1; Canvas, MTT085-Turorials-Part12, s. 4$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8618552f-17ac-5cf0-9455-ef38c43505a4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-takticitet$kuggfri$, $kuggfri$Takticitet (tacticity)$kuggfri$, $kuggfri$Hur sidogrupperna är placerade längs kolkedjan. Isotaktisk: alla på samma sida. Syndiotaktisk: regelbundet omväxlande. Ataktisk: slumpvis. Takticiteten avgör hur hög kristallinitet polymeren kan nå; isotaktisk PP blir mer kristallin än ataktisk.$kuggfri$, null, 318, true, $kuggfri$c2c822188$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 05142_03-3 (Osswald kap. 3), s. 9; Canvas, MTT085 PM 1, s. 7, 9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d9140ad5-4928-5582-af62-1a968be6a154', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-sampolymer$kuggfri$, $kuggfri$Sampolymer (copolymer)$kuggfri$, $kuggfri$En polymer vars kedjor innehåller två eller fler typer av monomerer (en homopolymer har bara en). Typer: slumpvis, alternerande, block och ymp (graft). Exempel: ABS (akrylnitril-butadien-styren) och SBR (styren-butadiengummi).$kuggfri$, null, 319, true, $kuggfri$c65dff51e$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 05142_03-3 (Osswald kap. 3), s. 25–26; Canvas, MTT085-Turorials-Part12, s. 1$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('370fceac-3581-5cd3-8911-9ec604678c01', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-polymerblandning$kuggfri$, $kuggfri$Polymerblandning (polymer blend)$kuggfri$, $kuggfri$En blandning av två eller fler polymerer som görs för att förbättra egenskaperna hos de enskilda polymererna. Till skillnad från en sampolymer sitter de olika monomererna inte i samma kedja. Exempel: PP-PC, PVC-ABS och LDPE + HDPE.$kuggfri$, null, 320, true, $kuggfri$cfebc7ed7$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 05142_03-3 (Osswald kap. 3), s. 27; Canvas, 2025 MTT085 Fo15, s. 34$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d21e7463-8d8a-55a3-a2ac-aa2fc377bc4d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-sfarulit$kuggfri$, $kuggfri$Sfärulit (spherulite)$kuggfri$, $kuggfri$Den största strukturen (längdskalan) i en delkristallin polymer: kristalliterna bildar lameller, som i sin tur bygger upp sfäruliter, och mellan dem finns amorfa områden. Sfäruliter kan vara ungefär 1 till 500 µm stora, alltså mycket större än ljusets våglängd, och syns tydligt i ett mikroskop med polariserat ljus.$kuggfri$, null, 321, true, $kuggfri$ca3abe378$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085 PM 1, s. 8–9; Canvas, 2025 MTT085 Fo16, s. 15; Canvas, MTT085 Polymeric materials L6, s. 8$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('11b1379c-2006-5afc-82e1-8e59d3461288', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-tvarbindning$kuggfri$, $kuggfri$Tvärbindning (crosslinking)$kuggfri$, $kuggfri$Bindningspunkter, i tekniska polymerer oftast kovalenta, som knyter ihop kedjorna till ett nätverk. De bildas vid härdning (curing) av monomerer med fler än två bindningsställen. Kovalent tvärbundna polymerer kan inte smältas om. Hög tvärbindningsgrad ger en styv härdplast, låg ger en elastomer.$kuggfri$, null, 322, true, $kuggfri$c1d6584fe$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085 PM 1, s. 10; Canvas, 2025 MTT085 Fo15, s. 44$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('84bccc40-c54b-56d7-bf13-d8c3783c54a1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-glasomvandlingstemperatur$kuggfri$, $kuggfri$Glasomvandlingstemperatur (Tg)$kuggfri$, $kuggfri$Temperaturen där en amorf polymer, eller de amorfa delarna av en delkristallin polymer, går från glasartat tillstånd till ett gummiartat eller smält tillstånd. Omvandlingen är reversibel och är inte smältpunkten; styvheten sjunker kraftigt vid Tg.$kuggfri$, null, 323, true, $kuggfri$c292a616f$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085-Turorials-Part12, s. 4; Canvas, MTT085 PM 2, s. 3–4$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('75df7fe7-7794-56c9-a4d8-32e08f5bc392', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-varfor-termiska-isolatorer$kuggfri$, $kuggfri$Varför är polymerer bra termiska isolatorer?$kuggfri$, $kuggfri$I metaller leds värme som vågor av gittervibrationer (fononer). En lång polymermolekyl kan ses som atomer med bindningar som inte är lika i alla riktningar, så en temperaturökning kan fördelas på väldigt många vibrationsmoder i molekylen. Därför isolerar polymerer. Skum isolerar bäst, t.ex. frigolit (PS-skum), eftersom de innehåller mycket luft.$kuggfri$, null, 324, true, $kuggfri$c18861d61$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 PM 2, s. 1–2; Canvas, 2025 MTT085 Fo16, s. 7–8, 21; Canvas, 2025 MTT085 Fo15, s. 21$kuggfri$, false, $kuggfri$Kortet säger att värme i metaller leds som gittervibrationer (fononer), som i MTT085 PM 2 s. 1, men i metaller leds värme främst av de fria elektronerna, vilket korten i område 01 också säger (elektronmoln ger termisk ledning). Ska meningen strykas eller skrivas om så att korten inte motsäger varandra?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('11aa2f18-9e99-57b3-afe3-956e5962fabf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-transparens-amorf-delkristallin$kuggfri$, $kuggfri$Varför är amorfa termoplaster transparenta medan delkristallina ofta är translucenta eller opaka?$kuggfri$, $kuggfri$**Amorfa** termoplaster (t.ex. PS, PC, PMMA) består av slumpvis orienterade kedjor utan överstruktur och är transparenta om de inte innehåller pigment eller andra tillsatser.

**Delkristallina** (t.ex. PE, PP, PA) innehåller kristalliter och amorfa områden med olika brytningsindex, så ljus sprids vid gränserna mellan dem. När kristalliterna och sfäruliterna är ungefär lika stora som eller större än ljusets våglängd blir materialet translucent eller opakt.$kuggfri$, null, 325, true, $kuggfri$c1ae74961$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 PM 1, s. 8–10; Canvas, 2025 MTT085 Fo16, s. 15$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('27603bd4-34c1-5710-ac62-14c795028f2c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-mn-mw$kuggfri$, $kuggfri$Antalsmedel- och viktmedelmolekylvikt (Mn och Mw)$kuggfri$, $kuggfri$En polymer består av kedjor med olika längd, så molekylvikten beskrivs med en molekylviktsfördelning och medelvärden:

* **Mn**, antalsmedelmolekylvikt (number average): ett vanligt medelvärde över kedjorna, $M_n = \sum n_i M_i / \sum n_i$
* **Mw**, viktmedelmolekylvikt (weight average): väger de tunga kedjorna tyngre, $M_w = \sum n_i M_i^2 / \sum n_i M_i$

$M_w \ge M_n$, och polydispersitetsindex $\mathrm{PDI} = M_w/M_n$ är ett mått på hur bred fördelningen är. Två polymerer med samma Mn kan därför ha olika breda fördelningar och olika PDI.$kuggfri$, null, 326, true, $kuggfri$c9db74c82$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 2025 MTT085 Fo15, s. 25, 28; Canvas, MTT085 PM 1, s. 4, 5, 6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('862be2d1-4964-56d3-87a3-354dd3d54a31', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-langkedjeforgrening$kuggfri$, $kuggfri$Kortkedje- och långkedjeförgrening$kuggfri$, $kuggfri$Förgrening beskriver polymermolekylens topologi. De flesta tekniska polymerer är linjära, kortkedjeförgrenade eller långkedjeförgrenade. Med kortkedjeförgrening har huvudkedjan korta sidokedjor, t.ex. HDPE (ca 4–10 per 1 000 C-atomer) och LLDPE (ca 10–35), och molekylen räknas fortfarande som linjär. Med långkedjeförgrening, som i LDPE, har kedjan långa grenar. Grenarna hindrar grannkedjorna från att packas tätt, så HDPE (linjär) når mycket högre kristallinitet (upp till ca 75 %) än LDPE. Förgrening är något annat än takticitet, som beskriver hur sidogrupperna sitter längs kedjan.$kuggfri$, null, 327, true, $kuggfri$cb860eebd$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 2025 MTT085 Fo15, s. 35; Canvas, MTT085 PM 1, s. 7, 9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('0e5666c9-0f4d-5b07-9aa6-4c4774ad156d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-topologi-lldpe$kuggfri$, $kuggfri$LLDPE har ca 10–35 korta sidokedjor per 1 000 kolatomer. Hur räknas molekylen i kursens indelning efter topologi?$kuggfri$, $kuggfri$Både HDPE (ca 4–10 korta sidokedjor per 1 000 C) och LLDPE (linear low density polyethylene) räknas som linjära, kortkedjeförgrenade molekyler, medan LDPE har långkedjeförgrening. Tvärbundna polymerer har bindningar mellan kedjorna, så att de bildar ett nätverk.$kuggfri$, null, 328, true, $kuggfri$c5efea633$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Linjär, med kortkedjeförgrening","correct":true},{"text":"Långkedjeförgrenad","correct":false},{"text":"Tvärbunden","correct":false},{"text":"Ingen av dem, eftersom bara helt ogrenade kedjor räknas som linjära","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo15, s. 35; Canvas, MTT085 PM 1, s. 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('97ee91a0-5c52-5e44-9ca7-12d561883f8a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-struktur-bild-hardplast$kuggfri$, $kuggfri$Bilden visar tre schematiska polymerstrukturer. Vilken visar en tvärbunden polymer, som en härdplast? ![Tre schematiska polymerstrukturer märkta A, B och C](/kort/materialteknik/polymerstrukturer-abc.svg)$kuggfri$, $kuggfri$A har kedjor som är sammanbundna i ett nätverk av tvärbindningar: högt tvärbundet ger en härdplast, glest tvärbundet en elastomer. B har kedjor veckade i kristallina lameller med oordnade (amorfa) kedjor emellan: en delkristallin termoplast, där lamellerna bygger upp sfäruliter. C är slumpvis trassliga kedjor utan ordning, "en skål spaghetti": en amorf termoplast.$kuggfri$, null, 329, true, $kuggfri$c91a71fda$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"A","correct":true},{"text":"B","correct":false},{"text":"C","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 1, s. 7, 8, 10; Canvas, 2025 MTT085 Fo15, s. 44$kuggfri$, false, $kuggfri$Kortet visar tre schematiska polymerstrukturer A, B och C i en egen figur och frågar vilken som är en härdplast, vilket i stort sett är tentan 2024-08 uppg. 7 (matcha strukturerna A, B och C mot delkristallin termoplast, amorf termoplast och härdplast). Ligger kortet för nära tentan?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('e0cec8a1-c2d7-5b34-a3cf-305c9958de9c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-modulkurva-delkristallin$kuggfri$, $kuggfri$En DMTA-mätning visar när temperaturen höjs: först ett måttligt fall i modulen, sedan en platå där materialet fortfarande är fast, och till sist ett mycket brant fall. Vilken polymertyp är det troligen?$kuggfri$, $kuggfri$Modulen ritas i logaritmisk skala. I en delkristallin polymer mjuknar de amorfa delarna vid Tg, men kristalliterna håller ihop materialet, som fortfarande är fast, tills de smälter vid Tm. En amorf termoplast har ingen Tm: vid Tg faller modulen ungefär tre dekader och över Tg flyter den som smälta. Tvärbundna polymerer (härdplaster och elastomerer) har ett Tg men bryts ned innan de smälter.$kuggfri$, null, 330, true, $kuggfri$cf54aa492$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"En delkristallin termoplast: fallet vid Tg i de amorfa delarna, det branta fallet vid Tm","correct":true},{"text":"En amorf termoplast: fallet vid Tg, det branta fallet vid Tm","correct":false},{"text":"En härdplast: fallet vid Tm, det branta fallet när tvärbindningarna smälter","correct":false},{"text":"En elastomer: fallet vid Tm, det branta fallet vid Tg","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 2, s. 2, 3, 4; Canvas, 2025 MTT085 Fo16, s. 10, 13, 21$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('84053d0d-c510-50e0-a830-ec77eb73708b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-modulkurva-tvarbunden$kuggfri$, $kuggfri$En polymers modul faller vid Tg och planar sedan ut på en lägre nivå, som håller tills materialet bryts ned vid hög temperatur utan att det smälter. Vilken typ av polymer är det?$kuggfri$, $kuggfri$Tvärbundna polymerer är amorfa och har ett Tg, men de bryts ned innan de kan smälta, så över Tg mjuknar de bara svagt. Tg beror på tvärbindningsgraden: för glest tvärbundna elastomerer kan det ligga så lågt som ca −50 °C, för härdplaster så högt som ca 120 °C (t.ex. epoxi). En amorf termoplast flyter som smälta över Tg, och en delkristallin termoplast får ett brant fall vid Tm.$kuggfri$, null, 331, true, $kuggfri$cd5d1b641$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"En tvärbunden polymer (elastomer eller härdplast)","correct":true},{"text":"En amorf termoplast","correct":false},{"text":"En delkristallin termoplast","correct":false},{"text":"En polymersmälta","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 2, s. 4; Canvas, Lab-PM Polymer_MTT085-1, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('5217a402-3ce0-566e-bf74-5e8b6d46b8aa', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-hardplaster-forkortningar$kuggfri$, $kuggfri$Vilka av följande är härdplaster?$kuggfri$, $kuggfri$I kursbokens förkortningstabell är MF, PF, UF, UP, PUR (polyuretan) och EP (epoxi) härdplaster (TS). Epoxi är den vanligaste härdplasten, och 80 % av härdplasterna används som matris i kompositer. PMMA och PP är termoplaster. Härdplaster är högt tvärbundna och amorfa och kan inte smältas om.$kuggfri$, null, 332, true, $kuggfri$c11a9d7f8$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"PF, fenolformaldehyd","correct":true},{"text":"EP, epoxi","correct":true},{"text":"MF, melaminformaldehyd","correct":true},{"text":"UP, omättad polyester","correct":true},{"text":"PMMA, polymetylmetakrylat","correct":false},{"text":"PP, polypropen","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 05142_01-3 (Osswald kap. 1), s. 9; Canvas, 2025 MTT085 Fo16, s. 20; Canvas, MTT085 PM 1, s. 10$kuggfri$, false, $kuggfri$Kortet säger att 80 % av härdplasterna används som matris i kompositer, som MTT085 PM 1 s. 10, men Polymeric materials L4-5 s. 1 använder samma 80 % om att härdplaster utgör ca 80 % av kompositernas produktionsvolym, vilket är ett annat påstående. Vilken uppgift stämmer, eller ska siffran strykas?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('69d80049-a15c-5dc6-b094-0ac8a5248b6a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', 'ca58740d-bf59-5401-9bf0-3e5f7e352f54', $kuggfri$polymer-begrepp-tillsatser$kuggfri$, $kuggfri$Tillsatser i plast$kuggfri$, $kuggfri$Plast = polymer + tillsatser. Vanliga tillsatser:

* **Stabilisatorer:** skyddar mot termisk och kemisk nedbrytning (värme, solljus, luft, syre)
* **Färgämnen (pigment):** färgar plasten
* **Flamskyddsmedel:** minskar brännbarheten; ofta relativt stora tillsatser, ca 10 %
* **Antistatmedel:** hindrar att plasten laddas upp elektrostatiskt; ofta ca 1 %
* **Mjukgörare:** ökar avståndet mellan molekylerna och sänker hårdhet, styvhet och Tg$kuggfri$, null, 333, true, $kuggfri$c7038f1da$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085-Turorials-Part12, s. 1, 2; Canvas, 05142_03-3 (Osswald kap. 3), s. 3$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('feca862f-6cd5-569d-9d89-0718b0478aae', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-the-melt-flow-index-smaltflodesindex$kuggfri$, $kuggfri$Vilka påståenden om smältflödesindex (melt flow index, MFI) stämmer?$kuggfri$, $kuggfri$MFI är massan polymer i gram som en kolv belastad med en standardiserad vikt pressar ut genom ett cylindriskt munstycke under 10 minuter, vid standardiserad temperatur. Enheten är därför g/10 min. En trögare smälta (högre viskositet) ger mindre utpressat material och alltså lägre MFI. MFI är ett flödesmått, inte ett mått på brottöjning, och det mäts i en MFI-mätare (melt flow indexer) med kolv och munstycke, inte i en extruder.$kuggfri$, null, 334, true, $kuggfri$c9845f62f$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Det anges i gram per 10 minuter.","correct":true},{"text":"Det står i omvänt förhållande till viskositeten: högre viskositet ger lägre MFI.","correct":true},{"text":"Det mäter brottöjningen hos polymerer.","correct":false},{"text":"Det bestäms i försök med en enskruvsextruder utan munstycke.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö15-18, fråga 5; Canvas, MTT085 PM 3, s. 7; Canvas, 2025 MTT085 Fö17, s. 23$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c9199cfe-e78e-5de2-ae5e-de6f3557d00c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-extrusion-extrudering-tva-ratta-svar$kuggfri$, $kuggfri$Vilka påståenden om extrudering stämmer?$kuggfri$, $kuggfri$Fiberspinning är en sekundär formning som kopplas till extrudering: smältan extruderas genom ett munstycke med ett eller flera hål och dras ut av valspar. Extruderns munstycke ger slutprofilen, t.ex. rör, filmer, filament och profiler. Extrudering är en bearbetningsmetod, inte en provningsmetod. Granulatet ska inte smälta i tratten: inmatningszonen kyls ofta just för att granulatet inte ska smälta och sätta igen inloppet, och smältningen sker först i cylinderns uppvärmda del.$kuggfri$, null, 335, true, $kuggfri$c03117d7e$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Det är grundprocessen för fiberspinning.","correct":true},{"text":"Det kan användas för att tillverka rör.","correct":true},{"text":"Det är en metod för att prova polymerers termiska egenskaper.","correct":false},{"text":"Det kräver att polymeren smälts redan i tratten.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö15-18, fråga 6; Canvas, MTT085 Polymeric materials L4-5, s. 2; Canvas, MTT085 Polymeric materials L4-5, s. 4$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c4ca9887-e586-58b0-b7bb-524a77ee6815', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-shear-thinning-skjuvtunning-tva-ratta$kuggfri$, $kuggfri$Vilka påståenden om skjuvförtunning (shear thinning) stämmer?$kuggfri$, $kuggfri$![Viskositetsfunktionen för en polymersmälta i log-log-skala med nollskjuvplatå, skjuvförtunnande område och platå vid höga skjuvhastigheter](/kort/materialteknik/viskositetsfunktion.svg)

Viskositetsfunktionen har tre områden i ordning efter ökande skjuvhastighet: nollskjuvviskositeten vid låga skjuvhastigheter, det skjuvförtunnande området och oändlig-skjuv-viskositeten. I det skjuvförtunnande området sträcks kedjorna, orienteras i flödesriktningen och trasslas ur, så viskositeten minskar när skjuvhastigheten ökar. Det första området ligger alltså vid låga, inte höga, skjuvhastigheter. Skjuvförtunning gäller smältans viskositet, inte seghet.$kuggfri$, null, 336, true, $kuggfri$c0ea65af3$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Den orsakas av att polymerkedjorna gradvis orienteras i flödesriktningen, sträcks ut och trasslas ur.","correct":true},{"text":"Den är det andra området i viskositetskurvan för en polymersmälta.","correct":true},{"text":"Den är det första området i viskositetsfunktionen, vid mycket höga skjuvhastigheter.","correct":false},{"text":"Den avser att segheten hos polymera material minskar.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö15-18, fråga 7; Canvas, MTT085 PM 3, s. 6; Canvas, 2025 MTT085 Fö17, s. 19$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('9279129f-16d6-546a-bafa-32e1934805ae', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-during-polymer-processing-vid$kuggfri$, $kuggfri$Vilka påståenden om skjuvhastigheten vid polymerbearbetning stämmer?$kuggfri$, $kuggfri$Små eller långsamma deformationer ändrar inte kedjornas orientering, medan stora eller snabba deformationer orienterar molekylerna i flödesriktningen. Varje bearbetningsmetod har sitt typiska skjuvhastighetsområde; fiberspinning ger mest orientering av kedjorna, medan formpressning, som sker vid låga skjuvhastigheter, ger lite orientering. Eftersom polymersmältor är skjuvförtunnande beror viskositeten av skjuvhastigheten. Skjuvhastigheten har enheten 1/s; Pa s är enheten för viskositet.$kuggfri$, null, 337, true, $kuggfri$cc4b58aef$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Höga skjuvhastigheter ger starkare molekylorientering i flödesriktningen.","correct":true},{"text":"De typiska skjuvhastigheterna skiljer sig mellan processer som extrudering, formsprutning och fiberspinning.","correct":true},{"text":"Skjuvhastigheten påverkar inte viskositeten.","correct":false},{"text":"Skjuvhastigheten mäts i pascalsekunder (Pa s).","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö15-18, fråga 8; Canvas, MTT085 PM 3, s. 6; Canvas, 2025 MTT085 Fö17, s. 9; Canvas, 2025 MTT085 Fö17, s. 22; Canvas, 2025 MTT085 Fö17, s. 28$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('31d1b81d-02a8-536e-ac52-45f7e8d99fc8', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-die-swelling-formsprutningssvallning$kuggfri$, $kuggfri$Vilka påståenden om extrudatsvällning (die swell) stämmer?$kuggfri$, $kuggfri$I munstycket utsätts smältan för skjuvflöde i det skjuvförtunnande området, så kedjorna sträcks, orienteras och kan trasslas ur. När smältan har lämnat munstycket och står under atmosfärstryck relaxerar kedjorna tillbaka mot sin föredragna konformation, och extrudatet blir större än munstyckets öppning. Det är alltså en elastisk effekt hos en viskoelastisk vätska; en newtonsk (rent viskös) vätska sväller inte. Smältflödet mäts med MFI, inte med extrudatsvällningen.$kuggfri$, null, 338, true, $kuggfri$cc78882ac$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Den är en viskoelastisk effekt som uppstår när en polymersmälta lämnar munstycket.","correct":true},{"text":"Den orsakas av att orienterade och utsträckta polymerkedjor relaxerar.","correct":true},{"text":"Den är ett mått på smältflödeshastigheten.","correct":false},{"text":"Den förekommer bara i newtonska vätskor.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö15-18, fråga 9; Canvas, 2025 MTT085 Fö17, s. 26-27; Canvas, MTT085 PM 3, s. 7-8$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1dc68c3e-1485-5a32-a2a1-1a9a5ebae761', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-the-viscosity-function-of-a-polymer$kuggfri$, $kuggfri$Vilka påståenden om viskositetsfunktionen för en polymersmälta stämmer?$kuggfri$, $kuggfri$![Viskositetsfunktionen för en polymersmälta i log-log-skala med nollskjuvplatå, skjuvförtunnande område och platå vid höga skjuvhastigheter](/kort/materialteknik/viskositetsfunktion.svg)

Viskositetsfunktionen ritas som viskositet mot skjuvhastighet i log-log-skala. Polymersmältor kallas skjuvförtunnande eftersom viskositeten minskar när de skjuvas snabbare; i nollskjuvområdet är den konstant, och platån vid mycket höga skjuvhastigheter är svår att nå för smältor. Kurvorna sjunker när temperaturen höjs, och de skiljer sig mellan polymerer (t.ex. ABS, PC och PA6) och beror av molekylvikt och molekylviktsfördelning.$kuggfri$, null, 339, true, $kuggfri$cfa77cfaa$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Den har tre huvudområden: en nollskjuvplatå, ett skjuvförtunnande område och en platå vid oändlig skjuvhastighet.","correct":true},{"text":"Den visar att viskositeten totalt sett minskar med ökande skjuvhastighet (skjuvförtunning).","correct":true},{"text":"Den är oberoende av temperaturen.","correct":false},{"text":"Den är densamma för alla polymersmältor.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö15-18, fråga 10; Canvas, MTT085 PM 3, s. 6; Canvas, 2025 MTT085 Fö17, s. 19; Canvas, 2025 MTT085 Fö17, s. 22$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('af5eaa4d-1147-5278-abf3-22197b9a3234', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-the-injection-molding-cycle$kuggfri$, $kuggfri$Vilka påståenden om formsprutningscykeln stämmer?$kuggfri$, $kuggfri$Cykeln börjar när formen stängs; sedan sprutas smältan in, eftertryck läggs på, nästa skott matas fram och detaljen stöts ut när den har svalnat. Cykeltiden är $t_{\text{cykel}} = t_{\text{stängning}} + t_{\text{kylning}} + t_{\text{utstötning}}$, och kyltiden, då detaljen stelnar i formen, är ungefär 80 % av den. Det är detaljen i formen som ska kylas, inte skruven, och cykeln är en tillverkningsföljd, inte en mätmetod.$kuggfri$, null, 340, true, $kuggfri$c7e59801a$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Den domineras av stelningstiden.","correct":true},{"text":"Den börjar med att formen stängs.","correct":true},{"text":"Den mäter smältans viskositet.","correct":false},{"text":"Den domineras av avkylningen av skruven.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö19-21, fråga 1; Canvas, MTT085 Polymeric materials L4-5, s. 6-7; Canvas, Tentamen Materialteknik med svar 2022-11-29, s. 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('0c62eceb-4108-506d-861a-4db3a1f21667', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-a-single-screw-extruder-en$kuggfri$, $kuggfri$Vilka påståenden om en enskruvsextruder stämmer?$kuggfri$, $kuggfri$![Enskruvsextruder med tratt, cylinder, skruv, munstycke och de tre zonerna](/kort/materialteknik/enskruvsextruder.svg)

I doseringszonen byggs det tryck upp som pressar smältan genom munstycket i extruderns ände; trycket är högst närmast munstycket, inte vid tratten. Munstycket ger produktens profil, t.ex. rör och slangfilm, och med film casting eller filmblåsning som sekundär formning blir det tunna filmer. Granulatet smälter inte i tratten; inmatningszonen kyls ofta just för att förhindra det.$kuggfri$, null, 341, true, $kuggfri$c1bc458da$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Skruven har en doseringszon (metering zone) som bygger upp trycket under flödet.","correct":true},{"text":"Den kan användas för att tillverka rör och tunna filmer.","correct":true},{"text":"Trycket byggs upp i inmatningszonen vid tratten.","correct":false},{"text":"Den smälter granulatet direkt i tratten.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö19-21, fråga 2; Canvas, MTT085 Polymeric materials L4-5, s. 2-5; Canvas, Svarsförslag Tentamen MTT085 24-01, s. 3$kuggfri$, false, $kuggfri$Quizens distraktor "kopplad till en formsprutningsform via fördelningskanaler och ingöt" byttes ut eftersom plasticeringsenheten i en formsprutningsmaskin är en sorts enskruvsextruder (L4-5 s. 6). Den nya distraktorn "Trycket byggs upp i inmatningszonen vid tratten" följer L4-5 s. 3, men kursboken säger att friktionen ger en tryckökning redan i inmatningszonen och att den står för tryckuppbyggnaden i extrudrar med spårad inmatning (Osswald 05142_06a-3 s. 8, 9). Är distraktorn entydigt fel, eller ska den bytas?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c27d4aed-00c4-5110-b8b5-1c3d39516f1f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-injection-molding-machines$kuggfri$, $kuggfri$Vilka påståenden om formsprutningsmaskiner stämmer?$kuggfri$, $kuggfri$En formsprutningsmaskin består av insprutningsenhet, plasticeringsenhet, form och stängningsenhet (clamping unit), och granulatet matas in genom en tratt. Maskinen arbetar i en cykel (stängning, insprutning, eftertryck, kylning, utstötning), inte kontinuerligt. Delkristallina polymerer formsprutas också; föreläsningen påpekar bara att kristallisationsvärmen måste föras bort och att de krymper mer, vilket delvis kompenseras med längre eftertryckstid och högre tryck.$kuggfri$, null, 342, true, $kuggfri$c6530f39f$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"De arbetar kontinuerligt utan cykel.","correct":false},{"text":"De har en tratt för inmatning av granulat.","correct":true},{"text":"De har en insprutningsenhet och en stängningsenhet.","correct":true},{"text":"De kan inte användas för delkristallina polymerer.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö19-21, fråga 3; Canvas, MTT085 Polymeric materials L4-5, s. 6; Canvas, 2025 MTT085 Fö18, s. 36; Canvas, 2025 MTT085 Fö19, s. 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('5bfaccc4-f814-5d4a-b5ce-f2f1b97a13d5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-p-v-t-diagrams-refer-to-p-v-t-diagram$kuggfri$, $kuggfri$Vad står pVT-diagram för, och vad visar de?$kuggfri$, $kuggfri$![pVT-diagram: amorf polymer med knäck vid Tg och delkristallin polymer med språng vid Tm](/kort/materialteknik/pvt-amorf-delkristallin.svg)

Ett pVT-diagram visar specifik volym (volym per massa, alltså inversen av densiteten) som funktion av temperaturen vid olika tryck. I diagrammet syns t.ex. knäcken vid glasövergången för amorfa polymerer, språnget vid kristallisation för delkristallina och att högt tryck höjer Tg och Tm. Viskositet och MFI ingår inte i diagrammet.$kuggfri$, null, 343, true, $kuggfri$c006d0e11$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Tryck, volym och temperatur (pressure-volume-temperature).","correct":true},{"text":"De beskriver sambandet mellan en polymers densitet och temperatur, också i smält tillstånd.","correct":true},{"text":"Tryck, viskositet och temperatur.","correct":false},{"text":"De kvantifierar smältflödesindex.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö19-21, fråga 5; Canvas, MTT085 Polymeric materials L4-5, s. 9; Canvas, 2025 MTT085 Fö19, s. 8-9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('4a826b1c-ad2d-5df0-bd92-2ca55ddee175', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-extrusion-extrudering$kuggfri$, $kuggfri$Vilka påståenden om extrudering som process stämmer?$kuggfri$, $kuggfri$Principen för extrudering är att en smälta pumpas genom ett munstycke, och trycket för det byggs upp i skruvens doseringszon. Med film casting som sekundär formning blir det tunna filmer, t.ex. för förpackningar. Granulatet smälter först i cylinderns uppvärmda del, inte i tratten. Att formen stängs är första steget i formsprutningscykeln; vid extrudering finns ingen sluten form, utan smältan pressas ut genom munstycket och ger produkter av i princip kontinuerlig längd.$kuggfri$, null, 344, true, $kuggfri$c6212ea77$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Den bygger på att trycket byggs upp i doseringszonen så att polymeren pressas genom munstycket.","correct":true},{"text":"Den kan användas för att tillverka tunna förpackningsfilmer.","correct":true},{"text":"Den kräver att granulatet smälts i tratten.","correct":false},{"text":"Den börjar med att formen stängs.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö19-21, fråga 6; Canvas, MTT085 Polymeric materials L4-5, s. 2-3; Canvas, MTT085 Polymeric materials L4-5, s. 5-6; Canvas, MTT085 Tutorials-Part 3-5, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8ba4e981-d1fa-524b-9df1-668bb91259bc', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-injection-moulding-formsprutning$kuggfri$, $kuggfri$Vilka påståenden om formsprutning stämmer?$kuggfri$, $kuggfri$Formsprutning passar för massproducerade detaljer med komplexa former och är mer mångsidig än extrudering i fråga om vilka produkter som kan tillverkas, så den är inte begränsad till konstant godstjocklek. Flash uppstår när eftertrycket är för högt: trycket i kaviteten överstiger maskinens låskraft och smälta tränger ut i formens delningsplan. För lågt eftertryck ger i stället för stor krympning.$kuggfri$, null, 345, true, $kuggfri$cfe146a48$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Den arbetar enligt formsprutningscykeln.","correct":true},{"text":"Den kan bara tillverka produkter med konstant godstjocklek.","correct":false},{"text":"Den kan ge flash om eftertrycket är för lågt.","correct":false},{"text":"Maskinen har en insprutningsenhet.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö19-21, fråga 7; Canvas, MTT085 Polymeric materials L4-5, s. 1; Canvas, MTT085 Polymeric materials L4-5, s. 6; Canvas, 05142_06b-4, s. 23; Canvas, 05142_06b-4, s. 26; Canvas, MTT085 Tutorials-Part 3-5, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d3c48a0d-1442-53e4-9724-ae8ba6ec8916', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-film-casting-filmcasting$kuggfri$, $kuggfri$Vilka påståenden om film casting stämmer?$kuggfri$, $kuggfri$Vid film casting extruderas smältan genom ett spaltmunstycke (slit die) och dras ut på en kyld vals (chill roll), som kyler filmen och ger den en dragkvot. Resultatet är tunna filmer, t.ex. för förpackningar. Sekundär formning (fiberspinning, film casting, filmblåsning) hör till extrudering, inte till formsprutning. Extrudatsvällning är en elastisk effekt vid munstycket, inte målet med processen.$kuggfri$, null, 346, true, $kuggfri$c22e4fdb2$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Syftet är att framkalla extrudatsvällning (die swell).","correct":false},{"text":"Det är en sekundär formning efter extrudering.","correct":true},{"text":"Det är en sekundär formning efter formsprutning.","correct":false},{"text":"Det används för att tillverka tunna polymerfilmer.","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö19-21, fråga 8; Canvas, MTT085 Polymeric materials L4-5, s. 4-5; Canvas, 2025 MTT085 Fö18, s. 23$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2b28d687-5ce8-5556-92a1-b0643906b14e', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-the-components-of-a-mold-for-injection$kuggfri$, $kuggfri$Vilka delar ingår i en formsprutningsform?$kuggfri$, $kuggfri$Formen består av sprue och fördelningskanaler (runners), ingöt (gate), formkavitet, kylsystem (ibland) och utstötarsystem (oftast stift). Doseringszonen hör till extruderns skruv, inte till formen. Shish-kebab är en kristallstruktur som kan bildas i materialet när det skjuvas och kyls samtidigt, inte en del av formen.$kuggfri$, null, 347, true, $kuggfri$c295c11eb$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Skruvens doseringszon","correct":false},{"text":"Shish-kebab-kristallstrukturer","correct":false},{"text":"Utstötarstift (ejector pins)","correct":true},{"text":"I vissa fall ett kylsystem","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö19-21, fråga 9; Canvas, MTT085 Polymeric materials L4-5, s. 7; Canvas, MTT085 Polymeric materials L4-5, s. 9; Canvas, 2025 MTT085 Fö18, s. 40$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('f8c227b2-db65-5784-b7e2-8f477cf8d5bb', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$quiz-during-solidification-under-stelning$kuggfri$, $kuggfri$Vilka påståenden om stelningen efter bearbetning stämmer?$kuggfri$, $kuggfri$Bearbetning kan låsa in strukturer som inte är i jämvikt, t.ex. flödesinducerad orientering och sträckning av kedjorna. Snabb avkylning sänker kristalliniteten eftersom mikrostrukturen fryses innan kedjorna hunnit ordna sig helt; på så sätt kan man till och med förhindra kristallisation (jfr PET-flaskor). Shish-kebab är kristallstrukturer och bildas i delkristallina polymerer (vanligast isotaktisk PP och PE), inte i amorfa. Vid avkylning stelnar polymeren genom glasövergång eller kristallisation; kedjorna bryts inte ned.$kuggfri$, null, 348, true, $kuggfri$c807280fc$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Polymerkedjornas orientering kan frysas in.","correct":true},{"text":"Kristallisationen kan frysas så att den inte hinner fullbordas.","correct":true},{"text":"Skjuvflöde kan ge shish-kebab-strukturer i amorfa polymerer.","correct":false},{"text":"Polymerer depolymeriseras alltid vid avkylning.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fö19-21, fråga 10; Canvas, MTT085 Polymeric materials L4-5, s. 9; Canvas, MTT085 Tutorials-Part 3-5, s. 2; Canvas, 2025 MTT085 Fö19, s. 6-9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8971c461-3c38-5d8e-b52e-a0c1dfa293ff', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-viskositet$kuggfri$, $kuggfri$Viskositet$kuggfri$, $kuggfri$En vätskas motstånd mot flöde. Newtons viskositetslag: $\sigma = \eta\dot{\gamma}$, dvs. skjuvspänningen $\sigma$ är proportionell mot skjuvhastigheten $\dot{\gamma}$, och proportionalitetskonstanten $\eta$ är (skjuv)viskositeten. Enheten är Pa s. För en newtonsk vätska beror $\eta$ bara av temperatur och tryck; för en polymersmälta beror den också av skjuvhastigheten.$kuggfri$, null, 349, true, $kuggfri$cf2a0b93f$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085 PM 3, s. 1-3; Canvas, 2025 MTT085 Fö17, s. 8-10; Canvas, Tentamen Materialteknik med svar 2022-11-29, s. 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ecb8e44e-6407-5172-9d6e-ce35d4458983', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-skjuvhastighet$kuggfri$, $kuggfri$Skjuvhastighet (shear rate)$kuggfri$, $kuggfri$Hur snabbt ett material deformeras i skjuvning, $\dot{\gamma} = \dfrac{d\gamma}{dt}$. I enkel skjuvning mellan två plattor på avståndet $h$, där den övre rör sig med hastigheten $v$ och den undre står still, är $\dot{\gamma} = v/h$. Enheten är 1/s. Man använder skjuvhastigheten i stället för skjuvtöjningen som mått på flödet, eftersom töjningen växer obegränsat så länge vätskan flyter.$kuggfri$, null, 350, true, $kuggfri$c57502719$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085 PM 3, s. 1-2; Canvas, 2025 MTT085 Fö17, s. 7-9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('907ee593-0311-5731-92e8-1121e01419e6', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-skjuvfortunning$kuggfri$, $kuggfri$Skjuvförtunning (shear thinning)$kuggfri$, $kuggfri$![Viskositetsfunktionen för en polymersmälta i log-log-skala med nollskjuvplatå, skjuvförtunnande område och platå vid höga skjuvhastigheter](/kort/materialteknik/viskositetsfunktion.svg)

Att viskositeten hos en polymersmälta minskar när skjuvhastigheten ökar. Orsaken är att kedjorna i flödet sträcks, orienteras i flödesriktningen och trasslas ur (om molekylvikten är över intrasslingsmolekylvikten), så att de ger mindre motstånd mot flödet.$kuggfri$, null, 351, true, $kuggfri$cf0964baf$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085 PM 3, s. 5-6; Canvas, Tentamen Materialteknik mrd svar 2021-10-23 korrigerad, s. 1$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('a42848f6-caa7-5e79-9d33-da72a56b3491', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-svetslinje$kuggfri$, $kuggfri$Svetslinje (weld line)$kuggfri$, $kuggfri$Linjen i en formsprutad detalj där två eller flera flödesfronter möts, när detaljens form gör att smältflödet delas i kaviteten. Svetslinjen är en svag punkt i detaljen, så man måste tänka på var den hamnar. För låg insprutningstemperatur kan ge svaga svetslinjer.$kuggfri$, null, 352, true, $kuggfri$c76146db5$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 8; Canvas, 2025 MTT085 Fö18, s. 41; Canvas, MTT085 Tutorials-Part 3-5, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('b9f7d94a-a205-57bd-9934-eb944c3b2e83', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-eftertryck$kuggfri$, $kuggfri$Eftertryck (holding pressure)$kuggfri$, $kuggfri$Det tryck som hålls på smältan vid formsprutning efter att kaviteten fyllts, för att motverka krympningen när materialet stelnar. Eftertrycket hålls tills ingötet har stelnat; därefter fortsätter detaljen att kylas utan förhöjt tryck.$kuggfri$, null, 353, true, $kuggfri$c19759174$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 6; Canvas, 05142_06b-4, s. 24; Canvas, Tentamen Materialteknik med svar 2013-08-20, s. 8$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8849a43e-6bb3-5453-8c64-996ea88f8520', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-shish-kebab$kuggfri$, $kuggfri$Shish-kebab-struktur$kuggfri$, $kuggfri$En speciell kristallstruktur i delkristallina polymerer, vanligast i isotaktisk polypropen och polyeten: en fibrillär kärna (shish) som omväxlar med lameller av veckade kedjor (kebab). Den bildas när smältan skjuvas samtidigt som den kyls, t.ex. vid formsprutning, och ger betydligt bättre mekaniska egenskaper än motsvarande jämviktsstruktur med sfäruliter.$kuggfri$, null, 354, true, $kuggfri$c409ddf22$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 9; Canvas, 2025 MTT085 Fö19, s. 14$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('261f191d-6f28-52d6-8ccf-e39a7c9c2f9c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-varfor-viskoelastisk-smalta$kuggfri$, $kuggfri$Varför är en polymersmälta viskoelastisk?$kuggfri$, $kuggfri$- **Elastisk del:** kedjorna kan sträckas av flödet men har en föredragen konformation som de återgår till när flödet upphör. De lagrar alltså energi under flödet.
- **Viskös del:** kedjorna glider förbi varandra, och friktionen mellan molekylerna ger det viskösa motståndet.

När flödet stoppas återtar kedjorna sin föredragna konformation men flyttar inte tillbaka till sina ursprungliga platser. Därför kan smältan flyta.$kuggfri$, null, 355, true, $kuggfri$cfe217ca0$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 PM 3, s. 4-5; Canvas, 2025 MTT085 Fö17, s. 24-25$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('34a893cf-36f4-5b18-ad33-6e1182628028', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-viskositetsfunktionens-omraden$kuggfri$, $kuggfri$Beskriv viskositetsfunktionen för en polymersmälta och vad kedjorna gör i varje område$kuggfri$, $kuggfri$![Viskositetsfunktionen för en polymersmälta i log-log-skala med nollskjuvplatå, skjuvförtunnande område och platå vid höga skjuvhastigheter](/kort/materialteknik/viskositetsfunktion.svg)

Viskositet mot skjuvhastighet i log-log-skala, med tre områden:

1. **Nollskjuvviskositet** (platå vid låga skjuvhastigheter): spänningarna från flödet är i samma storleksordning som spänningarna från kedjornas termiska rörelse, så kedjorna behåller sin föredragna konformation. Nivån beror på material, molekylvikt och molekylviktsfördelning.
2. **Skjuvförtunnande område:** kedjorna sträcks, orienteras i flödesriktningen och trasslas ur, och viskositeten minskar med ökande skjuvhastighet.
3. **Oändlig-skjuv-viskositet** (platå vid mycket höga skjuvhastigheter, på lägre nivå än nollskjuvplatån): maximal sträckning, orientering och uttrassling är nådd, och viskositeten beror inte längre av skjuvhastigheten. Den är mycket svår att mäta för smältor och kan utelämnas i en skiss.$kuggfri$, null, 356, true, $kuggfri$c058f486e$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 PM 3, s. 5-6; Canvas, 2025 MTT085 Fö17, s. 19; Canvas, Svar Materialteknik 2018-10-27, s. 3$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2d5cd0ac-8e00-5eff-b05e-17ff927b733d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-extruderns-zoner$kuggfri$, $kuggfri$Vad händer med polymeren i enskruvsextruderns tre zoner?$kuggfri$, $kuggfri$![Enskruvsextruder med tratt, cylinder, skruv, munstycke och de tre zonerna](/kort/materialteknik/enskruvsextruder.svg)

Granulatet matas genom tratten in i cylindern.

1. **Inmatningszonen** (solids conveying zone): skruven transporterar och packar granulatet. Zonen kyls ofta så att granulatet inte smälter och sätter igen inloppet.
2. **Smält- eller övergångszonen** (transition zone): i cylinderns uppvärmda del smälter granulatet och homogeniseras.
3. **Doseringszonen** (metering zone): trycket byggs upp så att smältan pressas genom munstycket (die) i extruderns ände.$kuggfri$, null, 357, true, $kuggfri$c86e31797$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 2-3; Canvas, 05142_06a-3, s. 7; Canvas, MTT085 Tutorials-Part 3-5, s. 2; Canvas, Tentamen Materialteknik mrd svar 2021-10-23 korrigerad, s. 1$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('4534df7f-7a28-56e1-9bb0-2fc70a4e4e49', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-formsprutningscykelns-steg$kuggfri$, $kuggfri$Beskriv formsprutningscykelns steg i ordning$kuggfri$, $kuggfri$1. Formen stängs (här börjar cykeln).
2. Insprutningsenheten förs fram och smältan sprutas in i kaviteten via sprue, fördelningskanaler och ingöt.
3. Kaviteten fylls och eftertryck läggs på för att motverka krympningen, tills ingötet har stelnat.
4. Insprutningsenheten dras tillbaka och skruven roterar och matar fram nästa skott.
5. Detaljen kyls i formen tills den är tillräckligt styv, sedan öppnas formen och detaljen stöts ut.

$t_{\text{cykel}} = t_{\text{stängning}} + t_{\text{kylning}} + t_{\text{utstötning}}$, där kyltiden är ungefär 80 % av cykeltiden.$kuggfri$, null, 358, true, $kuggfri$c8e55e3b7$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 6-7; Canvas, 05142_06b-4, s. 24-25; Canvas, MTT085 Tutorials-Part 3-5, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('921b5cc5-01cf-5808-be8c-fb9e39d08cca', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-kyltid-och-godstjocklek$kuggfri$, $kuggfri$Hur påverkar godstjockleken cykeltiden vid formsprutning, och varför?$kuggfri$, $kuggfri$Kyltiden dominerar cykeln (ungefär 80 %), och den ökar ungefär med kvadraten på godstjockleken. Dubbel tjocklek ger alltså ungefär fyra gånger så lång kyltid och därmed mycket längre cykel. Orsaken är plastens låga värmeledningsförmåga (låg termisk diffusivitet), som gör att värmen leds ut långsamt ur detaljen.$kuggfri$, null, 359, true, $kuggfri$c01e95e4b$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 Tutorials-Part 3-5, s. 2-3; Canvas, 05142_06b-4, s. 25$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('7e6cf84b-614e-54e8-91ff-0e23ca36272c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-filmblasning$kuggfri$, $kuggfri$Beskriv filmblåsning (film blowing)$kuggfri$, $kuggfri$Filmblåsning är en sekundär formning efter extrudering. Smältan pressas genom ett ringformat munstycke (blåshuvud) och bildar en slang. Luft blåses in genom munstyckets centrum och blåser upp slangen, som samtidigt dras ut, så att väggtjockleken minskar kraftigt. Filmen kyls av luft utifrån och stelnar innan den når klämvalsarna (nip rollers). Klämvalsarna pressar ihop filmen så att övertrycket i blåsan hålls kvar och drar filmen i axiell riktning. Till sist rullas filmen upp.$kuggfri$, null, 360, true, $kuggfri$c0d2801f5$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 5-6; Canvas, MTT085 Tutorials-Part 3-5, s. 2; Canvas, Tentamen Materialteknik med svar 2013-08-20, s. 8$kuggfri$, false, $kuggfri$Baksidan följer svarsförslaget till tentan 2013-08-20 uppg. 10c nära (uppblåsning, filmen stelnar före klämvalsarna, klämvalsarna håller övertrycket och drar filmen), även om samma innehåll finns i L4-5 s. 5, 6 och Tutorials Part 3-5 s. 2. Ligger baksidan för nära facit, eller får den stå kvar?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3b36715f-d0df-5721-a008-d3aa3577e30a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-sf-smalta-amorf$kuggfri$, $kuggfri$I smält tillstånd är alla polymerer amorfa, även de som är delkristallina i fast tillstånd.$kuggfri$, $kuggfri$Sant. Oavsett om polymeren är amorf eller delkristallin i fast tillstånd har den i smältan en oordnad, slumpmässig molekylorientering, dvs. den är amorf.$kuggfri$, null, 361, true, $kuggfri$c4de8653c$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 3, s. 4; Canvas, 2025 MTT085 Fö17, s. 17; Canvas, 2025 MTT085 Fö17, s. 28$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('48c745ee-202c-5fda-8505-ffe6927a29c4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-sf-viskositet-temperatur$kuggfri$, $kuggfri$Viskositeten hos en polymersmälta ökar när temperaturen höjs.$kuggfri$, $kuggfri$Falskt. Viskositeten minskar när temperaturen höjs ($\eta \propto 1/T$ på föreläsningsbilden); viskositetskurvorna för t.ex. ABS, PC och PA6 ligger lägre ju högre temperaturen är.$kuggfri$, null, 362, true, $kuggfri$c4b12580d$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 3, s. 6; Canvas, 2024 MTT085 Fö17, s. 27; Canvas, 2025 MTT085 Fö17, s. 22$kuggfri$, false, $kuggfri$Kortet skriver η ∝ 1/T från 2024 Fö17 s. 27, men temperaturberoendet är exponentiellt (Arrhenius, eller WLF för amorfa; Osswald kap. 5 s. 4, 11), och bilden visar bara riktningen. Att viskositeten sjunker när temperaturen höjs är belagt (PM 3 s. 6). Ska proportionalitetstecknet strykas?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('d03c3a35-1950-5430-83fa-cc90490bcbdd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-sf-viskositet-molekylvikt$kuggfri$, $kuggfri$Vid i övrigt lika förhållanden har en polymersmälta med högre molekylvikt högre viskositet.$kuggfri$, $kuggfri$Sant. Viskositeten ökar med molekylvikten ($\eta \propto M_w$ på föreläsningsbilden). Omvänt ger lägre molekylvikt lägre viskositet, så att materialet blir lättare att bearbeta. Fyllmedel höjer också viskositeten.$kuggfri$, null, 363, true, $kuggfri$c8cf2b173$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2024 MTT085 Fö17, s. 27; Canvas, MTT085 Tutorials-Part 3-5, s. 3$kuggfri$, false, $kuggfri$Kortet skriver η ∝ Mw som på föreläsningsbilden 2024 Fö17 s. 27 (bilden finns inte i 2025 års material), men kursboken (Osswald kap. 3 s. 5, fig. 3.7) visar att nollskjuvviskositeten över en kritisk molekylvikt växer ungefär som Mw upphöjt till 3,4. Räcker det att kortet säger att viskositeten ökar kraftigt med molekylvikten, utan proportionalitetstecknet?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('7b408caf-8075-539d-8862-5c8e7befefe9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-sf-nollskjuv-orientering$kuggfri$, $kuggfri$Vid låga skjuvhastigheter, i nollskjuvområdet, orienteras polymerkedjorna kraftigt i flödesriktningen.$kuggfri$, $kuggfri$![Viskositetsfunktionen för en polymersmälta i log-log-skala med nollskjuvplatå, skjuvförtunnande område och platå vid höga skjuvhastigheter](/kort/materialteknik/viskositetsfunktion.svg)

Falskt. Vid små eller långsamma deformationer hinner kedjornas termiska rörelse återställa deras föredragna konformation, så orienteringen ändras inte och viskositeten är konstant. Kedjorna orienteras först vid högre skjuvhastigheter, i det skjuvförtunnande området.$kuggfri$, null, 364, true, $kuggfri$c1d7478a2$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 3, s. 6; Canvas, 2025 MTT085 Fö17, s. 28; Canvas, Tentamen Materialteknik med svar 2020-10-24, s. 6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('422cab47-9609-501a-abfd-d72dee3f8afd', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-sf-delkristallin-krymper-mer$kuggfri$, $kuggfri$Delkristallina termoplaster krymper mer än amorfa när de stelnar.$kuggfri$, $kuggfri$![pVT-diagram: amorf polymer med knäck vid Tg och delkristallin polymer med språng vid Tm](/kort/materialteknik/pvt-amorf-delkristallin.svg)

Sant. Amorfa termoplaster förtätas minst vid stelning, eftersom kedjorna inte kan ordna sig i regelbundna, tätpackade kristaller. Delkristallina polymerer krymper mer; vid formsprutning motverkas det delvis med längre eftertryckstid och högre tryck.$kuggfri$, null, 365, true, $kuggfri$cb02cb611$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fö19, s. 7, 9; Canvas, MTT085 Tutorials-Part 3-5, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('62ca1f80-94d1-5a84-a887-ce23591effb4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-sf-snabbkylning-kristallinitet$kuggfri$, $kuggfri$Snabbare avkylning ger en högre kristallinitetsgrad i en delkristallin polymer.$kuggfri$, $kuggfri$Falskt. Snabb avkylning sänker kristalliniteten, eftersom mikrostrukturen fryses innan kedjorna hunnit ordna sig helt i kristaller.$kuggfri$, null, 366, true, $kuggfri$c74641561$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fö19, s. 9; Canvas, MTT085 Tutorials-Part 3-5, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('380e3145-de95-541b-92cf-c2fcd357d4f5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-alt-produkt-extrudering$kuggfri$, $kuggfri$Vilka produkter tillverkas typiskt genom extrudering, med eller utan sekundär formning?$kuggfri$, $kuggfri$Extrudering ger produkter med en viss tvärsnittsprofil, t.ex. rör, slangar, filament, profiler och filmer; med film casting eller filmblåsning blir det tunn film. Tryckknappen i en kulspetspenna formsprutas (tentan 2016-10), och massproducerade detaljer med komplex form är just det formsprutning passar för.$kuggfri$, null, 367, true, $kuggfri$cc70f0ea5$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Rör","correct":true},{"text":"Tunn förpackningsfilm","correct":true},{"text":"Tryckknappen i en kulspetspenna","correct":false},{"text":"Massproducerade detaljer med komplex tredimensionell form","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 4-5; Canvas, Tentamen Materialteknik med svar 2016-10-29, s. 7; Canvas, 05142_06b-4, s. 23$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('5ad366de-e6ff-517a-8a11-bef8a95b1bad', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-alt-processfonster$kuggfri$, $kuggfri$Vilka par av processfel och orsak stämmer för formsprutning?$kuggfri$, $kuggfri$Processfönstret (molding diagram) begränsas av smälttemperatur och eftertryck. För låg temperatur ger kortskott och svaga svetslinjer, för hög temperatur ger termisk nedbrytning. För lågt eftertryck ger för stor krympning, för högt eftertryck ger flash: trycket i kaviteten överstiger låskraften och smälta tränger ut i formens delningsplan.$kuggfri$, null, 368, true, $kuggfri$c1772ffa9$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"För låg smälttemperatur ger kortskott (ofylld kavitet).","correct":true},{"text":"För högt eftertryck ger flash.","correct":true},{"text":"För låg smälttemperatur ger termisk nedbrytning.","correct":false},{"text":"För lågt eftertryck ger flash.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 05142_06b-4, s. 26; Canvas, MTT085 Tutorials-Part 3-5, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3c9acbe1-5f5c-5956-8e14-ab3926adc59d', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-alt-formens-kanaler$kuggfri$, $kuggfri$Vilka påståenden om formsprutningsformens kanaler stämmer?$kuggfri$, $kuggfri$Smältan går från cylindern genom sprue och fördelas via fördelningskanalerna till ingöten (gates), som leder in i kaviteterna. Ingötet är en liten öppning jämfört med detaljen och kanalerna och stelnar därför före detaljen. Har formen bara en kavitet fungerar sprue själv som ingöt (sprue gate).$kuggfri$, null, 369, true, $kuggfri$cf1878e05$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Sprue förbinder cylindern med formen.","correct":true},{"text":"Fördelningskanalerna (runners) fördelar smältan till kaviteterna via ingöten.","correct":true},{"text":"Ingötet är formens största kanal och stelnar därför sist.","correct":false},{"text":"Om formen bara har en kavitet behövs ingen sprue.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 6-7; Canvas, 2025 MTT085 Fö18, s. 40$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('37682869-5c47-513b-8382-b8a17c9344c2', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-viskositet-omrade-skjuvfortunnande$kuggfri$, $kuggfri$Vilket område i viskositetsfunktionen är det skjuvförtunnande? ![Viskositet mot skjuvhastighet i log-log-skala, uppdelad i områdena A, B och C från låg till hög skjuvhastighet](/kort/materialteknik/viskositetsfunktion-fraga.svg)$kuggfri$, $kuggfri$![Viskositetsfunktionen för en polymersmälta i log-log-skala med nollskjuvplatå, skjuvförtunnande område och platå vid höga skjuvhastigheter](/kort/materialteknik/viskositetsfunktion.svg)

B är det skjuvförtunnande området, där viskositeten minskar med ökande skjuvhastighet eftersom kedjorna sträcks, orienteras i flödesriktningen och trasslas ur. A är nollskjuvviskositeten, en platå vid låga skjuvhastigheter, och C är oändlig-skjuv-viskositeten, en platå vid mycket höga skjuvhastigheter som är svår att mäta för smältor.$kuggfri$, null, 370, true, $kuggfri$c05d10284$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"B","correct":true},{"text":"A","correct":false},{"text":"C","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 3, s. 5-6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('7c2ba308-7a73-55b9-bc3e-4d762f262083', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-viskositet-omrade-nollskjuv$kuggfri$, $kuggfri$Vilket område i viskositetsfunktionen motsvarar nollskjuvviskositeten $\eta_0$? ![Viskositet mot skjuvhastighet i log-log-skala, uppdelad i områdena A, B och C från låg till hög skjuvhastighet](/kort/materialteknik/viskositetsfunktion-fraga.svg)$kuggfri$, $kuggfri$![Viskositetsfunktionen för en polymersmälta i log-log-skala med nollskjuvplatå, skjuvförtunnande område och platå vid höga skjuvhastigheter](/kort/materialteknik/viskositetsfunktion.svg)

Nollskjuvviskositeten är platån vid låga skjuvhastigheter (A). Där är spänningarna från flödet i samma storleksordning som spänningarna från kedjornas termiska rörelse, så kedjorna behåller sin föredragna konformation och viskositeten är konstant. Nivån beror på material, molekylvikt och molekylviktsfördelning.$kuggfri$, null, 371, true, $kuggfri$ca878c804$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"A","correct":true},{"text":"B","correct":false},{"text":"C","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 PM 3, s. 5-6$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('0dde2054-ff05-5f68-a64d-84106ea56ed9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-extruder-smaltzon$kuggfri$, $kuggfri$I vilken zon i en enskruvsextruder smälter granulatet?$kuggfri$, $kuggfri$![Enskruvsextruder med tratt, cylinder, skruv, munstycke och de tre zonerna](/kort/materialteknik/enskruvsextruder.svg)

Granulatet smälter och homogeniseras i smält- eller övergångszonen, i cylinderns uppvärmda del. Inmatningszonen transporterar och packar granulatet och kyls ofta så att det inte smälter och sätter igen inloppet. I doseringszonen byggs trycket upp som pressar smältan genom munstycket.$kuggfri$, null, 372, true, $kuggfri$c3d1440ba$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Smält- eller övergångszonen (transition zone)","correct":true},{"text":"Inmatningszonen (solids conveying zone)","correct":false},{"text":"Doseringszonen (metering zone)","correct":false},{"text":"I tratten, innan granulatet når skruven","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 2-3$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6e45484c-57ca-53e4-ac1f-e7288d0c7497', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-pvt-sprang$kuggfri$, $kuggfri$I ett pVT-diagram gör kurvan ett språng i specifik volym vid en viss temperatur. Vilken typ av polymer och vilken temperatur gäller det?$kuggfri$, $kuggfri$![pVT-diagram: amorf polymer med knäck vid Tg och delkristallin polymer med språng vid Tm](/kort/materialteknik/pvt-amorf-delkristallin.svg)

För en delkristallin polymer sjunker den specifika volymen språngvis vid $T_m$ när kristallisationen börjar under avsvalning. En amorf polymer har inget språng, bara en knäck vid $T_g$ där kurvan byter lutning från smälta till glas.$kuggfri$, null, 373, true, $kuggfri$c898f4dd1$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"En delkristallin polymer, vid smälttemperaturen $T_m$","correct":true},{"text":"En amorf polymer, vid glasomvandlingstemperaturen $T_g$","correct":false},{"text":"En amorf polymer, vid smälttemperaturen $T_m$","correct":false},{"text":"En delkristallin polymer, vid glasomvandlingstemperaturen $T_g$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 9-10; Canvas, 2025 MTT085 Fö19, s. 8-9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('86eba25c-7776-594e-81e1-8e05ce3cb274', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-formsprutning-produkt-ingotssystem$kuggfri$, $kuggfri$När formen öppnas efter ett formsprutningsskott stöts ett sammanhängande plaststycke ut. Vilka delar av stycket är inloppssystem, som skiljs bort från produkten?$kuggfri$, $kuggfri$Smältan går från cylindern genom sprue, fördelas i fördelningskanalerna och leds via små ingöt in i kaviteterna, där detaljerna får sin form. Plasten i sprue, kanaler och ingöt stelnar också och följer med ut, men den är bara vägen in; produkten är detaljerna från kaviteterna. Utstötarstiften hör till formen och stöter ut stycket, de följer inte med ut.$kuggfri$, null, 374, true, $kuggfri$c61898f4c$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Plasten som har stelnat i sprue","correct":true},{"text":"Plasten som har stelnat i fördelningskanalerna (runners)","correct":true},{"text":"Ingöten (gates)","correct":true},{"text":"Detaljerna som har formats i kaviteterna","correct":false},{"text":"Utstötarstiften","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 6, 7; Canvas, 2025 MTT085 Fo18, s. 40$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('b134c93d-140c-57a1-91d0-73fd5f894e69', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-formsprutningsmaskinens-enheter-uppgift$kuggfri$, $kuggfri$Vilka är formsprutningsmaskinens fyra huvudenheter, och vad gör var och en?$kuggfri$, $kuggfri$* **Plasticeringsenhet:** en sorts enskruvsextruder. Granulatet matas från tratten in i den uppvärmda cylindern, där den roterande skruven smälter det (värmeledning från cylindern och värme från friktion och flöde) och samlar en bestämd mängd smälta framför skruvspetsen.
* **Insprutningsenhet:** förs fram och trycker in smältan i formen med högt tryck och hög hastighet; därefter läggs eftertryck på.
* **Form:** sprue, fördelningskanaler, ingöt och kavitet, kylsystem (ibland) och utstötare. Detaljen kyls i formen tills den är styv nog att stötas ut.
* **Stängningsenhet (clamping unit):** stänger formen och håller den stängd mot trycket i kaviteten. Blir trycket i kaviteten för högt i förhållande till maskinens låskraft tränger smälta ut i formens delningsplan (flash).$kuggfri$, null, 375, true, $kuggfri$c058a74c1$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 6, 7; Canvas, MTT085 Tutorials-Part 3-5, s. 1, 2; Canvas, 2025 MTT085 Fo18, s. 36, 40; Canvas, 05142_06b-4, s. 26$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6374ae74-55d8-54a5-814f-3d54db5f292c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-sf-total-kyltid-eftertryck$kuggfri$, $kuggfri$Vid formsprutning börjar detaljen stelna först när eftertrycket har släppts.$kuggfri$, $kuggfri$Falskt. Smältan börjar stelna mot den relativt kalla formen redan medan eftertrycket ligger på; eftertrycket motverkar krympningen och hålls tills ingötet har stelnat. Därefter fortsätter stelningen utan förhöjt tryck tills detaljen är tillräckligt styv för att stötas ut. Den totala kyltiden omfattar alltså både tiden med eftertryck och tiden därefter, och den utgör ungefär 80 % av cykeltiden.$kuggfri$, null, 376, true, $kuggfri$c757e338d$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 6, 7; Canvas, MTT085 Tutorials-Part 3-5, s. 1, 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c23cffb8-e988-5b0c-81c0-d6a0309445f5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '5e84b0fc-3b12-5447-b13d-c1e3ca6a4e68', $kuggfri$reo-sf-tryck-hojer-tg-tm$kuggfri$, $kuggfri$Högt tryck under bearbetningen höjer glasomvandlingstemperaturen hos en amorf termoplast.$kuggfri$, $kuggfri$Sant. Högt tryck pressar molekylerna närmare varandra, så det krävs mer termisk energi för att frigöra dem så att de kan flyta. I ett pVT-diagram flyttas därför knäcken vid Tg (amorfa termoplaster) och språnget vid Tm (delkristallina termoplaster) till högre temperatur när trycket ökar.$kuggfri$, null, 377, true, $kuggfri$cb09924ce$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L4-5, s. 9; Canvas, 2025 MTT085 Fo19, s. 8, 9$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('0fcfdbc7-b726-5552-9801-23674c214d53', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$quiz-creep-krypning$kuggfri$, $kuggfri$Vad stämmer om krypning (creep) hos polymerer?$kuggfri$, $kuggfri$I ett krypprov hålls spänningen konstant och töjningen mäts över tiden. Konstant töjning med uppmätt spänning är i stället ett relaxationsprov. Snitt genom krypkurvorna vid konstant tid ger isokrona spännings-töjningskurvor. Slagprov är korttidsprov, där polymerer oftast kan betraktas som rent elastiska, medan krypprov är långtidsprov.$kuggfri$, null, 378, true, $kuggfri$c895aac32$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Ett krypprov görs med konstant töjning","correct":false},{"text":"Ett krypprov görs med konstant spänning","correct":true},{"text":"Krypkurvor kan användas för att konstruera isokrona diagram","correct":true},{"text":"Krypning är ett mått på slagseghet","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, Quiz Polymeric materials Fo19-21, fråga 4; Canvas, 2025 MTT085 Fo20, s. 15, 20; Canvas, 05142_09 (Osswald kap. 9), s. 5, 39; Canvas, MTT085 Polymeric materials L6, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('1df13097-698e-544b-a022-d227205814e4', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-krackelering-vad-stammer$kuggfri$, $kuggfri$Vad stämmer om krackelering (crazing) i en amorf polymer?$kuggfri$, $kuggfri$Krazer är mikrosprickor som bildas vinkelrätt mot den största huvudspänningen, med start vid spänningskoncentrationer som repor, dammpartiklar eller inhomogeniteter i materialet. De försämrar klarheten och reflekterar ljus, vilket gör dem tydliga i transparenta material.$kuggfri$, null, 379, true, $kuggfri$c6d6bb352$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Krazerna bildas i plan vinkelräta mot den största huvudspänningen","correct":true},{"text":"Krazerna kärnbildas vid spänningskoncentrationer som repor och dammpartiklar","correct":true},{"text":"Krazerna bildas i plan parallella med den största huvudspänningen","correct":false},{"text":"Krazerna påverkar inte materialets klarhet","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 9; Canvas, 05142_10 (Osswald kap. 10), s. 10$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('e5f519e8-a7c5-550a-8049-88a9eaecf7ec', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-duktilt-brott-ordning$kuggfri$, $kuggfri$I vilken ordning sker händelserna när en delkristallin termoplast, t.ex. PP, dras till brott vid rumstemperatur?$kuggfri$, $kuggfri$Först är deformationen linjärelastisk och reversibel (för PP upp till ca 0,5 %). Sedan blir kurvan olinjär när mikrosprickor bildas i gränsytorna mellan sfäruliterna, som syns som stress whitening. Vid spänningsmaximum nås flytpunkten, spänningen sjunker och halsbildning följer, med en lång kalldragning där sfärulitstrukturen deformeras och bryts upp. Linjärt område, krackelering och sprött brott vid ca 1 % töjning beskriver i stället en amorf termoplast under Tg.$kuggfri$, null, 380, true, $kuggfri$c3bf89d81$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Linjärelastiskt område, mikrosprickor mellan sfäruliterna (stress whitening), flytpunkt, halsbildning och kalldragning","correct":true},{"text":"Halsbildning, stress whitening, linjärelastiskt område, flytpunkt","correct":false},{"text":"Linjärelastiskt område, krackelering, sprött brott vid ca 1 % töjning","correct":false},{"text":"Kalldragning, flytpunkt, linjärelastiskt område, stress whitening","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 10–13; Canvas, 05142_10 (Osswald kap. 10), s. 12–14$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('5b693aa2-aded-52ff-9ffe-6eec5c217160', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-stress-whitening-var$kuggfri$, $kuggfri$Var bildas de mikrosprickor som ger stress whitening i en delkristallin polymer?$kuggfri$, $kuggfri$Sfäruliterna är den största längdskalan i en delkristallin polymer, och den största längdskalan går sönder först. Mikrosprickorna bildas därför i gränsytorna mellan sfäruliterna och blir ungefär lika långa som sfäruliterna. När de blir synliga kallas de stress whitening. Tvärbindningspunkter finns inte i en termoplast.$kuggfri$, null, 381, true, $kuggfri$c8a0ca65c$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"I gränsytorna mellan sfäruliterna","correct":true},{"text":"Inuti de enskilda kristallina lamellerna","correct":false},{"text":"Längs de kovalenta bindningarna i huvudkedjan","correct":false},{"text":"Vid tvärbindningspunkterna mellan kedjorna","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 12; Canvas, 05142_10 (Osswald kap. 10), s. 12–14; Canvas, MTT085 Polymeric materials L6, s. 8$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('e7603fd5-950e-502b-9632-5dcd5c498ae7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-isokrona-kurvor-konstruktion$kuggfri$, $kuggfri$Hur konstrueras isokrona spännings-töjningskurvor ur krypdata?$kuggfri$, $kuggfri$Isokron betyder "samma tid": varje kurva gäller en viss belastningstid, t.ex. 1 dag eller 1 år. Snitt vid konstant töjning med spänningen mot tiden ger i stället isometriska kurvor. Slagprov är korttidsprov och ger inga krypdata.$kuggfri$, null, 382, true, $kuggfri$c04adefd2$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Genom snitt i krypkurvorna vid konstant tid, med spänningen plottad mot töjningen","correct":true},{"text":"Genom snitt i krypkurvorna vid konstant töjning, med spänningen plottad mot tiden","correct":false},{"text":"Genom snitt vid konstant spänning, med töjningen plottad mot temperaturen","correct":false},{"text":"Genom slagprov vid olika temperaturer","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo20, s. 20; Canvas, 05142_09 (Osswald kap. 9), s. 39$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('a812b307-2d5f-5912-b9dc-8e3c0f911a1b', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-kryp-rent-viskost-svar$kuggfri$, $kuggfri$Vilket svar ger en rent viskös vätska i ett krypprov med konstant spänning σ₀?$kuggfri$, $kuggfri$En rent viskös vätska följer Newtons viskositetslag, så töjningen blir $\gamma(t) = \dfrac{\sigma_0}{\eta}\,t$. En ögonblicklig töjning som sedan är konstant är det rent elastiska svaret (Hooke). En elastisk start som sedan går mot ett gränsvärde är det fastfaslika viskoelastiska svaret.$kuggfri$, null, 383, true, $kuggfri$c268b40d1$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Töjningen växer linjärt med tiden, med lutningen σ₀/η","correct":true},{"text":"En ögonblicklig töjning som sedan är konstant","correct":false},{"text":"En ögonblicklig elastisk töjning som sedan närmar sig ett gränsvärde","correct":false},{"text":"Ingen töjning alls","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo20, s. 16; Canvas, MTT085 Polymeric materials L6, s. 5$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('9b19d47b-61e1-53e0-bdba-7f0039c09a5c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-kryp-aterhamtning$kuggfri$, $kuggfri$Vad händer när krypspänningen tas bort från ett viskoelastiskt material (återhämtning)?$kuggfri$, $kuggfri$Den töjning som återgår (återhämtningstöjningen) visar hur mycket elastisk energi som lagrades i strukturen. Resten återgår inte, eftersom kedjor som har glidit förbi varandra stannar i sina nya lägen; det är den viskösa förlusten. Att all töjning återgår gäller bara ett rent elastiskt material.$kuggfri$, null, 384, true, $kuggfri$c19088515$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"En del av töjningen återgår snabbt, men en kvarstående töjning blir kvar","correct":true},{"text":"All töjning återgår direkt","correct":false},{"text":"Töjningen fortsätter att öka i samma takt som under belastningen","correct":false},{"text":"Töjningen blir negativ","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L6, s. 5; Canvas, 2025 MTT085 Fo20, s. 17$kuggfri$, false, $kuggfri$Kortet säger att ett viskoelastiskt material får en kvarstående töjning och att full återgång "bara" gäller rent elastiska material, men en viskoelastisk fast kropp (Kelvinmodellen) återhämtar sig helt (Osswald kap. 9 s. 12), och kortet polymer-elastomer-reversibel säger att elastomerens deformation går tillbaka. Ska frågan begränsas till t.ex. en termoplast eller smälta, och ordet "bara" strykas?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('0592f1cd-14a4-5862-b005-39f588f8dd2a', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-var-star-polymerer-ut$kuggfri$, $kuggfri$Inom vilka områden sticker polymera material ut?$kuggfri$, $kuggfri$Polymerer och polymerkompositer har goda mekaniska egenskaper i förhållande till densiteten och är därför nyckeln till lättviktskonstruktion. Eftersom de är viskoelastiska omvandlas en del av vibrationerna till viskösa förluster, vilket ger dämpning. De är också termiskt och elektriskt isolerande; elektrisk ledningsförmåga kräver ledande fyllmedel. Jämfört med metaller tål polymerer lägre temperaturer, och användningstemperaturen är ett av de viktigaste kriterierna vid val av polymer.$kuggfri$, null, 385, true, $kuggfri$cdd55e475$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Lättviktskonstruktion (höga mekaniska egenskaper i förhållande till densiteten)","correct":true},{"text":"Vibrationsdämpning","correct":true},{"text":"Hög användningstemperatur","correct":false},{"text":"Hög elektrisk ledningsförmåga utan tillsatser","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L6, s. 1; Canvas, 2025 MTT085 Fo20, s. 4; Canvas, 2025 MTT085 Fo16, s. 20; Canvas, MTT085-Turorials-Part12, s. 4$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('ec7e3384-0c39-50d6-a088-147c77d5b244', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-krazer-langsam-deformation$kuggfri$, $kuggfri$Vid hög deformationshastighet blir krazerna stora och bildas tidigt under belastningen.$kuggfri$, $kuggfri$Det är tvärtom. Krackeleringen beror på deformationshastigheten: vid hög deformationshastighet blir krazerna små och bildas strax före brottet, eller inte alls. Vid långsam deformation blir de stora och uppträder tidigt under belastningen.$kuggfri$, null, 386, true, $kuggfri$cfbc51614$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 9; Canvas, 05142_10 (Osswald kap. 10), s. 10; Canvas, MTT085 Polymeric materials L6, s. 8$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('8e08644d-ccd3-5487-9cfd-30640aa0ffd1', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-krazer-fibriller$kuggfri$, $kuggfri$Krazer är mindre farliga än riktiga sprickor, eftersom krazernas gränsytor hålls ihop av lastbärande fibriller.$kuggfri$, $kuggfri$Krazerna är sammankopplade av lastbärande fibriller och är därför mindre farliga än verkliga sprickor. De är ändå en synlig varning: i transparenta detaljer syns de eftersom de försämrar klarheten och reflekterar ljus.$kuggfri$, null, 387, true, $kuggfri$c5bf3bca5$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 9; Canvas, 05142_10 (Osswald kap. 10), s. 10$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('6d0845be-44e8-54fb-bd6e-1dd179d9ce01', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-isometriska-kurvor$kuggfri$, $kuggfri$Isometriska kurvor fås genom snitt i krypkurvorna vid konstant tid, med spänningen plottad mot töjningen.$kuggfri$, $kuggfri$Det beskriver isokrona kurvor ("samma tid"). Isometriska kurvor ("samma töjning") fås genom snitt i krypkurvorna vid konstant töjning, med spänningen plottad mot tiden. De liknar resultatet av ett relaxationsprov.$kuggfri$, null, 388, true, $kuggfri$c68fec270$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":false},{"text":"Falskt","correct":true}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 05142_09 (Osswald kap. 9), s. 39; Canvas, 2025 MTT085 Fo20, s. 20$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('2761935f-c635-56ab-8132-f0d63d2a67bf', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-elastomer-reversibel$kuggfri$, $kuggfri$Deformationen hos en tvärbunden elastomer är reversibel så länge inga tvärbindningar bryts.$kuggfri$, $kuggfri$Tvärbindningarna gör att en elastomer klarar mycket stora deformationer (gummielasticitet). Eftersom elastomerer bara är glest tvärbundna kan stora delar av kedjorna sträckas ut, och deformationen går tillbaka så länge tvärbindningarna är intakta.$kuggfri$, null, 389, true, $kuggfri$c436576c4$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 15; Canvas, MTT085 PM 1, s. 10$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('86d41b2b-69c9-5ff6-abe2-77ab1a036969', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-sprott-over-tg-kryp-utmattning$kuggfri$, $kuggfri$Sprött brott hos polymerer kan uppträda även över Tg, vid krypbrott och utmattning.$kuggfri$, $kuggfri$Sprött brott i ett kortvarigt dragprov gäller termoplaster under Tg och högt tvärbundna polymerer. I krypbrotts- och utmattningsprov kan sprött brott uppträda även vid temperaturer över Tg.$kuggfri$, null, 390, true, $kuggfri$ca72332bb$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 7; Canvas, 05142_10 (Osswald kap. 10), s. 8$kuggfri$, false, $kuggfri$Förklaringen säger utan förbehåll att sprött brott i kortvarigt dragprov "gäller termoplaster under Tg och högt tvärbundna polymerer", men Fö21 2025 s. 7 säger "usually" och PC är ett undantag (Lab-PM Polymer s. 2); just denna fråga är omtvistad i tentan 2024-10-31 uppg. 9. Ska "i regel" läggas till, som på kortet polymer-dragkurvor-fyra-typer?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('881008db-c1c6-5ba2-a824-d0f7fe032b79', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-slagprov-elastiskt-langtid-viskoelastiskt$kuggfri$, $kuggfri$I slagprov kan polymerer oftast betraktas som rent elastiska, medan de i långtidsprov som krypprov beter sig viskoelastiskt.$kuggfri$, $kuggfri$Polymerers beteende är tidsberoende. Vid korta tidsskalor (slagprov) beter de sig i regel som rent elastiska material, vid långa tidsskalor (kryp) är beteendet tydligt viskoelastiskt. Svårast att bedöma är tidsskalor i samma storleksordning som ett vanligt dragprov.$kuggfri$, null, 391, true, $kuggfri$c6c0a0a54$kuggfri$, $kuggfri$sant-falskt$kuggfri$, $kuggfri$[{"text":"Sant","correct":true},{"text":"Falskt","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L6, s. 2$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('a42e6fe5-e420-5149-a836-d71f6ac183c9', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-begrepp-krypmodul$kuggfri$, $kuggfri$Krypmodul$kuggfri$, $kuggfri$Den pålagda konstanta spänningen delad med den tidsberoende töjningen i ett krypprov: $E_c = \dfrac{\sigma_0}{\varepsilon(t)}$. Krypmodulen minskar alltså med tiden. I skjuvning motsvaras den av skjuvkrypmodulen $G_c = \sigma_0/\gamma(t)$.$kuggfri$, null, 392, true, $kuggfri$c47979f87$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 2025 MTT085 Fo20, s. 15; Canvas, 05142_09 (Osswald kap. 9), s. 37$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3fe6e068-2291-5e5d-8ead-8d3dc0798d66', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-begrepp-deborahtal$kuggfri$, $kuggfri$Deborahtal (Deborah number)$kuggfri$, $kuggfri$Kvoten mellan materialets karakteristiska tidsskala och observationens tidsskala: $De = \dfrac{\text{materialets tidsskala}}{\text{observationstiden}}$. När De går mot 0 beter sig materialet som en rent viskös vätska, när De går mot oändligheten som ett rent elastiskt fast material. Däremellan är det viskoelastiskt ("everything flows", jämför beckdroppsförsöket).$kuggfri$, null, 393, true, $kuggfri$c12fbea6b$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 2025 MTT085 Fo20, s. 13$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('58e13724-a3e0-53ae-9469-3e98913340ac', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-begrepp-halsbildning$kuggfri$, $kuggfri$Halsbildning (necking)$kuggfri$, $kuggfri$En lokal minskning av tvärsnittsarean som följer efter flytpunkten när en delkristallin polymer dras. Därefter följer en lång kalldragning där sfärulitstrukturen först deformeras och sedan bryts upp, så att starkt orienterade områden bildas.$kuggfri$, null, 394, true, $kuggfri$c7971ff6a$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 13; Canvas, 05142_10 (Osswald kap. 10), s. 14$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('be773bde-4bcc-5819-b78b-8d95772a2130', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-halsbildning-molekylmodell$kuggfri$, $kuggfri$Beskriv vad som händer i molekylstrukturen vid halsbildning i en delkristallin polymer.$kuggfri$, $kuggfri$Under halsbildningen och kalldragningen deformeras sfärulitstrukturen och bryts upp, så att starkt orienterade områden bildas. I molekylmodellen ingår:

- De amorfa banden mellan lamellerna sträcks ut helt, vilket gör att lamellerna glider och vrids i förhållande till varandra (slip-tilt).
- Vid fortsatt dragning ordnas lamellfragment i dragriktningen och bildar fibriller av omväxlande kristallina block och sträckta amorfa områden.$kuggfri$, null, 395, true, $kuggfri$cd44b8935$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, 2025 MTT085 Fo21, s. 13–14; Canvas, MTT085 Polymeric materials L6, s. 9–10; Canvas, 05142_10 (Osswald kap. 10), s. 14–15$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('24ff24fb-975d-5da9-821d-f0cc7cc74d12', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-isokront-diagram-dimensionering$kuggfri$, $kuggfri$Hur används ett isokront spännings-töjningsdiagram vid dimensionering av en plastdetalj?$kuggfri$, $kuggfri$Varje isokron kurva gäller en viss belastningstid, och diagrammet gäller den temperatur som krypproven gjordes vid. Välj kurvan för produktens livslängd, t.ex. 1 år. Gå in med spänningen på y-axeln och läs av vilken töjning detaljen har fått efter krypning under den tiden; jämför med den tillåtna töjningen. Omvänt ger en största tillåten töjning den största tillåtna spänningen.$kuggfri$, null, 396, true, $kuggfri$c1ae73354$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 Polymeric materials L6, s. 6–7; Canvas, 2025 MTT085 Fo20, s. 20$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('fc451ba5-0819-5be7-955b-1405e7c7d38c', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-begrepp-boltzmann-superposition$kuggfri$, $kuggfri$Boltzmanns superpositionsprincip$kuggfri$, $kuggfri$I linjär viskoelasticitet är deformationen summan av de töjningar som varje lastförändring ger upphov till, oberoende av de laster som redan verkar. Vid stegvisa spänningsändringar $\Delta\sigma_i$ vid tiderna $t_i$ blir töjningen

$\varepsilon(t) = \sum_i \Delta\sigma_i\,J(t - t_i)$,

där $J$ är krypkompliansen. Varje steg bidrar efter hur länge det har verkat, så töjningen beror på hela belastningshistorien och inte bara på den spänning som verkar just nu. Principen gäller så länge polymeren beter sig linjärt viskoelastiskt.$kuggfri$, null, 397, true, $kuggfri$c78d1b36b$kuggfri$, $kuggfri$begrepp$kuggfri$, null, null, $kuggfri$Canvas, 05142_09 (Osswald kap. 9), s. 8, 9$kuggfri$, false, $kuggfri$Boltzmanns superpositionsprincip stod i läsanvisningen för PM 6 år 2020 och på tentan 2020, men finns inte i PM 6 för 2024 och 2025 (Fö20 2025 s. 22 hänvisar bara till bokens sidor om krypprov och isokrona diagram); kortets enda källa är Osswald kap. 9 s. 8, 9. Ingår principen i årets kurs, eller ska kortet tas bort?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('804bc267-02e4-5df0-abea-a8c90ef344d7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-boltzmann-tvastegs$kuggfri$, $kuggfri$En polymer har krypkompliansen $J(t)$. Spänningen $\sigma_0$ läggs på vid $t = 0$ och höjs till $2\sigma_0$ vid $t_1$. Vilket uttryck ger töjningen vid $t > t_1$ (linjär viskoelasticitet)?$kuggfri$, $kuggfri$Enligt Boltzmanns superpositionsprincip adderas bidraget från varje spänningssteg, räknat från den tidpunkt då steget lades på: $\varepsilon(t) = \sigma_0 J(t) + (2\sigma_0 - \sigma_0)\,J(t - t_1)$. Det andra steget är bara ökningen $\sigma_0$, och det har verkat kortare tid. $2\sigma_0 J(t)$ gäller om hela spänningen hade lagts på redan vid $t = 0$; eftersom $J$ växer med tiden blir den töjningen större.$kuggfri$, null, 398, true, $kuggfri$c7c1ee47b$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"$\\sigma_0 J(t) + \\sigma_0 J(t - t_1)$","correct":true},{"text":"$2\\sigma_0 J(t)$","correct":false},{"text":"$2\\sigma_0 J(t - t_1)$","correct":false},{"text":"$\\sigma_0 J(t) + 2\\sigma_0 J(t - t_1)$","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 05142_09 (Osswald kap. 9), s. 8, 9$kuggfri$, false, $kuggfri$Räkneuppgiften bygger på Boltzmanns superpositionsprincip, som inte står i läsanvisningen för PM 6 2024 och 2025 (Fö20 2025 s. 22); uträkningen stämmer med Osswald kap. 9 s. 8, 9. Ska kortet vara kvar om principen inte ingår i år (samma beslut som för polymer-begrepp-boltzmann-superposition)?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original, flag_note, flagged_at) values ('768d4012-2ca9-5754-a3ad-29a025ab1f3f', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-smalta-kryp-aterhamtning$kuggfri$, $kuggfri$En polymersmälta och en fast polymer belastas i var sitt krypprov (konstant spänning, linjärt viskoelastiskt område). Vad skiljer smältans töjningskurva från den fasta polymerens?$kuggfri$, $kuggfri$En polymersmälta domineras av den viskösa komponenten, eftersom kedjorna i smält tillstånd lätt glider förbi varandra: den beter sig vätskelikt (Maxwellmodellen), och efter den elastiska starten växer töjningen linjärt med lutningen $\sigma_0/\eta$. En fast polymer domineras av den elastiska komponenten, eftersom kedjorna hålls fast av andra kedjor: den beter sig fastlikt (Kelvin–Voigt), och töjningen går mot ett gränsvärde. Båda har en elastisk start, och i båda fallen går en del av töjningen snabbt tillbaka efter avlastning men inte hela; kedjor som har glidit förbi varandra stannar i sina nya lägen.$kuggfri$, null, 399, true, $kuggfri$ca9c60baa$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Smältans töjning fortsätter att växa linjärt med tiden, medan den fasta polymerens töjning närmar sig ett gränsvärde.","correct":true},{"text":"Smältan har ingen elastisk del, så ingenting av töjningen går tillbaka när lasten tas bort.","correct":false},{"text":"Den fasta polymerens töjning går alltid helt tillbaka när lasten tas bort, smältans inte.","correct":false},{"text":"Smältans töjning är konstant under hela belastningen, eftersom smältan är en vätska.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L6, s. 1, 4, 5; Canvas, 2025 MTT085 Fo20, s. 16, 17$kuggfri$, false, $kuggfri$Kortet säger, enligt L6 s. 1, 4, 5 och Fö20 2025 s. 16, 17, att en polymersmälta ger vätskelik respons där töjningen växer linjärt, medan svarsförslaget till tentan 2023-10-23 uppg. 9b pekar ut den fastlika kurvan för smältan. Förklaringen kallar dessutom den fasta polymerens svar Kelvin-Voigt med elastisk start och kvarstående töjning, men Kelvinmodellen har ingen ögonblicklig töjning och återhämtar sig helt (Osswald kap. 9 s. 11, 12). Vilket svar gäller, och ska modellnamnet tas bort?$kuggfri$, now());
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('c02ed3a6-ff83-592d-b5cc-fc23edd6eca7', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-dragkurvor-fyra-typer$kuggfri$, $kuggfri$Beskriv den typiska dragprovskurvan vid rumstemperatur för en amorf termoplast, en delkristallin termoplast, en härdplast och en elastomer.$kuggfri$, $kuggfri$* **Amorf termoplast** (Tg oftast över rumstemperatur, t.ex. PS och PMMA): styv och spröd. Kurvan är linjär och deformationen reversibel tills små mikrosprickor (krazer) bildas strax före brottet; då blir kurvan olinjär. Undantag: PC är mycket slagtålig trots att den är amorf.
* **Delkristallin termoplast** (mellan Tg och Tm, t.ex. PP och PE): linjärelastiskt område, sedan olinjärt med stress whitening, flytpunkt och spänningsfall, halsbildning och lång kalldragning; duktilt brott vid stor töjning.
* **Härdplast** (högt tvärbunden, t.ex. epoxi): hög styvhet och låg brottöjning, sprött brott.
* **Elastomer** (glest tvärbunden, används över sitt Tg): mycket låg styvhet och mycket hög brottöjning; klarar stora deformationer som går tillbaka.

Under sitt Tg går polymerer i regel till sprött brott i ett korttidsdragprov, även delkristallina.$kuggfri$, null, 400, true, $kuggfri$c946967a2$kuggfri$, $kuggfri$sjalvskattning$kuggfri$, null, null, $kuggfri$Canvas, MTT085 Polymeric materials L6, s. 7, 8, 9; Canvas, Lab-PM Polymer_MTT085-1, s. 2, 3; Canvas, MTT085-Turorials-Part12, s. 1, 3; Canvas, 2025 MTT085 Fo21, s. 7, 9, 10, 12, 13$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('e0815c80-9e1d-57f1-a588-135ced7fe005', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-dragkurva-kalldragning-typ$kuggfri$, $kuggfri$Vid rumstemperatur ger en polymer i dragprov en tydlig flytpunkt, därefter ett spänningsfall, halsbildning och en lång kalldragning till mycket stor töjning. Vilken typ av polymer är det troligen?$kuggfri$, $kuggfri$Duktilt brott med stress whitening, flytpunkt, halsbildning och kalldragning förekommer hos delkristallina polymerer mellan Tg och Tm; för delkristallina plaster ligger Tg oftast under rumstemperatur. En amorf termoplast under Tg och en härdplast går till sprött brott vid liten töjning. En elastomer har mycket låg styvhet och stor, reversibel töjning i stället för kalldragning.$kuggfri$, null, 401, true, $kuggfri$c1750de88$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"En delkristallin termoplast, t.ex. PP eller PE","correct":true},{"text":"En amorf termoplast under sitt Tg, t.ex. PS","correct":false},{"text":"En härdplast, t.ex. epoxi","correct":false},{"text":"En tvärbunden elastomer","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, MTT085 Polymeric materials L6, s. 7, 8, 9; Canvas, 2025 MTT085 Fo21, s. 10, 12, 13; Canvas, Lab-PM Polymer_MTT085-1, s. 2, 3$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('3fc11863-56b3-5f4f-98fd-f9974bec5085', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-krypmodul-ur-isokron-kurva$kuggfri$, $kuggfri$En plastdetalj belastas med konstant spänning 4 MPa i ett år. Den isokrona 1-årskurvan ger då töjningen 0,8 %. Vilken E-modul (krypmodul) ska användas i t.ex. en utböjningsberäkning?$kuggfri$, $kuggfri$Krypmodulen är $E_c = \sigma_0/\varepsilon(t) = 4\ \text{MPa}/0{,}008 = 500$ MPa $= 0{,}5$ GPa. Den gäller bara för den belastningstiden och temperaturen och sätts in i Hookes lag eller balkformeln i stället för korttidsmodulen. 5 GPa fås om 0,8 % räknas som 0,0008 och 50 GPa om töjningen räknas som 0,00008; 32 kPa fås om spänningen multipliceras med töjningen.$kuggfri$, null, 402, true, $kuggfri$cf2481143$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"0,5 GPa","correct":true},{"text":"5 GPa","correct":false},{"text":"50 GPa","correct":false},{"text":"32 kPa","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 2025 MTT085 Fo20, s. 15, 20; Canvas, 05142_09 (Osswald kap. 9), s. 37, 39$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('26b927ec-5838-5d9d-a163-c4b4a7cfb590', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-dimensionering-isokron-tvarsnitt$kuggfri$, $kuggfri$En plaststång ska bära dragkraften 600 N i ett år utan att töjningen överstiger 1 %. Den isokrona 1-årskurvan ger 12 MPa vid 1 % töjning. Vilken är den minsta tvärsnittsarean?$kuggfri$, $kuggfri$Metoden: välj den isokrona kurvan för produktens livslängd, läs av den tillåtna spänningen vid den tillåtna töjningen och räkna ut arean. Här är $A = F/\sigma = 600\ \text{N}/12\ \text{N/mm}^2 = 50$ mm². 5 och 500 mm² är tiopotensfel, och 7 200 mm² fås om man multiplicerar kraften med spänningen. En längre livslängd ger en lägre kurva och kräver större area.$kuggfri$, null, 403, true, $kuggfri$ce46f6dab$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"50 mm²","correct":true},{"text":"5 mm²","correct":false},{"text":"500 mm²","correct":false},{"text":"7 200 mm²","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 05142_09 (Osswald kap. 9), s. 39, 76; Canvas, 2021 MTT085 Ovningsuppgifter - Polymera material, s. 8; Canvas, MTT085 Polymeric materials L6, s. 7$kuggfri$, false);
insert into public.cards (id, deck_id, category_id, key, front, back, hint, sort_order, is_active, source_hash, kind, options, review_status, source, original) values ('d9c486f3-a45d-520f-871a-8ab7146b5dc5', '1fd9bb0d-b779-540f-bbbd-604e02cdaf6b', '93859c85-44c9-5113-879e-3dab2f92f3df', $kuggfri$polymer-presspassning-relaxation$kuggfri$, $kuggfri$En plaströrbit pressas på en metalldubb så att töjningen i röret hålls konstant. Hur ändras spänningen i röret, och därmed kraften som krävs för att dra isär delarna, med tiden?$kuggfri$, $kuggfri$En påtvingad konstant töjning är ett relaxationsfall. Man räknar ut töjningen (diameterändringen delad med diametern), följer den isometriska kurvan (konstant töjning) ur krypdata och läser av spänningen vid olika tider, t.ex. direkt efter monteringen och efter ett år. Ringspänningen ger trycket mot dubben, och kraften för att dra isär delarna är friktionen mot dubben, så den minskar när spänningen relaxerar. Konstant spänning med ökande töjning är i stället ett krypfall.$kuggfri$, null, 404, true, $kuggfri$c11b0947e$kuggfri$, $kuggfri$alternativ$kuggfri$, $kuggfri$[{"text":"Spänningen minskar med tiden (spänningsrelaxation), så kraften blir mindre; den läses av längs en isometrisk kurva vid den aktuella töjningen.","correct":true},{"text":"Spänningen ökar med tiden, eftersom materialet kryper.","correct":false},{"text":"Spänningen är konstant, eftersom töjningen är konstant.","correct":false},{"text":"Töjningen ökar medan spänningen är konstant.","correct":false}]$kuggfri$::jsonb, null, $kuggfri$Canvas, 05142_09 (Osswald kap. 9), s. 5, 39, 73, 75; Canvas, 2025 MTT085 Fo20, s. 18$kuggfri$, false);

commit;
