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
