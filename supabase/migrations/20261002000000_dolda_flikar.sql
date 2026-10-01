-- Globala inställningar för tjänsten (Alvins beslut 2 okt 2026): först dolda flikar i sidomenyn.
--
-- En rad per inställning. Alla inloggade läser (sidomenyn behöver veta vad som är dolt), bara
-- global admin skriver. Utökande: en ny tabell, inget befintligt ändras.
--   key 'dolda_flikar': value = ["tentalaget", "designsystem", …] (nycklarna i lib/admin/sidebar-tabs.ts)

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.app_settings is 'Globala inställningar (t.ex. dolda flikar i sidomenyn). Läses av alla inloggade, skrivs av global admin.';

revoke all on public.app_settings from anon, authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;
alter table public.app_settings enable row level security;

create policy "app_settings: inloggade läser" on public.app_settings
  for select to authenticated
  using (true);

create policy "app_settings: admin skriver" on public.app_settings
  for insert to authenticated
  with check (public.is_admin());

create policy "app_settings: admin uppdaterar" on public.app_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "app_settings: admin tar bort" on public.app_settings
  for delete to authenticated
  using (public.is_admin());

-- ÅNGRA (se docs/ATERSTALLNING.md):
-- drop table if exists public.app_settings;
