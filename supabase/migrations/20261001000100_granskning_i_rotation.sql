-- Alla kort i rotation från början, och engelska för granskningen (Alvins beslut 1 okt 2026).
--
-- Examinatorerna granskar samtliga kort, också originalkorten. Korten är i rotation från början
-- och ett kort som inte håller tas ur rotation (status avvisad). Godkännandet är
-- granskningsdatumet: ett kort i rotation utan reviewed_at är ogranskat. Kursen öppnas för
-- studenterna först när inget kort är ogranskat. Studenternas läsregel (is_active och
-- review_status is null) ändras inte.
--
-- Utökande: två nya kolumner och en trigger. Inget befintligt värde skrivs om här; korten
-- sätts i rotation genom innehållsfilerna (status: utkast tas bort) och sync_deck.

-- ---------------------------------------------------------------------------
-- 1. Ändrat innehåll granskas igen
-- ---------------------------------------------------------------------------
-- Ändras frågan, svaret, ledtråden, typen eller alternativen utan att samma uppdatering sätter ett
-- nytt granskningsdatum (godkänner), nollställs datumet. Gäller innehållsverktyget (sync_deck),
-- kortredigeraren i admin och återställning ur historiken. "Återställ originalet" och "Spara och
-- godkänn" sätter datumet själva och behåller det.

create or replace function public.cards_review_reset()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (old.front, old.back, old.hint, old.kind, old.options)
       is distinct from (new.front, new.back, new.hint, new.kind, new.options)
     and new.reviewed_at is not distinct from old.reviewed_at then
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.cards_review_reset() from public, anon, authenticated;

create trigger cards_review_reset
  before update on public.cards
  for each row execute function public.cards_review_reset();

-- ---------------------------------------------------------------------------
-- 2. Engelska för granskningen
-- ---------------------------------------------------------------------------
-- Översättningen visas bara för den som slagit på reglaget English (admin och examinatorer; den
-- polymerexaminatorn läser inte svenska) och är aldrig det som godkänns: studenterna ser alltid
-- svenskan. sv är ett fingeravtryck av den svenska texten som översattes, så att granskningen kan
-- säga till när kortet ändrats efteråt.
--   translation_en: { "front": text, "back": text, "hint": text|null, "options": [text]|null, "sv": text }

alter table public.cards add column translation_en jsonb;
alter table public.categories add column title_en text;
alter table public.decks add column description_en text;

comment on column public.cards.translation_en is
  'Engelsk översättning för granskningen i admin (front, back, hint, options, sv = fingeravtryck av den svenska texten). Synkas med npm run kuggfri -- engelska.';
comment on column public.categories.title_en is 'Områdets namn på engelska (reglaget English).';
comment on column public.decks.description_en is 'Kursbeskrivningen på engelska (reglaget English).';

-- ÅNGRA (se docs/ATERSTALLNING.md):
-- drop trigger if exists cards_review_reset on public.cards;
-- drop function if exists public.cards_review_reset();
-- alter table public.cards drop column if exists translation_en;
-- alter table public.categories drop column if exists title_en;
-- alter table public.decks drop column if exists description_en;
