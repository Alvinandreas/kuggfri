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
