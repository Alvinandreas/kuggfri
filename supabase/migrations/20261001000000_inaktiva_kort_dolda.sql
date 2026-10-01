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
