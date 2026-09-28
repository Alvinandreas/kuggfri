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
