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
