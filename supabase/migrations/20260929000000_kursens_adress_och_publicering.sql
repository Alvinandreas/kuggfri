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
