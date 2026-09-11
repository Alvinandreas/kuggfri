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
