-- Inloggning med Google (28 sep): nya konton som skapas via Google får sitt visningsnamn från
-- Google-profilen (full_name/name i raw_user_meta_data), eftersom de inte fyller i
-- registreringsformuläret. Namnet kortas till 80 tecken som i formuläret.
-- Samma funktion som i 20260920000200_sakerhet.sql i övrigt.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      nullif(
        trim(
          coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
            nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
            nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
            ''
          )
        ),
        ''
      ),
      80
    )
  )
  on conflict (id) do nothing;

  perform public.link_examiner_invites(new.id, new.email, new.email_confirmed_at);
  return new;
end;
$$;

-- ÅNGRA: kör om handle_new_user från 20260920000200_sakerhet.sql.
