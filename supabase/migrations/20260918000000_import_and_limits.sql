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
