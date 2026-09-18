-- Tentadatum per deck. Styr schemaläggningen för studenten: alla kort hinner förfalla minst en
-- gång före tentan, och nya kort doseras så att hela decket är sett i god tid.
-- Expanderande ändring: bara en nullable kolumn, gammal kod ignorerar den.

alter table public.decks add column exam_date date;

comment on column public.decks.exam_date is 'Kursens tentadatum (valfritt). Styr intervalltak och dosering av nya kort i schemalagd repetition.';

-- ÅNGRA (se docs/ATERSTALLNING.md)
-- alter table public.decks drop column if exists exam_date;
