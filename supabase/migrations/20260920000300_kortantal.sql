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
