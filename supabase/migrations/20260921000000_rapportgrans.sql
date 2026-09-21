-- Rättar takgränsen för felrapporter.
--
-- 20260920000200 skrev `raise exception 'rate limited' using errcode = ..., message = ...`.
-- Textsträngen efter `raise exception` ÄR meddelandet, så `using message` sätter det en
-- andra gång och PostgreSQL svarar 42601 "RAISE option already specified: MESSAGE".
--
-- Skyddet fungerade ändå — undantaget avbryter insert:en — men felkoden blev fel och
-- meddelandet blev internt, så studenten fick "Något gick fel. Försök igen." och
-- uppmanades att försöka igen direkt, vilket bara misslyckades på nytt.

create or replace function public.card_reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    -- Gäster delar på ett gemensamt tak: vi kan inte skilja dem åt.
    select count(*) into n from public.card_reports
    where user_id is null and created_at > now() - interval '1 hour';
    if n >= 60 then
      raise exception using errcode = '53400', message = 'För många rapporter just nu. Försök igen om en stund.';
    end if;
  else
    select count(*) into n from public.card_reports
    where user_id = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 10 then
      raise exception using errcode = '53400', message = 'Du har skickat många rapporter den senaste timmen. Försök igen senare.';
    end if;
  end if;
  return new;
end;
$$;

-- ÅNGRA
-- Återställ den tidigare versionen ur 20260920000200_sakerhet.sql. Den blockerar också,
-- men med felkod 42601 och ett internt meddelande.
