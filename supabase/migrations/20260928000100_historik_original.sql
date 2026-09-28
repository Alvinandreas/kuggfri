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
